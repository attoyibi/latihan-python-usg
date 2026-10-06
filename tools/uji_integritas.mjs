#!/usr/bin/env node
// Menguji analisis sinyal keaslian (site/js/integritas.js): tiap sinyal harus muncul pada kasus yang tepat dan
// TIDAK muncul pada kasus wajar (laboratorium, kesalahan umum, kelas kecil).
// Jalankan:  node tools/uji_integritas.mjs
import { analisis, ciriKhas, normalisasi, csvSinyal } from "../site/js/integritas.js";

let gagal = 0;
function cek(nama, ok, detail = "") {
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  " + detail));
}
const ada = (h, kode, bab) => h.sinyal.some((s) => s.kode === kode && (bab === undefined || s.bab === bab));
const dari = (r, id) => r.hasil.find((h) => h.peserta.id === id);

const mkPeserta = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + (i + 1), nama: "Peserta " + (i + 1), nim: "100" + i, kelas: "SI-2024-A" }));
const waktu = (menit) => new Date(Date.UTC(2026, 9, 6, 8, 0, 0) + menit * 60000).toISOString();

// ---------- ciri khas dan normalisasi ----------
{
  const c = ciriKhas('total_kotor = jumlah_boks * harga  # hitung dulu\nprint("Total: Rp", hasil_akhir_ku)\n');
  cek("ciri khas memuat nama bebas", c.has("n:total_kotor") && c.has("n:hasil_akhir_ku"));
  cek("ciri khas memuat komentar", c.has("k:hitung dulu"));
  cek("ciri khas mengabaikan isi tulisan di tanda kutip", ![...c].some((x) => x.includes("Total: Rp")));
  const j = ciriKhas("int sisaBiji = a % 20; // sisa\n/* blok komentar */\nString s = \"// bukan komentar\";");
  cek("Java: komentar // dan /* */ terbaca, tulisan berisi // tidak dianggap komentar", j.has("k:sisa") && j.has("k:blok komentar") && !j.has("k:bukan komentar\";"));
  cek("normalisasi membuang spasi ujung dan baris kosong", normalisasi("a = 1  \r\n\r\nb = 2\n") === "a = 1\nb = 2");
}

// ---------- perangkat ----------
{
  const peserta = mkPeserta(5);
  const sesi = [
    { user_id: "p1", device_id: "dev-aaaaaaaaaaaaaaaaaaaaaaaa", jumlah_masuk: 5, agen: "Chrome di Windows", pertama_dilihat: waktu(0), terakhir_dilihat: waktu(500) },
    { user_id: "p2", device_id: "dev-aaaaaaaaaaaaaaaaaaaaaaaa", jumlah_masuk: 2, agen: "Chrome di Windows", pertama_dilihat: waktu(100), terakhir_dilihat: waktu(300) },
    { user_id: "p3", device_id: "dev-bbbbbbbbbbbbbbbbbbbbbbbb", jumlah_masuk: 1, agen: "Firefox di Linux", pertama_dilihat: waktu(0), terakhir_dilihat: waktu(1) },
    { user_id: "p4", device_id: "dev-bbbbbbbbbbbbbbbbbbbbbbbb", jumlah_masuk: 1, agen: "Firefox di Linux", pertama_dilihat: waktu(2), terakhir_dilihat: waktu(3) },
    { user_id: "p5", device_id: "dev-bbbbbbbbbbbbbbbbbbbbbbbb", jumlah_masuk: 1, agen: "Firefox di Linux", pertama_dilihat: waktu(4), terakhir_dilihat: waktu(5) },
  ];
  const r = analisis({ peserta, sesi });
  cek("dua akun satu perangkat: sinyal sedang untuk keduanya", ada(dari(r, "p1"), "perangkat-bersama") && ada(dari(r, "p2"), "perangkat-bersama") && dari(r, "p1").sinyal[0].tingkat === "sedang");
  cek("tiga akun satu perangkat: tingkat tinggi", dari(r, "p3").sinyal.find((s) => s.kode === "perangkat-bersama").tingkat === "tinggi");
  cek("alasan menyebut nama akun lain", dari(r, "p1").sinyal[0].alasan.includes("Peserta 2"));
  cek("daftar perangkat memuat jumlah akun, terbanyak dulu", r.perangkat[0].akun.length === 3);
  const lab = analisis({ peserta, sesi, bersama: [{ device_id: "dev-bbbbbbbbbbbbbbbbbbbbbbbb" }] });
  cek("perangkat yang ditandai laboratorium tidak menghasilkan sinyal", !ada(dari(lab, "p3"), "perangkat-bersama") && ada(dari(lab, "p1"), "perangkat-bersama"));
  cek("perangkat laboratorium tetap muncul di daftar dengan tanda bersama", lab.perangkat.find((d) => d.device_id === "dev-bbbbbbbbbbbbbbbbbbbbbbbb").bersama === true);
  const dua = analisis({ peserta, sesi: [sesi[0], { ...sesi[0], device_id: "dev-cccccccccccccccccccccccc", agen: "Safari di iOS (ponsel)" }] });
  cek("satu akun, dua perangkat: hanya sinyal rendah", dari(dua, "p1").sinyal.length === 1 && dari(dua, "p1").sinyal[0].kode === "perangkat-banyak" && dari(dua, "p1").sinyal[0].tingkat === "rendah");
  const baru = analisis({ peserta, sesi: Array.from({ length: 5 }, (_, i) => ({ user_id: "p1", device_id: "dev-" + String(i).repeat(24), jumlah_masuk: 1, agen: "Chrome di Windows", pertama_dilihat: waktu(i * 600), terakhir_dilihat: waktu(i * 600) })) });
  cek("akun yang selalu perangkat baru ditandai", ada(dari(baru, "p1"), "perangkat-selalu-baru"));
}

