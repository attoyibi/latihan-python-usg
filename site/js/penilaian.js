// Logika murni untuk layar penilaian laporan di dashboard instruktur: ringkasan tiap laporan dan antrean "belum dinilai".
// Diuji dengan tools/uji_penilaian.mjs.
import { KOLOM } from "./laporan.js";

export const RUBRIK = [
  { id: "skor_konsep", label: "Ketepatan konsep" },
  { id: "skor_bahasa", label: "Kejelasan dengan bahasa sendiri" },
  { id: "skor_refleksi", label: "Kejujuran refleksi kendala" },
  { id: "skor_kode", label: "Kesesuaian dengan kode atau hasil" },
];

const panjang = (s) => String(s || "").trim().length;

/** Ringkasan satu laporan: kolom memadai, jumlah karakter, berapa persen yang benar-benar diketik, tempel, durasi. */
export function ringkasLaporan(l, kolom = KOLOM) {
  const j = l.jawaban || {};
  const terisi = kolom.filter((k) => panjang(j[k.id]) >= k.min).length;
  const karakter = kolom.reduce((a, k) => a + panjang(j[k.id]), 0);
  const diketik = Object.values(l.jumlah_ketikan || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  // Rasio diketik: huruf yang tercatat diketik dibanding yang ada di laporan. Jauh di bawah 100 persen bila isi masuk lewat jalan lain.
  const rasioKetik = karakter ? Math.min(1, diketik / karakter) : null;
  return { terisi, total: kolom.length, karakter, diketik, rasioKetik, tempel: l.percobaan_tempel || 0, menit: Math.round(((l.durasi_menulis_detik || 0) / 60) * 10) / 10, diekspor: l.dikumpulkan_pada || null };
}

/** Rata-rata skor rubrik (1 sampai 4) atau null bila belum dinilai. */
export function rataSkor(n) {
  if (!n) return null;
  const v = RUBRIK.map((r) => n[r.id]).filter((x) => typeof x === "number");
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
}

/**
 * Menggabungkan laporan, peserta, dan penilaian menjadi baris tabel.
 * @param {{laporan:object[], peserta:object[], penilaian:object[]}} d
 */
export function susunDaftar({ laporan, peserta, penilaian }) {
  const orang = new Map(peserta.map((p) => [p.id, p]));
  const nilai = new Map(penilaian.map((n) => [n.laporan_id, n]));
  return laporan
    .filter((l) => orang.has(l.user_id))
    .map((l) => {
      const n = nilai.get(l.id) || null;
      return { laporan: l, peserta: orang.get(l.user_id), ringkas: ringkasLaporan(l), nilai: n, rata: rataSkor(n), dinilai: !!n };
    })
    .sort((a, b) => a.laporan.bab - b.laporan.bab || (a.peserta.nama || "").localeCompare(b.peserta.nama || "", "id"));
}

export function saringDaftar(daftar, { bab = "", belumDinilai = false, cari = "" } = {}) {
  const q = String(cari).trim().toLowerCase();
  return daftar.filter((x) => (!bab || String(x.laporan.bab) === String(bab)) && (!belumDinilai || !x.dinilai) && (!q || (x.peserta.nama || "").toLowerCase().includes(q) || (x.peserta.nim || "").toLowerCase().includes(q)));
}

/** Memeriksa isian rubrik sebelum disimpan: setiap skor 1 sampai 4. */
export function validasiRubrik(skor, komentar) {
  for (const r of RUBRIK) {
    const v = skor[r.id];
    if (!Number.isInteger(v) || v < 1 || v > 4) return "Skor \"" + r.label + "\" harus 1 sampai 4.";
  }
  if (String(komentar || "").length > 2000) return "Komentar maksimal 2000 karakter.";
  return "";
}

const kutip = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  const aman = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(aman) ? '"' + aman.replace(/"/g, '""') + '"' : aman;
};

export function csvPenilaian(daftar) {
  const baris = [["NIM", "Nama", "Kelas", "Bab", "Kolom memadai", "Karakter", "Persen diketik", "Tempel diblokir", "Menit menulis", "Diekspor", ...RUBRIK.map((r) => r.label), "Rata-rata", "Komentar"].map(kutip).join(",")];
  for (const x of daftar) {
    const r = x.ringkas;
    baris.push([x.peserta.nim, x.peserta.nama, x.peserta.kelas, x.laporan.bab, r.terisi + "/" + r.total, r.karakter, r.rasioKetik === null ? "" : Math.round(r.rasioKetik * 100), r.tempel, r.menit, r.diekspor || "", ...RUBRIK.map((k) => (x.nilai ? x.nilai[k.id] : "")), x.rata === null ? "" : x.rata, x.nilai ? x.nilai.komentar || "" : ""].map(kutip).join(","));
  }
  return baris.join("\r\n") + "\r\n";
}
