// Logika murni kehadiran dan keaktifan: jadwal per kelas, "siap sebelum kelas", keterlibatan saat kelas, aktivitas per hari
// dan per minggu, serta skor keaktifan. Tidak menyentuh DOM atau jaringan, jadi bisa diuji dengan node
// (tools/uji_kehadiran.mjs). Semua waktu berupa epoch milidetik; tampilan memakai WIB (UTC+7, tanpa waktu musim panas).
//
// Aturan yang dipakai (semuanya tertulis di sini supaya mudah diubah):
//   * Satu pertemuan punya tenggat = jam mulai kelas. "Jendela kesiapan" = 6 hari sebelum jam mulai sampai jam mulai.
//   * Siap = ada pengerjaan (kirim kode atau periksa jawaban konsep, atau lulus bab) di jendela itu. Menekan Jalankan saja tidak dihitung.
//     Bila pencatatan sesi sudah berjalan sejak sebelum jendela dimulai, peserta juga harus aktif minimal
//     AMBANG_MENIT_SIAP menit. Untuk jendela sebelum pencatatan sesi aktif, menit aktif tidak diminta (datanya tidak ada).
//   * Status pertemuan: libur, belum (kelas belum mulai), hadir (siap), tidak (tidak siap). Koreksi manual menimpa.
//   * Jam yang dipakai: jam server bila ada (diterima_pada), jika tidak jam perangkat (dibuat_pada).
export const WIB_MS = 7 * 3600 * 1000;
export const HARI_MS = 86400000;
export const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const JENDELA_HARI = 6;
export const AMBANG_MENIT_SIAP = 20;
export const AMBANG_MENIT_KELAS = 15;
export const MENIT_BACA = 2;
export const SELISIH_WAJAR_MS = 10 * 60 * 1000;
export const AKTIF_LANGSUNG_MS = 2 * 60 * 1000;

const pad = (n) => (n < 10 ? "0" : "") + n;
const angka = (v) => (v === null || v === undefined || v === "" ? NaN : typeof v === "number" ? v : Date.parse(v));

// ---------- waktu WIB ----------
const dw = (t) => new Date(t + WIB_MS);
export const tanggalWib = (t) => {
  const d = dw(t);
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
};
export const jamWib = (t) => {
  const d = dw(t);
  return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
};
export const teksTanggal = (t) => {
  const d = dw(t);
  return HARI[d.getUTCDay()] + " " + d.getUTCDate() + " " + BULAN[d.getUTCMonth()];
};
export const hariDariWib = (t) => dw(t).getUTCDay();
/** Epoch dari tanggal "YYYY-MM-DD" dan jam "HH:MM" yang dimaksud dalam WIB. NaN bila format salah. */
export function dariWib(tgl, jam = "00:00") {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tgl || "");
  const b = /^(\d{1,2}):(\d{2})$/.exec(jam || "");
  if (!a || !b) return NaN;
  return Date.UTC(+a[1], +a[2] - 1, +a[3], +b[1], +b[2]) - WIB_MS;
}
/** Senin 00:00 WIB dari minggu yang memuat t. */
export function awalMinggu(t) {
  const d = dw(t);
  const mundur = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mundur) - WIB_MS;
}
export const awalHari = (t) => dariWib(tanggalWib(t), "00:00");
export const sisaTeks = (m) => {
  const menit = Math.max(0, Math.round(m / 60000));
  if (menit < 60) return menit + " menit";
  if (menit < 1440) return Math.floor(menit / 60) + " jam " + (menit % 60) + " menit";
  return Math.floor(menit / 1440) + " hari " + Math.round((menit % 1440) / 60) + " jam";
};

/** Jam yang dipercaya untuk satu baris: jam server bila ada, jika tidak jam perangkat. */
export function waktuBaris(r) {
  const s = angka(r.diterima_pada);
  return Number.isFinite(s) ? s : angka(r.dibuat_pada);
}
/** Selisih jam perangkat dan jam server (menit) bila lebih dari batas wajar; selain itu null. */
export function selisihJam(r) {
  const s = angka(r.diterima_pada);
  const p = angka(r.dibuat_pada);
  if (!Number.isFinite(s) || !Number.isFinite(p)) return null;
  return Math.abs(s - p) > SELISIH_WAJAR_MS ? Math.round((p - s) / 60000) : null;
}

