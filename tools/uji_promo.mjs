#!/usr/bin/env node
// Menguji data dan aturan promo silang ke muchson.web.id (site/js/promo-data.js, promo-logika.js).
import { PROMO, SITUS_UTAMA } from "../site/js/promo-data.js";
import { ATURAN, layak, undi, pilihPromo, tundaAwal, jedaBerikut } from "../site/js/promo-logika.js";

let total = 0;
let gagal = 0;
const cek = (nama, ok, detail = "") => {
  total++;
  if (!ok) {
    gagal++;
    console.log("GAGAL " + nama + (detail ? "  -> " + detail : ""));
  } else console.log("OK    " + nama);
};

console.log("== data ==");
const ids = PROMO.map((p) => p.id);
cek("jumlah promo sesuai daftar (6 utama + 16 CS + 9 UX + 16 Green IT = 47)", PROMO.length === 47, String(PROMO.length));
cek("id unik dan url unik", new Set(ids).size === ids.length && new Set(PROMO.map((p) => p.url)).size === ids.length);
cek("semua url ke situs utama", PROMO.every((p) => p.url.startsWith(SITUS_UTAMA)), PROMO.filter((p) => !p.url.startsWith(SITUS_UTAMA)).map((p) => p.url).join(","));
cek("semua entri punya kelompok, label, dan hook", PROMO.every((p) => p.kelompok && p.label && p.hook));
cek("hook cukup pendek untuk kotak kecil (<= 130 karakter)", PROMO.every((p) => p.hook.length <= 130), PROMO.filter((p) => p.hook.length > 130).map((p) => p.id).join(","));
cek("rute Aion: 16 customer-success, 9 ux, 16 green-it", ["customer-success", "ux", "green-it"].map((k) => PROMO.filter((p) => p.url.includes("#/aion/" + k + "/")).length).join() === "16,9,16");
cek("url hari sesuai daftar (customer-success/15, ux/8, green-it/15 ada)", ["#/aion/customer-success/15", "#/aion/ux/8", "#/aion/green-it/15"].every((u) => PROMO.some((p) => p.url === SITUS_UTAMA + u)));
cek("halaman utama ada (#about, #teaching, #projects, #contact, #/latihan)", ["#about", "#teaching", "#projects", "#contact", "#/latihan"].every((u) => PROMO.some((p) => p.url === SITUS_UTAMA + u)));
cek("hanya Latihan Python yang dilewati dari undian", PROMO.filter((p) => p.lewati).map((p) => p.id).join() === "latihan");

console.log("\n== aturan ==");
const dasar = { halamanBab: true, terlihat: true, mati: false, jumlah: 0, sedangTampil: false, menunggu: 0, diamMs: 6000, adaDialog: false };
cek("layak bila semua syarat terpenuhi", layak(dasar) === true);
cek("tidak di luar halaman bab", layak({ ...dasar, halamanBab: false }) === false);
cek("tidak saat tab tersembunyi", layak({ ...dasar, terlihat: false }) === false);
cek("tidak bila dimatikan peserta", layak({ ...dasar, mati: true }) === false);
cek("tidak bila masih ada yang tampil (tidak ditumpuk)", layak({ ...dasar, sedangTampil: true }) === false);
cek("tidak saat ada dialog terbuka", layak({ ...dasar, adaDialog: true }) === false);
cek("tidak melebihi batas per sesi", layak({ ...dasar, jumlah: ATURAN.maksPerSesi }) === false && layak({ ...dasar, jumlah: ATURAN.maksPerSesi - 1 }) === true);
cek("tidak sebelum jeda habis", layak({ ...dasar, menunggu: 1 }) === false);
cek("tidak saat baru mengetik atau menyentuh layar", layak({ ...dasar, diamMs: 1000 }) === false && layak({ ...dasar, diamMs: ATURAN.diamMinDetik * 1000 }) === true);
cek("undi: kadang muncul, kadang tidak", undi(dasar, () => 0.1) === true && undi(dasar, () => 0.9) === false);
cek("undi tidak pernah lolos bila tidak layak", undi({ ...dasar, halamanBab: false }, () => 0) === false);
cek("tampil 9 detik dan di bawah 10 detik", ATURAN.tampilMs === 9000 && ATURAN.tampilMs <= 10000);
cek("jeda awal dan antar kemunculan dalam rentang", tundaAwal(() => 0) === 120000 && tundaAwal(() => 1) === 240000 && jedaBerikut(() => 0) === 300000 && jedaBerikut(() => 1) === 600000);

console.log("\n== pemilihan ==");
const p1 = pilihPromo(PROMO, [], () => 0);
cek("promo yang dilewati tidak pernah terpilih", PROMO.filter((p) => !p.lewati).length === 46 && Array.from({ length: 200 }, (_, i) => pilihPromo(PROMO, [], () => i / 200)).every((p) => !p.lewati));
const semuaIkut = PROMO.filter((p) => !p.lewati).map((p) => p.id);
cek("tidak mengulang yang sudah tampil selama masih ada yang belum", pilihPromo(PROMO, semuaIkut.slice(0, -1), () => 0).id === semuaIkut[semuaIkut.length - 1]);
cek("bila semua sudah tampil, undian diulang (tidak null)", pilihPromo(PROMO, semuaIkut, () => 0) !== null);
cek("daftar kosong menghasilkan null", pilihPromo([], [], () => 0) === null && p1 !== null);
cek("rnd=1 tidak keluar batas", pilihPromo(PROMO, [], () => 1) !== undefined);

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
