#!/usr/bin/env node
// Menguji isi praktikum Java (site/data/kuliah/*/praktikum/*.json dengan "bahasa": "java") dengan JVM sungguhan.
// Memakai penyusun pekerjaan yang SAMA dengan browser (site/js/praktikum-java.js) dan JavaRun (site/vendor/javarun.jar,
// ECJ tingkat bahasa Java 8), jadi yang lulus di sini berperilaku sama di CheerpJ. Untuk tiap tahap yang punya kasus:
//   1. berkas contoh (tahap ini dan sebelumnya; tahap berikutnya yang merevisi berkas menggantikan yang lama) meluluskan SEMUA kasus;
//   2. kerangka awal tidak meluluskan semua kasus; 3. tanpa berkas tahap ini kasus tidak lulus semua.
// Jalankan: node tools/uji_praktikum_java.mjs   (butuh java di PATH)
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { susunPekerjaan, uraikanHasil, bersihkan } from "../site/js/praktikum-java.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cp = [join(root, "site", "vendor", "javarun.jar"), join(root, "site", "vendor", "ecj.jar")].join(delimiter);
let total = 0;
let gagal = 0;
const cek = (nama, ok, detail = "") => {
  total++;
  if (!ok) {
    gagal++;
    console.log("GAGAL " + nama + (detail ? "  -> " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""));
  } else console.log("OK    " + nama);
};

if (spawnSync("java", ["-version"]).error) {
  console.log("java tidak ditemukan di PATH; uji praktikum Java dilewati.");
  process.exit(0);
}

