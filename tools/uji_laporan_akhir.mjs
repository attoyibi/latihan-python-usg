#!/usr/bin/env node
// Menguji laporan akhir: penyusunan paket dan blok PDF (site/js/laporan-akhir.js) dan pengumpulan data dengan klien Supabase tiruan
// (site/js/laporan-akhir-data.js), termasuk tabel yang belum ada dan keadaan lokal peserta sendiri. Jalankan: node tools/uji_laporan_akhir.mjs
let gagal = 0;
let total = 0;
const cek = (nama, ok, detail = "") => {
  total++;
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  -> " + detail));
};

const gudang = new Map();
globalThis.localStorage = { getItem: (k) => (gudang.has(k) ? gudang.get(k) : null), setItem: (k, v) => gudang.set(k, String(v)), removeItem: (k) => gudang.delete(k) };
const pendengar = {};
globalThis.document = { addEventListener: (n, f) => (pendengar["d:" + n] = f), visibilityState: "visible" };
globalThis.window = { addEventListener: (n, f) => (pendengar["w:" + n] = f), APP_CONFIG: {} };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.endsWith("praktik/index.json")) return { ok: true, json: async () => ({ bab: [2] }) };
  if (u.endsWith("praktik/bab-02.json")) return { ok: true, json: async () => ({ bab: 2, judul: "Enam operasi", tujuan: "t", berkas: "hitung.py", awal: "x ____", kasus: [{ nama: "a", kode: "pass" }], langkah: [] }) };
  return { ok: false, status: 404, json: async () => ({}) };
};

const tabel = {
  progres: [{ user_id: "u1", matakuliah_id: "mk", bab: 1, status: "selesai", jumlah_kirim: 2 }, { user_id: "u1", matakuliah_id: "mk", bab: 2, status: "sedang", jumlah_kirim: 1 }],
  percobaan: [
    { id: 1, user_id: "u1", matakuliah_id: "mk", bab: 1, jenis: "kirim", lulus: false, kasus_lulus: 2, kasus_total: 5, kode: "print(1)", dibuat_pada: "2026-10-01T01:00:00Z" },
    { id: 2, user_id: "u1", matakuliah_id: "mk", bab: 1, jenis: "kirim", lulus: true, kasus_lulus: 5, kasus_total: 5, kode: "print('lulus')", dibuat_pada: "2026-10-01T02:00:00Z" },
    { id: 3, user_id: "u1", matakuliah_id: "mk", bab: 1, jenis: "kirim", lulus: false, kasus_lulus: 4, kasus_total: 5, kode: "print('lagi')", dibuat_pada: "2026-10-01T03:00:00Z" },
    { id: 4, user_id: "u1", matakuliah_id: "mk", bab: 2, jenis: "kirim", lulus: false, kasus_lulus: 1, kasus_total: 6, kode: "a = 1", dibuat_pada: "2026-10-02T01:00:00Z" },
    { id: 5, user_id: "u1", matakuliah_id: "mk", bab: 2, jenis: "jalankan", lulus: null, kode: "dijalankan saja", dibuat_pada: "2026-10-02T02:00:00Z" },
    { id: 6, user_id: "u2", matakuliah_id: "mk", bab: 1, jenis: "kirim", lulus: true, kode: "milik u2", dibuat_pada: "2026-10-01T01:00:00Z" },
  ],
  laporan: [{ user_id: "u1", matakuliah_id: "mk", bab: 1, jawaban: { tujuan: "Belajar print", kendala: "Tanda kutip" } }],
  praktikum_berkas: [{ user_id: "u1", matakuliah_id: "mk", praktikum_id: "bab-02", nama: "hitung.py", isi: "print('server')" }],
  praktikum_tahap: [{ user_id: "u1", matakuliah_id: "mk", praktikum_id: "bab-02", tahap_id: "p01", status: "lulus", jumlah_kirim: 3 }, { user_id: "u1", matakuliah_id: "mk", praktikum_id: "kasir", tahap_id: "t01", status: "lulus", jumlah_kirim: 9 }],
  praktikum_laporan: [{ user_id: "u1", matakuliah_id: "mk", praktikum_id: "akhir", jawaban: { apa: "Dari server" }, kode_verifikasi: "SRV12345", dikumpulkan_pada: null, jumlah_ketikan: {}, percobaan_tempel: 0, durasi_menulis_detik: 0 }],
};
let hilang = new Set(); // tabel yang "belum ada"
const klien = {
  auth: { getSession: async () => ({ data: { session: { user: { id: "u1", email: "a@x.id" } } } }), onAuthStateChange: () => ({ data: { subscription: {} } }) },
  rpc: async () => ({ error: null }),
  from: (t) => {
    const q = { f: {}, urut: null, dari: null, sampai: null };
    const rantai = {
      select: () => rantai,
      eq: (k, v) => ((q.f[k] = v), rantai),
      order: (k) => ((q.urut = k), rantai),
      range: (a, b) => ((q.dari = a), (q.sampai = b), rantai),
      maybeSingle: async () => ({ data: t === "profiles" ? { nama: "A", nim: "1", kelas: "SI-2024-A", peran: "peserta" } : null, error: null }),
      upsert: async () => ({ error: null }),
      then: (res) => {
        if (hilang.has(t)) return Promise.resolve({ data: null, error: { code: "PGRST205", message: "Could not find the table" } }).then(res);
        let baris = (tabel[t] || []).filter((x) => Object.keys(q.f).every((k) => String(x[k]) === String(q.f[k])));
        if (q.urut) baris = baris.slice().sort((a, b) => (a[q.urut] < b[q.urut] ? -1 : a[q.urut] > b[q.urut] ? 1 : 0));
        if (q.dari !== null) baris = baris.slice(q.dari, q.sampai + 1);
        return Promise.resolve({ data: baris, error: null }).then(res);
      },
    };
    return rantai;
  },
};
window.APP_CONFIG.client = klien;

