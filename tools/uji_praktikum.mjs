// Menguji logika praktikum (site/js/praktikum.js) dengan isi praktikum Kasir yang sebenarnya. Jalankan: node tools/uji_praktikum.mjs
// (Pengujian kasus uji dengan Python sungguhan ada di tools/uji_praktikum.py.)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as P from "../site/js/praktikum.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kasir = JSON.parse(readFileSync(join(root, "site", "data", "kuliah", "algoritma-python", "praktikum", "kasir.json"), "utf8"));
let total = 0;
let gagal = 0;
const cek = (nama, kondisi, detail = "") => {
  total++;
  if (!kondisi) {
    gagal++;
    console.log("GAGAL " + nama + (detail ? "  -> " + detail : ""));
  } else console.log("OK    " + nama);
};

console.log("== nama berkas ==");
const v = P.validasiNamaBerkas;
cek("nama sah", v("daftar_barang.py") === "" && v("data.json") === "" && v("catatan.md") === "" && v("Coba1.PY") === "");
cek("kosong ditolak", v("") !== "" && v(null) !== "");
cek("garis miring dan naik folder ditolak", v("../x.py") !== "" && v("a/b.py") !== "" && v("a\\b.py") !== "");
cek("spasi ditolak dengan saran", v("a b.py").includes("spasi"));
cek("awalan titik dan karakter aneh ditolak", v(".rahasia.py") !== "" && v("a$b.py") !== "" && v("é.py") !== "");
cek("akhiran tidak diizinkan ditolak", v("program.exe") !== "" && v("tanpa_akhiran") !== "");
cek("nama kembar ditolak", v("harga.py", ["harga.py"]).includes("Sudah ada"));
cek("tepat di batas panjang diterima dan di atasnya ditolak", v("a".repeat(57) + ".py") === "" && v("a".repeat(58) + ".py") !== "");
cek("batas jumlah berkas", v("baru.py", [], { jumlah: P.MAKS_BERKAS }).includes("batas") && v("baru.py", [], { jumlah: P.MAKS_BERKAS - 1 }) === "");
cek("ukuran isi dibatasi", P.ukuranSah("x".repeat(P.MAKS_UKURAN)) && !P.ukuranSah("x".repeat(P.MAKS_UKURAN + 1)));
cek("nama sah di klien sama dengan aturan database (huruf angka _ . -)", /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}$/.test("daftar-barang_2.py"));

console.log("\n== status dan ringkasan ==");
const baris = [{ tahap_id: "t01", status: "lulus" }, { tahap_id: "t02", status: "dilewati" }, { tahap_id: "t03", status: "sedang" }];
const peta = P.petaStatus(baris);
const ring = P.ringkasPraktikum(kasir, peta);
cek("ringkasan: 1 lulus, 1 dilewati, 1 sedang, sisanya belum", ring.lulus === 1 && ring.dilewati === 1 && ring.sedang === 1 && ring.belum === 8 && ring.total === 11 && ring.persen === 9, JSON.stringify(ring));
cek("tahap tanpa baris berstatus belum", P.statusTahap(peta, "t09") === "belum");
cek("tahap berikutnya: yang pertama belum lulus dan belum dilewati", P.tahapBerikut(kasir, peta) === 2);
cek("semua selesai memberi -1", P.tahapBerikut(kasir, P.petaStatus(kasir.tahap.map((t) => ({ tahap_id: t.id, status: "lulus" })))) === -1);
cek("praktikum tanpa tahap tidak membagi nol", P.ringkasPraktikum({ tahap: [] }, new Map()).persen === 0);

console.log("\n== tahap untuk bab ==");
const daftar = [kasir];
cek("bab 6 punya tahap keranjang", P.tahapUntukBab(daftar, 6).length === 1 && P.tahapUntukBab(daftar, 6)[0].tahap.id === "t04");
cek("bab 3 (konsep) tidak punya praktik", P.tahapUntukBab(daftar, 3).length === 0 && P.tahapUntukBab(daftar, 7).length === 0);
cek("bab 12 dan 13 menunjuk tahap yang sama", P.tahapUntukBab(daftar, 12)[0].tahap.id === "t10" && P.tahapUntukBab(daftar, 13)[0].tahap.id === "t10");
const babPraktik = P.babBerpraktik(daftar);
cek("daftar bab berpraktik: 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14", [...babPraktik].sort((a, b) => a - b).join() === "2,4,5,6,8,9,10,11,12,13,14");
cek("tanpa praktikum tidak ada tanda", P.babBerpraktik([]).size === 0 && P.tahapUntukBab([], 6).length === 0);

