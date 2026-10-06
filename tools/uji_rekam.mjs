#!/usr/bin/env node
// Menguji perekam cara menulis (site/js/rekam.js): ringkasan pola, pemadatan, dan putar ulang.
// Jalankan:  node tools/uji_rekam.mjs
import { hitungPola, susunUlang, rekamanAman, pasangRekam, MAKS_REKAMAN } from "../site/js/rekam.js";
import { idPerangkat, agenRingkas } from "../site/js/perangkat.js";

let gagal = 0;
function cek(nama, ok, detail = "") {
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  " + detail));
}

// Editor palsu seukuran CodeMirror 5 yang dipakai perekam: on("change"), indexFromPos, getValue.
function editorPalsu(teks) {
  const pendengar = [];
  const ed = {
    teks,
    on: (n, f) => n === "change" && pendengar.push(f),
    getValue: () => ed.teks,
    indexFromPos: (p) => p.idx,
    ubah(idx, hapus, tambah, origin = "+input") {
      const removed = ed.teks.slice(idx, idx + hapus);
      ed.teks = ed.teks.slice(0, idx) + tambah + ed.teks.slice(idx + hapus);
      pendengar.forEach((f) => f(ed, { from: { idx }, text: tambah.split("\n"), removed: removed.split("\n"), origin }));
    },
    setValue(t) {
      ed.teks = t;
      pendengar.forEach((f) => f(ed, { from: { idx: 0 }, text: t.split("\n"), removed: [""], origin: "setValue" }));
    },
  };
  return ed;
}

// Mengetik manusiawi: ritme beragam dan sesekali berhenti sejenak.
function ketikManusia(ed, jam, teks, mulaiIdx) {
  let idx = mulaiIdx;
  for (let i = 0; i < teks.length; i++) {
    jam.t += 90 + ((i * 37) % 160) + (i % 11 === 0 ? 700 : 0);
    ed.ubah(idx++, 0, teks[i]);
  }
  return idx;
}

// ---- 1. Menulis lurus tanpa koreksi lawan menulis dengan kerangka dan lompat ----
{
  const jam = { t: 1000 };
  const ed = editorPalsu("");
  const r = pasangRekam(ed, "", { sekarang: () => jam.t });
  ketikManusia(ed, jam, 'print("halo dunia")\nprint("selesai")\n', 0);
  const p = r.ambil().pola;
  cek("menulis lurus: hampir semua sisipan di ujung dokumen", p.linier >= 0.97, JSON.stringify(p));
  cek("menulis lurus: tidak ada penghapusan", p.rasio_hapus === 0 && p.dihapus === 0);
  cek("menulis lurus: tidak ada lompat kembali", p.lompat === 0);
  cek("kecepatan ketik manusia wajar", p.cps > 2 && p.cps < 12, String(p.cps));
  cek("ritme manusia beragam (cv di atas 0,3)", p.cv_ketuk > 0.3, String(p.cv_ketuk));
}
{
  const jam = { t: 1000 };
  const ed = editorPalsu("");
  const r = pasangRekam(ed, "", { sekarang: () => jam.t });
  // kerangka dulu, lalu kembali ke atas untuk mengisi, menghapus, dan mengoreksi
  ketikManusia(ed, jam, "print()\n\nprint()", 0);
  jam.t += 3000;
  ed.ubah(6, 0, '"halo"');
  jam.t += 2500;
  ed.ubah(ed.teks.length - 1, 0, '"akhir"');
  jam.t += 1500;
  ed.ubah(7, 2, "");
  jam.t += 400;
  ed.ubah(7, 0, "ha");
  const p = r.ambil().pola;
  cek("kerangka dulu: ada lompat kembali ke bagian atas", p.lompat >= 1, JSON.stringify(p));
  cek("kerangka dulu: ada penghapusan dan koreksi", p.dihapus >= 2 && p.rasio_hapus > 0);
  cek("kerangka dulu: tidak semua sisipan di ujung", p.linier < 0.97, String(p.linier));
  cek("jeda berpikir tercatat", p.jeda_median_s > 2, String(p.jeda_median_s));
}