// ---------- pola menulis ----------
const pola = (o) => ({ kejadian: 300, ketuk: 200, diketik: 200, dihapus: 20, rasio_hapus: 0.1, besar_maks: 3, jumlah_besar: 0, linier: 0.6, lompat: 4, cps: 3, cps_puncak: 4, cv_ketuk: 0.8, jeda_pertama_s: 20, jeda_median_s: 5, aktif_s: 90, rentang_s: 200, undo: 0, jalankan: 2, jalankan_ke_kirim_s: 10, panjang_akhir: 200, ...o });
let nomorId = 0;
const kirimLulus = (u, bab, o, kode = "x", menit = 0, lulus = true) => ({ id: ++nomorId, user_id: u, bab, jenis: "kirim", lulus, kode, pola: pola(o), dibuat_pada: waktu(menit) });
{
  const peserta = mkPeserta(3);
  const r = analisis({
    peserta,
    percobaan: [
      kirimLulus("p1", 1, { cps_puncak: 12 }),
      kirimLulus("p2", 1, { besar_maks: 80, jumlah_besar: 1 }),
      kirimLulus("p3", 1, { linier: 1, rasio_hapus: 0, dihapus: 0, jalankan: 0, panjang_akhir: 300, cv_ketuk: 0.2 }),
    ],
  });
  cek("kecepatan di atas batas manusia ditandai sedang", ada(dari(r, "p1"), "kecepatan", 1));
  cek("potongan besar yang bukan tempel ditandai", ada(dari(r, "p2"), "potongan-besar", 1));
  cek("lurus tanpa koreksi dengan ritme rata: tinggi", dari(r, "p3").sinyal.find((s) => s.kode === "lurus-tanpa-koreksi").tingkat === "tinggi");
  const wajar = analisis({ peserta, percobaan: [kirimLulus("p1", 1, {}), kirimLulus("p2", 1, { linier: 1, rasio_hapus: 0, jalankan: 0, panjang_akhir: 300, cv_ketuk: 0.9, cps_puncak: 5 })] });
  cek("pola wajar tidak menghasilkan sinyal", dari(wajar, "p1").sinyal.length === 0);
  cek("lurus tanpa koreksi tetapi ritme wajar: hanya sedang", dari(wajar, "p2").sinyal.find((s) => s.kode === "lurus-tanpa-koreksi").tingkat === "sedang");
  const gagalSaja = analisis({ peserta, percobaan: [kirimLulus("p1", 1, { cps_puncak: 15 }, "x", 0, false)] });
  cek("sinyal pola hanya dari percobaan yang lulus", dari(gagalSaja, "p1").sinyal.length === 0);
}
{
  // dasar milik peserta sendiri: kecepatan biasanya sekitar 3, tiba-tiba 14 di bab 6
  const peserta = mkPeserta(1);
  const biasa = [1, 2, 3, 4].map((b) => kirimLulus("p1", b, { cps: 2.6 + b * 0.2 }));
  const r = analisis({ peserta, percobaan: [...biasa, kirimLulus("p1", 6, { cps: 14, cps_puncak: 8 })] });
  cek("kecepatan yang melonjak dari kebiasaan sendiri ditandai", ada(dari(r, "p1"), "ritme-berubah", 6));
  cek("bab biasa tidak ditandai berubah", !biasa.some((p) => ada(dari(r, "p1"), "ritme-berubah", p.bab)));
  const sedikit = analisis({ peserta, percobaan: [kirimLulus("p1", 1, { cps: 3 }), kirimLulus("p1", 2, { cps: 3 }), kirimLulus("p1", 6, { cps: 14 })] });
  cek("dasar terlalu sedikit (kurang dari 3 bab lain): tidak menyimpulkan apa-apa", !ada(dari(sedikit, "p1"), "ritme-berubah"));
  const sedikitKetuk = analisis({ peserta, percobaan: [...biasa, kirimLulus("p1", 6, { cps: 14, ketuk: 10 })] });
  cek("bab yang hampir tak diketik (kurang dari 40 ketukan) tidak dinilai ritmenya", !ada(dari(sedikitKetuk, "p1"), "ritme-berubah"));
}