console.log("\n== berkas awal dan contoh bagi yang tertinggal ==");
const milik = (isi) => ({ isi, asal: "milik" });
const l1 = P.lengkapiDariContoh(kasir, 3, { "pesanan.py": milik("# milikku\n") });
cek("berkas milik peserta tidak pernah ditimpa", l1.berkas["pesanan.py"].isi === "# milikku\n" && l1.berkas["pesanan.py"].asal === "milik");
cek("berkas tahap yang dilewati diisi contoh", l1.berkas["potongan.py"].asal === "contoh" && l1.berkas["banyak.py"].asal === "contoh" && l1.berkas["potongan.py"].isi === kasir.tahap[1].contoh["potongan.py"]);
cek("berkas awal tahap ini disediakan", l1.berkas["keranjang.py"].asal === "awal" && l1.berkas["keranjang.py"].isi === kasir.tahap[3].awal["keranjang.py"]);
cek("pakaiContoh bernilai benar bila ada contoh dari tahap sebelumnya", l1.pakaiContoh === true && l1.ditambah.includes("potongan.py"));
cek("dipanggil lagi: tidak ada yang berubah (idempoten)", (() => { const l2 = P.lengkapiDariContoh(kasir, 3, l1.berkas); return l2.ditambah.length === 0 && JSON.stringify(l2.berkas) === JSON.stringify(l1.berkas); })());
const semuaMilik = Object.fromEntries(kasir.tahap.slice(0, 3).flatMap((t) => Object.keys(t.contoh).map((n) => [n, milik("# punyaku " + n)])));
const l3 = P.lengkapiDariContoh(kasir, 3, semuaMilik);
cek("semua berkas sebelumnya milik peserta: tidak memakai contoh", l3.pakaiContoh === false && Object.keys(l3.berkas).filter((n) => l3.berkas[n].asal === "contoh").length === 0);
const l0 = P.lengkapiDariContoh(kasir, 0, {});
cek("tahap pertama: hanya berkas awalnya", Object.keys(l0.berkas).join() === "pesanan.py" && l0.berkas["pesanan.py"].asal === "awal" && !l0.pakaiContoh);
cek("peserta yang mengerjakan tahap yang tadinya dilewati: berkasnya menggantikan contoh", (() => { const b = P.tandaiMilik(l1.berkas, "potongan.py", "# sudah kukerjakan\n"); return b["potongan.py"].asal === "milik" && P.lengkapiDariContoh(kasir, 3, b).berkas["potongan.py"].isi === "# sudah kukerjakan\n"; })());
const kem = P.kembalikanAwal(kasir, 3, Object.assign({}, l1.berkas, { "keranjang.py": milik("# berantakan\n"), "catatan.md": milik("# jangan hilang\n") }));
cek("kembalikan awal hanya mengganti berkas tahap ini", kem["keranjang.py"].isi === kasir.tahap[3].awal["keranjang.py"] && kem["keranjang.py"].asal === "awal" && kem["catatan.md"].isi === "# jangan hilang\n" && kem["pesanan.py"].asal === "milik");
const ter = P.terapkanContoh(kasir, 3, l1.berkas);
cek("terapkan contoh mengisi berkas yang diminta dengan jawaban contoh", ter["keranjang.py"].asal === "contoh" && ter["keranjang.py"].isi === kasir.tahap[3].contoh["keranjang.py"]);
cek("fungsi tidak mengubah masukan", (() => { const a = { "x.py": milik("1") }; P.lengkapiDariContoh(kasir, 2, a); P.kembalikanAwal(kasir, 2, a); P.terapkanContoh(kasir, 2, a); return Object.keys(a).join() === "x.py"; })());
cek("keIsi menghasilkan peta nama ke isi", JSON.stringify(P.keIsi({ "a.py": milik("1"), "b.py": { isi: "2", asal: "contoh" } })) === '{"a.py":"1","b.py":"2"}');
cek("berkas contoh seluruh rantai tanpa nama bentrok antar tahap yang berbeda isi dengan sengaja", (() => { const nama = new Map(); for (const t of kasir.tahap) for (const n of Object.keys(t.contoh)) nama.set(n, (nama.get(n) || 0) + 1); return [...nama.values()].every((x) => x === 1); })());