// ---- 2. Menyalin ketikan dari layar lain: sangat rata, sangat cepat, tanpa koreksi ----
{
  const jam = { t: 0 };
  const ed = editorPalsu("");
  const r = pasangRekam(ed, "", { sekarang: () => jam.t });
  const teks = "jumlah_boks = int(input())\nharga_satuan = int(input())\ntotal = jumlah_boks * harga_satuan\nprint(total)\n".repeat(3);
  let idx = 0;
  for (const ch of teks) {
    jam.t += 70; // tepat 70 ms tiap huruf
    ed.ubah(idx++, 0, ch);
  }
  const p = r.ambil().pola;
  cek("mesin: ritme nyaris rata (cv di bawah 0,1)", p.cv_ketuk < 0.1, String(p.cv_ketuk));
  cek("mesin: kecepatan puncak melebihi batas manusia untuk kode (lebih dari 9 huruf per detik)", p.cps_puncak > 9, String(p.cps_puncak));
}

// ---- 2b. Letupan singkat manusia tidak boleh dikira mesin; kode pendek yang diketik mesin tetap terdeteksi ----
{
  const jam = { t: 0 };
  const ed = editorPalsu("");
  const r = pasangRekam(ed, "", { sekarang: () => jam.t });
  let idx = 0;
  for (const ch of "print(total)") { // 12 huruf dalam 0,6 detik, lalu diam
    jam.t += 50;
    ed.ubah(idx++, 0, ch);
  }
  const p = r.ambil().pola;
  cek("letupan singkat manusia (12 huruf dalam 0,6 detik) tidak melewati batas", p.cps_puncak < 9, String(p.cps_puncak));
  const jam2 = { t: 0 };
  const ed2 = editorPalsu("");
  const r2 = pasangRekam(ed2, "", { sekarang: () => jam2.t });
  let i2 = 0;
  for (const ch of "jumlah_boks = int(input())\nharga = int(input())\nprint(jumlah_boks * harga)\n") {
    jam2.t += 45; // 22 huruf per detik
    ed2.ubah(i2++, 0, ch);
  }
  const p2 = r2.ambil().pola;
  cek("kode pendek yang diketik mesin (sekitar 70 huruf dalam 3 detik) tetap terdeteksi", p2.cps_puncak > 9, String(p2.cps_puncak));
}

// ---- 3. Potongan besar, undo, tombol Jalankan, tombol kembalikan kode awal ----
{
  const jam = { t: 0 };
  const ed = editorPalsu("x = 1\n");
  const r = pasangRekam(ed, "x = 1\n", { sekarang: () => jam.t });
  jam.t += 5000;
  ed.ubah(6, 0, "print('sekali muncul 60 karakter sekaligus dalam satu perubahan..')");
  jam.t += 100;
  ed.ubah(6, 0, "a", "undo");
  r.jalankan();
  jam.t += 4000;
  r.jalankan();
  jam.t += 800;
  const hasil = r.ambil();
  cek("potongan besar terdeteksi", hasil.pola.besar_maks >= 60 && hasil.pola.jumlah_besar === 1, JSON.stringify(hasil.pola));
  cek("undo dihitung terpisah dan tidak merusak metrik lain", hasil.pola.undo === 1);
  cek("jumlah Jalankan sebelum kirim tercatat", hasil.pola.jalankan === 2 && hasil.pola.jalankan_ke_kirim_s === 0.8, JSON.stringify(hasil.pola));
  cek("jeda sebelum ketikan pertama tercatat", hasil.pola.jeda_pertama_s === 5, String(hasil.pola.jeda_pertama_s));
  const kedua = r.ambil();
  cek("setelah ambil, catatan baru dimulai dari kode sekarang", kedua.awal === ed.teks && kedua.pola.kejadian === 0);
  ed.setValue("# kode awal baru\n");
  cek("setValue (kembalikan kode awal) mengatur ulang catatan", r.ambil().awal === "# kode awal baru\n");
}