// ---------- kejadian per peserta ----------
/**
 * @returns {Map<string,{kerja:{t:number,bab:number,lulus:boolean}[], sesi:{mulai:number,akhir:number,aktif:number,bab:number[]}[], janggal:number}>}
 * kerja: setiap pengerjaan (kirim kode/jawaban) dan lulus bab; sesi: tiap kali situs dibuka; janggal: jumlah baris dengan jam perangkat menyimpang.
 */
export function susunKejadian({ percobaan = [], progres = [], sesi = [] }) {
  const peta = new Map();
  const ambil = (id) => {
    if (!peta.has(id)) peta.set(id, { kerja: [], sesi: [], jalan: [], janggal: 0 });
    return peta.get(id);
  };
  for (const r of percobaan) {
    const t = waktuBaris(r);
    if (!Number.isFinite(t)) continue;
    if (r.jenis === "jalankan") {
      ambil(r.user_id).jalan.push(t); // tombol Jalankan dihitung untuk ringkasan, tetapi bukan pengerjaan untuk kehadiran
      continue;
    }
    const k = ambil(r.user_id);
    k.kerja.push({ t, bab: Number(r.bab), lulus: !!r.lulus });
    if (selisihJam(r) !== null) k.janggal++;
  }
  for (const r of progres) {
    const t = angka(r.lulus_pada);
    if (!Number.isFinite(t) || r.status !== "selesai") continue;
    // Bila percobaan lulus yang sesuai sudah ada (selisih kecil), tidak dihitung dua kali.
    const k = ambil(r.user_id);
    if (!k.kerja.some((x) => x.lulus && x.bab === Number(r.bab) && Math.abs(x.t - t) < 10 * 60000)) k.kerja.push({ t, bab: Number(r.bab), lulus: true });
  }
  for (const r of sesi) {
    const m = angka(r.mulai);
    const a = angka(r.terakhir);
    if (!Number.isFinite(m) || !Number.isFinite(a)) continue;
    ambil(r.user_id).sesi.push({ mulai: m, akhir: Math.max(a, m), aktif: Math.max(0, Number(r.aktif_detik) || 0), bab: (r.bab_dibuka || []).map(Number) });
  }
  for (const k of peta.values()) {
    k.kerja.sort((a, b) => a.t - b.t);
    k.sesi.sort((a, b) => a.mulai - b.mulai);
    k.jalan.sort((a, b) => a - b);
  }
  return peta;
}
export const kejadianKosong = () => ({ kerja: [], sesi: [], jalan: [], janggal: 0 });
/** Kapan pencatatan sesi mulai berjalan (sesi paling awal di seluruh data) atau null bila belum ada. */
export function sesiMulaiGlobal(sesi) {
  let min = null;
  for (const r of sesi) {
    const m = angka(r.mulai);
    if (Number.isFinite(m) && (min === null || m < min)) min = m;
  }
  return min;
}

// ---------- siap sebelum kelas ----------
export function hitungSiap(k, mulai, { sekarang, sesiMulai = null }) {
  const awal = mulai - JENDELA_HARI * HARI_MS;
  const akhir = Math.min(mulai, sekarang);
  const kerja = k.kerja.filter((x) => x.t >= awal && x.t <= akhir);
  const lulus = kerja.filter((x) => x.lulus);
  const menit = Math.round(k.sesi.filter((s) => s.akhir >= awal && s.mulai <= akhir).reduce((a, s) => a + s.aktif, 0) / 60);
  const pakaiMenit = sesiMulai !== null && awal >= sesiMulai;
  const siap = kerja.length > 0 && (!pakaiMenit || menit >= AMBANG_MENIT_SIAP);
  const terakhir = kerja.length ? Math.max(...kerja.map((x) => x.t)) : null;
  const jamSebelum = terakhir === null ? null : Math.max(0, Math.round((mulai - terakhir) / 3600000));
  let status = "belum";
  if (siap) status = "siap";
  else if (kerja.length) status = "kurang";
  else if (menit >= MENIT_BACA) status = "membaca";
  return { siap, status, menit, kerja: kerja.length, lulus: lulus.length, terakhir, jamSebelum, mepet: jamSebelum !== null && jamSebelum < 3, pakaiMenit };
}