// ---------- tempel ----------
{
  const peserta = mkPeserta(3);
  const r = analisis({ peserta, tempel: [{ user_id: "p1", detail: { jumlah: 2 } }, { user_id: "p2", detail: { jumlah: 4 } }, { user_id: "p2", detail: { jumlah: 3 } }, { user_id: "p3", detail: null }] });
  cek("tempel sedikit: rendah", dari(r, "p1").sinyal[0].tingkat === "rendah");
  cek("tempel 5 kali atau lebih (dijumlahkan semua bab): sedang", dari(r, "p2").sinyal[0].tingkat === "sedang" && dari(r, "p2").sinyal[0].alasan.startsWith("7 kali"));
  cek("baris tanpa detail dihitung satu", dari(r, "p3").sinyal[0].alasan.startsWith("1 kali"));
}

// ---------- kemiripan ----------
const KODE_SALAH = "jumlah_boks = int(input())\nharga = int(input())\ntotal = jumlah_boks * harga\npotongan = 0.12\nprint(f'Total: {total - total * potongan}')\n";
{
  // 12 peserta; p1 dan p2 punya percobaan salah yang persis sama; semua orang pernah mengirim kode awal yang sama (diabaikan)
  const peserta = mkPeserta(12);
  const KODE_AWAL = "jumlah_boks = int(input())\nharga_satuan = int(input())\npotongan = 0.0\nprint(jumlah_boks * harga_satuan)\n# tulis if di sini\n";
  const percobaan = [];
  for (const p of peserta) percobaan.push(kirimLulus(p.id, 4, {}, KODE_AWAL, 1, false));
  percobaan.push(kirimLulus("p1", 4, {}, KODE_SALAH, 5, false), kirimLulus("p2", 4, {}, KODE_SALAH + "  \n", 6, false));
  percobaan.push(kirimLulus("p3", 4, {}, KODE_SALAH.replace("0.12", "0.1"), 7, false));
  const r = analisis({ peserta, percobaan });
  cek("percobaan salah yang persis sama pada dua orang: tinggi untuk keduanya", dari(r, "p1").sinyal.some((s) => s.kode === "urutan-salah-sama" && s.tingkat === "tinggi" && s.alasan.includes("Peserta 2")) && ada(dari(r, "p2"), "urutan-salah-sama"));
  cek("kode awal yang belum diubah (dikirim hampir semua orang) diabaikan", peserta.slice(3).every((p) => !ada(dari(r, p.id), "urutan-salah-sama")));
  cek("percobaan salah yang hanya mirip (bukan sama) tidak ditandai", !ada(dari(r, "p3"), "urutan-salah-sama"));
  cek("spasi ujung baris tidak mengelabui perbandingan", ada(dari(r, "p2"), "urutan-salah-sama"));
  cek("pasangan tercatat untuk tampilan", r.pasangan.some((x) => x.jenis === "urutan-salah-sama" && x.ids.includes("p1") && x.ids.includes("p2")));
}
{
  // kesalahan umum yang dibuat 5 dari 12 orang tidak dianggap janggal
  const peserta = mkPeserta(12);
  const percobaan = peserta.slice(0, 5).map((p) => kirimLulus(p.id, 4, {}, KODE_SALAH, 1, false));
  const r = analisis({ peserta, percobaan });
  cek("kesalahan umum (banyak orang sama) tidak ditandai", r.hasil.every((h) => !ada(h, "urutan-salah-sama")));
}
{
  // ciri khas pada kode yang lulus: p1 dan p2 sama-sama memakai nama langka dan komentar langka yang sama
  const peserta = mkPeserta(14);
  const biasa = (i) => "jumlah_boks = int(input())\nharga_satuan = int(input())\ntotal = jumlah_boks * harga_satuan\nprint(total)\n# hitung" + (i % 2) + "\n";
  const percobaan = peserta.slice(2).map((p, i) => kirimLulus(p.id, 4, {}, biasa(i), 10, true));
  const khas = "jumlah_boks = int(input())\nharga_satuan = int(input())\nnilai_ajaib = jumlah_boks * harga_satuan\nhasil_pelanggan_x = nilai_ajaib\nprint(hasil_pelanggan_x)  # versi punyaku sendiri\n";
  percobaan.push(kirimLulus("p1", 4, {}, khas, 20, true), kirimLulus("p2", 4, {}, khas.replace("punyaku sendiri", "punyaku sendiri"), 25, true));
  const r = analisis({ peserta, percobaan });
  cek("ciri khas langka yang sama pada dua orang: ditandai sedang", dari(r, "p1").sinyal.some((s) => s.kode === "kemiripan-khas" && s.tingkat === "sedang") && ada(dari(r, "p2"), "kemiripan-khas"));
  cek("jawaban yang hanya mirip karena memakai nama dari soal tidak ditandai", peserta.slice(2).every((p) => !ada(dari(r, p.id), "kemiripan-khas")));
  const kecil = analisis({ peserta: mkPeserta(4), percobaan: [kirimLulus("p1", 4, {}, khas), kirimLulus("p2", 4, {}, khas), kirimLulus("p3", 4, {}, biasa(0)), kirimLulus("p4", 4, {}, biasa(1))] });
  cek("kelas terlalu kecil (kurang dari 10 yang lulus): kemiripan tidak dinilai", kecil.hasil.every((h) => !ada(h, "kemiripan-khas")));
}
{
  // lulus bersamaan di 3 bab: p1 dan p2 dalam selang 60 detik; p3 hanya sekali
  const peserta = mkPeserta(3);
  const percobaan = [];
  [1, 2, 3].forEach((bab, i) => {
    percobaan.push(kirimLulus("p1", bab, {}, "a", i * 100, true), kirimLulus("p2", bab, {}, "b", i * 100 + 1, true));
  });
  percobaan.push(kirimLulus("p3", 1, {}, "c", 0.5, true));
  const r = analisis({ peserta, percobaan });
  cek("lulus berdekatan di tiga bab atau lebih: ditandai", ada(dari(r, "p1"), "kirim-serentak") && ada(dari(r, "p2"), "kirim-serentak"));
  cek("sekali kebetulan berdekatan tidak ditandai", !ada(dari(r, "p3"), "kirim-serentak"));
  const jauh = analisis({ peserta, percobaan: [1, 2, 3].flatMap((bab, i) => [kirimLulus("p1", bab, {}, "a", i * 100, true), kirimLulus("p2", bab, {}, "b", i * 100 + 30, true)]) });
  cek("selisih 30 menit tidak ditandai", !ada(dari(jauh, "p1"), "kirim-serentak"));
}