// ---- 4. Pemadatan dan putar ulang harus menghasilkan kode akhir yang sama persis ----
{
  const jam = { t: 100 };
  const ed = editorPalsu("# mulai\n");
  const r = pasangRekam(ed, "# mulai\n", { sekarang: () => jam.t });
  ketikManusia(ed, jam, 'print("a")\nprint("b")', 8);
  jam.t += 2500;
  ed.ubah(15, 1, "x");
  r.jalankan();
  jam.t += 1200;
  ed.ubah(0, 0, "import os\n");
  jam.t += 900;
  ed.ubah(ed.teks.length, 0, "\nprint('c')");
  const akhir = ed.teks;
  const h = r.ambil();
  cek("rekaman berisi awal dan peristiwa padat", h.rekaman && h.rekaman.awal === "# mulai\n" && Array.isArray(h.rekaman.e));
  cek("pemadatan menggabung ketikan berdekatan (lebih sedikit dari kejadian)", h.rekaman.e.length < h.pola.kejadian, h.rekaman.e.length + " vs " + h.pola.kejadian);
  const langkah = susunUlang(h.rekaman);
  cek("putar ulang berakhir pada kode yang sama persis", langkah[langkah.length - 1].teks === akhir, JSON.stringify(langkah[langkah.length - 1].teks));
  cek("langkah putar ulang berurutan waktu", langkah.every((x, i) => i === 0 || x.t >= langkah[i - 1].t));
  cek("tombol Jalankan muncul sebagai langkah tersendiri", langkah.some((x) => x.jalankan));
  cek("langkah pertama adalah kode awal", langkah[0].teks === "# mulai\n");
}

// ---- 5. Batas ukuran rekaman ----
{
  const ev = [];
  for (let i = 0; i < 30000; i++) ev.push({ t: i * 5000, off: (i * 7) % 500, del: 0, ins: String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + ((i * 3) % 26)), origin: "+input", panjang: 500 });
  const r = rekamanAman("", ev, []);
  cek("rekaman yang terlalu besar dibuang, bukan disimpan penuh", r === null || JSON.stringify(r).length <= MAKS_REKAMAN);
  cek("pola tetap bisa dihitung untuk kejadian sangat banyak", hitungPola(ev).kejadian === 30000);
  cek("tanpa kejadian: pola kosong tidak melempar galat", hitungPola([]).kejadian === 0 && hitungPola([]).cps === null);
}

// ---- 6. ID perangkat ----
{
  const gudang = new Map();
  globalThis.localStorage = { getItem: (k) => (gudang.has(k) ? gudang.get(k) : null), setItem: (k, v) => gudang.set(k, String(v)) };
  const jar = {};
  globalThis.document = {
    get cookie() {
      return Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ");
    },
    set cookie(s) {
      const [kv] = s.split(";");
      const i = kv.indexOf("=");
      jar[kv.slice(0, i)] = kv.slice(i + 1);
    },
  };
  const a = idPerangkat();
  cek("ID perangkat berbentuk dev- diikuti 24 heksadesimal", /^dev-[0-9a-f]{24}$/.test(a), a);
  cek("ID sama dikembalikan pada pemanggilan berikutnya", idPerangkat() === a);
  gudang.clear();
  cek("bila penyimpanan lokal hilang, ID dipulihkan dari cookie", idPerangkat() === a && gudang.get("latihan:perangkat") === a);
  gudang.clear();
  for (const k of Object.keys(jar)) delete jar[k];
  cek("bila keduanya hilang, dibuat ID baru yang berbeda", idPerangkat() !== a);
  gudang.set("latihan:perangkat", "sembarang");
  for (const k of Object.keys(jar)) delete jar[k];
  cek("ID rusak diganti ID sah", /^dev-[0-9a-f]{24}$/.test(idPerangkat()));
  cek("ringkasan agen: Chrome di Windows", agenRingkas("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36") === "Chrome di Windows");
  cek("ringkasan agen: Safari di iOS ponsel", agenRingkas("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1") === "Safari di iOS (ponsel)");
  cek("ringkasan agen: Firefox di Linux", agenRingkas("Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0") === "Firefox di Linux");
  cek("ringkasan agen tidak membawa nomor versi", !/\d/.test(agenRingkas("Mozilla/5.0 (Windows NT 10.0) Chrome/126.0.0.0 Safari/537.36")));
}

console.log(gagal ? "\n" + gagal + " uji GAGAL." : "\nSemua uji lulus.");
process.exit(gagal ? 1 : 0);
