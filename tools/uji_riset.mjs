// Menguji ringkasan kohort dan ekspor anonim (site/js/riset.js). Jalankan: node tools/uji_riset.mjs
import * as R from "../site/js/riset.js";

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
const JAM = 3600000;
let nid = 0;
const baris = (u, bab, jenis, menit, o = {}) => ({ id: ++nid, user_id: u, matakuliah_id: "algoritma-python", bab, jenis, dibuat_pada: new Date(T0 + menit * MNT).toISOString(), diterima_pada: new Date(T0 + menit * MNT + 1000).toISOString(), lulus: jenis === "jalankan" ? null : false, ...o });

const peserta = [
  { id: "a", nama: "Ani Rahasia", nim: "2024110001", kelas: "SI-2024-A", angkatan: 2024, riset_setuju: true, kode_riset: "R-aaaa1111" },
  { id: "b", nama: "Bimo Tertutup", nim: "2024110002", kelas: "SI-2024-B", angkatan: 2024, riset_setuju: false, kode_riset: "R-bbbb2222" },
  { id: "c", nama: "Cici Setuju", nim: "2024110003", kelas: "SI-2024-A", angkatan: 2024, riset_setuju: true, kode_riset: "R-cccc3333" },
  { id: "d", nama: "Dedi Belum", nim: "2024110004", kelas: "SI-2024-A", angkatan: 2024, riset_setuju: null, kode_riset: null },
  { id: "e", nama: "Eka Setuju Tanpa Kode", nim: "2024110005", kelas: "SI-2024-A", riset_setuju: true, kode_riset: null },
];
const percobaan = [
  // Ani, bab 4: dua galat, satu belum cocok, kirim gagal, hapus-tulis ulang, petunjuk, lalu lulus keesokan harinya
  baris("a", 4, "jalankan", 0, { hasil: "galat", galat_jenis: "SyntaxError", petunjuk: 0, pola: { cps: 2, rasio_hapus: 0.1, linier: 0.9, lompat: 0, jalankan: 1 }, kode: "if x", rekaman: { awal: "", e: [] } }),
  baris("a", 4, "jalankan", 5, { hasil: "galat", galat_jenis: "NameError", petunjuk: 0, pola: { cps: 2, rasio_hapus: 0.35, linier: 0.7, lompat: 1, jalankan: 2 } }),
  baris("a", 4, "jalankan", 9, { hasil: "jalan", cocok_contoh: false, petunjuk: 1 }),
  baris("a", 4, "kirim", 12, { kasus_lulus: 3, kasus_total: 7, hasil: "gagal", petunjuk: 1, pola: { cps: 2.5, cps_puncak: 5, rasio_hapus: 0.4, linier: 0.5, lompat: 3, jalankan: 3 } }),
  baris("a", 4, "kirim", 20, { kasus_lulus: 5, kasus_total: 7, hasil: "gagal", petunjuk: 2 }),
  baris("a", 4, "kirim", 24 * 60 + 30, { lulus: true, kasus_lulus: 7, kasus_total: 7, hasil: "lulus", petunjuk: 2 }),
  // Ani, bab 5: lulus langsung
  baris("a", 5, "kirim", 3000, { lulus: true, kasus_lulus: 5, kasus_total: 5, hasil: "lulus", petunjuk: 0 }),
  // Cici, bab 4: lulus pada kirim kedua; ada Jalankan timeout
  baris("c", 4, "jalankan", 100, { hasil: "timeout", petunjuk: 0 }),
  baris("c", 4, "jalankan", 103, { hasil: "galat", galat_jenis: "ZeroDivisionError", petunjuk: 0 }),
  baris("c", 4, "kirim", 106, { kasus_lulus: 6, kasus_total: 7, hasil: "gagal", petunjuk: 0 }),
  baris("c", 4, "kirim", 112, { lulus: true, kasus_lulus: 7, kasus_total: 7, hasil: "lulus", petunjuk: 0 }),
  // Cici, konsep bab 3
  baris("c", 3, "kirim", 200, { lulus: false, kasus_lulus: 5, kasus_total: 10, pola: { jenis: "konsep" } }),
  // Bimo menolak, Dedi belum menjawab, Eka tanpa kode: tidak boleh muncul
  baris("b", 4, "kirim", 50, { lulus: true, kasus_lulus: 7, kasus_total: 7, kode: "rahasia bimo" }),
  baris("d", 4, "kirim", 60, { lulus: true, kasus_lulus: 7, kasus_total: 7 }),
  baris("e", 4, "kirim", 70, { lulus: true, kasus_lulus: 7, kasus_total: 7 }),
];
const progres = [
  { user_id: "a", bab: 4, status: "selesai", jalur: "bantuan" },
  { user_id: "a", bab: 5, status: "selesai", jalur: "langsung" },
  { user_id: "c", bab: 4, status: "selesai", jalur: "langsung" },
  { user_id: "b", bab: 4, status: "selesai", jalur: "langsung" },
];

