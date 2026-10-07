// Logika murni untuk bagian "Jejak peserta": ringkasan semua peserta, riwayat tiap peserta (satu baris per Jalankan atau Kirim),
// kolom yang bisa dipilih, penyaringan, CSV, dan penyusunan rantai rekaman untuk diputar ulang.
// Tidak menyentuh DOM atau jaringan; diuji dengan tools/uji_jejak.mjs.
import { waktuBaris } from "./kehadiran.js";
import { gabungRekaman } from "./rekam.js";

const MS_JAM = 3600000;
const persen = (x) => (x === null || x === undefined || !isFinite(x) ? null : Math.round(x * 100));

/** Kelas warna hasil: k = berhasil, d = gagal atau galat, b = berjalan tetapi belum cocok, t = netral. */
export function teksHasil(r) {
  const o = r.pola || {};
  if (r.jenis === "jalankan") {
    if (r.hasil === "timeout") return { teks: "Terlalu lama", jenis: "d" };
    if (r.hasil === "galat" || r.galat_jenis) return { teks: "Galat", jenis: "d" };
    if (r.cocok_contoh === true) return { teks: "Berjalan, cocok contoh", jenis: "k" };
    if (r.cocok_contoh === false) return { teks: "Berjalan, belum cocok", jenis: "b" };
    return { teks: "Berjalan", jenis: "t" };
  }
  const total = r.kasus_total;
  const lulus = r.kasus_lulus;
  if (o.jenis === "konsep") {
    const p = total ? Math.round((lulus / total) * 100) : null;
    return { teks: (r.lulus ? "Lulus" : "Belum lulus") + (p !== null ? " " + p + "%" : ""), jenis: r.lulus ? "k" : "d" };
  }
  if (r.lulus) return { teks: "Lulus" + (total ? " " + lulus + "/" + total : ""), jenis: "k" };
  return { teks: "Gagal" + (total ? " " + (lulus || 0) + "/" + total : ""), jenis: "d" };
}

/** Satu baris riwayat dengan semua nilai yang mungkin ditampilkan (kolom dipilih di tampilan). */
export function barisRiwayat(r) {
  const o = r.pola || {};
  const h = teksHasil(r);
  return {
    id: r.id,
    t: waktuBaris(r),
    bab: Number(r.bab),
    jenis: r.jenis === "jalankan" ? "Jalankan" : o.jenis === "konsep" ? "Periksa" : "Kirim",
    hasil: h.teks,
    jenisHasil: h.jenis,
    galat: r.galat_jenis || "",
    pesan: r.galat_pesan || "",
    mengetik: o.cps !== null && o.cps !== undefined ? o.cps : o.diketik !== undefined ? o.diketik : null,
    dihapus: persen(o.rasio_hapus),
    linier: persen(o.linier),
    lompat: o.lompat !== undefined ? o.lompat : null,
    jalankan: o.jalankan !== undefined ? o.jalankan : null,
    petunjuk: r.petunjuk === null || r.petunjuk === undefined ? null : r.petunjuk,
    aktif: o.aktif_s !== undefined ? o.aktif_s : null,
    puncak: o.cps_puncak !== undefined ? o.cps_puncak : null,
    panjang: o.panjang_akhir !== undefined ? o.panjang_akhir : null,
    ada: !!r.punyaRekaman,
  };
}

/** Kolom yang bisa dipilih. awal = tampil secara bawaan. */
export const KOLOM = [
  { id: "t", label: "Waktu", awal: true },
  { id: "bab", label: "Bab", awal: true },
  { id: "jenis", label: "Jenis", awal: true },
  { id: "hasil", label: "Hasil", awal: true },
  { id: "galat", label: "Galat", awal: false },
  { id: "mengetik", label: "Mengetik (huruf/dtk)", awal: true },
  { id: "dihapus", label: "Dihapus %", awal: true },
  { id: "linier", label: "Linier %", awal: true },
  { id: "lompat", label: "Lompat", awal: true },
  { id: "jalankan", label: "Jalankan", awal: true },
  { id: "petunjuk", label: "Petunjuk", awal: false },
  { id: "aktif", label: "Aktif (dtk)", awal: false },
  { id: "puncak", label: "Puncak (huruf/dtk)", awal: false },
  { id: "panjang", label: "Panjang kode", awal: false },
];
export const kolomAwal = () => Object.fromEntries(KOLOM.map((k) => [k.id, k.awal]));

/** Menyusun riwayat satu peserta, terlama dulu. */
export function riwayatPeserta(percobaan, userId) {
  return percobaan
    .filter((r) => r.user_id === userId)
    .map(barisRiwayat)
    .sort((a, b) => a.t - b.t || a.id - b.id);
}
/** @param {{bab?:string|number, jenis?:string, hasil?:string}} f jenis: "", "Jalankan", "Kirim"; hasil: "", "berhasil", "gagal" */
export function saringRiwayat(rows, { bab = "", jenis = "", hasil = "" } = {}) {
  return rows.filter((r) => (!bab || String(r.bab) === String(bab)) && (!jenis || r.jenis === jenis || (jenis === "Kirim" && r.jenis === "Periksa")) && (!hasil || (hasil === "berhasil" ? r.jenisHasil === "k" : r.jenisHasil === "d" || r.jenisHasil === "b")));
}