const A = await import("../site/js/laporan-akhir.js");
const Auth = await import("../site/js/auth.js");
const DA = await import("../site/js/laporan-akhir-data.js");
await Auth.init();

console.log("== bahan murni ==");
cek("potongKode: pendek utuh, panjang dipotong dengan sisa baris", A.potongKode("a\nb").dipotong === 0 && A.potongKode(Array.from({ length: 100 }, (_, i) => "b" + i).join("\n")).dipotong === 20 && A.potongKode(Array.from({ length: 100 }, (_, i) => "b" + i).join("\n")).teks.split("\n").length === 80 && A.potongKode(null).teks === "");
const kir = A.pilihKiriman(tabel.percobaan.filter((r) => r.user_id === "u1" && r.jenis === "kirim"));
cek("pilihKiriman: kiriman lulus terakhir didahulukan, jumlah kirim dihitung", kir.get(1).kode === "print('lulus')" && kir.get(1).lulus === true && kir.get(1).kirim === 3 && kir.get(2).kode === "a = 1" && kir.get(2).lulus === false && kir.get(2).kirim === 1);
cek("pilihKiriman: tanpa baris menghasilkan peta kosong", A.pilihKiriman([]).size === 0 && A.pilihKiriman(null).size === 0);
cek("form akhir: kelengkapan 3 kolom", A.kelengkapanAkhir({}).total === 3 && A.kelengkapanAkhir({ apa: "x".repeat(90), kendala: "y".repeat(70), kesimpulan: "z".repeat(70) }).lengkap && !A.kelengkapanAkhir({ apa: "x" }).lengkap);
cek("nama berkas aman", A.namaBerkasAkhir({ matakuliah: { id: "algoritma-python" }, identitas: { nim: "2024 11/0001" } }) === "laporan-akhir-algoritma-python-2024-11-0001.pdf");