console.log("== persetujuan ==");
cek("hanya setuju dengan kode riset yang layak", R.layak(peserta[0]) && !R.layak(peserta[1]) && !R.layak(peserta[3]) && !R.layak(peserta[4]));
cek("hitung setuju, tidak, dan belum menjawab", JSON.stringify(R.statusPersetujuan(peserta)) === JSON.stringify({ setuju: 3, tidak: 1, belum: 1 }));

console.log("\n== ringkasan kohort ==");
const k = R.ringkasKohort({ peserta, percobaan, progres });
cek("hanya peserta yang layak dihitung", k.nPeserta === 2 && k.nBaris === 12, JSON.stringify([k.nPeserta, k.nBaris]));
cek("peserta menolak, belum menjawab, dan tanpa kode tidak ikut", !JSON.stringify(k).includes("rahasia") && k.nSetuju === 3 && k.nTidak === 1 && k.nBelum === 1);
cek("total galat saat menjalankan: 4 (SyntaxError, NameError, Timeout, ZeroDivisionError)", k.nGalat === 4, String(k.nGalat));
cek("galat dikelompokkan dengan persen", k.galat.find((g) => g.nama === "Sintaks").n === 1 && k.galat.find((g) => g.nama === "Berjalan terlalu lama").n === 1 && k.galat.find((g) => g.nama === "Pembagian nol").persen === 25);
cek("daftar jenis galat memuat nama jenis", k.galatJenis.some((g) => g.nama === "NameError") && k.galatJenis.some((g) => g.nama === "Timeout"));
cek("Kirim gagal (kasus uji) dihitung, konsep tidak", k.kirimGagal === 3, String(k.kirimGagal));
const b4 = k.perBab.find((x) => x.bab === 4);
cek("percobaan Kirim sampai lulus pertama: Ani 3, Cici 2, median 2,5", b4.median === 2.5 && b4.lulus === 2 && b4.belum === 0, JSON.stringify(b4));
cek("bab 5: lulus pada kirim pertama", k.perBab.find((x) => x.bab === 5).median === 1);
cek("bab konsep yang belum lulus dihitung belum lulus", k.perBab.find((x) => x.bab === 3).belum === 1 && k.perBab.find((x) => x.bab === 3).median === null);
cek("lulus langsung dari progres peserta yang layak saja (2 dari 3)", k.lulusLangsung === 67 && k.nSelesai === 3, JSON.stringify([k.lulusLangsung, k.nSelesai]));
cek("tersangkut = butuh tiga Kirim atau lebih untuk lulus: hanya bab 4 milik Ani", k.tersangkut.n === 1);
cek("perilaku saat tersangkut: pakai petunjuk, hapus-tulis ulang, kembali di hari lain", k.tersangkut.petunjuk === 100 && k.tersangkut.hapus === 100 && k.tersangkut.kembali === 100, JSON.stringify(k.tersangkut));
const kosong = R.ringkasKohort({ peserta, percobaan: [], progres: [] });
cek("tanpa data tidak melempar galat dan tidak membagi nol", kosong.nPeserta === 0 && kosong.nBaris === 0 && kosong.lulusLangsung === null && kosong.tersangkut.n === 0 && kosong.perBab.length === 0);