// ---------- saat kelas ----------
export function hitungSaatKelas(k, mulai, selesai, { sekarang, sesiMulai = null }) {
  const tersedia = sesiMulai !== null && mulai >= sesiMulai;
  if (sekarang < mulai) return { tersedia, mulaiKelas: false, jalan: false, selesai: false, menit: 0, kerja: 0, aktif: false };
  const batas = Math.min(selesai, sekarang);
  let detik = 0;
  for (const s of k.sesi) {
    const tumpang = Math.min(s.akhir, batas) - Math.max(s.mulai, mulai);
    if (tumpang <= 0) continue;
    const panjang = Math.max(1, s.akhir - s.mulai);
    detik += s.aktif * Math.min(1, tumpang / panjang);
  }
  const kerja = k.kerja.filter((x) => x.t >= mulai && x.t <= batas).length;
  const menit = Math.round(detik / 60);
  return { tersedia, mulaiKelas: true, jalan: sekarang < selesai, selesai: sekarang >= selesai, menit, kerja, aktif: menit >= AMBANG_MENIT_KELAS || kerja > 0 };
}
/** Banyak peserta aktif tiap 10 menit selama kelas (untuk grafik). */
export function grafikKelas(daftarKejadian, mulai, selesai) {
  const bin = 10 * 60000;
  const n = Math.max(1, Math.ceil((selesai - mulai) / bin));
  const hasil = new Array(n).fill(0);
  for (const k of daftarKejadian) {
    for (let i = 0; i < n; i++) {
      const a = mulai + i * bin;
      const b = a + bin;
      if (k.sesi.some((s) => s.mulai < b && s.akhir > a && s.aktif > 0) || k.kerja.some((x) => x.t >= a && x.t < b)) hasil[i]++;
    }
  }
  return hasil;
}
/** Peserta yang aktif tepat sekarang (denyut terakhir dalam 2 menit). */
export const aktifSekarang = (k, sekarang) => k.sesi.some((s) => s.mulai <= sekarang && sekarang - s.akhir <= AKTIF_LANGSUNG_MS);

// ---------- status pertemuan ----------
export function statusPertemuan({ jadwal, siap, koreksi, sekarang }) {
  if (jadwal.libur) return "libur";
  if (koreksi) return koreksi.status === "hadir" ? "hadir" : "tidak";
  if (sekarang < jadwal.mulai) return "belum";
  return siap ? "hadir" : "tidak";
}
export function pola({ siap, saat }) {
  const adaKelas = !!saat && saat.tersedia && saat.selesai;
  if (!adaKelas) return siap ? ["Menyiapkan diri", "a"] : ["Belum menyiapkan diri", "d"];
  if (siap && saat.aktif) return ["Lengkap", "k"];
  if (siap) return ["Menyiapkan diri, tidak aktif di situs saat kelas", "t"];
  if (saat.aktif) return ["Aktif di kelas, belum menyiapkan diri", "b"];
  return ["Belum menyiapkan diri, tidak aktif saat kelas", "d"];
}

const normKelas = (s) => String(s || "").toUpperCase().replace(/[\s_-]+/g, "");

/** Mengelompokkan baris jadwal per kelas (kunci = kelas apa adanya), terurut pertemuan, dengan mulai dan selesai berupa ms. */
export function kelompokJadwal(baris) {
  const peta = new Map();
  for (const r of baris) {
    const mulai = angka(r.mulai);
    const selesai = angka(r.selesai);
    if (!Number.isFinite(mulai) || !Number.isFinite(selesai)) continue;
    if (!peta.has(r.kelas)) peta.set(r.kelas, []);
    peta.get(r.kelas).push({ kelas: r.kelas, pertemuan: Number(r.pertemuan), mulai, selesai, libur: !!r.libur, dipindah: !!r.dipindah, catatan: r.catatan || "" });
  }
  for (const a of peta.values()) a.sort((x, y) => x.pertemuan - y.pertemuan);
  return peta;
}
export function cariJadwal(peta, kelas) {
  if (peta.has(kelas)) return peta.get(kelas);
  const n = normKelas(kelas);
  for (const [k, v] of peta) if (normKelas(k) === n) return v;
  return null;
}

/**
 * Hasil utama: status tiap peserta di tiap pertemuan kelasnya.
 * @param {{peserta:object[], jadwal:Map, kejadian:Map, koreksi:object[], sekarang:number, sesiMulai:number|null}} d
 */
