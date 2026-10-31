// Fitur Ujian (UTS/UAS) di situs latihan: pintu masuk dari app.js.
//   kartuUjian(kuliah)                 -> kartu di halaman mata kuliah (daftar ujian, status per akun)
//   renderUjian(main, kuliah, ujianId, peserta) -> layar ujian; tahap ditentukan dari keadaan, bukan dari alamat
// Satu kali jalan: Mulai -> Tahap 1 -> Tahap 2 (otomatis) -> Hasil. Peserta tidak bisa melompat antar tahap.
// Diadaptasi dari prototype double-check-exam; logika murni di ./logic disalin utuh dan diuji tools/uji_ujian.
import { muatIndeks, pakaiUjian, examStage, simpanSekarang } from './data.js';
import * as store from './store.js';
import { initCodeTools, syncScrollLock } from './codetools.js';
import { html, show } from './ui.js';
import * as start from './screens/start.js';
import * as stage1 from './screens/stage1.js';
import * as stage2 from './screens/stage2.js';
import * as result from './screens/result.js';

const LAYAR = { belum: start, stage1, stage2, selesai: result };
const LABEL = { belum: 'Belum dimulai', stage1: 'Tahap 1 berjalan', stage2: 'Tahap 2 berjalan', selesai: 'Selesai' };

let cleanups = [];
const bersihkan = () => { cleanups.forEach((fn) => { try { fn(); } catch { /* abaikan */ } }); cleanups = []; };

// Dipanggil app.js setiap pindah halaman, supaya hitung mundur dan penjaga tempel tidak tertinggal.
export function tinggalkan() { bersihkan(); syncScrollLock(); }

// Status ujian akun ini tanpa memuat definisinya (dibaca langsung dari penyimpanan lokal).
function statusLokal(userId, mk, ujianId) {
  try {
    const d = (JSON.parse(localStorage.getItem(`ujian:${userId || 'lokal'}:${mk}:${ujianId}`)) || {}).demo || {};
    if (!d.exam) return 'belum';
    if (!d.stage1?.submitted) return 'stage1';
    const atts = d.stage2?.attempts || [];
    return !atts.length || atts.some((a) => !a.finishedAt) ? 'stage2' : 'selesai';
  } catch { return 'belum'; }
}

export function kartuUjian(kuliah, userId) {
  const el = document.createElement('section');
  el.className = 'card uj-kartu';
  el.hidden = true;
  muatIndeks(kuliah.id, kuliah.ujian === true).then((daftar) => {
    if (!daftar.length) return;
    show(el, html`<h2>Ujian</h2>
      <p class="muted">Ujian berjalan satu kali duduk: Tahap 1 (koding dan teori) lalu Tahap 2 (pertanyaan tentang kodemu sendiri), nilai keluar otomatis. Coba <strong>simulasi</strong> dulu supaya terbiasa dengan setiap tahap; soalnya lebih mudah dan nilainya tidak dihitung.</p>
      <div class="uj-daftar">${daftar.map((u) => {
        const st = statusLokal(userId, kuliah.id, u.id);
        return html`<a class="uj-item" href="#k/${kuliah.id}/ujian/${u.id}"><span><strong>${u.judul}</strong><br><span class="muted small">Bab ${u.babDari}–${u.babSampai}</span></span><span class="uj-lencana">${u.latihan ? html`<span class="badge info">Simulasi · boleh diulang</span>` : ''}<span class="badge ${st === 'selesai' ? 'ok' : st === 'belum' ? '' : 'warn'}">${LABEL[st]}</span></span></a>`;
      })}</div>`);
    el.hidden = false;
  });
  return el;
}

// peserta = { id, nama, nim, kelas, peran }
export async function renderUjian(main, kuliah, ujianId, peserta) {
  bersihkan();
  initCodeTools();
  const daftar = await muatIndeks(kuliah.id, kuliah.ujian === true);
  const meta = daftar.find((u) => u.id === ujianId);
  const root = document.createElement('div');
  root.className = 'uj';
  main.replaceChildren(root);
  if (!meta) {
    show(root, html`<section class="card"><h2>Ujian tidak ditemukan</h2><p>Ujian ini belum dibuka untuk mata kuliah ${kuliah.nama}.</p><a class="btn btn-primary" href="#k/${kuliah.id}">Kembali ke mata kuliah</a></section>`);
    return;
  }
  try {
    await pakaiUjian(kuliah.id, ujianId, peserta, meta);
  } catch (e) {
    const pesan = e.jenis === 'belum-siap'
      ? 'Fitur ujian belum disiapkan di server (migrasi 0010_ujian.sql belum dijalankan). Beri tahu pengajarmu.'
      : e.jenis === 'jaringan' ? 'Tidak bisa terhubung ke server. Periksa koneksi lalu muat ulang halaman.' : `${e.message}. Muat ulang halaman.`;
    show(root, html`<section class="card"><h2>Ujian belum bisa dibuka</h2><p>${pesan}</p><a class="btn btn-primary" href="#k/${kuliah.id}">Kembali ke mata kuliah</a></section>`);
    return;
  }
  let tahap = null;
  const ctx = {
    onLeave: (fn) => cleanups.push(fn),
    rerender: () => {
      bersihkan();
      const t = examStage();
      LAYAR[t].render(root, ctx);
      syncScrollLock();
      if (t !== tahap) {
        // Pindah tahap (terutama selesai): kirim segera, jangan menunggu jeda simpan otomatis.
        if (tahap !== null) simpanSekarang().catch(() => {});
        tahap = t;
        window.scrollTo(0, 0);
      }
    },
  };
  ctx.rerender();
}

// Tab "Ujian" di dashboard instruktur (jadwal, akomodasi, rekap nilai): lihat dosen.js.
export { renderTabDosen } from './dosen.js';

// Hanya untuk uji lokal (server_uji): menghapus keadaan ujian akun ini di browser.
export function hapusLokal() { store.reset(); }