console.log("\n== paket dari data server ==");
const kuliah = { id: "mk", nama: "Algoritma", praktik: true, materi: [{ bab: 1, judul: "Fondasi", jenis: "kode" }, { bab: 2, judul: "Variabel", jenis: "kode" }, { bab: 3, judul: "Flowchart", jenis: "konsep" }, { bab: 4, judul: "Unggah", jenis: "unggah" }] };
const profil = { nama: "Ani", nim: "123", kelas: "SI-A" };
const paketSrv = await DA.kumpulkan({ kuliah, profil, uid: "u1" });
const b1 = paketSrv.bab[0];
const b2 = paketSrv.bab[1];
cek("bab 1: lulus, kode lulus terakhir, jumlah kirim dari server, refleksi dari server", b1.latihan.status === "selesai" && b1.latihan.kodeAkhir === "print('lulus')" && b1.latihan.kirim === 3 && b1.refleksi.jawaban.tujuan === "Belajar print", JSON.stringify(b1));
cek("bab 2: sedang, kode kiriman (bukan baris jalankan), praktik lulus dari server", b2.latihan.status === "sedang" && b2.latihan.kodeAkhir === "a = 1" && b2.praktik && b2.praktik.status === "lulus" && b2.praktik.isi === "print('server')" && b2.praktik.berkas === "hitung.py" && b2.praktik.kirim === 3, JSON.stringify(b2));
cek("bab tanpa data: belum, tanpa praktik bila tidak di indeks", paketSrv.bab[2].latihan.status === "belum" && paketSrv.bab[2].praktik === null && paketSrv.bab[3].praktik === null);
cek("data peserta lain tidak ikut, baris praktikum lama (kasir) diabaikan", !JSON.stringify(paketSrv).includes("milik u2") && !JSON.stringify(paketSrv).includes("kasir"));
cek("form akhir dari server dan kode verifikasinya", paketSrv.akhir.jawaban.apa === "Dari server" && paketSrv.akhir.kode === "SRV12345");
const r = A.ringkasAkhir(paketSrv);
cek("ringkasan: latihan lulus 1 dari 3 (unggah tidak dihitung), praktik 1 dari 1, refleksi 0 memadai", r.latihanLulus === 1 && r.latihanTotal === 3 && r.praktikLulus === 1 && r.praktikTotal === 1 && r.refleksiTerisi === 0 && r.akhirBaik === 0);

console.log("\n== blok PDF ==");
const blok = A.susunBlokAkhir(paketSrv);
const teks = blok.map((b) => b.teks || (b.baris ? b.baris.map((x) => x.join(" ")).join(" ") : "")).join("\n");
cek("judul, identitas, ringkasan, dan kode verifikasi di kaki", blok[0].teks === "LAPORAN AKHIR" && teks.includes("Ani") && teks.includes("123") && blok[2].teks.startsWith("Ringkasan: latihan lulus 1 dari 3") && blok.at(-1).teks === "Kode verifikasi: SRV12345");
cek("tiap bab punya bagian, status, refleksi, dan kode", teks.includes("Bab 1: Fondasi") && teks.includes("Latihan: lulus (5 dari 5 kasus uji cocok), 3 kali kirim") && teks.includes("Tujuan: Belajar print") && blok.some((b) => b.t === "kode" && b.teks === "print('lulus')"));
cek("bab belum lulus diberi tanda pada kode latihan", teks.includes("Kode latihan (kiriman terakhir, belum lulus):"));
cek("praktik tampil dengan nama berkas dan kodenya", teks.includes("Kode praktik (hitung.py):") && blok.some((b) => b.t === "kode" && b.teks === "print('server')") && teks.includes("Praktik: lulus, diperiksa 3 kali"));
cek("bab konsep dan unggah: tanpa blok kode, tanpa praktik", teks.includes("Bab 4: Unggah") && teks.includes("dikumpulkan sebagai tugas unggahan") && !teks.includes("Kode latihan: (belum ada kiriman)\nRefleksi bab: (belum diisi)\nBab 4"));
cek("kolom kosong tetap muncul sebagai belum diisi (form akhir 3 kolom)", blok.filter((b) => b.t === "paragraf" && b.kosong && b.teks.includes("(belum diisi)")).length >= 3);
const panjang = A.susunBlokAkhir(Object.assign({}, paketSrv, { bab: [Object.assign({}, b1, { latihan: Object.assign({}, b1.latihan, { kodeAkhir: Array.from({ length: 200 }, (_, i) => "baris" + i).join("\n") }) })] }));
cek("kode panjang dipotong dengan keterangan sisa", panjang.some((b) => b.t === "catatan" && b.teks === "(120 baris lagi tidak ditampilkan)") && panjang.find((b) => b.t === "kode").teks.split("\n").length === 80);

