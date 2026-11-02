// Tab "Ujian" di dashboard instruktur: jadwal per kelas, akomodasi waktu, dan rekap nilai (migrasi 0010_ujian.sql).
// Semua perubahan langsung ke Supabase lewat aturan RLS (hanya instruktur yang boleh menulis jadwal dan akomodasi).
import * as server from './server.js';
import { muatIndeks } from './data.js';
import { toCsv, parseCsv } from './logic/csv.js';
import { salinan, isOpen, uraikanHasil, OPEN_LABEL } from './logic/open.js';
import { barisPantau, saringPantau, urutkanPantau, ringkasPantau, teksSisa, KUNCI_URUT, STATUS as STATUS_PANTAU } from './logic/pantau.js';
import { pilihanSaringan } from '../rekap.js';
import { buatDummy } from './dummy.js';
import { unduhPdfPeserta, unduhPdfSemua, unduhCsvAnalisis, unduhFormatHasil } from './ekspor.js';
import { html, show, $, $$, ask, download } from './ui.js';

const STATUS = { belum: 'Belum mulai', stage1: 'Tahap 1', stage2: 'Tahap 2', selesai: 'Selesai' };
const fmtWaktu = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
// <input type="datetime-local"> memakai waktu lokal tanpa zona: ubah dua arah dengan jam perangkat dosen.
const keInput = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const dariInput = (v) => new Date(v).toISOString();
const statusJadwal = (j) => { const t = Date.now(); return t < Date.parse(j.buka) ? ['warn', 'Terjadwal'] : t < Date.parse(j.tutup) ? ['ok', 'Buka'] : ['', 'Sudah tutup']; };