export function susunKehadiran({ peserta, jadwal, kejadian, koreksi = [], sekarang, sesiMulai = null }) {
  const kor = new Map(koreksi.map((x) => [x.user_id + "|" + x.pertemuan, x]));
  const tanpaJadwal = [];
  const hasil = peserta.map((p) => {
    const rows = cariJadwal(jadwal, p.kelas);
    const k = kejadian.get(p.id) || kejadianKosong();
    if (!rows) {
      tanpaJadwal.push(p);
      return { p, ada: false, pertemuan: [], hadir: 0, total: 0, persen: null, rataJam: null, mepet: 0 };
    }
    const pertemuan = rows.map((j) => {
      const siap = hitungSiap(k, j.mulai, { sekarang, sesiMulai });
      const saat = hitungSaatKelas(k, j.mulai, j.selesai, { sekarang, sesiMulai });
      const ko = kor.get(p.id + "|" + j.pertemuan) || null;
      const status = statusPertemuan({ jadwal: j, siap: siap.siap, koreksi: ko, sekarang });
      return { n: j.pertemuan, jadwal: j, siap, saat, koreksi: ko, status, pola: pola({ siap: siap.siap, saat }) };
    });
    const dinilai = pertemuan.filter((x) => x.status === "hadir" || x.status === "tidak");
    const hadir = dinilai.filter((x) => x.status === "hadir").length;
    const jam = pertemuan.filter((x) => x.status === "hadir" && x.siap.jamSebelum !== null).map((x) => x.siap.jamSebelum);
    return { p, ada: true, pertemuan, hadir, total: dinilai.length, persen: dinilai.length ? Math.round((hadir / dinilai.length) * 100) : null, rataJam: jam.length ? Math.round(jam.reduce((a, b) => a + b, 0) / jam.length) : null, mepet: pertemuan.filter((x) => x.status === "hadir" && x.siap.mepet).length };
  });
  return { baris: hasil, tanpaJadwal };
}

/** Pertemuan terdekat yang belum mulai untuk satu kelas (indeks di array jadwal) atau -1. */
export function pertemuanBerikut(rows, sekarang) {
  return rows.findIndex((j) => !j.libur && j.mulai > sekarang);
}
/** Pertemuan yang sedang berlangsung (indeks) atau -1. */
export function pertemuanBerlangsung(rows, sekarang) {
  return rows.findIndex((j) => !j.libur && j.mulai <= sekarang && sekarang < j.selesai);
}

// ---------- aktivitas per hari dan per minggu ----------
const TEKS_LEVEL = { 0: "Tidak aktif", 1: "Hanya membaca", 2: "Mengerjakan", 3: "Lulus bab" };
export const teksLevel = (l) => TEKS_LEVEL[l] || TEKS_LEVEL[0];

/** Ringkasan satu peserta pada satu tanggal WIB ("YYYY-MM-DD"). */
export function ringkasHari(k, tgl) {
  const awal = dariWib(tgl, "00:00");
  const akhir = awal + HARI_MS;
  const kerja = k.kerja.filter((x) => x.t >= awal && x.t < akhir);
  // Sesi dihitung pada hari ia dimulai (satu sesi yang melewati tengah malam tidak dihitung aktif di dua hari).
  const sesi = k.sesi.filter((s) => s.mulai >= awal && s.mulai < akhir);
  const menit = Math.round(sesi.reduce((a, s) => a + s.aktif, 0) / 60);
  const lulus = kerja.filter((x) => x.lulus).length;
  const level = lulus ? 3 : kerja.length ? 2 : menit >= MENIT_BACA ? 1 : 0;
  const kegiatan = [];
  for (const s of sesi) kegiatan.push({ t: s.mulai, teks: "Membuka situs" + (s.bab.length ? " (bab " + s.bab.join(", ") + ")" : "") + ", aktif " + Math.round(s.aktif / 60) + " menit" });
  for (const x of kerja) kegiatan.push({ t: x.t, teks: "Mengirim jawaban bab " + x.bab + (x.lulus ? ", lulus" : ", belum lulus") });
  kegiatan.sort((a, b) => a.t - b.t);
  const semua = [...sesi.map((s) => s.mulai), ...kerja.map((x) => x.t)];
  const ujung = [...sesi.map((s) => s.akhir), ...kerja.map((x) => x.t)];
  return { tgl, level, menit, kerja: kerja.length, lulus, awal: semua.length ? Math.min(...semua) : null, akhir: ujung.length ? Math.max(...ujung) : null, kegiatan };
}
/** Tujuh hari (Senin sampai Minggu) mulai dari awalMinggu. */
export function ringkasMinggu(k, awalSenin, sekarang) {
  const hari = [];
  for (let i = 0; i < 7; i++) {
    const t = awalSenin + i * HARI_MS;
    const r = ringkasHari(k, tanggalWib(t));
    hari.push(Object.assign(r, { depan: t > sekarang }));
  }
  const ada = hari.filter((h) => !h.depan);
  return { hari, menit: ada.reduce((a, h) => a + h.menit, 0), hariAktif: ada.filter((h) => h.level > 0).length, hariKerja: ada.filter((h) => h.level >= 2).length, lulus: ada.reduce((a, h) => a + h.lulus, 0) };
}