/** Menjalankan pekerjaan lewat JavaRun di JVM sungguhan; mengembalikan teks mentah seperti dari worker. */
function jalankanMentah(sumber) {
  const d = mkdtempSync(join(tmpdir(), "pkjava-"));
  try {
    writeFileSync(join(d, "sumber.txt"), sumber, "utf8");
    writeFileSync(join(d, "masukan.txt"), "", "utf8");
    const p = spawnSync("java", ["-cp", cp, "JavaRun", join(d, "sumber.txt"), join(d, "masukan.txt"), join(d, "hasil.txt")], { cwd: d, timeout: 120000, encoding: "utf8" });
    if (p.status !== 0 || !existsSync(join(d, "hasil.txt"))) throw new Error("JavaRun gagal: " + (p.stderr || p.error || "").toString().slice(-600));
    return readFileSync(join(d, "hasil.txt"), "utf8");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
const kasus = (berkas, daftar) => {
  const { sumber, tafsir } = susunPekerjaan(berkas, { aksi: "kasus", kasus: daftar });
  return uraikanHasil(jalankanMentah(sumber), tafsir).kasus;
};
const jalankan = (berkas, entri, masukan) => {
  const { sumber, tafsir } = susunPekerjaan(berkas, { aksi: "jalankan", entri, masukan });
  return uraikanHasil(jalankanMentah(sumber), tafsir);
};

const gabung = (tahap, sampai, awalTerakhir = false) => {
  const b = {};
  for (const t of tahap.slice(0, sampai)) Object.assign(b, t.contoh || {});
  if (awalTerakhir) Object.assign(b, tahap[sampai].awal || {});
  return b;
};
const POLA_NAMA = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}$/;
const POLA_JAVA = /^[A-Za-z_][A-Za-z0-9_]*\.java$/;

// ---- kasus bawaan penguji sendiri: harus membedakan lulus dan gagal
console.log("== penyusun dan penguji ==");
{
  const lulus = kasus({ "A.java": "public class A { public int dua() { return 2; } }" }, [{ nama: "benar", kode: "sama(2, new A().dua());" }]);
  cek("kasus kode yang benar lulus", lulus[0].lulus, lulus[0]);
  const salah = kasus({ "A.java": "public class A { public int dua() { return 3; } }" }, [{ nama: "salah", kode: "sama(2, new A().dua());" }]);
  cek("kasus kode yang salah gagal dengan pesan jelas", !salah[0].lulus && salah[0].pesan.includes("Diharapkan 2 tetapi hasilnya 3"), salah[0]);
  const kompil = kasus({ "A.java": "public class A { void x( }" }, [{ nama: "k", kode: "new A();" }]);
  cek("galat kompilasi dilaporkan beserta nama berkas dan baris", !kompil[0].lulus && /A\.java:1/.test(kompil[0].pesan), kompil[0]);
  const eksepsi = kasus({ "A.java": "public class A { public int bagi(int x) { return 10 / x; } }" }, [{ nama: "e", kode: "new A().bagi(0);" }]);
  cek("eksepsi dari kode peserta dilaporkan", !eksepsi[0].lulus && eksepsi[0].pesan.includes("ArithmeticException"), eksepsi[0]);
  const java11 = kasus({ "A.java": 'public class A { public String f() { var x = "a"; return x; } }' }, [{ nama: "var", kode: "new A().f();" }]);
  cek("sintaks di atas Java 8 (var) ditolak, sama seperti di browser", !java11[0].lulus, java11[0]);
  const banyak = kasus({ "Induk.java": "public abstract class Induk { abstract int n(); }", "Anak.java": "public class Anak extends Induk { int n() { return 7; } }" }, [{ nama: "dua berkas", kode: "Induk i = new Anak(); sama(7, i.n());" }]);
  cek("beberapa berkas saling memakai", banyak[0].lulus, banyak[0]);
  const run = jalankan({ "Main.java": "import java.util.*; public class Main { public static void main(String[] a) { Scanner s = new Scanner(System.in); System.out.println(\"Halo \" + s.nextLine()); } }" }, "Main.java", ["Gresik"]);
  cek("jalankan membaca masukan dan mengembalikan keluaran", run.keluaran.includes("Halo Gresik") && run.galat === null, run);
  const runGalat = jalankan({ "Main.java": "public class Main { public static void main(String[] a) { throw new IllegalStateException(\"rusak\"); } }" }, "Main.java", []);
  cek("jalankan dengan eksepsi mengembalikan galat", runGalat.galat && runGalat.galat.includes("IllegalStateException: rusak"), runGalat);
  const kar = bersihkan("a\u0001b\u0005c");
  cek("karakter pemisah dibuang dari kode peserta", kar === "abc");
  const rahasia = kasus({ "A.java": "public class A { }" }, [{ nama: "rahasia", kode: "cek(false, \"nilai 42\");", tersembunyi: true }]);
  cek("kasus tersembunyi ditandai", rahasia[0].tersembunyi === true && !rahasia[0].lulus);
}

// ---- isi praktikum
const dir = join(root, "site", "data", "kuliah");
const daftar = [];
for (const k of readdirSync(dir)) {
  const pd = join(dir, k, "praktikum");
  if (!existsSync(pd)) continue;
  for (const f of readdirSync(pd)) {
    if (f === "index.json") continue;
    const p = JSON.parse(readFileSync(join(pd, f), "utf8"));
    if (p.bahasa === "java") daftar.push({ nama: k + "/" + f, p });
  }
}
cek("ada minimal satu praktikum Java untuk diuji", daftar.length >= 1);

for (const { nama, p } of daftar) {
  console.log("\n== " + nama + " ==");
  const ids = p.tahap.map((t) => t.id);
  cek(nama + ": id tahap unik dan berpola", new Set(ids).size === ids.length && ids.every((i) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(i) && i.length <= 40), ids);
  const seen = new Map();
  for (const t of p.tahap) for (const n of Object.keys(t.contoh || {})) seen.set(n, (seen.get(n) || 0) + 1);
  const berulang = [...seen].filter(([, c]) => c > 1).map(([n]) => n);
  cek(nama + ": berkas contoh yang muncul di beberapa tahap tercantum di 'ubah' tahap yang merevisinya", berulang.every((n) => p.tahap.filter((t) => (t.contoh || {})[n]).slice(1).every((t) => (t.ubah || []).includes(n))), berulang);
  cek(nama + ": entri ada di tahap terakhir yang bercontoh", p.tahap.some((t) => (t.contoh || {})[p.entri]));
  for (const t of p.tahap) {
    const pre = nama + " " + t.id + ": ";
    cek(pre + "punya judul, tujuan, dan langkah", !!t.judul && !!t.tujuan && t.langkah.length > 0);
    cek(pre + "bab berupa daftar angka", Array.isArray(t.bab) && t.bab.every((b) => Number.isInteger(b) && b >= 1 && b <= 99));
    cek(pre + "nama berkas aman, kelas Java bernama sesuai kelasnya, dan ukuran wajar", [...Object.entries(t.contoh || {}), ...Object.entries(t.awal || {})].every(([n, i]) => POLA_NAMA.test(n) && (!n.endsWith(".java") || POLA_JAVA.test(n)) && i.length <= 20000));
    cek(pre + "jenis petunjuk sah", (t.petunjuk || []).every((h) => ["soal", "buku", "video"].includes(h.jenis) && h.isi));
    if (!t.kasus || !t.kasus.length) {
      cek(pre + "tahap tanpa uji otomatis: opsional dan jalurnya jelas", t.opsional === true && ["web", "laptop"].includes(t.jalur), { opsional: t.opsional, jalur: t.jalur });
      cek(pre + "tahap tanpa uji tidak memuat kasus", true);
      continue;
    }
    const namaKasus = t.kasus.map((k) => k.nama);
    cek(pre + "nama kasus unik dan minimal 3", new Set(namaKasus).size === namaKasus.length && namaKasus.length >= 3, namaKasus);
    cek(pre + "setiap kasus punya kode atau jalankan", t.kasus.every((k) => (k.kode !== undefined) !== (k.jalankan !== undefined)));
    cek(pre + "kasus tersembunyi hanya sebagian", t.kasus.some((k) => !k.tersembunyi));
    cek(pre + "berkas yang diminta ada di contoh", t.diminta.length > 0 && t.diminta.every((b) => (t.contoh || {})[b]));
    const i = p.tahap.indexOf(t);
    const hasil = kasus(gabung(p.tahap, i + 1), t.kasus);
    const gagalContoh = hasil.filter((h) => !h.lulus).map((h) => h.nama + " -> " + h.pesan);
    cek(pre + `berkas contoh meluluskan semua ${t.kasus.length} kasus`, gagalContoh.length === 0, gagalContoh);
    if (Object.keys(t.awal || {}).length) {
      const awal = kasus(gabung(p.tahap, i, true), t.kasus);
      cek(pre + "kerangka awal tidak meluluskan semua kasus (kasusnya menguji)", awal.some((h) => !h.lulus));
    }
    const tanpa = kasus(gabung(p.tahap, i), t.kasus);
    cek(pre + "tanpa berkas tahap ini, kasus tidak lulus semua", tanpa.some((h) => !h.lulus));
    // tiap kasus harus membedakan: dengan salah satu berkas diminta dikosongkan, minimal satu kasus gagal (sudah diwakili di atas)
  }
  // seluruh rantai: jalankan entri dengan berkas contoh semua tahap
  const akhir = jalankan(gabung(p.tahap, p.tahap.length), p.entri, ["1", "Bumi", "3", "0"]);
  cek(nama + ": produk akhir berjalan dari awal sampai akhir tanpa galat", akhir.galat === null && akhir.keluaran.includes("Terima kasih"), akhir);
}

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