console.log("\n== hasil uji ==");
const r = P.ringkasHasil([{ nama: "a", lulus: true, pesan: "" }, { nama: "b", lulus: false, pesan: "Tidak cocok: assert x == 1" }, { nama: "rahasia", lulus: false, pesan: "AssertionError: nilai 42", tersembunyi: true }, { nama: "rahasia2", lulus: true, pesan: "", tersembunyi: true }]);
cek("lulus hanya bila semua kasus lulus", !r.lulus && r.benar === 2 && r.total === 4 && P.ringkasHasil([{ nama: "a", lulus: true }]).lulus);
cek("kasus biasa menampilkan pesan galat", r.tampil[1].pesan.includes("Tidak cocok"));
cek("kasus tersembunyi yang gagal menyembunyikan nama dan rincian", r.tampil[2].nama === "Kasus tersembunyi" && !r.tampil[2].pesan.includes("42") && r.tampil[2].pesan.includes("disembunyikan"));
cek("tanpa kasus tidak dianggap lulus", !P.ringkasHasil([]).lulus);
const rw = P.hasilUntukRiwayat(r);
cek("riwayat versi tidak membocorkan rincian tersembunyi dan memotong pesan panjang", !JSON.stringify(rw).includes("42") && P.hasilUntukRiwayat(P.ringkasHasil([{ nama: "z", lulus: false, pesan: "p".repeat(900) }])).kasus[0].pesan.length === 300);