// ---------- skor keaktifan ----------
/**
 * Ringkasan 0 sampai 100 untuk membantu nilai akhir (bukan nilai itu sendiri).
 * Bobot: waktu aktif 30, bab lulus 30, hari mengerjakan 20, laporan 20. Bila belum ada data sesi, bobot waktu
 * dibuang dan skor dihitung dari tiga komponen lain (skala ke 100) supaya peserta lama tidak dirugikan.
 */
export function skorKeaktifan({ k, laporan = 0, target, tersediaWaktu, minggu }) {
  const babLulus = new Set(k.kerja.filter((x) => x.lulus).map((x) => x.bab)).size;
  const hariKerja = new Set(k.kerja.map((x) => tanggalWib(x.t))).size;
  const menit = Math.round(k.sesi.reduce((a, s) => a + s.aktif, 0) / 60);
  const rasio = (n, t) => (t > 0 ? Math.min(1, n / t) : 0);
  const waktu = tersediaWaktu ? rasio(menit / Math.max(1, minggu), target.menitPerMinggu) * 30 : null;
  const bab = rasio(babLulus, target.bab) * 30;
  const hari = rasio(hariKerja, target.hari) * 20;
  const lap = rasio(laporan, target.laporan) * 20;
  const skor = waktu === null ? Math.round(((bab + hari + lap) / 70) * 100) : Math.round(waktu + bab + hari + lap);
  return { skor: Math.min(100, skor), waktu, bab, hari, lap, babLulus, hariKerja, menit, tersediaWaktu };
}

// ---------- membuat dan mengubah jadwal ----------
/** Jadwal mingguan: mulai dari tanggalPertama, tiap 7 hari, melewati tanggal di `lewati` (tidak memakai nomor pertemuan). */
export function buatJadwal({ kelas, tanggalPertama, jamMulai, jamSelesai, jumlah, lewati = [] }) {
  const m = dariWib(tanggalPertama, jamMulai);
  const s = dariWib(tanggalPertama, jamSelesai);
  if (!Number.isFinite(m) || !Number.isFinite(s) || s <= m) return [];
  const lewat = new Set(lewati);
  const baris = [];
  const jumlahOk = Math.max(0, Math.min(40, Math.floor(Number(jumlah) || 0)));
  for (let i = 0; baris.length < jumlahOk && i < 200; i++) {
    const tgl = tanggalWib(m + i * 7 * HARI_MS);
    if (lewat.has(tgl)) continue;
    baris.push({ kelas, pertemuan: baris.length + 1, mulai: m + i * 7 * HARI_MS, selesai: s + i * 7 * HARI_MS, libur: false, dipindah: false, catatan: "" });
  }
  return baris;
}
/** Mengubah satu pertemuan ke tanggal dan jam baru. Mengembalikan baris baru (tidak mengubah masukan) atau null bila tidak sah. */
export function ubahSatu(rows, n, { tanggal, jamMulai, jamSelesai }) {
  const m = dariWib(tanggal, jamMulai);
  const s = dariWib(tanggal, jamSelesai);
  if (!Number.isFinite(m) || !Number.isFinite(s) || s <= m) return null;
  return rows.map((j) => (j.pertemuan === n ? Object.assign({}, j, { mulai: m, selesai: s, dipindah: true, libur: false }) : Object.assign({}, j)));
}
/**
 * Menggeser pertemuan ke-n dan semua sesudahnya ke hari lain (0=Min..6=Sab) pada minggu yang sama, jam baru.
 * Pertemuan libur dibiarkan.
 */