console.log("\n== keadaan lokal peserta sendiri ==");
const toko = new Map();
const store = { get: (k, f) => (toko.has(k) ? JSON.parse(toko.get(k)) : f), set: (k, v) => toko.set(k, JSON.stringify(v)) };
store.set("kirimTerakhir:mk:2", { kode: "a = 99  # lokal", lulus: true, kasus_lulus: 6, kasus_total: 6, waktu: "2026-10-03T00:00:00Z" });
store.set("done:mk:2", true);
store.set("tries:mk:2", 7);
store.set("kirimTerakhir:mk:3", { konsep: true, lulus: true, persen: 100, kasus_lulus: 29, kasus_total: 29 });
store.set("done:mk:3", true);
store.set("laporan:mk:2", { jawaban: { kesimpulan: "Dari browser" } });
store.set("pk2:mk:2", { isi: "print('lokal')", t: "2026-10-04T00:00:00Z", status: "sedang", jumlah_kirim: 1, riwayat: [] });
store.set("lapakhir:mk", { jawaban: { kendala: "Lokal" }, ketikan: {}, tempel: 0, durasi: 0, kode: "LOK12345", diekspor: null, diperbarui: null });
const paketLok = await DA.kumpulkan({ kuliah, profil, uid: "u1", store });
const l2 = paketLok.bab[1];
cek("lokal lebih baru: kode dan status latihan dari browser (lulus), jumlah kirim terbesar", l2.latihan.status === "selesai" && l2.latihan.kodeAkhir === "a = 99  # lokal" && l2.latihan.lulus === true && l2.latihan.kirim === 7, JSON.stringify(l2.latihan));
cek("bab konsep memakai ringkasan skor, bukan kode", paketLok.bab[2].latihan.status === "selesai" && paketLok.bab[2].latihan.kasus_total === 29 && paketLok.bab[2].latihan.kodeAkhir === "");
cek("refleksi lokal digabung dengan server; praktik: isi lokal, status server yang lebih jauh", l2.refleksi.jawaban.kesimpulan === "Dari browser" && paketLok.bab[0].refleksi.jawaban.tujuan === "Belajar print" && l2.praktik.isi === "print('lokal')" && l2.praktik.status === "lulus");
cek("form akhir: lokal dan server digabung (kode verifikasi server dipakai)", paketLok.akhir.jawaban.apa === "Dari server" || paketLok.akhir.jawaban.kendala === "Lokal");
const ringLokal = await DA.ringkasLokal(store, kuliah, profil);
cek("ringkasan cepat dari browser tanpa jaringan", ringLokal.latihanLulus === 2 && ringLokal.praktikTotal === 1 && ringLokal.praktikLulus === 0);
DA.simpanAkhir(store, "mk", { jawaban: { apa: "baru" }, ketikan: {}, tempel: 1, durasi: 3.2, kode: "LOK12345", diekspor: null });
cek("simpanAkhir menyimpan lokal dengan waktu pembaruan", DA.bacaAkhirLokal(store, "mk").jawaban.apa === "baru" && !!DA.bacaAkhirLokal(store, "mk").diperbarui);

console.log("\n== tabel yang belum ada ==");
hilang = new Set(["praktikum_berkas", "praktikum_tahap", "praktikum_laporan"]);
const paketTanpa = await DA.kumpulkan({ kuliah, profil, uid: "u1" });
cek("tanpa tabel praktikum: laporan tetap dibuat, praktik belum dikerjakan, latihan utuh", paketTanpa.bab[0].latihan.status === "selesai" && paketTanpa.bab[1].praktik.status === "belum" && paketTanpa.bab[1].praktik.isi === "" && paketTanpa.akhir.kode === "");
hilang = new Set(["percobaan", "progres", "laporan"]);
const paketKosong = await DA.kumpulkan({ kuliah, profil, uid: "u1" });
cek("tanpa tabel latihan pun tidak melempar galat", paketKosong.bab.length === 4 && paketKosong.bab[0].latihan.status === "belum");
cek("blok tetap tersusun dari paket kosong", A.susunBlokAkhir(paketKosong).length > 10);

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