console.log("\n== ekspor HTML ==");
const berkas = { "kasir.py": 'print("Halo </script><b>dunia</b> & \\"kutip\\"")\n', "model.py": "x = 1\n" };
const html = P.bangunHtmlEkspor({ judul: 'Kasir <UD> "Rasa" & Gresik', deskripsi: "Dibuat <di> praktikum", berkas, entri: "kasir.py", oleh: "Ani <script>" });
cek("halaman HTML lengkap dan berbahasa Indonesia", html.startsWith("<!doctype html>") && html.includes('<html lang="id">') && html.includes("</html>"));
cek("judul dan deskripsi dilolosi (tidak bisa menyisipkan tag)", html.includes("Kasir &lt;UD&gt; &quot;Rasa&quot; &amp; Gresik") && !html.includes("<UD>") && !html.includes("Ani <script>") && html.includes("Ani &lt;script&gt;"));
const skrip = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
cek("hanya dua blok script (data dan program) walau kode peserta memuat </script>", skrip.length === 2, String(skrip.length));
const data = JSON.parse(skrip[0][1]);
cek("data proyek di dalam halaman utuh setelah dibaca kembali", data.entri === "kasir.py" && data.berkas["kasir.py"] === berkas["kasir.py"] && data.berkas["model.py"] === "x = 1\n" && data.pyodide === P.PYODIDE_URL);
cek("kode peserta ikut ditampilkan sebagai teks yang dilolosi di bagian Lihat kode", html.includes("&lt;/script&gt;&lt;b&gt;dunia&lt;/b&gt;") && html.includes("Lihat kode (2 berkas)"));
cek("program halaman sah secara sintaks JavaScript", (() => { try { new Function(skrip[1][1]); return true; } catch (e) { return false; } })());
cek("tidak memuat sumber luar selain Pyodide", [...html.matchAll(/https?:\/\/[^"'\s)]+/g)].every((m) => m[0].startsWith("https://cdn.jsdelivr.net/pyodide/")), JSON.stringify([...html.matchAll(/https?:\/\/[^"'\s)]+/g)].map((m) => m[0])));
cek("ada penanganan masukan lewat dialog dan batal mengakhiri masukan", skrip[1][1].includes("window.prompt") && skrip[1][1].includes("EOFError"));
cek("nama berkas HTML aman", P.namaBerkasHtml('Kasir <UD> "Rasa"!') === "aplikasi-kasir-ud-rasa.html" && P.namaBerkasHtml("") === "aplikasi-praktikum.html");

console.log("\n== laporan praktikum ==");
const lap = { matakuliah: "Algoritma dan Pemrograman", praktikum: kasir, jalur: "web", nama: "Ani", nim: "2024110001", kelas: "SI-2024-A", jawaban: { apa: "Saya membangun kasir yang menghitung potongan dan mencetak struk untuk toko oleh-oleh.", kendala: "" }, statusTahap: [{ tahap_id: "t01", status: "lulus", jumlah_kirim: 2 }, { tahap_id: "t02", status: "dilewati", pakai_contoh: false }, { tahap_id: "t03", status: "lulus", jumlah_kirim: 1, pakai_contoh: true }], kodeVerifikasi: "ABCD2345", diekspor: new Date(2026, 9, 7, 9, 5) };
const blok = P.susunLaporanPraktikum(lap);
cek("blok laporan: judul, identitas, jalur, kelengkapan", blok[0].teks === "LAPORAN PRAKTIKUM" && blok[1].baris.some((b) => b[0] === "Cara mengerjakan" && b[1] === "Di website") && blok[1].baris.some((b) => b[0] === "Praktikum" && b[1] === kasir.judul) && blok[2].teks.includes("1 dari 3 kolom"));
cek("ringkasan tahap di catatan", blok[2].teks.includes("2 lulus, 1 dilewati, 8 belum selesai dari 11"));
cek("kolom kosong tetap muncul sebagai belum diisi", blok.filter((b) => b.t === "paragraf" && b.kosong).length === 2);
cek("status tiap tahap tertulis lengkap dengan kirim dan penanda contoh", (() => { const k = blok.find((b) => b.t === "kode").teks.split("\n"); return k.length === 11 && k[0].includes("Lulus (2 kali kirim)") && k[1].includes("Dilewati") && k[2].includes("[memakai berkas contoh]") && k[10].includes("Belum"); })());
cek("kode verifikasi di kaki", blok.at(-1).teks === "Kode verifikasi: ABCD2345");
cek("nama berkas laporan aman", P.namaBerkasLaporan(lap) === "laporan-praktikum-kasir-2024110001.pdf");
cek("jalur tidak dikenal kembali ke Di website", P.teksJalur("kertas") === "Di website" && P.teksJalur("laptop") === "Laptop sendiri" && P.teksJalur("ponsel").includes("ponsel"));
cek("laporan kosong sama sekali tetap bisa disusun", P.susunLaporanPraktikum({ ...lap, jawaban: {}, statusTahap: [] }).filter((b) => b.t === "paragraf" && b.kosong).length === 3);

console.log("\n== baris untuk database ==");
cek("baris tahap memberi nilai bawaan yang sah", JSON.stringify(P.barisTahap("algoritma-python", "kasir", "t01", { status: "sedang" })) === JSON.stringify({ matakuliah_id: "algoritma-python", praktikum_id: "kasir", tahap_id: "t01", status: "sedang", jalur: "web", jumlah_kirim: 0, pertama_dibuka: null, lulus_pada: null, pakai_contoh: false, centang: {} }));
cek("baris berkas membawa asal", P.barisBerkas("algoritma-python", "kasir", "harga.py", { isi: "x", asal: "contoh" }).asal === "contoh");

console.log("\n== rekap dosen ==");
const pes = [{ id: "u1", nim: "1", nama: "Ani", kelas: "A" }, { id: "u2", nim: "2", nama: "Budi", kelas: "A" }, { id: "u3", nim: "3", nama: "Cici", kelas: "B" }];
const semuaLulus = kasir.tahap.map((t) => ({ user_id: "u1", tahap_id: t.id, status: "lulus", jumlah_kirim: 2, pakai_contoh: false, diperbarui_pada: "2026-10-05T00:00:00Z" }));
const baris2 = [...semuaLulus, { user_id: "u2", tahap_id: "t01", status: "lulus", jumlah_kirim: 5, pakai_contoh: true, diperbarui_pada: "2026-10-06T00:00:00Z" }, { user_id: "u2", tahap_id: "t02", status: "sedang", jumlah_kirim: 3, diperbarui_pada: "2026-10-07T00:00:00Z" }];
const rk = P.rekapPraktikum({ peserta: pes, tahap: baris2, laporan: [{ user_id: "u1", jawaban: { apa: "x".repeat(70), kendala: "y".repeat(50), kesimpulan: "z" }, percobaan_tempel: 2, dikumpulkan_pada: "2026-10-08T00:00:00Z" }], praktikum: kasir });
cek("rekap: peserta tanpa data tidak dihitung mulai", rk.mulai === 2 && rk.baris[2].mulai === false && rk.baris[2].lulus === 0);
cek("rekap: selesai hanya yang semua tahap lulus atau dilewati", rk.selesai === 1 && rk.baris[0].selesai && !rk.baris[1].selesai);
cek("rekap: kode sel membedakan lulus, lulus dengan contoh, sedang, belum", rk.baris[1].sel.t01.kode === "lulus-contoh" && rk.baris[1].sel.t02.kode === "sedang" && rk.baris[1].sel.t03.kode === "belum" && rk.baris[0].sel.t05.kode === "lulus");
cek("rekap: hitungan per peserta", rk.baris[1].lulus === 1 && rk.baris[1].sedang === 1 && rk.baris[1].kirim === 8 && rk.baris[1].terakhir === "2026-10-07T00:00:00Z");
cek("rekap: per tahap menghitung lulus, contoh, sedang, dan rata-rata kirim", rk.perTahap[0].lulus === 2 && rk.perTahap[0].contoh === 1 && rk.perTahap[1].sedang === 1 && rk.perTahap[0].kirimRata === 3.5);
cek("rekap: laporan memuat kelengkapan, tempel, dan status ekspor", rk.baris[0].laporan.baik === 2 && rk.baris[0].laporan.tempel === 2 && rk.baris[0].laporan.diekspor && !rk.baris[1].laporan.ada);
const csv = P.csvPraktikum(rk, kasir);
cek("CSV: kepala, satu baris per peserta, kutip digandakan", csv.split("\r\n").length === 5 && csv.startsWith('"NIM","Nama","Kelas","Tahap 1"') && csv.includes('"lulus (contoh)"'));
cek("CSV: awalan rumus Excel dinetralkan", P.csvPraktikum(P.rekapPraktikum({ peserta: [{ id: "x", nim: "9", nama: "=HYPERLINK(1)", kelas: "A" }], praktikum: kasir }), kasir).includes('"\'=HYPERLINK(1)"'));
cek("CSV: tanpa peserta hanya kepala", P.csvPraktikum(P.rekapPraktikum({ peserta: [], praktikum: kasir }), kasir).split("\r\n").length === 2);

console.log("\n== Java ==");
const vj = (n, ada = [], o = {}) => P.validasiNamaBerkas(n, ada, Object.assign({ bahasa: "java" }, o));
cek("nama kelas Java sah", vj("Buku.java") === "" && vj("Daftar_Barang2.java") === "" && vj("catatan.md") === "");
cek("nama Java tidak sah ditolak", vj("buku-baru.java") !== "" && vj("2Buku.java") !== "" && vj("Buku.py") !== "" && vj("Buku.JAVA") !== "");
cek("nama yang dipakai penguji ditolak", vj("Uji.java") !== "" && vj("GagalUji.java") !== "");
cek("spasi pada nama Java disarankan memakai nama kelas", vj("Daftar Barang.java").includes("DaftarBarang.java"));
cek("aturan Python tidak berubah", P.validasiNamaBerkas("a.py") === "" && P.validasiNamaBerkas("A.java") !== "");
cek("berkasKode mengenali bahasa", P.berkasKode("java").test("A.java") && !P.berkasKode("java").test("a.py") && P.berkasKode("python").test("a.py"));
const prak = { tahap: [{ id: "a", contoh: { "X.java": "v1", "Y.java": "y" } }, { id: "b", contoh: { "X.java": "v2" } }, { id: "c", contoh: {} }] };
const rev = P.lengkapiDariContoh(prak, 2, {});
cek("contoh yang direvisi tahap berikutnya memakai versi terbaru", rev.berkas["X.java"].isi === "v2" && rev.berkas["Y.java"].isi === "y");
const revMilik = P.lengkapiDariContoh(prak, 2, { "X.java": { isi: "punyaku", asal: "milik" }, "Y.java": { isi: "lama", asal: "contoh" } });
cek("berkas milik peserta tidak ditimpa, contoh lama diperbarui", revMilik.berkas["X.java"].isi === "punyaku" && revMilik.berkas["Y.java"].isi === "y");
cek("tahap tanpa kasus dikenali sebagai dinilai dosen", P.tanpaUji({ kasus: [] }) && P.tanpaUji({}) && !P.tanpaUji({ kasus: [{}] }));
const htmlJ = P.bangunHtmlEksporJava({ judul: 'Tugas <akhir> "PBO"', deskripsi: "d", berkas: { "Main.java": 'public class Main { String s = "</details><script>x</script>"; }' }, entri: "Main.java", oleh: "Ani <b>" });
cek("ekspor Java: kode dilolosi dan tidak ada script", !htmlJ.includes("<script") && !htmlJ.includes("</details><script>") && htmlJ.includes("&lt;/details&gt;&lt;script&gt;") && htmlJ.includes("javac *.java") && htmlJ.includes("java Main"));
cek("ekspor Java: judul dan nama dilolosi", htmlJ.includes("Tugas &lt;akhir&gt; &quot;PBO&quot;") && htmlJ.includes("Ani &lt;b&gt;"));

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
