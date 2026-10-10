#!/usr/bin/env node
// Menguji penilaian tantangan konsep (site/js/konsep.js) dan isi semua tantangan konsep:
// jawaban yang benar harus bernilai penuh, jawaban kosong nol, dan tidak ada butir yang bisa dilulusi dengan asal tebak.
// Jalankan:  node tools/uji_konsep.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

globalThis.document = { createElement: () => ({}) };
const { nilaiButir, nilaiSemua, kunciTeks, jawabanBenar, AMBANG_LULUS } = await import("../site/js/konsep.js");

let gagal = 0;
function cek(nama, ok, detail = "") {
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  " + detail));
}
const akar = join(dirname(fileURLToPath(import.meta.url)), "..", "site", "data", "kuliah");

// ---- penilaian per tipe ----
const pg = { tipe: "pilgan", tanya: "?", opsi: ["a", "b", "c"], benar: 1 };
cek("pilgan: benar", nilaiButir(pg, "b").benar === 1);
cek("pilgan: salah, kosong, huruf besar kecil tidak masalah", nilaiButir(pg, "a").benar === 0 && nilaiButir(pg, null).benar === 0 && nilaiButir(pg, " B ").benar === 1);
const bn = { tipe: "banyak", tanya: "?", opsi: ["a", "b", "c", "d"], benar: [0, 2] };
cek("banyak: semua benar", nilaiButir(bn, ["a", "c"]).benar === 4);
cek("banyak: nilai sebagian (memilih satu benar saja)", nilaiButir(bn, ["a"]).benar === 3 && nilaiButir(bn, ["a"]).total === 4);
cek("banyak: memilih semua tidak mendapat nilai penuh", nilaiButir(bn, ["a", "b", "c", "d"]).benar === 2);
cek("banyak: tidak memilih apa pun hanya benar pada yang memang salah", nilaiButir(bn, []).benar === 2);
const ur = { tipe: "urutkan", tanya: "?", langkah: ["satu", "dua", "tiga", "empat"] };
cek("urutkan: urutan benar", nilaiButir(ur, ["satu", "dua", "tiga", "empat"]).benar === 4);
cek("urutkan: nilai sebagian per posisi", nilaiButir(ur, ["satu", "tiga", "dua", "empat"]).benar === 2);
cek("urutkan: kebalikan nol atau sedikit", nilaiButir(ur, ["empat", "tiga", "dua", "satu"]).benar === 0);
const co = { tipe: "cocokkan", tanya: "?", pasangan: [["a", "1"], ["b", "2"], ["c", "3"]] };
cek("cocokkan: benar semua dan sebagian", nilaiButir(co, { a: "1", b: "2", c: "3" }).benar === 3 && nilaiButir(co, { a: "1", b: "3", c: "2" }).benar === 1);
cek("cocokkan: kosong atau null aman", nilaiButir(co, null).benar === 0 && nilaiButir(co, { a: null }).benar === 0);
const se = { tipe: "seret", tanya: "?", wadah: [{ id: "x", nama: "X" }, { id: "y", nama: "Y" }], butir: [{ teks: "t1", wadah: "x" }, { teks: "t2", wadah: "y" }, { teks: "t3", wadah: "x" }] };
cek("seret: benar semua dan sebagian", nilaiButir(se, { t1: "x", t2: "y", t3: "x" }).benar === 3 && nilaiButir(se, { t1: "x", t2: "x" }).benar === 1);
cek("seret: butir yang tidak ditempatkan dihitung salah", nilaiButir(se, {}).benar === 0 && nilaiButir(se, undefined).benar === 0);
const isi = { tipe: "isian", tanya: "?", jawaban: ["3696000", "3.696.000"] };
cek("isian: beberapa bentuk jawaban diterima, spasi diabaikan", nilaiButir(isi, "3.696.000").benar === 1 && nilaiButir(isi, "  3696000 ").benar === 1 && nilaiButir(isi, "3696001").benar === 0);
const tb = { tipe: "tabel", tanya: "?", kolom: ["p", "q"], baris: [{ label: "r1", sel: ["1", "2"] }, { label: "r2", sel: ["3", "4"] }] };
cek("tabel: nilai per sel", nilaiButir(tb, [["1", "2"], ["3", "x"]]).benar === 3 && nilaiButir(tb, [["1", "2"], ["3", "4"]]).benar === 4 && nilaiButir(tb, []).total === 4);
const re = { tipe: "relasi", tanya: "?", relasi: ["asosiasi", "agregasi"], multiplisitas: ["1", "0..*"], pasangan: [{ dari: "A", ke: "B", benar: "asosiasi", a: "1", b: "0..*" }, { dari: "C", ke: "D", benar: "agregasi" }] };
cek("relasi: tiga komponen untuk pasangan bermultiplisitas, satu untuk yang tidak", nilaiButir(re, [{ relasi: "asosiasi", a: "1", b: "0..*" }, { relasi: "agregasi" }]).total === 4 && nilaiButir(re, [{ relasi: "asosiasi", a: "1", b: "0..*" }, { relasi: "agregasi" }]).benar === 4);
cek("relasi: jenis benar tapi multiplisitas salah = nilai sebagian", nilaiButir(re, [{ relasi: "asosiasi", a: "0..*", b: "1" }, { relasi: "agregasi" }]).benar === 2);
let galat = null;
try {
  nilaiButir({ tipe: "aneh" }, null);
} catch (e) {
  galat = e;
}
cek("tipe tidak dikenal melempar galat jelas (bukan diam-diam bernilai nol)", galat && /tidak dikenal/.test(galat.message));

