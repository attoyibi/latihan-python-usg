#!/usr/bin/env node
// Menguji laporan praktikum (site/js/laporan.js dan pdf.js): selalu terbuka dan bisa diekspor, kelengkapan hanya
// petunjuk, penggabungan dengan server, susunan dan penggambaran PDF.
// Jalankan:  node tools/uji_laporan.mjs
let gagal = 0;
function cek(nama, ok, detail = "") {
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  " + detail));
}
globalThis.window = { crypto: globalThis.crypto };
globalThis.document = { createElement: () => ({}), head: { append() {} }, addEventListener() {}, body: { append() {} } };

const { KOLOM, kelengkapan, keBaris, gabungkan, laporanKosong, kodeVerifikasiBaru } = await import("../site/js/laporan.js");
const { bersihkanTeks, susunLaporan, gambarPdf, namaBerkas } = await import("../site/js/pdf.js");

// ---- data laporan ----
cek("ada lima kolom", KOLOM.length === 5 && KOLOM.map((k) => k.id).join() === "tujuan,konsep,langkah,kendala,kesimpulan");
cek("kode verifikasi 8 karakter tanpa huruf yang mudah tertukar", /^[A-HJ-NP-Z2-9]{8}$/.test(kodeVerifikasiBaru()));
cek("kode verifikasi berbeda tiap kali", new Set(Array.from({ length: 200 }, kodeVerifikasiBaru)).size === 200);
const kosong = laporanKosong();
cek("laporan baru kosong tapi sudah punya kode", Object.keys(kosong.jawaban).length === 0 && kosong.kode.length === 8 && kosong.tempel === 0);
cek("kelengkapan: kosong = 0 dari 5", kelengkapan({}).baik === 0 && !kelengkapan({}).lengkap);
const penuh = { tujuan: "x".repeat(40), konsep: "x".repeat(60), langkah: "x".repeat(60), kendala: "x".repeat(40), kesimpulan: "x".repeat(40) };
cek("kelengkapan: semua memenuhi minimum = lengkap", kelengkapan(penuh).lengkap);
cek("kelengkapan: spasi tidak dihitung", kelengkapan({ tujuan: " ".repeat(100) }).baik === 0);
const baris = keBaris("algoritma-python", 4, { jawaban: penuh, ketikan: { tujuan: 40 }, tempel: 2, durasi: 12.6, kode: "ABCD2345", diekspor: "2026-10-07T00:00:00Z" });
cek("baris server: status SELALU draf (tidak pernah dikunci)", baris.status === "draf");
cek("baris server: durasi dibulatkan dan kode ikut", baris.durasi_menulis_detik === 13 && baris.kode_verifikasi === "ABCD2345" && baris.percobaan_tempel === 2 && baris.matakuliah_id === "algoritma-python" && baris.bab === 4);
cek("baris server memuat waktu ekspor", baris.dikumpulkan_pada === "2026-10-07T00:00:00Z");

// ---- penggabungan dengan server ----
const lokal = { jawaban: { tujuan: "pendek" }, ketikan: { tujuan: 6 }, tempel: 1, durasi: 5, kode: "LOKAL111", diekspor: null };
const server = { jawaban: { tujuan: "jauh lebih panjang dan lengkap", konsep: "ada juga" }, jumlah_ketikan: { tujuan: 30 }, percobaan_tempel: 0, durasi_menulis_detik: 50, kode_verifikasi: "SERVER22", dikumpulkan_pada: "2026-10-06T00:00:00Z" };
const g1 = gabungkan(lokal, server);
cek("server lebih lengkap: isi server dipakai, tempel dan durasi mengambil yang terbesar", g1.jawaban.konsep === "ada juga" && g1.tempel === 1 && g1.durasi === 50 && g1.kode === "SERVER22");
const lokal2 = { jawaban: { tujuan: "jawaban lokal yang lebih panjang daripada server tentunya" }, ketikan: {}, tempel: 0, durasi: 1, kode: "LOKAL333", diekspor: null };
const g2 = gabungkan(lokal2, { jawaban: { tujuan: "pendek" }, kode_verifikasi: "SERVER44" });
cek("lokal lebih lengkap: isi lokal dipertahankan, tetapi kode verifikasi server dipakai agar PDF cocok dengan sistem", g2.jawaban.tujuan.startsWith("jawaban lokal") && g2.kode === "SERVER44");
cek("tanpa baris server: lokal tidak berubah", gabungkan(lokal, null) === lokal);
cek("tanpa lokal: server dipakai", gabungkan(null, server).kode === "SERVER22");

// ---- teks PDF ----
cek("bersihkanTeks: tanda kutip dan panah dibuat ASCII", bersihkanTeks("“kata” → ✓") === '"kata" -> v');
cek("bersihkanTeks: emoji dan huruf non-Latin diganti ?", bersihkanTeks("a\u{1F600}b中") === "a?b?");
cek("bersihkanTeks: huruf Latin-1 (é, ñ) tetap", bersihkanTeks("café señor") === "café señor");
cek("bersihkanTeks: tab menjadi spasi, baris baru tetap", bersihkanTeks("a\tb\r\nc") === "a    b\nc");
cek("bersihkanTeks: null dan undefined aman", bersihkanTeks(null) === "" && bersihkanTeks(undefined) === "");