/** Ringkasan satu baris per peserta untuk daftar semua peserta (termasuk yang belum pernah mengerjakan apa pun). */
export function ringkasPeserta({ peserta, percobaan, sesi = [], sekarang }) {
  const perUser = new Map();
  for (const r of percobaan) {
    if (!perUser.has(r.user_id)) perUser.set(r.user_id, []);
    perUser.get(r.user_id).push(r);
  }
  const sesiUser = new Map();
  for (const s of sesi) {
    if (!sesiUser.has(s.user_id)) sesiUser.set(s.user_id, []);
    sesiUser.get(s.user_id).push(s);
  }
  return peserta.map((p) => {
    const rows = perUser.get(p.id) || [];
    const ss = sesiUser.get(p.id) || [];
    const kirim = rows.filter((r) => r.jenis !== "jalankan");
    const lulus = kirim.filter((r) => r.lulus).length;
    const waktu = [...rows.map(waktuBaris), ...ss.map((s) => Date.parse(s.terakhir))].filter(Number.isFinite);
    const terakhir = waktu.length ? Math.max(...waktu) : null;
    return {
      p,
      terakhir,
      aktif24: terakhir !== null && sekarang - terakhir < 24 * MS_JAM,
      sesi: ss.length,
      menit: Math.round(ss.reduce((a, s) => a + (Number(s.aktif_detik) || 0), 0) / 60),
      jalankan: rows.length - kirim.length,
      kirim: kirim.length,
      lulus: kirim.length ? Math.round((lulus / kirim.length) * 100) : null,
      galat: rows.filter((r) => r.hasil === "galat" || r.galat_jenis).length,
      bab: new Set(rows.map((r) => r.bab)).size,
      belumMulai: !rows.length && !ss.length,
    };
  });
}
export const URUT_PESERTA = {
  nama: (a, b) => (a.p.nama || "").localeCompare(b.p.nama || "", "id"),
  terakhir: (a, b) => (b.terakhir || 0) - (a.terakhir || 0),
  sesi: (a, b) => b.sesi - a.sesi,
  menit: (a, b) => b.menit - a.menit,
  jalankan: (a, b) => b.jalankan - a.jalankan,
  kirim: (a, b) => b.kirim - a.kirim,
  lulus: (a, b) => (b.lulus === null ? -1 : b.lulus) - (a.lulus === null ? -1 : a.lulus),
  galat: (a, b) => b.galat - a.galat,
};

/**
 * Rantai rekaman untuk memutar ulang "dari awal bab sampai baris ini" (atau hanya baris ini).
 * @param {{id:number, jenis:string, rekaman:object|null, kode?:string}[]} barisBab semua baris satu peserta di satu bab (urut id)
 * @returns {{rekaman:object|null, kode:string, ada:boolean, segmen:number}}
 */
export function rantaiPutar(barisBab, idTarget, dariAwal = true) {
  const urut = barisBab.slice().sort((a, b) => a.id - b.id);
  const target = urut.find((r) => r.id === idTarget);
  if (!target) return { rekaman: null, kode: "", ada: false, segmen: 0 };
  const sebelum = dariAwal ? urut.filter((r) => r.id < target.id && r.jenis !== "jalankan") : [];
  const daftar = [...sebelum.map((r) => r.rekaman), target.rekaman];
  const gabung = target.rekaman ? gabungRekaman(daftar) : null;
  return { rekaman: gabung, kode: target.kode || "", ada: !!gabung, segmen: daftar.filter(Boolean).length };
}

// ---------- CSV ----------
const kutip = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  const aman = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(aman) ? '"' + aman.replace(/"/g, '""') + '"' : aman;
};
const tglCsv = (t) => (Number.isFinite(t) ? new Date(t + 7 * MS_JAM).toISOString().replace("T", " ").slice(0, 16) : "");
export function csvPeserta(ringkas) {
  const rows = [["NIM", "Nama", "Kelas", "Terakhir aktif (WIB)", "Sesi", "Menit aktif", "Bab dikerjakan", "Jalankan", "Kirim", "Persen lulus", "Galat"].map(kutip).join(",")];
  for (const r of ringkas) rows.push([r.p.nim, r.p.nama, r.p.kelas, tglCsv(r.terakhir), r.sesi, r.menit, r.bab, r.jalankan, r.kirim, r.lulus === null ? "" : r.lulus, r.galat].map(kutip).join(","));
  return rows.join("\r\n") + "\r\n";
}
export function csvRiwayat(rows, peserta) {
  const kepala = ["NIM", "Nama", "Kelas", ...KOLOM.map((k) => k.label)];
  const hasil = [kepala.map(kutip).join(",")];
  for (const r of rows) hasil.push([peserta.nim, peserta.nama, peserta.kelas, ...KOLOM.map((k) => (k.id === "t" ? tglCsv(r.t) : r[k.id]))].map(kutip).join(","));
  return hasil.join("\r\n") + "\r\n";
}