// ---- nilaiSemua ----
const s2 = nilaiSemua([pg, bn], ["b", ["a", "c"]]);
cek("nilaiSemua: persen, lulus, dan butir salah", s2.persen === 1 && s2.lulus && s2.butirSalah.length === 0);
const s3 = nilaiSemua([pg, bn, ur], ["a", ["a"], ["satu", "dua", "tiga", "empat"]]);
cek("nilaiSemua: butir salah dicatat (nomor mulai 1)", s3.butirSalah.join() === "1,2" && Math.abs(s3.persen - 7 / 9) < 1e-9 && s3.lulus === true);
cek("nilaiSemua: di bawah ambang tidak lulus", nilaiSemua([pg, bn], ["a", []]).lulus === false);
cek("ambang lulus 70 persen", AMBANG_LULUS === 0.7);
cek("nilaiSemua: tanpa butir tidak lulus (bukan lulus kosong)", nilaiSemua([], []).lulus === false);

// ---- isi semua tantangan konsep ----
let jumlah = 0;
for (const kuliah of readdirSync(akar)) {
  const dir = join(akar, kuliah, "challenges");
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const ch = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (ch.jenis !== "konsep") continue;
    jumlah++;
    const nama = kuliah + "/" + f;
    const benar = nilaiSemua(ch.butir, ch.butir.map(jawabanBenar));
    cek(nama + ": jawaban yang benar bernilai 100 persen", benar.persen === 1 && benar.lulus, JSON.stringify(benar.butirSalah));
    const kosong = nilaiSemua(ch.butir, ch.butir.map(() => null));
    cek(nama + ": jawaban kosong tidak lulus", !kosong.lulus && kosong.persen < 0.5, String(kosong.persen));
    cek(nama + ": kunci teks tersedia untuk semua butir", ch.butir.every((b) => kunciTeks(b).length > 0));
    // Menebak: untuk tiap butir pilgan, memilih opsi pertama atau acak tidak boleh selalu lulus. Uji deterministik:
    // memilih opsi yang bukan kunci di semua pilgan harus gagal pada butir itu.
    const salahSemua = ch.butir.map((b) => (b.tipe === "pilgan" ? b.opsi[(b.benar + 1) % b.opsi.length] : jawabanBenar(b)));
    const s = nilaiSemua(ch.butir, salahSemua);
    cek(nama + ": salah di semua pilgan tercermin pada nilai", ch.butir.filter((b) => b.tipe === "pilgan").length === 0 || s.persen < 1);
    // Urutan awal yang diacak tidak boleh sama dengan kunci untuk semua butir urutkan (butir urutkan benar-benar menguji)
    cek(nama + ": butir urutkan punya langkah yang saling berbeda", ch.butir.filter((b) => b.tipe === "urutkan").every((b) => new Set(b.langkah).size === b.langkah.length));
    // Soal seret/cocokkan: tidak ada dua butir bernilai sama yang bisa tertukar tanpa terdeteksi
    cek(nama + ": setiap butir seret/cocokkan menolak penempatan tertukar", ch.butir.filter((b) => b.tipe === "seret" || b.tipe === "cocokkan").every((b) => {
      const j = jawabanBenar(b);
      const k = Object.keys(j);
      const tukar = Object.assign({}, j);
      if (k.length >= 2 && j[k[0]] !== j[k[1]]) {
        [tukar[k[0]], tukar[k[1]]] = [tukar[k[1]], tukar[k[0]]];
        return nilaiButir(b, tukar).benar < nilaiButir(b, j).benar;
      }
      return true;
    }));
  }
}
cek("ada tantangan konsep untuk lima bab (Algoritma 3; PBO 4, 11, 12, 15)", jumlah === 5, String(jumlah));

console.log(gagal ? "\n" + gagal + " uji GAGAL." : "\nSemua uji lulus.");
process.exit(gagal ? 1 : 0);
