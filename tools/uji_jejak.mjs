// Menguji logika bagian Jejak peserta (site/js/jejak.js). Jalankan: node tools/uji_jejak.mjs
import * as J from "../site/js/jejak.js";
import { susunUlang } from "../site/js/rekam.js";

let total = 0;
let gagal = 0;
const cek = (nama, kondisi, detail = "") => {
  total++;
  if (!kondisi) {
    gagal++;
    console.log("GAGAL " + nama + (detail ? "  -> " + detail : ""));
  } else console.log("OK    " + nama);
};

const T0 = Date.parse("2026-10-05T12:00:00Z");
const MNT = 60000;
let nid = 0;
const baris = (u, bab, jenis, menit, o = {}) => ({ id: ++nid, user_id: u, bab, jenis, dibuat_pada: new Date(T0 + menit * MNT).toISOString(), diterima_pada: new Date(T0 + menit * MNT + 2000).toISOString(), lulus: jenis === "jalankan" ? null : false, ...o });

console.log("== teks hasil ==");
cek("Jalankan galat", J.teksHasil({ jenis: "jalankan", hasil: "galat", galat_jenis: "NameError" }).jenis === "d");
cek("Jalankan terlalu lama", J.teksHasil({ jenis: "jalankan", hasil: "timeout" }).teks === "Terlalu lama");
cek("Jalankan cocok dengan contoh", J.teksHasil({ jenis: "jalankan", hasil: "jalan", cocok_contoh: true }).jenis === "k");
cek("Jalankan belum cocok", J.teksHasil({ jenis: "jalankan", hasil: "jalan", cocok_contoh: false }).jenis === "b");
cek("Jalankan berjalan tanpa pembanding", J.teksHasil({ jenis: "jalankan", hasil: "jalan", cocok_contoh: null }).teks === "Berjalan");
cek("Kirim lulus dan gagal membawa jumlah kasus", J.teksHasil({ jenis: "kirim", lulus: true, kasus_lulus: 7, kasus_total: 7 }).teks === "Lulus 7/7" && J.teksHasil({ jenis: "kirim", lulus: false, kasus_lulus: 3, kasus_total: 7 }).teks === "Gagal 3/7");
cek("Periksa konsep memakai persen", J.teksHasil({ jenis: "kirim", lulus: true, kasus_lulus: 9, kasus_total: 10, pola: { jenis: "konsep" } }).teks === "Lulus 90%");
cek("baris lama tanpa kolom baru tetap terbaca", J.teksHasil({ jenis: "kirim", lulus: false, kasus_lulus: null, kasus_total: null }).teks === "Gagal");

console.log("\n== riwayat peserta ==");
const semua = [
  baris("a", 4, "jalankan", 10, { hasil: "galat", galat_jenis: "SyntaxError", galat_pesan: "expected ':'", petunjuk: 0, pola: { cps: 2.5, rasio_hapus: 0.1, linier: 0.8, lompat: 1, jalankan: 1 } }),
  baris("a", 4, "jalankan", 15, { hasil: "jalan", cocok_contoh: false, petunjuk: 1, pola: { cps: 3, rasio_hapus: 0.3, linier: 0.5, lompat: 3, jalankan: 2 } }),
  baris("a", 4, "kirim", 20, { kasus_lulus: 3, kasus_total: 7, hasil: "gagal", petunjuk: 1, pola: { cps: 3, rasio_hapus: 0.25, linier: 0.6, lompat: 2, jalankan: 2, panjang_akhir: 120 } }),
  baris("a", 5, "kirim", 60, { lulus: true, kasus_lulus: 5, kasus_total: 5, hasil: "lulus" }),
  baris("b", 4, "kirim", 5, { lulus: true, kasus_lulus: 7, kasus_total: 7 }),
];
const rw = J.riwayatPeserta(semua, "a");
cek("riwayat hanya milik peserta itu dan terurut waktu", rw.length === 4 && rw.every((r, i, a) => i === 0 || a[i - 1].t <= r.t));
cek("kolom Mengetik, Dihapus, Linier, Lompat, Jalankan terisi dari pola", rw[0].mengetik === 2.5 && rw[0].dihapus === 10 && rw[0].linier === 80 && rw[0].lompat === 1 && rw[0].jalankan === 1);
cek("jenis baris: Jalankan, Kirim", rw[0].jenis === "Jalankan" && rw[2].jenis === "Kirim");
cek("galat dan petunjuk terbawa", rw[0].galat === "SyntaxError" && rw[0].pesan === "expected ':'" && rw[1].petunjuk === 1);
cek("baris tanpa pola menampilkan kosong, bukan 0", rw[3].mengetik === null && rw[3].dihapus === null && rw[3].linier === null);
cek("waktu memakai jam server bila ada", rw[0].t === T0 + 10 * MNT + 2000);
cek("kolom awal mencakup yang diminta", ["t", "bab", "hasil", "mengetik", "dihapus", "linier", "lompat", "jalankan"].every((k) => J.kolomAwal()[k]) && !J.kolomAwal().galat);
cek("saring per bab", J.saringRiwayat(rw, { bab: 4 }).length === 3);
cek("saring per jenis", J.saringRiwayat(rw, { jenis: "Jalankan" }).length === 2 && J.saringRiwayat(rw, { jenis: "Kirim" }).length === 2);
cek("saring hasil gagal mencakup galat dan belum cocok, berhasil hanya yang lulus", J.saringRiwayat(rw, { hasil: "gagal" }).length === 3 && J.saringRiwayat(rw, { hasil: "berhasil" }).length === 1);

