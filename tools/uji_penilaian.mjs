#!/usr/bin/env node
// Menguji logika penilaian laporan di dashboard instruktur (site/js/penilaian.js).
// Jalankan:  node tools/uji_penilaian.mjs
globalThis.window = { crypto: globalThis.crypto };
globalThis.document = { createElement: () => ({}), head: { append() {} }, addEventListener() {}, body: { append() {} } };
const { ringkasLaporan, rataSkor, susunDaftar, saringDaftar, validasiRubrik, csvPenilaian, RUBRIK } = await import("../site/js/penilaian.js");

let gagal = 0;
function cek(nama, ok, detail = "") {
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  " + detail));
}
const lap = (id, user, bab, jawaban, ketikan = {}, tempel = 0, detik = 0) => ({ id, user_id: user, bab, jawaban, jumlah_ketikan: ketikan, percobaan_tempel: tempel, durasi_menulis_detik: detik, dikumpulkan_pada: null });
const penuh = { tujuan: "x".repeat(40), konsep: "x".repeat(60), langkah: "x".repeat(60), kendala: "x".repeat(40), kesimpulan: "x".repeat(40) };

const r1 = ringkasLaporan(lap("a", "u1", 1, penuh, { tujuan: 40, konsep: 60, langkah: 60, kendala: 40, kesimpulan: 40 }, 0, 600));
cek("ringkas: semua kolom memadai, 100 persen diketik, 10 menit", r1.terisi === 5 && r1.karakter === 240 && r1.rasioKetik === 1 && r1.menit === 10);
const r2 = ringkasLaporan(lap("b", "u2", 1, penuh, { tujuan: 5 }, 4, 30));
cek("ringkas: isi banyak tapi hampir tidak diketik = rasio rendah dan tempel tercatat", r2.rasioKetik < 0.05 && r2.tempel === 4);
const r3 = ringkasLaporan(lap("c", "u3", 1, {}, {}, 0, 0));
cek("ringkas: laporan kosong tidak membagi dengan nol", r3.rasioKetik === null && r3.terisi === 0 && r3.karakter === 0);
cek("ringkas: rasio dibatasi 100 persen (ketikan dengan koreksi lebih banyak dari isi)", ringkasLaporan(lap("d", "u", 1, { tujuan: "abc" }, { tujuan: 99 })).rasioKetik === 1);
cek("rata skor: rata-rata empat rubrik, dibulatkan", rataSkor({ skor_konsep: 4, skor_bahasa: 3, skor_refleksi: 3, skor_kode: 4 }) === 3.5 && rataSkor(null) === null);

const peserta = [{ id: "u1", nama: "Ani", nim: "1", kelas: "SI-2024-A" }, { id: "u2", nama: "Budi", nim: "2", kelas: "SI-2024-B" }];
const laporan = [lap("l1", "u2", 2, penuh), lap("l2", "u1", 1, penuh), lap("l3", "u1", 2, {}), lap("lx", "orang-lain", 1, penuh)];
const d = susunDaftar({ laporan, peserta, penilaian: [{ laporan_id: "l2", skor_konsep: 4, skor_bahasa: 4, skor_refleksi: 2, skor_kode: 2, komentar: "baik" }] });
cek("daftar: laporan dari akun yang bukan peserta diabaikan", d.length === 3 && !d.some((x) => x.laporan.id === "lx"));
cek("daftar: urut bab lalu nama", d.map((x) => x.laporan.id).join() === "l2,l3,l1");
cek("daftar: status dinilai dan rata-rata", d[0].dinilai && d[0].rata === 3 && !d[1].dinilai && d[1].rata === null);
cek("saring: hanya yang belum dinilai", saringDaftar(d, { belumDinilai: true }).length === 2);
cek("saring: per bab dan pencarian nama", saringDaftar(d, { bab: "2" }).length === 2 && saringDaftar(d, { cari: "bud" }).length === 1 && saringDaftar(d, { cari: "2" }).length === 1);
cek("saring: tanpa saringan = semua", saringDaftar(d).length === 3);

const ok = { skor_konsep: 3, skor_bahasa: 3, skor_refleksi: 3, skor_kode: 3 };
cek("rubrik: skor lengkap 1 sampai 4 diterima", validasiRubrik(ok, "") === "");
cek("rubrik: skor kosong (NaN) ditolak dan menyebut rubriknya", validasiRubrik({ ...ok, skor_bahasa: NaN }, "").includes("Kejelasan"));
cek("rubrik: skor di luar 1 sampai 4 ditolak", validasiRubrik({ ...ok, skor_konsep: 5 }, "") !== "" && validasiRubrik({ ...ok, skor_konsep: 0 }, "") !== "" && validasiRubrik({ ...ok, skor_konsep: 2.5 }, "") !== "");
cek("rubrik: komentar terlalu panjang ditolak", validasiRubrik(ok, "x".repeat(2001)) !== "");
cek("rubrik: ada empat butir", RUBRIK.length === 4);

const csv = csvPenilaian(d);
const baris = csv.trim().split("\r\n");
cek("CSV: judul, satu baris per laporan, dan skor tercantum", baris.length === 4 && baris[0].startsWith("NIM,Nama,Kelas,Bab") && baris[1].includes(",4,4,2,2,3,baik"), baris[1]);
cek("CSV: laporan belum dinilai punya sel skor kosong", baris[2].includes(",,,,,"));
cek("CSV: nama berawalan = diberi apostrof", csvPenilaian(susunDaftar({ laporan: [lap("z", "u9", 1, {})], peserta: [{ id: "u9", nama: "=Rumus", nim: "9", kelas: "x" }], penilaian: [] })).includes("'=Rumus"));

console.log(gagal ? "\n" + gagal + " uji GAGAL." : "\nSemua uji lulus.");
process.exit(gagal ? 1 : 0);