// ---------- ringkasan, urutan, CSV ----------
{
  const peserta = mkPeserta(3);
  const sesi = ["p1", "p2", "p3"].map((u) => ({ user_id: u, device_id: "dev-zzzzzzzzzzzzzzzzzzzzzzzz", jumlah_masuk: 1, agen: "Chrome di Windows", pertama_dilihat: waktu(0), terakhir_dilihat: waktu(1) }));
  const r = analisis({ peserta, sesi, percobaan: [kirimLulus("p1", 1, { cps_puncak: 12 })] });
  cek("ringkasan menghitung peserta menurut tingkat tertinggi", r.ringkasan.bersinyalTinggi === 3 && r.ringkasan.perangkatBersama === 1);
  cek("sinyal tiap peserta terurut dari yang paling berat", dari(r, "p1").sinyal[0].tingkat === "tinggi");
  const csv = csvSinyal(r.hasil);
  cek("CSV: judul dan satu baris per sinyal", csv.split("\r\n")[0] === "NIM,Nama,Kelas,Tingkat,Jenis,Bab,Alasan" && csv.trim().split("\r\n").length === 1 + r.hasil.reduce((a, h) => a + h.sinyal.length, 0));
  cek("peserta tanpa data tidak membuat galat", analisis({ peserta: [], sesi: [], percobaan: [] }).hasil.length === 0 && analisis({ peserta }).hasil.length === 3);
}

console.log(gagal ? "\n" + gagal + " uji GAGAL." : "\nSemua uji lulus.");
process.exit(gagal ? 1 : 0);