console.log("\n== ringkasan semua peserta ==");
const peserta = [{ id: "a", nama: "Ani", nim: "1", kelas: "SI-2024-A" }, { id: "b", nama: "Bimo", nim: "2", kelas: "SI-2024-A" }, { id: "c", nama: "Cici", nim: "3", kelas: "SI-2024-A" }];
const SEKARANG = T0 + 2 * 3600000;
const sesi = [{ user_id: "a", terakhir: new Date(T0 + 70 * MNT).toISOString(), aktif_detik: 1800 }, { user_id: "c", terakhir: new Date(T0 - 30 * 3600000).toISOString(), aktif_detik: 600 }];
const rg = J.ringkasPeserta({ peserta, percobaan: semua, sesi, sekarang: SEKARANG });
cek("semua peserta muncul, termasuk yang belum mengerjakan apa pun", rg.length === 3);
cek("Ani: 2 Jalankan, 2 Kirim, 50 persen lulus, 1 galat, 2 bab", rg[0].jalankan === 2 && rg[0].kirim === 2 && rg[0].lulus === 50 && rg[0].galat === 1 && rg[0].bab === 2);
cek("menit aktif dari sesi dan jumlah sesi", rg[0].menit === 30 && rg[0].sesi === 1);
cek("aktif 24 jam terakhir dan terakhir aktif", rg[0].aktif24 && rg[0].terakhir >= T0 + 70 * MNT);
cek("peserta yang hanya membuka (sesi tanpa mengerjakan) tidak dianggap belum mulai", !rg[2].belumMulai && rg[2].kirim === 0 && rg[2].lulus === null && !rg[2].aktif24);
cek("peserta tanpa data sama sekali ditandai belum mulai", J.ringkasPeserta({ peserta: [{ id: "z", nama: "Zed" }], percobaan: [], sesi: [], sekarang: SEKARANG })[0].belumMulai === true);
cek("urutan terakhir aktif dan nama", rg.slice().sort(J.URUT_PESERTA.terakhir)[0].p.id === "a" && rg.slice().sort(J.URUT_PESERTA.nama)[0].p.nama === "Ani");

console.log("\n== rantai putar ulang ==");
const bab4 = [
  { id: 1, jenis: "jalankan", rekaman: { awal: "", e: [["e", 0, 0, 0, "ab", 2, 100]] }, kode: "ab" },
  { id: 2, jenis: "kirim", rekaman: { awal: "", e: [["e", 0, 0, 0, "abc", 3, 200]] }, kode: "abc" },
  { id: 3, jenis: "jalankan", rekaman: { awal: "abc", e: [["e", 0, 3, 0, "d", 1, 0]] }, kode: "abcd" },
  { id: 4, jenis: "kirim", rekaman: { awal: "abc", e: [["e", 0, 3, 0, "de", 2, 50]] }, kode: "abcde" },
  { id: 5, jenis: "jalankan", rekaman: null, kode: "abcdef" },
];
const teksAkhir = (g) => susunUlang(g.rekaman).at(-1).teks;
cek("Kirim: dari awal bab menggabungkan Kirim sebelumnya", teksAkhir(J.rantaiPutar(bab4, 4, true)) === "abcde" && J.rantaiPutar(bab4, 4, true).segmen === 2);
cek("Kirim: hanya segmen ini", J.rantaiPutar(bab4, 4, false).segmen === 1 && susunUlang(J.rantaiPutar(bab4, 4, false).rekaman)[0].teks === "abc");
cek("Jalankan: Kirim sebelumnya ditambah rekaman Jalankan itu (bukan Jalankan lain)", teksAkhir(J.rantaiPutar(bab4, 3, true)) === "abcd" && J.rantaiPutar(bab4, 3, true).segmen === 2);
cek("Jalankan pertama: hanya rekamannya sendiri", J.rantaiPutar(bab4, 1, true).segmen === 1);
cek("rekaman Jalankan yang tidak tersimpan: tidak ada putar ulang tetapi kode tetap tersedia", !J.rantaiPutar(bab4, 5, true).ada && J.rantaiPutar(bab4, 5, true).kode === "abcdef");
cek("id tidak ditemukan tidak melempar galat", !J.rantaiPutar(bab4, 99).ada);

console.log("\n== CSV ==");
const csvP = J.csvPeserta(rg).split("\r\n");
cek("CSV peserta: kepala dan satu baris per peserta", csvP[0].startsWith("NIM,Nama,Kelas") && csvP.length === 5 && csvP[1].includes("Ani"));
const csvR = J.csvRiwayat(rw, { nim: "=1+1", nama: 'A "B", C', kelas: "X" }).split("\r\n");
cek("CSV riwayat memuat semua kolom dan mengamankan rumus dan kutip", csvR[0].includes("Waktu") && csvR[1].startsWith("'=1+1") && csvR[1].includes('"A ""B"", C"') && csvR.length === 6);

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