export function geserMulai(rows, n, { hari, jamMulai, jamSelesai }) {
  const jm = /^(\d{1,2}):(\d{2})$/.exec(jamMulai || "");
  const js = /^(\d{1,2}):(\d{2})$/.exec(jamSelesai || "");
  if (!jm || !js || !(hari >= 0 && hari <= 6)) return null;
  const menitM = +jm[1] * 60 + +jm[2];
  const menitS = +js[1] * 60 + +js[2];
  if (menitS <= menitM) return null;
  return rows.map((j) => {
    if (j.pertemuan < n || j.libur) return Object.assign({}, j);
    const senin = awalMinggu(j.mulai);
    const target = (hari + 6) % 7;
    const baruMulai = senin + target * HARI_MS + menitM * 60000;
    const baruSelesai = senin + target * HARI_MS + menitS * 60000;
    const ubah = baruMulai !== j.mulai || baruSelesai !== j.selesai;
    return Object.assign({}, j, { mulai: baruMulai, selesai: baruSelesai, dipindah: j.dipindah || ubah });
  });
}
export const tandaiLibur = (rows, n, libur) => rows.map((j) => (j.pertemuan === n ? Object.assign({}, j, { libur: !!libur }) : Object.assign({}, j)));

// ---------- CSV ----------
const kutip = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  const aman = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(aman) ? '"' + aman.replace(/"/g, '""') + '"' : aman;
};
const KODE_STATUS = { hadir: "H", tidak: "A", libur: "L", belum: "-" };
export function csvKehadiran(baris) {
  const maks = Math.max(0, ...baris.map((b) => Math.max(0, ...b.pertemuan.map((x) => x.n))));
  const kepala = ["NIM", "Nama", "Kelas", ...Array.from({ length: maks }, (_, i) => "P" + (i + 1)), "Hadir", "Dinilai", "Persen hadir", "Rata-rata selesai (jam sebelum kelas)", "Mepet"];
  const rows = [kepala.map(kutip).join(",")];
  for (const b of baris) {
    const sel = Array.from({ length: maks }, (_, i) => {
      const x = b.pertemuan.find((y) => y.n === i + 1);
      return x ? KODE_STATUS[x.status] + (x.koreksi ? "*" : "") : "";
    });
    rows.push([b.p.nim, b.p.nama, b.p.kelas, ...sel, b.hadir, b.total, b.persen === null ? "" : b.persen, b.rataJam === null ? "" : b.rataJam, b.mepet].map(kutip).join(","));
  }
  return rows.join("\r\n") + "\r\n";
}

