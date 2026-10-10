#!/usr/bin/env node
// Menguji praktik per bab berbahasa Java (site/data/kuliah/*/praktik/bab-NN.json) dengan JVM sungguhan.
// Memakai penyusun pekerjaan yang SAMA dengan browser (site/js/praktikum-java.js) dan JavaRun (site/vendor/javarun.jar, ECJ Java 8),
// jadi yang lulus di sini berperilaku sama di CheerpJ. Untuk tiap praktik:
//   1. contoh jawaban meluluskan SEMUA kasus. Contoh TIDAK ada di situs (publik); dibaca dari kunci/<mata kuliah>/praktik-NN.java
//      (diabaikan git). Bila folder kunci/ tidak ada (mis. di CI), pemeriksaan ini dilewati;
//   2. kerangka awal (dengan ____) tidak meluluskan semua kasus dan paling banyak separuhnya;
//   3. tanpa berkas, kasus tidak lulus semua.
// Jalankan: node tools/uji_praktik_java.mjs   (butuh java di PATH)
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { susunPekerjaan, uraikanHasil } from "../site/js/praktikum-java.js";

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
  console.log("java tidak ditemukan di PATH; uji praktik Java dilewati.");
  process.exit(0);
}

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
const jalankan = (berkas, entri) => {
  const { sumber, tafsir } = susunPekerjaan(berkas, { aksi: "jalankan", entri, masukan: [] });
  return uraikanHasil(jalankanMentah(sumber), tafsir);
};

const dir = join(root, "site", "data", "kuliah");
const POLA_BERKAS = /^[A-Za-z_][A-Za-z0-9_]{0,58}\.java$/;
let ada = 0;
for (const k of readdirSync(dir)) {
  const pd = join(dir, k, "praktik");
  if (!existsSync(pd)) continue;
  const materi = JSON.parse(readFileSync(join(dir, k, "materi.json"), "utf8"));
  const daftarMk = JSON.parse(readFileSync(join(dir, "..", "matakuliah.json"), "utf8"));
  if ((daftarMk.find((c) => c.id === k) || {}).bahasa !== "java") continue;
  const babKode = new Set(materi.filter((m) => m.jenis === "kode").map((m) => m.bab));
  const indeks = JSON.parse(readFileSync(join(pd, "index.json"), "utf8"));
  const berkasBab = readdirSync(pd).filter((f) => /^bab-\d\d\.json$/.test(f));
  cek(k + "/praktik/index.json cocok dengan berkas bab-NN.json", JSON.stringify([...indeks.bab].sort((a, b) => a - b)) === JSON.stringify(berkasBab.map((f) => Number(f.slice(4, 6))).sort((a, b) => a - b)));
  for (const f of berkasBab) {
    ada++;
    const p = JSON.parse(readFileSync(join(pd, f), "utf8"));
    const nama = k + "/" + f;
    const pre = nama + ": ";
    console.log("\n== " + nama + " ==");
    cek(pre + "punya bab, judul, tujuan, langkah, dan kasus", ["bab", "judul", "tujuan", "langkah", "kasus"].every((x) => p[x] && p[x].length !== 0));
    cek(pre + "bab sama dengan nama berkas dan berjenis kode", "bab-" + String(p.bab).padStart(2, "0") + ".json" === f && babKode.has(p.bab), p.bab);
    cek(pre + "berkas adalah Main.java dan kerangka memuat tanda ____", p.berkas === "Main.java" && POLA_BERKAS.test(p.berkas) && p.awal.includes("____"), p.berkas);
    cek(pre + "situs tidak memuat contoh jawaban (publik)", !("contoh" in p));
    const nm = p.kasus.map((x) => x.nama);
    cek(pre + "nama kasus unik, minimal tiga, dan ada yang tidak tersembunyi", new Set(nm).size === nm.length && nm.length >= 3 && p.kasus.some((x) => !x.tersembunyi), nm);
    cek(pre + "tiap kasus punya kode atau jalankan (Main)", p.kasus.every((x) => ("kode" in x) !== ("jalankan" in x) && (!x.jalankan || x.jalankan === "Main")));
    cek(pre + "petunjuk sah dan minimal dua", p.petunjuk.length >= 2 && p.petunjuk.every((h) => ["soal", "buku", "video"].includes(h.jenis) && h.isi));
    const kunci = join(root, "kunci", k, "praktik-" + String(p.bab).padStart(2, "0") + ".java");
    if (existsSync(kunci)) {
      const contoh = readFileSync(kunci, "utf8");
      cek(pre + "contoh tidak memuat tanda ____", !contoh.includes("____"));
      const hasil = kasus({ "Main.java": contoh }, p.kasus);
      cek(pre + "contoh jawaban meluluskan semua " + p.kasus.length + " kasus", hasil.every((h) => h.lulus), hasil.filter((h) => !h.lulus).map((h) => h.nama + " -> " + h.pesan));
      const r = jalankan({ "Main.java": contoh }, "Main.java");
      cek(pre + "contoh berjalan tanpa galat dan mencetak sesuatu", r.galat === null && r.keluaran.trim() !== "", r);
    } else console.log("LEWAT " + pre + "contoh jawaban (kunci/ tidak ada di komputer ini)");
    const hAwal = kasus({ "Main.java": p.awal }, p.kasus);
    cek(pre + "kerangka awal tidak meluluskan semua kasus", hAwal.some((h) => !h.lulus));
    cek(pre + "kerangka awal paling banyak separuh kasus lulus", hAwal.filter((h) => h.lulus).length <= Math.floor(hAwal.length / 2), hAwal.filter((h) => h.lulus).map((h) => h.nama));
    const hKosong = kasus({}, p.kasus);
    cek(pre + "tanpa berkas, kasus tidak lulus semua", hKosong.some((h) => !h.lulus));
  }
}
cek("ada minimal satu praktik Java untuk diuji", ada >= 1);
console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