console.log("\n== ekspor anonim ==");
const e = R.bangunEkspor({ peserta, percobaan });
const csv = R.csvEkspor(e);
cek("hanya peserta yang layak diekspor", e.nPeserta === 2 && e.nBaris === 12);
cek("nama, NIM, dan kelas tidak muncul di ekspor", !/Ani|Cici|Bimo|Dedi|Eka|2024110|SI-2024/.test(csv), csv.slice(0, 300));
cek("identitas diganti kode riset", csv.includes("R-aaaa1111") && csv.includes("R-cccc3333") && !csv.includes("R-bbbb2222"));
cek("tanggal kalender tidak ada (hanya hari ke-n)", !/2026-10|T\d\d:/.test(csv) && e.baris[0][e.kolom.findIndex((c) => c.id === "hari_ke")] === 0);
const kol = (nama) => e.kolom.findIndex((c) => c.id === nama);
const a4 = e.baris.filter((b) => b[0] === "R-aaaa1111" && b[kol("bab")] === 4);
cek("urutan di bab dan detik sejak mulai bab", a4.map((b) => b[kol("urutan_di_bab")]).join() === "1,2,3,4,5,6" && a4[0][kol("detik_sejak_mulai_bab")] === 0 && a4[1][kol("detik_sejak_mulai_bab")] === 300);
cek("hari ke-n: lulus keesokan harinya jatuh pada hari ke-1", a4[5][kol("hari_ke")] === 1);
cek("jenis dan hasil: jalankan galat, kirim gagal, kirim lulus", a4[0][kol("jenis")] === "jalankan" && a4[0][kol("hasil")] === "galat" && a4[3][kol("jenis")] === "kirim" && a4[3][kol("hasil")] === "gagal" && a4[5][kol("hasil")] === "lulus");
cek("jenis galat dan kelompoknya", a4[0][kol("galat_jenis")] === "SyntaxError" && a4[0][kol("galat_kelompok")] === "Sintaks" && a4[1][kol("galat_kelompok")] === "Nama tidak dikenal");
cek("cocok contoh 0, 1, atau kosong", a4[2][kol("cocok_contoh")] === 0 && a4[0][kol("cocok_contoh")] === "");
cek("kasus lulus kosong pada baris Jalankan dan terisi pada Kirim", a4[0][kol("kasus_lulus")] === "" && a4[3][kol("kasus_lulus")] === 3 && a4[3][kol("kasus_total")] === 7);
cek("pola menulis terbawa", a4[3][kol("cps")] === 2.5 && a4[3][kol("rasio_hapus")] === 0.4 && a4[3][kol("linier")] === 0.5 && a4[3][kol("lompat")] === 3 && a4[3][kol("jalankan_dalam_segmen")] === 3);
cek("Periksa konsep diberi jenis periksa", e.baris.find((b) => b[kol("bab")] === 3)[kol("jenis")] === "periksa");
cek("timeout menjadi hasil timeout dengan kelompok sendiri", e.baris.some((b) => b[kol("hasil")] === "timeout" && b[kol("galat_kelompok")] === "Berjalan terlalu lama"));
cek("kode dan rekaman tidak diekspor kecuali dipilih", !csv.includes("if x") && !e.kolom.some((c) => c.id === "kode" || c.id === "rekaman"));
const lengkap = R.bangunEkspor({ peserta, percobaan, opsi: { kode: true, rekaman: true, angkatan: true } });
cek("opsi kode, rekaman, dan angkatan menambah kolom", lengkap.kolom.some((c) => c.id === "kode") && lengkap.kolom.some((c) => c.id === "rekaman") && lengkap.kolom.some((c) => c.id === "angkatan") && lengkap.baris[0].length === lengkap.kolom.length);
cek("angkatan tanpa kelas dan nama", R.csvEkspor(lengkap).includes("2024") && !/SI-2024|Ani Rahasia/.test(R.csvEkspor(lengkap).replace(/R-/g, "")));
cek("kolom dan baris selalu sama panjang", e.baris.every((b) => b.length === e.kolom.length));
cek("urutan ekspor stabil: per kode riset lalu bab", e.baris.map((b) => b[0]).join("|") === e.baris.map((b) => b[0]).slice().sort().join("|"));
const dgJson = JSON.parse(R.jsonEkspor(e));
cek("JSON memakai id kolom dan null untuk kosong", dgJson.length === 12 && dgJson[0].kode_riset === "R-aaaa1111" && dgJson[0].kasus_lulus === null);
const kamus = R.kamusData(e, { mataKuliah: "Algoritma dan Pemrograman", dibuat: "2026-10-07" });
cek("kamus data menjelaskan setiap kolom dan batas anonimisasi", e.kolom.every((c) => kamus.includes("- " + c.label + ":")) && kamus.includes("kode_riset") && kamus.includes("setuju"));
const ekstrim = R.csvEkspor({ kolom: [{ label: "a" }, { label: "b" }], baris: [["=1+1", 'x "y", z'], [-5, "ok"]] }).split("\r\n");
cek("rumus di teks diamankan dan angka negatif tidak diberi apostrof", ekstrim[1] === "'=1+1,\"x \"\"y\"\", z\"" && ekstrim[2] === "-5,ok", JSON.stringify(ekstrim));
cek("ekspor tanpa peserta layak menghasilkan data kosong tanpa galat", R.bangunEkspor({ peserta: [peserta[1]], percobaan }).nBaris === 0);

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
