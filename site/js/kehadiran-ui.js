// Tab "Kehadiran" di dashboard instruktur: jadwal per kelas, kesiapan sebelum kelas, rekap per pertemuan, matriks kehadiran,
// aktivitas per hari dan per minggu, serta skor keaktifan. Perhitungannya ada di kehadiran.js (diuji terpisah).
// Absensi resmi tetap SIAKAD; tab ini menambahkan dua hal yang tidak dimilikinya: apakah peserta sudah menyiapkan diri sebelum
// kelas, dan seberapa aktif ia belajar. Semua data hanya terbaca oleh akun instruktur (aturan keamanan di database).
import { h } from "./dom.js";
import * as Auth from "./auth.js";
import { ambilSemua } from "./rekap.js";
import * as K from "./kehadiran.js";

let cache = null; // { cid, jadwal, koreksi, sesi, percobaan, laporan, riwayat }
const ui = { gen: null, sub: "s", kf: "", kj: "", n: null, gran: "h", bentuk: "d", hari: null, mgg: null, buka: "", edit: null, konf: null, pesan: "", idPeserta: "" };

export function reset() {
  cache = null;
  ui.edit = null;
  ui.konf = null;
}

// Di server uji, ?sekarang=2026-10-06T01:47:00Z menggeser jam "sekarang" supaya data contoh bisa dicoba pada waktu tertentu.
function sekarang() {
  if (typeof window !== "undefined" && window.__fake) {
    const q = new URLSearchParams(location.search).get("sekarang");
    const t = q ? Date.parse(q) : NaN;
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

const pil = (teks, jenis = "t") => h("span", { class: "kh-pil " + jenis }, teks);
const kartu = (...isi) => h("section", { class: "card" }, ...isi);
const info = (teks) => h("p", { class: "kh-info" }, teks);
const kecil = (teks) => h("small", { class: "kh-kecil" }, teks);
const tombol = (teks, aksi, kelas = "btn btn-sm") => h("button", { type: "button", class: kelas, onclick: aksi }, teks);

function pesanGalat(e) {
  const kode = String((e && e.code) || "");
  const msg = String((e && e.message) || "");
  if (kode === "42P01" || kode === "PGRST205" || /does not exist|schema cache|could not find the table/i.test(msg)) {
    return "Fitur kehadiran belum dipasang di database. Jalankan berkas supabase/migrations/0006_kehadiran.sql di Supabase SQL Editor, lalu tekan Muat ulang. Tab lain tidak terpengaruh.";
  }
  return Auth.friendly(e);
}

async function muat(cid) {
  const c = Auth.getClient();
  try {
    const [jadwal, koreksi, sesi, percobaan, laporan, riwayat] = await Promise.all([
      ambilSemua(() => c.from("jadwal_kelas").select("*").eq("matakuliah_id", cid).order("kelas").order("pertemuan")),
      ambilSemua(() => c.from("koreksi_kehadiran").select("*").eq("matakuliah_id", cid).order("user_id")),
      ambilSemua(() => c.from("sesi_belajar").select("*").eq("matakuliah_id", cid).order("id")),
      ambilSemua(() => c.from("percobaan").select("user_id,bab,jenis,lulus,dibuat_pada,diterima_pada").eq("matakuliah_id", cid).order("id")),
      ambilSemua(() => c.from("laporan").select("user_id,bab").eq("matakuliah_id", cid).order("user_id")),
      ambilSemua(() => c.from("jadwal_riwayat").select("*").eq("matakuliah_id", cid).order("id")),
    ]);
    cache = { cid, jadwal, koreksi, sesi, percobaan, laporan, riwayat };
    return "";
  } catch (e) {
    cache = null;
    return pesanGalat(e);
  }
}

function bangun(peserta, progres) {
  const kejadian = K.susunKejadian({ percobaan: cache.percobaan, progres, sesi: cache.sesi });
  const ctx = { peserta, progres, jadwal: K.kelompokJadwal(cache.jadwal), kejadian, sekarang: sekarang(), sesiMulai: K.sesiMulaiGlobal(cache.sesi) };
  ctx.hasil = hitung(ctx);
  return ctx;
}
function hitung(ctx, jadwal = ctx.jadwal) {
  return K.susunKehadiran({ peserta: ctx.peserta, jadwal, kejadian: ctx.kejadian, koreksi: cache.koreksi, sekarang: ctx.sekarang, sesiMulai: ctx.sesiMulai });
}
const kejadianDari = (ctx, id) => ctx.kejadian.get(id) || K.kejadianKosong();
const urut = (a) => a.slice().sort((x, y) => String(x).localeCompare(String(y), "id"));
function kelasDaftar(ctx) {
  const s = new Set(ctx.peserta.map((p) => p.kelas).filter(Boolean));
  for (const k of ctx.jadwal.keys()) s.add(k);
  return urut([...s]);
}
const kelasBerjadwal = (ctx) => urut([...ctx.jadwal.keys()]);
const pilihKelas = (ctx) => (ui.kf ? (ctx.jadwal.has(ui.kf) ? [ui.kf] : []) : kelasBerjadwal(ctx));
const anggotaKelas = (ctx, kelas) => ctx.hasil.baris.filter((b) => b.ada && K.cariJadwal(ctx.jadwal, b.p.kelas) === ctx.jadwal.get(kelas));
const labelPertemuan = (j) => "P" + j.pertemuan + " " + K.teksTanggal(j.mulai) + " " + K.jamWib(j.mulai) + "-" + K.jamWib(j.selesai);

// ---------- dialog ----------
function dialog(judul, isi) {
  const dlg = h("dialog", { class: "putar", "aria-label": judul });
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.append(h("h3", {}, judul), ...isi, h("div", { class: "actions" }, tombol("Tutup", () => dlg.close())));
  dlg.showModal();
  return dlg;
}

// ---------- render utama ----------
export async function render({ main, kepala, kuliah, unduh, peserta, progres }) {
  if (!peserta) {
    main.replaceChildren(kepala, kartu(h("p", { class: "verdict fail" }, "Data peserta belum termuat. Tekan Muat ulang.")));
    return;
  }
  if (!cache || cache.cid !== kuliah.id) {
    main.replaceChildren(kepala, kartu(h("p", { class: "muted" }, "Memuat kehadiran")));
    const g = await muat(kuliah.id);
    if (g) {
      main.replaceChildren(kepala, kartu(h("p", { class: "verdict fail" }, g)));
      return;
    }
  }
  const ctx = bangun(peserta, progres || []);
  const ulang = () => render({ main, kepala, kuliah, unduh, peserta, progres });
  const segarkan = async () => {
    cache = null;
    await ulang();
  };
  const a = { ulang, segarkan, unduh, kuliah, main };

  const sub = (id, teks) => h("button", { type: "button", class: "tab" + (ui.sub === id ? " on" : ""), onclick: () => {
    ui.sub = id;
    ui.edit = null;
    ui.konf = null;
    ulang();
  } }, teks);
  const bar = h("div", { class: "tabs", role: "tablist", "aria-label": "Bagian kehadiran" }, sub("s", "Kesiapan"), sub("p", "Per pertemuan"), sub("x", "Semua pertemuan"), sub("a", "Aktivitas"), sub("b", "Keaktifan"), sub("j", "Jadwal"));
  const kelasTersedia = ui.sub === "j" ? kelasDaftar(ctx) : kelasBerjadwal(ctx);
  let saring = null;
  if (ui.sub === "j") {
    if (!ui.kj || !kelasTersedia.includes(ui.kj)) ui.kj = kelasBerjadwal(ctx)[0] || kelasTersedia[0] || "";
    saring = h("label", {}, "Kelas yang diatur ", h("select", { id: "khKelasJ", onchange: (e) => { ui.kj = e.target.value; ui.edit = null; ui.konf = null; ui.pesan = ""; ulang(); } }, kelasTersedia.map((k) => h("option", { value: k, selected: k === ui.kj ? "" : false }, k))));
  } else {
    if (ui.kf && !kelasTersedia.includes(ui.kf)) ui.kf = "";
    saring = h("label", {}, "Kelas ", h("select", { id: "khKelas", onchange: (e) => { ui.kf = e.target.value; ulang(); } }, h("option", { value: "" }, "Semua kelas"), kelasTersedia.map((k) => h("option", { value: k, selected: k === ui.kf ? "" : false }, k))));
  }
  const catatan = ctx.sesiMulai === null
    ? "Pencatatan sesi (jam dan lama aktif) belum menghasilkan data. Sampai ada peserta yang membuka versi situs terbaru, kehadiran dihitung dari waktu mengerjakan saja."
    : "Pencatatan sesi aktif sejak " + K.teksTanggal(ctx.sesiMulai) + ". Sebelum itu, kesiapan dihitung dari waktu mengerjakan saja (menit aktif tidak diminta).";
  const atas = kartu(
    h("h3", {}, "Kehadiran dan keaktifan"),
    h("p", { class: "muted" }, "Absensi resmi tetap SIAKAD. Di sini terlihat siapa yang sudah menyiapkan diri sebelum kelas dan seberapa aktif belajar. " + catatan),
    bar,
    h("div", { class: "filters" }, saring)
  );
  const isi = { s: tabKesiapan, p: tabPertemuan, x: tabMatriks, a: tabAktivitas, b: tabKeaktifan, j: tabJadwal }[ui.sub](ctx, a);
  main.replaceChildren(kepala, atas, ...isi.filter(Boolean));
}

function tanpaJadwal(ctx) {
  const tj = ctx.hasil.tanpaJadwal;
  if (!tj.length) return null;
  return h("div", { class: "kh-peringatan" }, h("strong", {}, tj.length + " peserta belum punya jadwal kelas"), h("p", {}, "Kelas mereka tidak cocok dengan jadwal mana pun, jadi belum ikut terhitung: " + tj.slice(0, 12).map((p) => p.nama + " (" + (p.kelas || "tanpa kelas") + ")").join(", ") + (tj.length > 12 ? ", dan lainnya" : "") + ". Atur jadwal untuk kelas itu di tab Jadwal, atau perbaiki kelas mereka."));
}
const kosongJadwal = (ctx) => (kelasBerjadwal(ctx).length ? null : kartu(info("Belum ada jadwal. Buka tab Jadwal, pilih kelas, lalu buat jadwal mingguannya. Setelah itu kesiapan, kehadiran, dan tampilan lain terisi otomatis.")));

// ---------- tab: kesiapan ----------
const URUT_SIAP = { belum: 0, membaca: 1, kurang: 2, siap: 3 };
const TEKS_SIAP = { siap: ["Siap", "k"], kurang: ["Mencoba, kurang aktif", "b"], membaca: ["Hanya membaca", "b"], belum: ["Belum mulai", "d"] };

function tabKesiapan(ctx, a) {
  const kosong = kosongJadwal(ctx);
  if (kosong) return [kosong, tanpaJadwal(ctx)];
  const bagian = [];
  for (const kelas of pilihKelas(ctx)) {
    const rows = ctx.jadwal.get(kelas);
    let idx = K.pertemuanBerlangsung(rows, ctx.sekarang);
    const jalan = idx >= 0;
    if (!jalan) idx = K.pertemuanBerikut(rows, ctx.sekarang);
    if (idx < 0) {
      bagian.push(kartu(h("h3", {}, kelas), h("p", { class: "muted" }, "Semua pertemuan di jadwal kelas ini sudah lewat.")));
      continue;
    }
    const j = rows[idx];
    const anggota = anggotaKelas(ctx, kelas).map((b) => ({ b, s: K.hitungSiap(kejadianDari(ctx, b.p.id), j.mulai, { sekarang: ctx.sekarang, sesiMulai: ctx.sesiMulai }) }));
    const hit = { siap: 0, kurang: 0, membaca: 0, belum: 0 };
    anggota.forEach((x) => hit[x.s.status]++);
    const n = anggota.length || 1;
    const lebar = (v) => "width:" + (v / n) * 100 + "%";
    const belumSiap = anggota.filter((x) => !x.s.siap).map((x) => x.b.p.nama);
    const salin = tombol("Salin daftar yang belum siap", async (e) => {
      try {
        await navigator.clipboard.writeText("Belum siap untuk pertemuan " + j.pertemuan + " (" + kelas + "):\n" + belumSiap.map((x) => "- " + x).join("\n"));
        e.target.textContent = "Tersalin";
      } catch (err) {
        e.target.textContent = "Tidak bisa menyalin";
      }
    });
    const barisPeserta = anggota
      .slice()
      .sort((x, y) => URUT_SIAP[x.s.status] - URUT_SIAP[y.s.status] || x.b.p.nama.localeCompare(y.b.p.nama, "id"))
      .map(({ b, s }) => {
        const [teks, jenis] = TEKS_SIAP[s.status];
        const kor = b.pertemuan.find((x) => x.n === j.pertemuan);
        return h("div", { class: "kh-baris klik", onclick: () => dialogPeserta(ctx, b.p, a) }, h("span", {}, h("strong", {}, b.p.nama), kecil(b.p.nim || "")), h("span", {}, pil(teks, jenis)), h("span", { class: "muted" }, s.siap ? "selesai " + s.jamSebelum + " jam sebelum kelas" + (s.mepet ? " (mepet)" : "") + ", " + s.menit + " menit aktif" : s.menit + " menit aktif dalam 6 hari terakhir, " + s.kerja + " kali mengerjakan") + (kor && kor.koreksi ? " | dikoreksi dosen: " + (kor.koreksi.status === "hadir" ? "hadir" : "tidak hadir") : ""));
      });
    bagian.push(kartu(
      h("h3", {}, kelas + ", " + labelPertemuan(j) + (j.dipindah ? " (dipindah)" : "")),
      h("p", { class: jalan ? "kh-jalan" : "muted" }, jalan ? "Sedang berlangsung" : "Kelas mulai dalam " + K.sisaTeks(j.mulai - ctx.sekarang) + ". Tenggat kesiapan: " + K.teksTanggal(j.mulai) + " " + K.jamWib(j.mulai) + "."),
      h("div", { class: "kh-prog", role: "img", "aria-label": hit.siap + " siap, " + hit.kurang + " kurang aktif, " + hit.membaca + " hanya membaca, " + hit.belum + " belum mulai" }, h("i", { class: "k", style: lebar(hit.siap) }), h("i", { class: "b", style: lebar(hit.kurang + hit.membaca) }), h("i", { class: "d", style: lebar(hit.belum) })),
      h("p", { class: "muted" }, hit.siap + " dari " + anggota.length + " siap. " + hit.kurang + " mencoba tetapi kurang aktif, " + hit.membaca + " hanya membaca, " + hit.belum + " belum mulai."),
      h("div", { class: "actions" }, salin),
      barisPeserta.length ? h("div", { class: "kh-daftar" }, barisPeserta) : h("p", { class: "muted" }, "Belum ada peserta di kelas ini.")
    ));
  }
  bagian.push(h("p", { class: "kh-info" }, "Siap = mengerjakan tantangan (kirim kode atau periksa jawaban) dalam 6 hari sebelum kelas mulai. Bila pencatatan sesi sudah berjalan sejak jendela itu dimulai, peserta juga harus aktif minimal " + K.AMBANG_MENIT_SIAP + " menit. Ketuk satu nama untuk melihat rinciannya."));
  return [tanpaJadwal(ctx), ...bagian];
}

// ---------- tab: per pertemuan ----------
const TEKS_STATUS = { hadir: ["Hadir", "k"], tidak: ["Tidak hadir", "d"], libur: ["Libur", "t"], belum: ["Belum", "t"] };

function tabPertemuan(ctx, a) {
  const kosong = kosongJadwal(ctx);
  if (kosong) return [kosong, tanpaJadwal(ctx)];
  const kelasPilih = pilihKelas(ctx);
  const maks = Math.max(1, ...kelasPilih.map((k) => Math.max(...ctx.jadwal.get(k).map((j) => j.pertemuan))));
  if (ui.n === null || ui.n > maks) {
    const dulu = kelasPilih.length ? ctx.jadwal.get(kelasPilih[0]).filter((j) => j.mulai <= ctx.sekarang && !j.libur) : [];
    ui.n = dulu.length ? dulu[dulu.length - 1].pertemuan : 1;
  }
  const n = ui.n;
  const pilihN = h("div", { class: "kh-strip" }, Array.from({ length: maks }, (_, i) => h("button", { type: "button", class: "btn btn-sm" + (i + 1 === n ? " on" : ""), onclick: () => { ui.n = i + 1; a.ulang(); } }, "P" + (i + 1))));
  const bagian = [kartu(h("h3", {}, "Pilih pertemuan"), pilihN)];
  const tot = { n: 0, siap: 0, aktif: 0, hadir: 0 };
  const isiKelas = [];
  for (const kelas of kelasPilih) {
    const rows = ctx.jadwal.get(kelas);
    const j = rows.find((x) => x.pertemuan === n);
    if (!j) {
      isiKelas.push(kartu(h("h3", {}, kelas), h("p", { class: "muted" }, "Kelas ini tidak punya pertemuan ke-" + n + ".")));
      continue;
    }
    if (j.libur) {
      isiKelas.push(kartu(h("h3", {}, kelas + ", " + labelPertemuan(j)), pil("Libur", "t"), h("p", { class: "muted" }, "Pertemuan ini libur menurut jadwal dan tidak dihitung dalam persentase hadir maupun kesiapan.")));
      continue;
    }
    const anggota = anggotaKelas(ctx, kelas);
    const mulaiKelas = j.mulai <= ctx.sekarang;
    const selesaiKelas = j.selesai <= ctx.sekarang;
    const jalan = mulaiKelas && !selesaiKelas;
    const data = anggota.map((b) => ({ b, x: b.pertemuan.find((y) => y.n === n) }));
    data.forEach(({ x }) => {
      tot.n++;
      if (x.siap.siap) tot.siap++;
      if (x.saat.aktif) tot.aktif++;
      if (x.status === "hadir") tot.hadir++;
    });
    const aktifSkrg = data.filter(({ b }) => K.aktifSekarang(kejadianDari(ctx, b.p.id), ctx.sekarang)).length;
    const bagianKelas = [h("h3", {}, kelas + ", " + labelPertemuan(j) + (j.dipindah ? " (dipindah)" : ""))];
    if (jalan) bagianKelas.push(h("div", { class: "kh-live" }, h("span", { class: "kh-titik" }), h("span", {}, "Langsung: " + aktifSkrg + " dari " + anggota.length + " aktif sekarang (denyut dalam 2 menit terakhir), " + data.filter(({ x }) => x.saat.kerja > 0).length + " sudah mengirim jawaban sejak kelas mulai. "), tombol("Muat ulang data", a.segarkan)));
    if (!mulaiKelas) bagianKelas.push(h("p", { class: "muted" }, "Kelas mulai dalam " + K.sisaTeks(j.mulai - ctx.sekarang) + ". Yang tampil di bawah adalah kesiapan sampai saat ini."));
    if (mulaiKelas && (kelasPilih.length === 1 || ui.kf)) {
      const g = K.grafikKelas(anggota.map((b) => kejadianDari(ctx, b.p.id)), j.mulai, j.selesai);
      const total = Math.max(1, anggota.length);
      bagianKelas.push(
        h("p", { class: "muted" }, "Peserta yang aktif di situs selama jam kuliah (tiap 10 menit)" + (ctx.sesiMulai === null || j.mulai < ctx.sesiMulai ? ". Pencatatan sesi belum berjalan pada waktu ini, jadi grafik hanya menunjukkan yang mengirim jawaban." : ":")),
        h("div", { class: "kh-grafik", style: "grid-template-columns:repeat(" + g.length + ",minmax(0,1fr))" }, g.map((v, i) => h("div", { title: K.jamWib(j.mulai + i * 600000) + ": " + v + " peserta", style: "height:" + Math.max(3, (v / total) * 100) + "%" }))),
        h("div", { class: "kh-sumbu", style: "grid-template-columns:repeat(" + g.length + ",minmax(0,1fr))" }, g.map((_, i) => h("span", {}, i % 3 === 0 ? K.jamWib(j.mulai + i * 600000) : "")))
      );
    }
    const baris = data
      .slice()
      .sort((x, y) => (y.x.siap.siap - x.x.siap.siap) || x.b.p.nama.localeCompare(y.b.p.nama, "id"))
      .map(({ b, x }) => {
        const [tk, jk] = TEKS_STATUS[x.status];
        const saat = x.saat.mulaiKelas ? (x.saat.tersedia ? pil(x.saat.aktif ? "Aktif" : "Tidak aktif", x.saat.aktif ? "k" : "t") : pil(x.saat.kerja ? "Mengirim jawaban" : "Tidak ada data", "t")) : pil("Belum", "t");
        return h(
          "div",
          { class: "kh-baris5" },
          h("span", { class: "klik", onclick: () => dialogPeserta(ctx, b.p, a) }, h("strong", {}, b.p.nama), kecil(b.p.nim || "")),
          h("span", {}, pil(TEKS_SIAP[x.siap.status][0], TEKS_SIAP[x.siap.status][1]), x.siap.siap ? kecil("selesai " + x.siap.jamSebelum + " jam sebelum" + (x.siap.mepet ? ", mepet" : "")) : kecil(x.siap.menit + " menit aktif")),
          h("span", {}, saat, x.saat.mulaiKelas ? kecil(x.saat.menit + " menit" + (x.saat.kerja ? ", " + x.saat.kerja + " kirim" : "")) : null),
          h("span", {}, pil(tk, jk), x.koreksi ? kecil("dikoreksi: " + (x.koreksi.alasan || "tanpa alasan")) : null),
          h("span", {}, selesaiKelas ? pil(x.pola[0], x.pola[1]) : h("span", { class: "muted" }, "belum bisa disimpulkan"), " ", tombol("Koreksi", () => dialogKoreksi(ctx, b.p, j, x, a)))
        );
      });
    bagianKelas.push(h("div", { class: "kh-kepala5" }, h("span", {}, "Peserta"), h("span", {}, "Sebelum kelas"), h("span", {}, "Saat kelas"), h("span", {}, "Status"), h("span", {}, "Gambaran")), baris.length ? h("div", { class: "kh-daftar" }, baris) : h("p", { class: "muted" }, "Belum ada peserta di kelas ini."));
    isiKelas.push(kartu(...bagianKelas));
  }
  const ringkas = kartu(h("div", { class: "d-stats" }, stat(tot.siap + " dari " + tot.n, "siap sebelum kelas"), stat(String(tot.aktif), "aktif saat kelas"), stat(String(tot.hadir), "hadir menurut aturan situs"), stat(String(ctx.hasil.tanpaJadwal.length), "tanpa jadwal")), info("Status hadir mengikuti aturan siap sebelum kelas (kelas yang belum mulai belum dinilai). 'Saat kelas' hanya informasi tambahan tentang keterlibatan; absensi kelas yang resmi tetap di SIAKAD."));
  return [...bagian, ringkas, ...isiKelas, tanpaJadwal(ctx)];
}
const stat = (angka, label) => h("div", { class: "d-stat" }, h("strong", {}, angka), h("span", { class: "muted" }, label));

function dialogKoreksi(ctx, p, j, x, a) {
  const pilih = h("select", { id: "khKorStatus", "aria-label": "Status" }, [["", "Otomatis (ikuti hitungan situs)"], ["hadir", "Hadir"], ["tidak", "Tidak hadir"]].map(([v, t]) => h("option", { value: v, selected: (x.koreksi ? x.koreksi.status : "") === v ? "" : false }, t)));
  const alasan = h("input", { class: "input", id: "khKorAlasan", maxlength: "200", placeholder: "Alasan, mis. sakit dan kirim surat", value: x.koreksi && x.koreksi.alasan ? x.koreksi.alasan : "", "aria-label": "Alasan" });
  const pesan = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const simpan = tombol("Simpan", async () => {
    simpan.disabled = true;
    pesan.textContent = "Menyimpan";
    const c = Auth.getClient();
    let error = null;
    if (!pilih.value) ({ error } = await c.from("koreksi_kehadiran").delete().eq("matakuliah_id", cache.cid).eq("user_id", p.id).eq("pertemuan", j.pertemuan));
    else ({ error } = await c.from("koreksi_kehadiran").upsert({ matakuliah_id: cache.cid, user_id: p.id, pertemuan: j.pertemuan, status: pilih.value, alasan: alasan.value.trim() || null, oleh: Auth.getUserId() }, { onConflict: "matakuliah_id,user_id,pertemuan" }));
    simpan.disabled = false;
    if (error) {
      pesan.textContent = "Gagal menyimpan: " + Auth.friendly(error);
      return;
    }
    dlg.close();
    a.segarkan();
  }, "btn btn-primary");
  const dlg = dialog("Koreksi kehadiran: " + p.nama + ", P" + j.pertemuan, [
    h("p", { class: "muted" }, "Hasil otomatis: " + TEKS_STATUS[x.status][0] + ". Koreksi menimpa hasil otomatis dan tercatat atas namamu."),
    h("div", { class: "field" }, h("label", { for: "khKorStatus" }, "Status"), pilih),
    h("div", { class: "field" }, h("label", { for: "khKorAlasan" }, "Alasan (opsional)"), alasan),
    h("div", { class: "actions" }, simpan),
    pesan,
  ]);
}

// ---------- tab: semua pertemuan (matriks) ----------
function tabMatriks(ctx, a) {
  const kosong = kosongJadwal(ctx);
  if (kosong) return [kosong, tanpaJadwal(ctx)];
  const kelasPilih = pilihKelas(ctx);
  const rowsPilih = new Set(kelasPilih.map((k) => ctx.jadwal.get(k)));
  const baris = ctx.hasil.baris.filter((b) => b.ada && rowsPilih.has(K.cariJadwal(ctx.jadwal, b.p.kelas)));
  const maks = Math.max(1, ...baris.map((b) => Math.max(0, ...b.pertemuan.map((x) => x.n))));
  const tunggal = kelasPilih.length === 1 ? ctx.jadwal.get(kelasPilih[0]) : null;
  const kepalaTabel = h("tr", {}, h("th", { scope: "col", class: "nama" }, "Peserta"), Array.from({ length: maks }, (_, i) => h("th", { scope: "col" }, "P" + (i + 1), tunggal && tunggal.find((j) => j.pertemuan === i + 1) ? h("small", { class: "kh-kecil" }, K.teksTanggal(tunggal.find((j) => j.pertemuan === i + 1).mulai).split(" ").slice(1).join(" ")) : null)), h("th", { scope: "col" }, "Hadir"), h("th", { scope: "col", title: "Rata-rata selesai berapa jam sebelum kelas" }, "Jam"), h("th", { scope: "col", title: "Selesai kurang dari 3 jam sebelum kelas" }, "Mepet"));
  const sel = (b, i) => {
    const x = b.pertemuan.find((y) => y.n === i + 1);
    if (!x) return h("td", {});
    if (x.status === "libur") return h("td", { class: "kh-sel", title: "Libur" }, h("span", { class: "kh-lib" }, "L"));
    if (x.status === "belum") return h("td", { class: "kh-sel", title: "Belum berlangsung" }, h("span", { class: "kh-belum" }));
    const ada = x.saat.tersedia && x.saat.selesai;
    return h(
      "td",
      { class: "kh-sel klik", title: b.p.nama + ", P" + x.n + ": " + TEKS_STATUS[x.status][0] + (x.koreksi ? " (dikoreksi)" : "") + ", " + (x.siap.siap ? "siap" : "belum siap") + (ada ? ", " + (x.saat.aktif ? "aktif saat kelas" : "tidak aktif saat kelas") : ""), onclick: () => { ui.n = x.n; ui.sub = "p"; a.ulang(); } },
      h("span", { class: "kh-tumpuk " + (x.status === "hadir" ? "h" : "a") }, h("i", { class: x.siap.siap ? "s" : "" }), h("i", { class: ada && x.saat.aktif ? "k" : "" }), x.koreksi ? h("b", {}, "*") : null)
    );
  };
  const isi = baris.length
    ? h("div", { class: "tablewrap" }, h("table", { class: "rekap kh-matriks" }, h("caption", { class: "sr-only" }, "Kehadiran peserta per pertemuan"), h("thead", {}, kepalaTabel), h("tbody", {}, baris.slice().sort((x, y) => x.p.nama.localeCompare(y.p.nama, "id")).map((b) => h("tr", {}, h("th", { scope: "row", class: "nama" }, h("strong", {}, b.p.nama), h("small", {}, (b.p.nim || "") + (tunggal ? "" : " | " + b.p.kelas))), Array.from({ length: maks }, (_, i) => sel(b, i)), h("td", {}, b.persen === null ? "-" : b.persen + "%"), h("td", {}, b.rataJam === null ? "-" : String(b.rataJam)), h("td", {}, String(b.mepet)))))))
    : h("p", { class: "muted" }, "Tidak ada peserta yang cocok.");
  const unduh = tombol("Unduh CSV", () => a.unduh("kehadiran-" + cache.cid + ".csv", K.csvKehadiran(baris)));
  return [
    kartu(
      h("h3", {}, "Semua pertemuan"),
      h("div", { class: "actions" }, unduh),
      isi,
      h("div", { class: "kh-legenda" }, h("span", {}, h("i", { class: "kh-tumpuk h mini" }, h("i", { class: "s" }), h("i", {})), " hadir (atas hijau: siap sebelum kelas)"), h("span", {}, h("i", { class: "kh-tumpuk a mini" }, h("i", {}), h("i", {})), " tidak hadir"), h("span", {}, h("i", { class: "kh-tumpuk h mini" }, h("i", {}), h("i", { class: "k" })), " bawah biru: aktif di situs saat kelas"), h("span", {}, "L libur, kotak putus-putus belum berlangsung, * dikoreksi dosen")),
      info("Tiap kolom mengikuti jadwal kelas peserta itu. Pertemuan libur tidak dihitung dan yang belum berlangsung dibiarkan kosong. Ketuk satu kotak untuk membuka pertemuannya.")
    ),
    tanpaJadwal(ctx),
  ];
}

// ---------- tab: aktivitas ----------
const TEKS_LEVEL_KELAS = ["t", "b", "k", "k"];
function tabAktivitas(ctx, a) {
  const peserta = pesertaDi(ctx);
  const sekarangT = ctx.sekarang;
  if (!ui.hari) ui.hari = K.tanggalWib(sekarangT);
  const seninSekarang = K.awalMinggu(sekarangT);
  if (ui.mgg === null || ui.mgg === undefined) ui.mgg = seninSekarang;
  const ganti = (kunci, nilai) => () => {
    ui[kunci] = nilai;
    a.ulang();
  };
  const seg = (nilai, teks, kunci) => h("button", { type: "button", class: "btn btn-sm" + (ui[kunci] === nilai ? " on" : ""), onclick: ganti(kunci, nilai) }, teks);
  const kontrol = h("div", { class: "actions" }, seg("h", "Per hari", "gran"), seg("m", "Per minggu", "gran"), h("span", { class: "kh-pisah" }), seg("d", "Daftar", "bentuk"), seg("k", "Kalender", "bentuk"));
  const bagian = [];
  if (ui.gran === "h") {
    const hariIni = K.tanggalWib(sekarangT);
    const deret = Array.from({ length: 14 }, (_, i) => K.tanggalWib(sekarangT - (13 - i) * K.HARI_MS));
    const kelasPd = (tgl) => {
      const t = [];
      for (const [k, rows] of ctx.jadwal) rows.forEach((j) => { if (!j.libur && K.tanggalWib(j.mulai) === tgl) t.push(k + " " + K.jamWib(j.mulai)); });
      return t;
    };
    const strip = h("div", { class: "kh-hari" }, deret.map((tgl) => {
      const t = K.dariWib(tgl, "12:00");
      return h("button", { type: "button", class: "kh-hbtn" + (tgl === ui.hari && ui.bentuk === "d" ? " on" : "") + (kelasPd(tgl).length ? " kelas" : ""), title: kelasPd(tgl).length ? "Ada kelas: " + kelasPd(tgl).join(", ") : "", onclick: () => { ui.hari = tgl; ui.bentuk = "d"; a.ulang(); } }, K.HARI[K.hariDariWib(t)], h("b", {}, String(+tgl.slice(8))));
    }));
    if (ui.bentuk === "d") {
      const ring = peserta.map((p) => ({ p, r: K.ringkasHari(kejadianDari(ctx, p.id), ui.hari) }));
      const aktif = ring.filter((x) => x.r.level > 0);
      const kerja = ring.filter((x) => x.r.level >= 2);
      const kls = kelasPd(ui.hari);
      bagian.push(kartu(
        h("h3", {}, "Aktivitas " + K.teksTanggal(K.dariWib(ui.hari, "12:00")) + (ui.hari === hariIni ? " (hari ini)" : "")),
        strip,
        h("p", { class: "muted" }, aktif.length + " dari " + peserta.length + " aktif: " + kerja.length + " mengerjakan, " + (aktif.length - kerja.length) + " hanya membaca, " + (peserta.length - aktif.length) + " tidak aktif." + (kls.length ? " Kelas pada tanggal ini: " + kls.join(", ") + "." : "")),
        h("div", { class: "kh-daftar" }, ring.slice().sort((x, y) => y.r.level - x.r.level || (x.r.awal || 0) - (y.r.awal || 0) || x.p.nama.localeCompare(y.p.nama, "id")).map(({ p, r }) => {
          const terbuka = ui.buka === p.id + "|" + ui.hari && r.level > 0;
          return h("div", { class: "kh-blok" }, h("div", { class: "kh-baris klik", onclick: () => { ui.buka = terbuka ? "" : p.id + "|" + ui.hari; a.ulang(); } }, h("span", {}, h("strong", {}, p.nama), kecil(p.kelas || "")), h("span", {}, pil(K.teksLevel(r.level), TEKS_LEVEL_KELAS[r.level])), h("span", { class: "muted" }, r.level ? K.jamWib(r.awal) + " sampai " + K.jamWib(r.akhir) + ", " + r.menit + " menit aktif" + (r.kerja ? ", " + r.kerja + " kali mengirim" : "") : "tidak ada catatan")), terbuka ? h("ul", { class: "kh-kegiatan" }, r.kegiatan.map((k) => h("li", {}, h("b", {}, K.jamWib(k.t)), " " + k.teks))) : null);
        })),
        info("Ketuk satu baris untuk melihat kegiatannya jam demi jam. Hanya membaca = membuka situs minimal " + K.MENIT_BACA + " menit aktif tanpa mengirim jawaban. Tanggal dihitung dalam WIB.")
      ));
    } else {
      bagian.push(kartu(h("h3", {}, "Kalender 14 hari terakhir"), kalender(peserta, deret.map((tgl) => ({ judul: String(+tgl.slice(8)), ket: tgl, level: (p) => K.ringkasHari(kejadianDari(ctx, p.id), tgl).level, klik: () => { ui.hari = tgl; ui.bentuk = "d"; a.ulang(); } })), ctx), legendaLevel(), info("Terlihat siapa yang rutin tiap hari dan siapa yang baru muncul menjelang kelas. Ketuk satu kotak untuk membuka rincian tanggalnya.")));
    }
  } else {
    const minggu = Array.from({ length: 8 }, (_, i) => seninSekarang - (7 - i) * 7 * K.HARI_MS);
    const stripM = h("div", { class: "kh-hari" }, minggu.map((s, i) => h("button", { type: "button", class: "kh-hbtn" + (s === ui.mgg && ui.bentuk === "d" ? " on" : ""), onclick: () => { ui.mgg = s; ui.bentuk = "d"; a.ulang(); } }, "M" + (i + 1), h("b", {}, K.tanggalWib(s).slice(8) + "-" + K.tanggalWib(s + 6 * K.HARI_MS).slice(8)))));
    if (ui.bentuk === "d") {
      const rm = peserta.map((p) => ({ p, m: K.ringkasMinggu(kejadianDari(ctx, p.id), ui.mgg, sekarangT) }));
      const aktif = rm.filter((x) => x.m.hariAktif > 0).length;
      const rataH = rm.length ? Math.round((rm.reduce((s, x) => s + x.m.hariAktif, 0) / rm.length) * 10) / 10 : 0;
      const rataM = rm.length ? Math.round(rm.reduce((s, x) => s + x.m.menit, 0) / rm.length) : 0;
      bagian.push(kartu(
        h("h3", {}, "Minggu " + K.teksTanggal(ui.mgg) + " sampai " + K.teksTanggal(ui.mgg + 6 * K.HARI_MS)),
        stripM,
        h("p", { class: "muted" }, aktif + " dari " + peserta.length + " aktif, rata-rata " + rataH + " hari dan " + rataM + " menit per peserta."),
        h("div", { class: "kh-kepalaM" }, h("span", {}, "Peserta"), h("span", {}, "Sen Sel Rab Kam Jum Sab Min"), h("span", {}, "Ringkasan")),
        h("div", { class: "kh-daftar" }, rm.slice().sort((x, y) => y.m.menit - x.m.menit || x.p.nama.localeCompare(y.p.nama, "id")).map(({ p, m }) => h("div", { class: "kh-barisM" }, h("span", { class: "klik", onclick: () => dialogPeserta(ctx, p, a) }, h("strong", {}, p.nama), kecil(p.kelas || "")), h("div", { class: "kh-mini" }, m.hari.map((hr) => h("span", { class: "l" + (hr.depan ? "x" : hr.level), title: K.teksTanggal(K.dariWib(hr.tgl, "12:00")) + ": " + (hr.depan ? "belum berlangsung" : K.teksLevel(hr.level) + (hr.menit ? ", " + hr.menit + " menit" : "")), onclick: () => { if (!hr.depan) { ui.hari = hr.tgl; ui.gran = "h"; ui.bentuk = "d"; a.ulang(); } } }))), h("span", { class: "muted" }, m.menit + " menit, " + m.hariAktif + " hari aktif, " + m.lulus + " bab lulus")))),
        legendaLevel(),
        info("Ketuk satu kotak hari untuk membuka rincian tanggalnya. Hari kelas tiap kelas berbeda; lihat tab Jadwal.")
      ));
    } else {
      bagian.push(kartu(h("h3", {}, "Kalender 8 minggu terakhir"), kalender(peserta, minggu.map((s, i) => ({ judul: "M" + (i + 1), ket: K.teksTanggal(s), level: (p) => { const m = K.ringkasMinggu(kejadianDari(ctx, p.id), s, sekarangT); return m.hariAktif === 0 ? 0 : m.hariAktif <= 2 ? 1 : m.hariAktif <= 4 ? 2 : 3; }, klik: () => { ui.mgg = s; ui.bentuk = "d"; a.ulang(); } })), ctx), h("div", { class: "kh-legenda" }, h("span", {}, h("i", { class: "kh-kot l0" }), " tidak aktif"), h("span", {}, h("i", { class: "kh-kot l1" }), " 1 sampai 2 hari aktif"), h("span", {}, h("i", { class: "kh-kot l2" }), " 3 sampai 4 hari"), h("span", {}, h("i", { class: "kh-kot l3" }), " 5 hari atau lebih")), info("Ketuk satu kotak untuk membuka minggunya.")));
    }
  }
  return [kartu(h("h3", {}, "Tampilan"), kontrol), ...bagian, tanpaJadwal(ctx)];
}
function pesertaDi(ctx) {
  if (!ui.kf) return ctx.peserta.slice().sort((x, y) => x.nama.localeCompare(y.nama, "id"));
  return anggotaKelas(ctx, ui.kf).map((b) => b.p).sort((x, y) => x.nama.localeCompare(y.nama, "id"));
}
function legendaLevel() {
  return h("div", { class: "kh-legenda" }, h("span", {}, h("i", { class: "kh-kot l0" }), " tidak aktif"), h("span", {}, h("i", { class: "kh-kot l1" }), " hanya membaca"), h("span", {}, h("i", { class: "kh-kot l2" }), " mengerjakan"), h("span", {}, h("i", { class: "kh-kot l3" }), " lulus bab"));
}
function kalender(peserta, kolom, ctx) {
  return h("div", { class: "tablewrap" }, h("table", { class: "kh-kal" }, h("thead", {}, h("tr", {}, h("th", { class: "nama" }, ""), kolom.map((k) => h("th", { title: k.ket }, k.judul)))), h("tbody", {}, peserta.map((p) => h("tr", {}, h("th", { scope: "row", class: "nama" }, p.nama), kolom.map((k) => { const lv = k.level(p); return h("td", { class: "l" + lv, title: p.nama + ", " + k.ket + ": " + K.teksLevel(lv), onclick: k.klik }); }))))));
}

// ---------- tab: keaktifan ----------
function tabKeaktifan(ctx, a) {
  const peserta = pesertaDi(ctx);
  const laporanPer = new Map();
  for (const l of cache.laporan) {
    if (!laporanPer.has(l.user_id)) laporanPer.set(l.user_id, new Set());
    laporanPer.get(l.user_id).add(Number(l.bab));
  }
  const pertemuanLalu = (p) => {
    const rows = K.cariJadwal(ctx.jadwal, p.kelas);
    return rows ? rows.filter((j) => !j.libur && j.mulai <= ctx.sekarang).length : 0;
  };
  const awalJadwal = Math.min(...[...ctx.jadwal.values()].flat().map((j) => j.mulai), ctx.sekarang);
  const mingguSemester = Math.max(1, Math.ceil((ctx.sekarang - awalJadwal) / (7 * K.HARI_MS)));
  const mingguSesi = ctx.sesiMulai === null ? 1 : Math.max(1, Math.ceil((ctx.sekarang - ctx.sesiMulai) / (7 * K.HARI_MS)));
  const hitungSkor = peserta.map((p) => {
    const target = { bab: Math.max(1, pertemuanLalu(p)), hari: Math.max(2, mingguSemester * 2), laporan: Math.max(1, pertemuanLalu(p)), menitPerMinggu: 150 };
    return { p, s: K.skorKeaktifan({ k: kejadianDari(ctx, p.id), laporan: (laporanPer.get(p.id) || new Set()).size, target, tersediaWaktu: ctx.sesiMulai !== null, minggu: mingguSesi }), target };
  });
  hitungSkor.sort((x, y) => y.s.skor - x.s.skor || x.p.nama.localeCompare(y.p.nama, "id"));
  const baris = hitungSkor.map(({ p, s }) => h("div", { class: "kh-skor klik", onclick: () => dialogPeserta(ctx, p, a) }, h("span", {}, h("strong", {}, p.nama), kecil(p.kelas || "")), h("div", { class: "kh-bar", role: "img", "aria-label": "Skor " + s.skor }, s.waktu !== null ? h("i", { class: "w", style: "width:" + s.waktu + "%" }) : null, h("i", { class: "b", style: "width:" + s.bab + "%" }), h("i", { class: "h", style: "width:" + s.hari + "%" }), h("i", { class: "l", style: "width:" + s.lap + "%" })), h("b", {}, String(s.skor))));
  return [
    kartu(
      h("h3", {}, "Skor keaktifan"),
      h("div", { class: "kh-legenda" }, ctx.sesiMulai !== null ? h("span", {}, h("i", { class: "kh-kot w" }), " waktu aktif 30") : null, h("span", {}, h("i", { class: "kh-kot b" }), " bab lulus " + (ctx.sesiMulai !== null ? "30" : "")), h("span", {}, h("i", { class: "kh-kot h" }), " hari mengerjakan 20"), h("span", {}, h("i", { class: "kh-kot l" }), " laporan 20")),
      baris.length ? h("div", { class: "kh-daftar" }, baris) : h("p", { class: "muted" }, "Tidak ada peserta."),
      info("Skor 0 sampai 100 hanya ringkasan untuk membantu nilai akhir, bukan nilai itu sendiri. Peserta dengan skor rendah tetapi hadir penuh, atau sebaliknya, perlu dilihat rinciannya dan sinyal integritasnya. " + (ctx.sesiMulai === null ? "Waktu aktif belum dihitung karena pencatatan sesi belum menghasilkan data; skor memakai tiga komponen lain." : "Waktu aktif dihitung per minggu sejak pencatatan sesi dimulai (target 150 menit per minggu).") + " Target bab dan laporan mengikuti jumlah pertemuan yang sudah berlangsung di kelas peserta; target hari mengerjakan 2 per minggu.")
    ),
  ];
}

// ---------- tab: jadwal ----------
const OPSI_HARI = [[1, "Senin"], [2, "Selasa"], [3, "Rabu"], [4, "Kamis"], [5, "Jumat"], [6, "Sabtu"], [0, "Minggu"]];

function dampak(ctx, kelas, barisBaru, terdampak) {
  const jadwalBaru = new Map(ctx.jadwal);
  jadwalBaru.set(kelas, barisBaru);
  const baru = hitung(ctx, jadwalBaru);
  const hadirDi = (hasil, jadwal, n) => hasil.baris.filter((b) => b.ada && K.cariJadwal(jadwal, b.p.kelas) === jadwal.get(kelas)).filter((b) => (b.pertemuan.find((x) => x.n === n) || {}).status === "hadir").length;
  const teks = [];
  for (const n of terdampak) {
    const sebelum = hadirDi(ctx.hasil, ctx.jadwal, n);
    const sesudah = hadirDi(baru, jadwalBaru, n);
    if (sebelum !== sesudah) teks.push("P" + n + ": hadir " + sebelum + " menjadi " + sesudah);
  }
  return teks;
}

function tabJadwal(ctx, a) {
  const kelas = ui.kj;
  if (!kelas) return [kartu(h("p", { class: "muted" }, "Belum ada peserta atau kelas."))];
  const rows = ctx.jadwal.get(kelas) || [];
  const cid = cache.cid;
  const sekarangT = ctx.sekarang;

  const simpan = async (barisBaru, ringkasan, hapusSetelah = null) => {
    const c = Auth.getClient();
    const kirim = barisBaru.map((j) => ({ matakuliah_id: cid, kelas, pertemuan: j.pertemuan, mulai: new Date(j.mulai).toISOString(), selesai: new Date(j.selesai).toISOString(), libur: !!j.libur, dipindah: !!j.dipindah, catatan: j.catatan || null, diperbarui_pada: new Date().toISOString() }));
    if (kirim.length) {
      const r = await c.from("jadwal_kelas").upsert(kirim, { onConflict: "matakuliah_id,kelas,pertemuan" });
      if (r.error) throw r.error;
    }
    if (hapusSetelah !== null) {
      const r = await c.from("jadwal_kelas").delete().eq("matakuliah_id", cid).eq("kelas", kelas).gt("pertemuan", hapusSetelah);
      if (r.error) throw r.error;
    }
    const r = await c.from("jadwal_riwayat").insert({ matakuliah_id: cid, kelas, oleh: Auth.getUserId(), ringkasan: ringkasan.slice(0, 400) });
    if (r.error) throw r.error;
    ui.edit = null;
    ui.konf = null;
    ui.pesan = "";
    ui.gen = null;
    await a.segarkan();
  };
  const jalankan = async (barisBaru, ringkasan, hapusSetelah) => {
    try {
      await simpan(barisBaru, ringkasan, hapusSetelah);
    } catch (e) {
      ui.pesan = "Gagal menyimpan jadwal: " + pesanGalat(e);
      a.ulang();
    }
  };
  // Perubahan pada pertemuan yang sudah atau sedang berlangsung selalu meminta konfirmasi dengan dampaknya.
  const ajukan = (barisBaru, ringkasan, terdampak) => {
    const lama = new Map(rows.map((j) => [j.pertemuan, j]));
    const perluKonfirmasi = terdampak.some((n) => {
      const b = barisBaru.find((x) => x.pertemuan === n);
      const l = lama.get(n);
      return (l && l.selesai <= sekarangT) || (b && b.mulai <= sekarangT);
    });
    if (!perluKonfirmasi) return jalankan(barisBaru, ringkasan, null);
    const d = dampak(ctx, kelas, barisBaru, terdampak);
    ui.konf = { teks: "Pertemuan ini sudah atau sedang berlangsung. Status kehadiran dihitung ulang: " + (d.length ? d.join("; ") + "." : "tidak ada status yang berubah.") + " Perubahan dicatat di riwayat.", aksi: () => jalankan(barisBaru, ringkasan, null) };
    ui.edit = null;
    a.ulang();
  };

  // ---- generator ----
  // Isian disimpan di ui.gen supaya tidak hilang saat halaman digambar ulang (mis. saat diminta konfirmasi menimpa).
  const g0 = ui.gen && ui.gen.kelas === kelas ? ui.gen : null;
  const awalSenin = rows.length ? K.tanggalWib(rows[0].mulai) : "";
  const f = { tgl: h("input", { type: "date", id: "gTgl", value: g0 ? g0.tgl : awalSenin, "aria-label": "Tanggal pertemuan pertama" }), mulai: h("input", { type: "time", id: "gMulai", value: g0 ? g0.mulai : rows.length ? K.jamWib(rows[0].mulai) : "08:00", "aria-label": "Jam mulai" }), selesai: h("input", { type: "time", id: "gSelesai", value: g0 ? g0.selesai : rows.length ? K.jamWib(rows[0].selesai) : "10:00", "aria-label": "Jam selesai" }), jumlah: h("input", { type: "number", id: "gJumlah", min: "1", max: "40", value: g0 ? g0.jumlah : String(rows.length ? Math.max(...rows.map((j) => j.pertemuan)) : 14), style: "width:80px", "aria-label": "Jumlah pertemuan" }), lewati: h("input", { type: "text", id: "gLewati", value: g0 ? g0.lewati : "", placeholder: "2026-11-04, 2026-12-23 (opsional)", style: "min-width:230px", "aria-label": "Tanggal yang dilewati" }) };
  const pesanGen = h("p", { class: "form-msg", role: "status", "aria-live": "polite" }, ui.pesan);
  const buat = tombol(ui.konf && ui.konf.tipe === "timpa" ? "Ya, timpa jadwal kelas ini" : rows.length ? "Buat ulang jadwal" : "Buat jadwal", () => {
    ui.gen = { kelas, tgl: f.tgl.value, mulai: f.mulai.value, selesai: f.selesai.value, jumlah: f.jumlah.value, lewati: f.lewati.value };
    const lewati = f.lewati.value.split(/[,\s]+/).filter(Boolean);
    const salah = lewati.find((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x));
    if (!f.tgl.value) return void (ui.pesan = "Isi tanggal pertemuan pertama."), a.ulang();
    if (salah) return void (ui.pesan = "Tanggal yang dilewati harus berbentuk 2026-11-04: " + salah), a.ulang();
    const baru = K.buatJadwal({ kelas, tanggalPertama: f.tgl.value, jamMulai: f.mulai.value, jamSelesai: f.selesai.value, jumlah: f.jumlah.value, lewati });
    if (!baru.length) return void (ui.pesan = "Jadwal tidak sah: periksa jam (selesai harus setelah mulai) dan jumlah pertemuan."), a.ulang();
    if (rows.length && !(ui.konf && ui.konf.tipe === "timpa")) {
      ui.konf = { tipe: "timpa", teks: "" };
      ui.pesan = "Kelas ini sudah punya " + rows.length + " pertemuan. Membuat ulang menimpa semuanya, termasuk libur dan perubahan manual. Tekan sekali lagi untuk melanjutkan.";
      return a.ulang();
    }
    ui.pesan = "";
    return jalankan(baru, "Jadwal dibuat ulang: " + baru.length + " pertemuan, mulai " + K.teksTanggal(baru[0].mulai) + " " + K.jamWib(baru[0].mulai) + "-" + K.jamWib(baru[0].selesai), baru.length);
  }, "btn btn-primary");
  const generator = h("div", { class: "kh-gen" }, h("label", {}, "Pertemuan pertama", f.tgl), h("label", {}, "Mulai", f.mulai), h("label", {}, "Selesai", f.selesai), h("label", {}, "Jumlah", f.jumlah), h("label", {}, "Tanggal dilewati", f.lewati), buat);

  // ---- tabel pertemuan ----
  const statusJ = (j, idx) => {
    if (j.libur) return pil("Libur", "t");
    if (j.selesai <= sekarangT) return pil(j.dipindah ? "Selesai, dipindah" : "Selesai", "k");
    if (j.mulai <= sekarangT) return pil("Berlangsung", "a");
    if (idx === K.pertemuanBerikut(rows, sekarangT)) return pil(j.dipindah ? "Berikutnya, dipindah" : "Berikutnya", "b");
    return pil(j.dipindah ? "Akan datang, dipindah" : "Akan datang", "t");
  };
  const panelEdit = (j) => {
    const geser = ui.edit.mode === "g";
    const e = { tgl: h("input", { type: "date", id: "eTgl", value: K.tanggalWib(j.mulai), "aria-label": "Tanggal" }), hari: h("select", { id: "eHari", "aria-label": "Hari baru" }, OPSI_HARI.map(([v, t]) => h("option", { value: String(v), selected: v === K.hariDariWib(j.mulai) ? "" : false }, t))), mulai: h("input", { type: "time", id: "eMulai", value: K.jamWib(j.mulai), "aria-label": "Mulai" }), selesai: h("input", { type: "time", id: "eSelesai", value: K.jamWib(j.selesai), "aria-label": "Selesai" }) };
    const pesanE = h("p", { class: "form-msg", role: "alert" });
    const ok = tombol("Simpan perubahan", () => {
      let baru;
      let ringkas;
      let terdampak;
      if (geser) {
        baru = K.geserMulai(rows, j.pertemuan, { hari: Number(e.hari.value), jamMulai: e.mulai.value, jamSelesai: e.selesai.value });
        ringkas = "Jadwal digeser mulai P" + j.pertemuan + " ke " + OPSI_HARI.find(([v]) => v === Number(e.hari.value))[1] + " " + e.mulai.value + "-" + e.selesai.value;
        terdampak = rows.filter((x) => x.pertemuan >= j.pertemuan && !x.libur).map((x) => x.pertemuan);
      } else {
        baru = K.ubahSatu(rows, j.pertemuan, { tanggal: e.tgl.value, jamMulai: e.mulai.value, jamSelesai: e.selesai.value });
        ringkas = "P" + j.pertemuan + " dipindah dari " + K.teksTanggal(j.mulai) + " " + K.jamWib(j.mulai) + " ke " + (baru ? K.teksTanggal(baru.find((x) => x.pertemuan === j.pertemuan).mulai) + " " + e.mulai.value : "?");
        terdampak = [j.pertemuan];
      }
      if (!baru) {
        pesanE.textContent = "Isian tidak sah: periksa tanggal dan pastikan jam selesai setelah jam mulai.";
        return;
      }
      ajukan(baru, ringkas, terdampak);
    }, "btn btn-primary");
    return h("div", { class: "kh-edit" }, h("strong", {}, geser ? "Geser P" + j.pertemuan + " dan semua pertemuan sesudahnya" : "Ubah P" + j.pertemuan + " saja"), h("div", { class: "kh-gen" }, geser ? h("label", {}, "Hari baru", e.hari) : h("label", {}, "Tanggal", e.tgl), h("label", {}, "Mulai", e.mulai), h("label", {}, "Selesai", e.selesai), ok, tombol("Batal", () => { ui.edit = null; a.ulang(); })), pesanE);
  };
  const tabel = rows.length
    ? rows.flatMap((j, idx) => [
        h("div", { class: "kh-jrow" }, h("span", {}, "P" + j.pertemuan), h("span", {}, K.teksTanggal(j.mulai)), h("span", {}, K.jamWib(j.mulai) + "-" + K.jamWib(j.selesai)), h("span", {}, statusJ(j, idx)), h("span", { class: "kh-aksi" },
          tombol("Ubah", () => { ui.edit = { n: j.pertemuan, mode: "u" }; ui.konf = null; a.ulang(); }),
          tombol(j.libur ? "Aktifkan" : "Libur", () => ajukan(K.tandaiLibur(rows, j.pertemuan, !j.libur), "P" + j.pertemuan + (j.libur ? " diaktifkan kembali" : " ditandai libur"), [j.pertemuan])),
          tombol("Geser", () => { ui.edit = { n: j.pertemuan, mode: "g" }; ui.konf = null; a.ulang(); }))),
        ui.edit && ui.edit.n === j.pertemuan ? panelEdit(j) : null,
      ])
    : [h("p", { class: "muted" }, "Kelas ini belum punya jadwal. Isi formulir di atas lalu tekan Buat jadwal.")];
  const konfirmasi = ui.konf && ui.konf.aksi ? h("div", { class: "kh-peringatan" }, h("p", {}, ui.konf.teks), h("div", { class: "actions" }, tombol("Terapkan perubahan", ui.konf.aksi, "btn btn-primary"), tombol("Batal", () => { ui.konf = null; a.ulang(); }))) : null;
  const riwayat = cache.riwayat.filter((r) => r.kelas === kelas).slice().reverse().slice(0, 20);
  const anggota = ctx.peserta.filter((p) => K.cariJadwal(ctx.jadwal, p.kelas) === ctx.jadwal.get(kelas) && ctx.jadwal.has(kelas)).length;
  return [
    kartu(
      h("h3", {}, "Jadwal kelas " + kelas),
      h("p", { class: "muted" }, anggota + " peserta di kelas ini. Waktu dalam WIB. Tenggat kesiapan tiap pertemuan = jam mulainya."),
      generator,
      pesanGen
    ),
    kartu(h("h3", {}, "Pertemuan"), konfirmasi, h("div", { class: "kh-jtabel" }, tabel), info("Ubah memindahkan satu pertemuan. Geser memindahkan pertemuan itu dan semua sesudahnya ke hari lain pada minggu yang sama. Libur tidak dihitung dalam persentase hadir. Mengubah pertemuan yang sudah berlangsung selalu meminta konfirmasi dan menampilkan berapa status yang berubah.")),
    kartu(h("h3", {}, "Riwayat perubahan"), riwayat.length ? h("div", { class: "kh-daftar" }, riwayat.map((r) => h("div", { class: "kh-rw" }, h("span", { class: "muted" }, K.teksTanggal(Date.parse(r.dibuat_pada) || 0) + " " + K.jamWib(Date.parse(r.dibuat_pada) || 0)), h("span", {}, r.ringkasan)))) : h("p", { class: "muted" }, "Belum ada perubahan tercatat.")),
    tanpaJadwal(ctx),
  ];
}

// ---------- dialog rincian peserta ----------
function dialogPeserta(ctx, p, a) {
  const b = ctx.hasil.baris.find((x) => x.p.id === p.id);
  const k = kejadianDari(ctx, p.id);
  const hari14 = Array.from({ length: 14 }, (_, i) => K.tanggalWib(ctx.sekarang - i * K.HARI_MS)).map((tgl) => K.ringkasHari(k, tgl)).filter((r) => r.level > 0);
  const perPertemuan = b && b.ada ? b.pertemuan.map((x) => h("li", {}, h("strong", {}, "P" + x.n + " " + K.teksTanggal(x.jadwal.mulai) + ": "), pil(TEKS_STATUS[x.status][0], TEKS_STATUS[x.status][1]), x.status === "hadir" || x.status === "tidak" ? " " + (x.siap.siap ? "siap, selesai " + x.siap.jamSebelum + " jam sebelum kelas" : "belum siap (" + x.siap.menit + " menit aktif, " + x.siap.kerja + " kali mengerjakan)") : "", x.koreksi ? " | dikoreksi dosen" + (x.koreksi.alasan ? ": " + x.koreksi.alasan : "") : "")) : [];
  dialog(p.nama + " (" + (p.nim || "-") + ", " + (p.kelas || "-") + ")", [
    b && b.ada ? h("p", { class: "muted" }, "Hadir " + b.hadir + " dari " + b.total + " pertemuan yang sudah dinilai" + (b.persen !== null ? " (" + b.persen + "%)" : "") + (b.rataJam !== null ? ", rata-rata selesai " + b.rataJam + " jam sebelum kelas" : "") + (b.mepet ? ", " + b.mepet + " kali mepet" : "") + ".") : h("p", { class: "kh-peringatan" }, "Kelas peserta ini belum punya jadwal."),
    k.janggal ? h("p", { class: "muted" }, k.janggal + " catatan memiliki jam perangkat yang menyimpang lebih dari 10 menit dari jam server. Yang dipakai adalah jam server.") : null,
    h("h4", {}, "Per pertemuan"),
    perPertemuan.length ? h("ul", { class: "kh-kegiatan" }, perPertemuan) : h("p", { class: "muted" }, "Belum ada pertemuan."),
    h("h4", {}, "Aktivitas 14 hari terakhir"),
    hari14.length ? h("div", {}, hari14.map((r) => h("div", { class: "kh-blok" }, h("div", { class: "kh-baris" }, h("strong", {}, K.teksTanggal(K.dariWib(r.tgl, "12:00"))), pil(K.teksLevel(r.level), TEKS_LEVEL_KELAS[r.level]), h("span", { class: "muted" }, r.menit + " menit aktif")), h("ul", { class: "kh-kegiatan" }, r.kegiatan.map((x) => h("li", {}, h("b", {}, K.jamWib(x.t)), " " + x.teks)))))) : h("p", { class: "muted" }, "Tidak ada aktivitas tercatat dalam 14 hari terakhir."),
  ]);
}