// ---- susunan laporan ----
const data = { matakuliah: "Algoritma dan Pemrograman", matakuliahId: "algoritma-python", nomor: 4, judul: "Percabangan", nama: "Budi", nim: "2024110099", kelas: "SI-2024-A", kolom: KOLOM, jawaban: { tujuan: "tujuanku", konsep: "konsepku" }, kodeVerifikasi: "ABCD2345", lampiran: { tipe: "kode", judul: "kode terakhir yang dikirim", isi: "print(1)", hasil: "Hasil: belum lulus, 3 dari 7 kasus uji cocok." }, diekspor: new Date(Date.UTC(2026, 9, 7, 3, 0, 0)) };
const blok = susunLaporan(data);
const teks = JSON.stringify(blok);
cek("susunan: judul, identitas, lima bagian, lampiran, dan kode verifikasi", blok[0].t === "judul" && teks.includes("2024110099") && teks.includes("Bab 4: Percabangan") && blok.filter((b) => b.t === "bagian").length === 6 && teks.includes("Kode verifikasi: ABCD2345"));
cek("susunan: kolom kosong tetap muncul bertanda (belum diisi), bukan menghilang", blok.filter((b) => b.t === "paragraf" && b.kosong).length === 3);
cek("susunan: catatan kelengkapan menyebut kolom yang kurang tanpa menolak ekspor", blok[2].t === "catatan" && blok[2].teks.includes("Belum memadai") && blok[2].teks.includes("Langkah pengerjaan"));
cek("susunan: lampiran memuat hasil gagal apa adanya", teks.includes("belum lulus, 3 dari 7"));
cek("susunan: tanpa lampiran tetap valid (bab non-kode)", susunLaporan(Object.assign({}, data, { lampiran: null })).every((b) => b.t !== "kode"));
const lengkap = susunLaporan(Object.assign({}, data, { jawaban: penuh }));
cek("susunan: semua kolom memadai dinyatakan lengkap", lengkap[2].teks.includes("semua 5 kolom"));
cek("nama berkas: huruf kecil dan tanpa spasi", namaBerkas(data) === "laporan-algoritma-python-bab-04-2024110099.pdf", namaBerkas(data));

// ---- penggambaran PDF dengan jsPDF tiruan ----
class JsPdfTiruan {
  constructor() {
    this.halaman = 1;
    this.teks = [];
    this.setPageNo = 1;
  }
  setFont() {}
  setFontSize() {}
  setDrawColor() {}
  setLineWidth() {}
  line() {}
  splitTextToSize(t, w) {
    const hasil = [];
    for (const baris of String(t).split("\n")) {
      for (let i = 0; i < Math.max(1, baris.length); i += 60) hasil.push(baris.slice(i, i + 60));
    }
    return hasil;
  }
  text(t) {
    this.teks.push([this.setPageNo, t]);
  }
  addPage() {
    this.halaman++;
    this.setPageNo = this.halaman;
  }
  getNumberOfPages() {
    return this.halaman;
  }
  setPage(n) {
    this.setPageNo = n;
  }
}
const panjang = Object.assign({}, data, { jawaban: Object.assign({}, penuh, { langkah: Array.from({ length: 140 }, (_, i) => "langkah nomor " + i).join("\n") }), lampiran: Object.assign({}, data.lampiran, { isi: Array.from({ length: 120 }, (_, i) => "baris_kode_" + i + " = " + i).join("\n") }) });
const doc = gambarPdf(JsPdfTiruan, susunLaporan(panjang), panjang.kodeVerifikasi);
cek("laporan panjang membentuk beberapa halaman", doc.halaman >= 3, String(doc.halaman));
const kaki = doc.teks.filter(([, t]) => String(t).startsWith("Kode verifikasi"));
cek("kode verifikasi ada di kaki SETIAP halaman", kaki.length === doc.halaman && new Set(kaki.map(([p]) => p)).size === doc.halaman, JSON.stringify(kaki.length));
cek("nomor halaman ditulis 'i dari n'", doc.teks.some(([, t]) => t === "Halaman " + doc.halaman + " dari " + doc.halaman));
cek("tidak ada isi yang hilang: baris terakhir kode ada di dokumen", doc.teks.some(([, t]) => String(t).includes("baris_kode_119")) && doc.teks.some(([, t]) => String(t).includes("langkah nomor 139")));
const kecil = gambarPdf(JsPdfTiruan, susunLaporan(data), "ABCD2345");
cek("laporan pendek muat satu halaman", kecil.halaman === 1);

console.log(gagal ? "\n" + gagal + " uji GAGAL." : "\nSemua uji lulus.");
process.exit(gagal ? 1 : 0);