async function ambilJson(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

let pantauTimer = null;

export async function renderTabDosen({ main, kepala, kuliah }) {
  const isi = document.createElement('div');
  isi.className = 'uj-dosen';
  main.replaceChildren(kepala, isi);
  show(isi, html`<section class="card"><p class="muted">Memuat data ujian…</p></section>`);

  let daftar, cfgSitus, exams, soal;
  try {
    daftar = await muatIndeks(kuliah.id, kuliah.ujian === true);
    cfgSitus = await ambilJson('data/config.json').catch(() => ({ kelas: ['A', 'B', 'C', 'D'] }));
    exams = Object.fromEntries(await Promise.all(daftar.map(async (u) => [u.id, await ambilJson(`data/kuliah/${kuliah.id}/ujian/${u.id}/exam.json`).catch(() => null)])));
    soal = Object.fromEntries(await Promise.all(daftar.map(async (u) => {
      const dir = `data/kuliah/${kuliah.id}/ujian/${u.id}`;
      const [tasks, theory] = await Promise.all([ambilJson(`${dir}/tasks.json`).catch(() => ({ tasks: [] })), ambilJson(`${dir}/theory.json`).catch(() => ({ questions: [] }))]);
      const templates = await ambilJson(`${dir}/templates.json`).catch(() => null);
      const contoh = u.latihan ? await ambilJson(`${dir}/contoh.json`).catch(() => null) : null;
      return [u.id, { tasks: tasks.tasks, theory: theory.questions, templates, contoh }];
    })));
  } catch (e) {
    show(isi, html`<section class="card"><p class="verdict fail">${e.message}</p></section>`);
    return;
  }
  if (!daftar.length) {
    show(isi, html`<section class="card"><p class="muted">Belum ada ujian untuk mata kuliah ini.</p></section>`);
    return;
  }

  let data;
  // Peserta DUMMY (hanya simulasi, hanya di browser ini, tidak ke server): untuk melihat bentuk pantauan dan ekspor.
  const dummyAktif = new Set();
  const dummyAnalisis = {};
  const dummyDari = (uid) => {
    const ex = examLengkap(uid);
    const sl = soal[uid];
    if (!ex || !sl?.contoh || !sl.templates) return null;
    const d = buatDummy({ exam: ex, contoh: sl.contoh, templates: sl.templates, ujianId: uid, kuliahId: kuliah.id });
    d.sesi.forEach((s) => { if (dummyAnalisis[s.user_id]) s.analisis = dummyAnalisis[s.user_id]; else if (d.analisis[s.user_id]) s.analisis = d.analisis[s.user_id]; });
    return d;
  };
  const gabungDummy = () => {
    data.dummy = {};
    for (const uid of dummyAktif) {
      const d = dummyDari(uid);
      if (!d) continue;
      data.dummy[uid] = d;
      data.sesi = [...data.sesi, ...d.sesi];
      d.profil.forEach((p) => { data.profil[p.id] = p; });
    }
  };
  const muat = async () => {
    const [jadwal, akomodasi, sesi, profil] = await Promise.all([server.bacaJadwal(kuliah.id), server.bacaAkomodasi(kuliah.id), server.bacaSesi(kuliah.id), server.bacaProfil()]);
    data = { jadwal, akomodasi, sesi, profil: Object.fromEntries(profil.map((p) => [p.id, p])), profilList: profil, dummy: {} };
    gabungDummy();
    data.sesiPantau = data.sesi;
  };
  // Pantauan berkala memakai pembacaan ringan (tanpa jawaban lengkap).
  const muatPantau = async () => {
    const ringan = await server.bacaSesiRingan(kuliah.id);
    const dum = Object.values(data.dummy).flatMap((d) => d.sesi);
    data.sesiPantau = [...ringan, ...dum];
  };
  const pantau = {}; // keadaan penyaring dan urutan per ujian (bertahan saat tabel digambar ulang)
  const stp = (uid) => (pantau[uid] ||= { kunci: 'status', arah: 1, prodi: '', angkatan: '', rombel: '', status: '', cari: '', auto: true });
  try {
    await muat();
  } catch (e) {
    show(isi, html`<section class="card"><h2>Ujian belum siap di server</h2><p>${e.jenis === 'belum-siap' ? 'Tabel ujian belum ada. Jalankan supabase/migrations/0010_ujian.sql di Supabase SQL Editor, lalu kunci ujian (kunci/ujian_kunci.sql).' : e.message}</p></section>`);
    return;
  }

  // Definisi ujian lengkap (publik) untuk menyusun salinan jawaban; hanya ujian dengan Tahap 2 terbuka yang punya salinan Tahap 2.
  const examLengkap = (uid) => {
    const e = exams[uid];
    if (!e) return null;
    return { ...e, language: kuliah.bahasa || 'python', tasks: soal[uid].tasks.filter((t) => e.config.activeTasks.includes(t.id)), theory: soal[uid].theory };
  };
  const salinanSesi = (uid) => {
    const ex = examLengkap(uid);
    if (!ex || !isOpen(ex)) return [];
    return data.sesi.filter((s) => s.ujian_id === uid && s.keadaan?.demo?.stage1?.submitted).map((s) => {
      const p = data.profil[s.user_id] || {};
      return { ...salinan({ keadaan: s.keadaan, exam: ex, peserta: { id: s.user_id, nama: p.nama || '?', nim: p.nim || '', kelas: p.kelas || s.kelas || '' }, ujian: ex.title }), sesi: s };
    });
  };
  const KONS_BADGE = { konsisten: ['ok', 'konsisten'], sebagian: ['warn', 'sebagian'], tidak_konsisten: ['bad', 'tidak konsisten'], tidak_jelas: ['', 'tidak jelas'] };
  const panelJawaban = (uid) => {
    const daftarS = salinanSesi(uid);
    if (!daftarS.length) return '';
    return html`<h3>Jawaban Tahap 2 dan pembandingnya <span class="muted small">(${daftarS.length} peserta)</span></h3>
      <p class="small muted">Tahap 2 berupa pertanyaan terbuka dan tidak dinilai otomatis. Unduh CSV, berikan ke AI bersama prompt-mu, lalu unggah hasilnya di sini; hasil analisis tersimpan di server dan muncul di bawah tiap jawaban.</p>
      <div class="row uj-aksi">
        <button class="btn btn-sm" type="button" data-unduh-analisis>Unduh CSV untuk analisis</button>
        <button class="btn btn-sm" type="button" data-unduh-format>Unduh format hasil analisis</button>
        <label class="btn btn-sm">Unggah hasil analisis (CSV)<input type="file" accept=".csv,text/csv" data-unggah-hasil hidden></label>
        <button class="btn btn-sm" type="button" data-pdf-semua>Unduh PDF semua jawaban</button>
      </div>
      <div class="stack" style="margin-top:8px">${daftarS.map((s) => {
        const rows = (s.sesi.analisis || {}).rows || {};
        return html`<details class="card" style="margin:0" data-peserta="${s.peserta.id}"><summary><strong>${s.peserta.nama}</strong> <span class="muted small">${s.peserta.nim} · ${s.peserta.kelas}</span> ${s.s2.length ? html`<span class="badge">${s.s2.filter((x) => !x.kosong).length}/${s.s2.length} terjawab</span>` : html`<span class="badge warn">belum Tahap 2</span>`}${s.sesi.selesai_pada ? html` <span class="badge ok">dikunci</span>` : ''}${s.keluar ? html` <span class="badge ${s.keluar > 3 ? 'warn' : ''}">keluar tab ${s.keluar}× (${s.keluarDetik} dtk)</span>` : ''}${s.tempelS1 ? html` <span class="badge warn">tempel diblokir ${s.tempelS1}×</span>` : ''}${Object.keys(rows).length ? html` <span class="badge info">dianalisis</span>` : ''}</summary>
          <div class="stack" style="margin-top:8px">${s.s2.map((x) => { const a = rows[x.id]; const [kc, kl] = KONS_BADGE[a?.konsistensi] || ['', '']; return html`<div class="card" style="margin:0">
            <div><span class="badge info">${OPEN_LABEL[x.jenis] || x.jenis}</span> <strong>${x.pertanyaan}</strong></div>
            <div class="small muted" style="margin-top:6px">Jawaban Tahap 2 · ${x.kata} kata · ${x.detik === '' ? '–' : x.detik + ' dtk'}${x.tempel ? ` · tempel ${x.tempel}×` : ''}</div>
            <div class="quote">${x.jawaban || '(tidak dijawab)'}</div>
            ${x.jawabanS1 ? html`<div class="small muted">Jawaban teori Tahap 1</div><div class="quote">${x.jawabanS1}</div>` : ''}
            ${x.kodeS1 ? html`<details><summary class="small">Kode Tahap 1 ${x.tesS1 ? `(tes lulus ${x.tesS1})` : ''}${x.konteks ? ` · ${x.konteks}` : ''}</summary><pre class="block">${x.kodeS1}</pre></details>` : ''}
            ${a ? html`<div class="callout ${kc === 'bad' ? 'warn' : 'ok'}" style="margin-top:8px"><strong>Analisis:</strong> ${kl ? html`<span class="badge ${kc}">${kl}</span>` : ''}${a.skor !== null && a.skor !== undefined ? html` skor ${a.skor}` : ''}${a.catatan ? html` · ${a.catatan}` : ''}</div>` : ''}
          </div>`; })}</div>
          <div class="row" style="margin-top:8px"><button class="btn btn-sm" type="button" data-pdf-peserta="${s.peserta.id}">Unduh PDF peserta ini</button></div>
        </details>`;
      })}</div>`;
  };

  const rosterUntuk = (uid) => {
    // Semua peserta, ditambah akun dosen yang punya sesi (mis. sedang mencoba ujian) supaya namanya tampil.
    const adaSesi = new Set((data.sesiPantau || data.sesi).filter((s) => s.ujian_id === uid).map((s) => s.user_id));
    const nyata = data.profilList.filter((p) => p.peran !== 'instruktur' || adaSesi.has(p.id));
    return [...nyata, ...(data.dummy[uid]?.profil || [])];
  };
  const barisUntuk = (uid) => barisPantau(rosterUntuk(uid), (data.sesiPantau || data.sesi).filter((s) => s.ujian_id === uid), Date.now());
  const panelPantau = (u) => {
    const st = stp(u.id);
    const semua = barisUntuk(u.id);
    const pil = pilihanSaringan(semua);
    const menu = (nama, label, opsi) => html`<select data-pf="${nama}" aria-label="${label}"><option value="">${label}: semua</option>${opsi.map((o) => html`<option value="${o}" ${String(st[nama]) === String(o) ? 'selected' : ''}>${o}</option>`)}</select>`;
    return html`<h3>Pantau peserta <span class="muted small" data-pantau-ringkas></span></h3>
      <p class="small muted">Siapa yang sudah masuk, di tahap mana, dan siapa yang belum. Daftar peserta dari data profil; peserta tanpa sesi berarti belum masuk. Disegarkan otomatis tiap 20 detik.</p>
      <div class="filters" style="flex-wrap:wrap;gap:6px">
        ${menu('prodi', 'Prodi', pil.prodi)}${menu('angkatan', 'Angkatan', pil.angkatan)}${menu('rombel', 'Kelas', pil.rombel)}
        <select data-pf="status" aria-label="Status"><option value="">Status: semua</option>${Object.entries(STATUS_PANTAU).map(([k, l]) => html`<option value="${k}" ${st.status === k ? 'selected' : ''}>${l}</option>`)}</select>
        <select data-pf="kunci" aria-label="Urutkan">${Object.entries(KUNCI_URUT).map(([k, l]) => html`<option value="${k}" ${st.kunci === k ? 'selected' : ''}>Urutkan: ${l}</option>`)}</select>
        <button class="btn btn-sm" type="button" data-pf-arah>${st.arah === 1 ? '↑ naik' : '↓ turun'}</button>
        <input type="search" data-pf="cari" placeholder="Cari nama atau NIM" value="${st.cari}" aria-label="Cari nama atau NIM">
      </div>
      <div class="row" style="margin:6px 0;gap:8px;flex-wrap:wrap">
        <label class="small"><input type="checkbox" data-pf-auto ${st.auto ? 'checked' : ''}> Segarkan otomatis</label>
        <button class="btn btn-sm" type="button" data-pf-segar>Segarkan sekarang</button>
        ${u.latihan ? html`<button class="btn btn-sm btn-ghost" type="button" data-dummy>${dummyAktif.has(u.id) ? 'Sembunyikan peserta dummy' : 'Tampilkan peserta dummy (contoh hasil)'}</button>` : ''}
        <span class="small muted" data-pf-waktu></span>
      </div>
      ${dummyAktif.has(u.id) ? html`<div class="callout warn small"><strong>Mode contoh.</strong> Peserta berlabel DUMMY dibuat di browser ini dari contoh jawaban simulasi, tidak tersimpan di server, dan ikut muncul di CSV/PDF/analisis di bawah supaya Bapak melihat bentuk hasilnya. Mulai dari nol: sembunyikan peserta dummy.</div>` : ''}
      <div data-pantau-tabel></div>`;
  };
  const isiPantau = (sec) => {
    const uid = sec.dataset.ujian;
    const st = stp(uid);
    const semua = barisUntuk(uid);
    const terpilih = urutkanPantau(saringPantau(semua, st), st.kunci, st.arah);
    const r = ringkasPantau(semua);
    const kecil = (iso) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '–');
    const lencana = { belum: ['', 'Belum masuk'], tahap1: ['warn', 'Tahap 1'], tahap2: ['info', 'Tahap 2'], selesai: ['ok', 'Selesai'] };
    show($('[data-pantau-ringkas]', sec), html`· ${r.masuk} dari ${r.total} sudah masuk · belum ${r.belum} · Tahap 1 ${r.tahap1}${r.lewat ? html` (${r.lewat} lewat batas)` : ''} · Tahap 2 ${r.tahap2} · selesai ${r.selesai}`);
    show($('[data-pantau-tabel]', sec), r.total ? html`<div class="tablewrap"><table><thead><tr><th>Nama</th><th>NIM</th><th>Angkatan</th><th>Kelas</th><th>Status</th><th>Mulai</th><th>Sisa Tahap 1</th><th>Selesai</th><th>Keluar tab</th><th>Tempel</th></tr></thead><tbody>
      ${terpilih.map((b) => { const [c, l] = lencana[b.status]; return html`<tr><td>${b.nama}${b.dummy ? html` <span class="badge info">DUMMY</span>` : ''}</td><td>${b.nim}</td><td>${b.angkatan ?? ''}</td><td>${b.rombel || b.kelas}</td><td><span class="badge ${c}">${l}</span>${b.lewat ? html` <span class="badge bad">lewat batas</span>` : ''}${b.terlambat ? html` <span class="badge warn">terlambat</span>` : ''}${b.dianalisis ? html` <span class="badge info">dianalisis</span>` : ''}</td><td>${kecil(b.mulai)}</td><td>${b.status === 'tahap1' ? teksSisa(b.sisaDetik) : ''}</td><td>${kecil(b.selesai)}</td><td>${b.keluar ? html`<span class="${b.keluar > 3 ? 'badge warn' : ''}">${b.keluar}× (${b.keluarDetik} dtk)</span>` : '–'}</td><td>${b.tempel || '–'}</td></tr>`; })}
      </tbody></table></div>${terpilih.length ? '' : html`<p class="small muted">Tidak ada peserta yang cocok dengan saringan.</p>`}` : html`<p class="small muted">Belum ada data peserta di profil.</p>`);
    const w = $('[data-pf-waktu]', sec);
    if (w) w.textContent = `Diperbarui ${new Date().toLocaleTimeString('id-ID')}`;
  };
  const isiPantauSemua = () => $$('[data-ujian]', isi).forEach(isiPantau);
  const pasangPantau = (sec) => {
    const uid = sec.dataset.ujian;
    const st = stp(uid);
    $$('[data-pf]', sec).forEach((el) => el.addEventListener(el.type === 'search' ? 'input' : 'change', () => { st[el.dataset.pf] = el.value; isiPantau(sec); }));
    $('[data-pf-arah]', sec)?.addEventListener('click', (e) => { st.arah = -st.arah; e.currentTarget.textContent = st.arah === 1 ? '↑ naik' : '↓ turun'; isiPantau(sec); });
    $('[data-pf-auto]', sec)?.addEventListener('change', (e) => { st.auto = e.currentTarget.checked; });
    $('[data-pf-segar]', sec)?.addEventListener('click', () => segarkanPantau());
    $('[data-dummy]', sec)?.addEventListener('click', async () => { if (dummyAktif.has(uid)) dummyAktif.delete(uid); else dummyAktif.add(uid); await muat(); gambar(); });
    isiPantau(sec);
  };
  let sibukPantau = false;
  async function segarkanPantau() {
    if (sibukPantau) return;
    sibukPantau = true;
    try { await muatPantau(); isiPantauSemua(); } catch { /* gagal sementara: coba lagi pada putaran berikutnya */ } finally { sibukPantau = false; }
  }

  const kelasPilihan = [['*', 'Semua kelas'], ...(cfgSitus.kelas || []).map((k) => [k, `Kelas ${k}`])];

  const kartu = (u) => {
    const ex = exams[u.id];
    const menitBawaan = ex?.config?.tahap1Minutes || 60;
    const jd = data.jadwal.filter((j) => j.ujian_id === u.id).sort((a, b) => (a.kelas === '*' ? -1 : b.kelas === '*' ? 1 : a.kelas.localeCompare(b.kelas)));
    const ak = data.akomodasi.filter((a) => a.ujian_id === u.id);
    const ss = data.sesi.filter((s) => s.ujian_id === u.id).map((s) => ({ ...s, p: data.profil[s.user_id] || {} })).sort((a, b) => (a.p.kelas || '').localeCompare(b.p.kelas || '') || (a.p.nama || '').localeCompare(b.p.nama || ''));
    const sekarang = new Date();
    const nanti = new Date(sekarang.getTime() + 2 * 3600 * 1000);
    return html`
    <section class="card" data-ujian="${u.id}">
      <div class="task-head"><h2>${u.judul} <span class="muted small">Bab ${u.babDari}–${u.babSampai}</span></h2>${u.latihan ? html`<span class="badge info">Simulasi</span>` : ''}</div>
      <p class="small muted">Tahap 1 bawaan ${menitBawaan} menit. Peserta hanya bisa mulai saat jadwal kelasnya buka; jadwal kelas tertentu didahulukan dari "Semua kelas".</p>

      <h3>Jadwal</h3>
      ${jd.length ? html`<div class="tablewrap"><table><thead><tr><th>Kelas</th><th>Buka</th><th>Tutup</th><th>Durasi Tahap 1</th><th>Boleh diulang</th><th>Status</th><th></th></tr></thead><tbody>
        ${jd.map((j) => { const [c, t] = statusJadwal(j); return html`<tr><td>${j.kelas === '*' ? 'Semua kelas' : j.kelas}</td><td>${fmtWaktu(j.buka)}</td><td>${fmtWaktu(j.tutup)}</td><td>${j.menit || menitBawaan} menit</td><td>${j.boleh_ulang ? 'Ya' : 'Tidak'}</td><td><span class="badge ${c}">${t}</span></td>
          <td class="uj-aksi"><button class="btn btn-sm" type="button" data-ubah-jadwal="${j.kelas}">Ubah</button><button class="btn btn-sm btn-ghost" type="button" data-tutup-jadwal="${j.kelas}">Tutup sekarang</button><button class="btn btn-sm btn-ghost" type="button" data-hapus-jadwal="${j.kelas}">Hapus</button></td></tr>`; })}
      </tbody></table></div>` : html`<p class="callout warn">Belum ada jadwal: peserta belum bisa memulai ujian ini.</p>`}
      <form class="uj-form" data-form-jadwal>
        <label class="field"><span>Kelas</span><select name="kelas">${kelasPilihan.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select></label>
        <label class="field"><span>Buka</span><input type="datetime-local" name="buka" value="${keInput(sekarang.toISOString())}" required></label>
        <label class="field"><span>Tutup</span><input type="datetime-local" name="tutup" value="${keInput(nanti.toISOString())}" required></label>
        <label class="field"><span>Durasi Tahap 1 (menit)</span><input type="number" name="menit" min="5" max="600" placeholder="${menitBawaan}"></label>
        <label class="field uj-cek"><input type="checkbox" name="boleh_ulang" ${u.latihan ? 'checked' : ''}> <span>Peserta boleh mengulang</span></label>
        <div class="field"><button class="btn btn-primary" type="submit">Simpan jadwal</button></div>
      </form>
      <p class="small muted">Menyimpan jadwal untuk kelas yang sudah punya jadwal akan menggantinya. "Tutup" adalah batas untuk MEMULAI; peserta yang sudah mulai tetap menyelesaikan waktunya.</p>

      <h3>Akomodasi waktu</h3>
      ${ak.length ? html`<ul class="uj-ak">${ak.map((a) => { const p = data.profil[a.user_id] || {}; return html`<li>${p.nama || a.user_id} <span class="muted small">${p.nim || ''} · ${p.kelas || ''}</span> · waktu ×${Number(a.faktor)} <button class="btn btn-sm btn-ghost" type="button" data-hapus-ak="${a.user_id}">Hapus</button></li>`; })}</ul>` : html`<p class="small muted">Belum ada. Akomodasi mengalikan durasi Tahap 1 untuk peserta tertentu, dan berlaku saat peserta itu menekan Mulai.</p>`}
      <form class="uj-form" data-form-ak>
        <label class="field"><span>NIM</span><input type="text" name="nim" required autocomplete="off"></label>
        <label class="field"><span>Faktor waktu</span><select name="faktor"><option value="1.25">×1,25</option><option value="1.5" selected>×1,5</option><option value="2">×2</option></select></label>
        <div class="field"><button class="btn" type="submit">Tambah akomodasi</button></div>
      </form>

      ${panelPantau(u)}

      <h3>Peserta dan nilai <span class="muted small">(${ss.length} sesi)</span></h3>
      ${ss.length ? html`<div class="tablewrap"><table><thead><tr><th>Nama</th><th>NIM</th><th>Kelas</th><th>Status</th><th>Mulai</th><th>Terkunci</th><th>S1</th><th>S2</th><th>Nilai</th><th>Keterangan</th><th>Keluar tab</th><th></th></tr></thead><tbody>
        ${ss.map((s) => { const h = s.hasil || {}; return html`<tr><td>${s.p.nama || '?'}</td><td>${s.p.nim || ''}</td><td>${s.p.kelas || s.kelas || ''}</td><td>${STATUS[h.tahap] || (s.terkunci_pada ? 'Tahap 2' : 'Tahap 1')}</td><td>${fmtWaktu(s.mulai_pada)}${Number(s.faktor) > 1 ? html` <span class="badge info">×${Number(s.faktor)}</span>` : ''}</td><td>${fmtWaktu(s.terkunci_pada)}${s.terlambat ? html` <span class="badge warn">terlambat</span>` : ''}</td><td>${h.s1 ?? '–'}</td><td>${h.s2 ?? '–'}</td><td><strong>${h.nilai ?? '–'}</strong></td><td>${h.keterangan || ''}${h.flag ? html` <span class="badge warn">ditinjau</span>` : ''}</td><td>${h.keluar ? `${h.keluar}× (${h.keluarDetik} dtk)` : '–'}</td>
          <td><button class="btn btn-sm btn-ghost" type="button" data-hapus-sesi="${s.user_id}">Izinkan mengulang</button></td></tr>`; })}
      </tbody></table></div>
      <div class="row" style="margin-top:8px"><button class="btn btn-sm" type="button" data-csv>Unduh CSV</button></div>` : html`<p class="small muted">Belum ada peserta yang memulai.</p>`}
      ${panelJawaban(u.id)}
      <div data-pesan></div>
    </section>`;
  };

  const gambar = () => {
    show(isi, html`
      <section class="card"><h2>Ujian</h2><p class="muted">Atur kapan tiap kelas boleh memulai, waktu tambahan untuk peserta tertentu, dan lihat nilai otomatis. Nilai dihitung di perangkat peserta (rumus diumumkan di halaman hasil) dan dikirim ke sini.</p>
        <div class="row"><button class="btn btn-sm" type="button" data-muat-ulang>Muat ulang</button></div></section>
      ${daftar.map(kartu)}`);
    pasang();
  };

  const jalankan = async (el, fn) => {
    const pesan = $('[data-pesan]', el.closest('[data-ujian]')) || null;
    try {
      await fn();
      await muat();
      gambar();
    } catch (e) {
      if (pesan) show(pesan, html`<p class="callout bad" role="alert">${e.message}</p>`);
      else alert(e.message);
    }
  };

  async function galatPdf(sec, tombol, fn) {
    tombol.disabled = true;
    try { await fn(); } catch (e) { show($('[data-pesan]', sec), html`<p class="callout bad" role="alert">${e.message}</p>`); }
    tombol.disabled = false;
  }

  function pasang() {
    $('[data-muat-ulang]', isi)?.addEventListener('click', (e) => jalankan(e.currentTarget, async () => {}));
    for (const sec of $$('[data-ujian]', isi)) {
      const uid = sec.dataset.ujian;
      const u = daftar.find((x) => x.id === uid);
      pasangPantau(sec);
      $('[data-form-jadwal]', sec).addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const buka = f.get('buka'), tutup = f.get('tutup');
        if (!buka || !tutup || Date.parse(tutup) <= Date.parse(buka)) { show($('[data-pesan]', sec), html`<p class="callout bad">Waktu tutup harus setelah waktu buka.</p>`); return; }
        const menit = f.get('menit') ? Number(f.get('menit')) : null;
        jalankan(sec, () => server.simpanJadwal({ matakuliah_id: kuliah.id, ujian_id: uid, kelas: f.get('kelas'), buka: dariInput(buka), tutup: dariInput(tutup), menit, boleh_ulang: f.get('boleh_ulang') === 'on' }));
      });
      $$('[data-ubah-jadwal]', sec).forEach((b) => b.addEventListener('click', () => {
        const j = data.jadwal.find((x) => x.ujian_id === uid && x.kelas === b.dataset.ubahJadwal);
        const f = $('[data-form-jadwal]', sec);
        f.kelas.value = j.kelas;
        f.buka.value = keInput(j.buka);
        f.tutup.value = keInput(j.tutup);
        f.menit.value = j.menit || '';
        f.boleh_ulang.checked = !!j.boleh_ulang;
        f.scrollIntoView({ block: 'center' });
      }));
      $$('[data-tutup-jadwal]', sec).forEach((b) => b.addEventListener('click', async () => {
        const j = data.jadwal.find((x) => x.ujian_id === uid && x.kelas === b.dataset.tutupJadwal);
        if (!(await ask(`Tutup ${u.judul} untuk ${j.kelas === '*' ? 'semua kelas' : 'kelas ' + j.kelas} sekarang? Peserta yang sudah mulai tetap bisa menyelesaikan.`, 'Tutup'))) return;
        const t = Date.now();
        jalankan(sec, () => server.simpanJadwal({ ...j, buka: new Date(Math.min(Date.parse(j.buka), t - 60000)).toISOString(), tutup: new Date(t).toISOString(), diperbarui_pada: undefined }));
      }));
      $$('[data-hapus-jadwal]', sec).forEach((b) => b.addEventListener('click', async () => {
        if (!(await ask('Hapus jadwal ini?', 'Hapus'))) return;
        jalankan(sec, () => server.hapusJadwal(kuliah.id, uid, b.dataset.hapusJadwal));
      }));
      $('[data-form-ak]', sec).addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const nim = String(f.get('nim')).trim();
        const p = data.profilList.find((x) => x.nim === nim);
        if (!p) { show($('[data-pesan]', sec), html`<p class="callout bad">NIM ${nim} tidak ditemukan di daftar peserta.</p>`); return; }
        jalankan(sec, () => server.simpanAkomodasi({ matakuliah_id: kuliah.id, ujian_id: uid, user_id: p.id, faktor: Number(f.get('faktor')) }));
      });
      $$('[data-hapus-ak]', sec).forEach((b) => b.addEventListener('click', () => jalankan(sec, () => server.hapusAkomodasi(kuliah.id, uid, b.dataset.hapusAk))));
      $$('[data-hapus-sesi]', sec).forEach((b) => b.addEventListener('click', async () => {
        const p = data.profil[b.dataset.hapusSesi] || {};
        if (!(await ask(`Hapus sesi ${p.nama || 'peserta ini'} untuk ${u.judul}? Jawaban dan nilainya hilang, dan ia bisa mulai lagi selama jadwal kelasnya buka.`, 'Hapus dan izinkan'))) return;
        if (String(b.dataset.hapusSesi).startsWith('dummy-')) { show($('[data-pesan]', sec), html`<p class="callout ok">Itu peserta dummy; sembunyikan lewat tombol di bagian Pantau peserta.</p>`); return; }
        jalankan(sec, () => server.hapusSesi(kuliah.id, uid, b.dataset.hapusSesi));
      }));
      const namaBerkas = (x) => `${x}-${kuliah.id}-${uid}`;
      const dosen = () => salinanSesi(uid);
      $('[data-unduh-analisis]', sec)?.addEventListener('click', () => unduhCsvAnalisis(dosen(), namaBerkas('jawaban-s2')));
      $('[data-unduh-format]', sec)?.addEventListener('click', () => unduhFormatHasil(dosen(), namaBerkas('format-hasil-analisis')));
      $('[data-pdf-semua]', sec)?.addEventListener('click', (e) => galatPdf(sec, e.currentTarget, () => unduhPdfSemua(dosen(), u.judul)));
      $$('[data-pdf-peserta]', sec).forEach((b) => b.addEventListener('click', () => galatPdf(sec, b, () => unduhPdfPeserta(dosen().find((s) => s.peserta.id === b.dataset.pdfPeserta)))));
      $('[data-unggah-hasil]', sec)?.addEventListener('change', async (e) => {
        const berkas = e.target.files[0];
        e.target.value = '';
        if (!berkas) return;
        const pesan = $('[data-pesan]', sec);
        const { rows, galat } = uraikanHasil(await berkas.text(), parseCsv);
        if (!rows.length) { show(pesan, html`<p class="callout bad" role="alert">${galat.join(' ') || 'Tidak ada baris hasil.'}</p>`); return; }
        // Hanya baris yang cocok dengan butir peserta di ujian ini yang diterima.
        const peta = new Map(dosen().map((s) => [s.peserta.id, s]));
        const baru = new Map();
        let dipakai = 0;
        for (const r of rows) {
          const s = peta.get(r.peserta_id);
          if (!s || !s.s2.some((x) => x.id === r.id_baris)) { galat.push(`id_baris ${r.id_baris}: tidak cocok dengan peserta di ujian ini, dilewati.`); continue; }
          if (!baru.has(r.peserta_id)) baru.set(r.peserta_id, { ...((s.sesi.analisis || {}).rows || {}) });
          baru.get(r.peserta_id)[r.id_baris] = { konsistensi: r.konsistensi, skor: r.skor, catatan: r.catatan };
          dipakai += 1;
        }
        if (!dipakai) { show(pesan, html`<p class="callout bad" role="alert">Tidak ada baris yang cocok dengan ujian ini. ${galat.slice(0, 3).join(' ')}</p>`); return; }
        try {
          for (const [id, rowsBaru] of baru) if (String(id).startsWith('dummy-')) dummyAnalisis[id] = { rows: rowsBaru, diimpor: new Date().toISOString() }; else await server.simpanAnalisis(kuliah.id, uid, id, { rows: rowsBaru, diimpor: new Date().toISOString() });
        } catch (err) {
          show(pesan, html`<p class="callout bad" role="alert">${err.jenis === 'belum-siap' ? 'Fungsi penyimpan analisis belum ada di server: jalankan supabase/migrations/0011_ujian_selesai.sql.' : err.message}</p>`);
          return;
        }
        await muat();
        gambar();
        show($('[data-pesan]', isi.querySelector(`[data-ujian="${uid}"]`)), html`<p class="callout ok" role="status">${dipakai} baris analisis tersimpan untuk ${baru.size} peserta.${galat.length ? ` ${galat.length} baris dilewati: ${galat.slice(0, 3).join(' ')}` : ''}</p>`);
      });
      $('[data-csv]', sec)?.addEventListener('click', () => {
        const rows = data.sesi.filter((s) => s.ujian_id === uid).map((s) => ({ ...s, p: data.profil[s.user_id] || {}, h: s.hasil || {} }));
        const csv = toCsv(rows, [
          { label: 'nama', get: (r) => r.p.nama }, { label: 'nim', get: (r) => r.p.nim }, { label: 'kelas', get: (r) => r.p.kelas || r.kelas },
          { label: 'status', get: (r) => STATUS[r.h.tahap] || '' }, { label: 'mulai', get: (r) => r.mulai_pada }, { label: 'terkunci', get: (r) => r.terkunci_pada },
          { label: 'terlambat', get: (r) => (r.terlambat ? 'ya' : '') }, { label: 'faktor_waktu', get: (r) => Number(r.faktor) },
          { label: 's1', get: (r) => r.h.s1 }, { label: 's2', get: (r) => r.h.s2 }, { label: 'nilai', get: (r) => r.h.nilai },
          { label: 'butir_benar', get: (r) => r.h.benar }, { label: 'butir', get: (r) => r.h.butir }, { label: 'percobaan_tahap2', get: (r) => r.h.percobaan },
          { label: 'keterangan', get: (r) => r.h.keterangan }, { label: 'keluar_tab_kali', get: (r) => r.h.keluar }, { label: 'keluar_tab_detik', get: (r) => r.h.keluarDetik }, { label: 'perlu_ditinjau', get: (r) => (r.h.flag ? 'ya' : '') },
        ]);
        download(`nilai-${kuliah.id}-${uid}.csv`, csv, 'text/csv');
      });
    }
  }

  gambar();
  // Segarkan pantauan tiap 20 detik selama tab ini masih tampil dan penyegaran otomatis menyala.
  clearInterval(pantauTimer);
  pantauTimer = setInterval(() => {
    if (!document.contains(isi)) { clearInterval(pantauTimer); return; }
    if (Object.values(pantau).some((p) => p.auto) || !Object.keys(pantau).length) segarkanPantau();
  }, 20000);
}