// ---------- periode: minggu, bulan, semester ----------
export const awalBulan = (t) => {
  const d = dw(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - WIB_MS;
};
export const awalBulanBerikut = (t) => {
  const d = dw(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - WIB_MS;
};
export const labelBulan = (t) => {
  const d = dw(t);
  return BULAN[d.getUTCMonth()] + " " + d.getUTCFullYear();
};
/** Berapa hari aktif dalam satu minggu menjadi tingkat warna 0 sampai 3. */
export const levelHariAktif = (n) => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3);

/**
 * Batas semester otomatis dari jadwal: Senin pekan pertemuan pertama sampai akhir pekan pertemuan terakhir (pertemuan libur tidak dihitung).
 * @param {object[][]} daftarJadwal array berisi array baris jadwal (satu per kelas) yang dipakai
 * @param {number|null} awalData bila belum ada jadwal, awal dipakai dari data paling awal (akhir = sekarang)
 * @returns {{mulai:number, akhir:number, dariJadwal:boolean}|null} akhir bersifat eksklusif; null bila tidak ada data sama sekali
 */
export function periodeSemester(daftarJadwal, sekarang, awalData = null) {
  const aktif = daftarJadwal.flat().filter((j) => !j.libur);
  if (aktif.length) {
    const mulai = awalMinggu(Math.min(...aktif.map((j) => j.mulai)));
    const akhir = awalMinggu(Math.max(...aktif.map((j) => j.selesai))) + 7 * HARI_MS;
    return { mulai, akhir, dariJadwal: true };
  }
  if (awalData === null || awalData === undefined || !Number.isFinite(awalData)) return null;
  return { mulai: awalMinggu(awalData), akhir: awalMinggu(sekarang) + 7 * HARI_MS, dariJadwal: false };
}
/** Senin 00:00 WIB tiap minggu dalam periode. */
export function daftarMinggu(p) {
  const a = [];
  for (let t = p.mulai; t < p.akhir; t += 7 * HARI_MS) a.push(t);
  return a;
}
/** Awal tiap bulan (WIB) yang beririsan dengan periode. */
export function daftarBulan(p) {
  const a = [];
  for (let t = awalBulan(p.mulai); t < p.akhir; t = awalBulanBerikut(t)) a.push(t);
  return a;
}
/**
 * Ringkasan satu peserta pada rentang [awal, akhirEx). Hari yang belum terjadi (setelah sekarang) tidak dihitung.
 * menit dijumlah dari sesi yang MULAI di rentang itu (tidak ganda walau sesi melewati tengah malam).
 */
export function ringkasRentang(k, awal, akhirEx, sekarang) {
  const batas = Math.min(akhirEx, sekarang + 1);
  let hariAktif = 0;
  let hariKerja = 0;
  for (let t = awalHari(awal); t < batas; t += HARI_MS) {
    const r = ringkasHari(k, tanggalWib(t));
    if (r.level > 0) hariAktif++;
    if (r.level >= 2) hariKerja++;
  }
  const kerja = k.kerja.filter((x) => x.t >= awal && x.t < batas);
  const lulus = kerja.filter((x) => x.lulus);
  return {
    hariAktif,
    hariKerja,
    menit: Math.round(k.sesi.filter((s) => s.mulai >= awal && s.mulai < batas).reduce((a, s) => a + s.aktif, 0) / 60),
    kirim: kerja.length,
    jalankan: k.jalan.filter((t) => t >= awal && t < batas).length,
    lulus: lulus.length,
    babLulus: new Set(lulus.map((x) => x.bab)).size,
  };
}
/** Satu entri per minggu: hari aktif, menit, dan tingkat warna. depan = minggu belum berlangsung. */
export function kurvaMingguan(k, minggu, sekarang) {
  return minggu.map((awal) => {
    const depan = awal > sekarang;
    const r = depan ? { hariAktif: 0, hariKerja: 0, menit: 0, kirim: 0, jalankan: 0, lulus: 0, babLulus: 0 } : ringkasRentang(k, awal, awal + 7 * HARI_MS, sekarang);
    return Object.assign({ awal, depan, level: levelHariAktif(r.hariAktif) }, r);
  });
}
/** Rata-rata beberapa baris ringkasan (mis. satu kelas). */
export function rataRingkas(rows) {
  const n = rows.length;
  const rata = (f) => (n ? Math.round((rows.reduce((a, r) => a + f(r), 0) / n) * 10) / 10 : 0);
  return { n, hariAktif: rata((r) => r.total.hariAktif), menit: rata((r) => r.total.menit), kirim: rata((r) => r.total.kirim), babLulus: rata((r) => r.total.babLulus), hadir: n ? Math.round(rows.reduce((a, r) => a + (r.persenHadir === null ? 0 : r.persenHadir), 0) / n) : 0, skor: rata((r) => r.skor) };
}
export function csvSemester(rows, minggu) {
  const kepala = ["NIM", "Nama", "Kelas", "Hari aktif", "Hari mengerjakan", "Menit aktif", "Pengerjaan (Kirim dan Periksa)", "Jalankan", "Bab lulus", "Persen hadir", "Skor keaktifan", ...minggu.map((t, i) => "M" + (i + 1) + " " + tanggalWib(t).slice(5) + " (hari aktif)")];
  const hasil = [kepala.map(kutip).join(",")];
  for (const r of rows) hasil.push([r.p.nim, r.p.nama, r.p.kelas, r.total.hariAktif, r.total.hariKerja, r.total.menit, r.total.kirim, r.total.jalankan, r.total.babLulus, r.persenHadir === null ? "" : r.persenHadir, r.skor, ...r.minggu.map((m) => (m.depan ? "" : m.hariAktif))].map(kutip).join(","));
  return hasil.join("\r\n") + "\r\n";
}
