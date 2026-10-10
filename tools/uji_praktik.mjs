#!/usr/bin/env node
// Menguji praktik per bab: logika murni (site/js/praktik.js), lapisan data (praktik-data.js) dengan klien Supabase tiruan,
// dan lampiran praktik di laporan PDF. Pengujian kasus uji dengan Python sungguhan ada di tools/uji_praktik.py.
// Jalankan: node tools/uji_praktik.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let gagal = 0;
let total = 0;
const cek = (nama, ok, detail = "") => {
  total++;
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  -> " + detail));
};
const akar = join(dirname(fileURLToPath(import.meta.url)), "..");

const gudang = new Map();
globalThis.localStorage = { getItem: (k) => (gudang.has(k) ? gudang.get(k) : null), setItem: (k, v) => gudang.set(k, String(v)), removeItem: (k) => gudang.delete(k) };
const pendengar = {};
globalThis.document = { addEventListener: (n, f) => (pendengar["d:" + n] = f), visibilityState: "visible" };
globalThis.window = { addEventListener: (n, f) => (pendengar["w:" + n] = f), APP_CONFIG: {} };

const tabel = { praktikum_berkas: [], praktikum_tahap: [], praktikum_versi: [] };
let mode = "normal"; // normal | offline | tanpatabel | datasalah
const panggilan = [];
const galat = () => (mode === "offline" ? { code: "", message: "Failed to fetch" } : mode === "tanpatabel" ? { code: "PGRST205", message: "Could not find the table 'public.praktikum_berkas' in the schema cache" } : mode === "datasalah" ? { code: "23514", message: "check constraint" } : null);
const kunci = { praktikum_berkas: ["user_id", "matakuliah_id", "praktikum_id", "nama"], praktikum_tahap: ["user_id", "matakuliah_id", "praktikum_id", "tahap_id"] };
const klien = {
  auth: { getSession: async () => ({ data: { session: { user: { id: "u1", email: "a@x.id" } } } }), onAuthStateChange: () => ({ data: { subscription: {} } }) },
  rpc: async () => ({ error: null }),
  from: (t) => {
    const q = { f: {} };
    const rantai = {
      select: () => rantai,
      eq: (k, v) => ((q.f[k] = v), rantai),
      order: () => rantai,
      maybeSingle: async () => ({ data: t === "profiles" ? { nama: "A", nim: "1", kelas: "SI-2024-A", peran: "peserta" } : null, error: null }),
      upsert: async (rows) => {
        panggilan.push(["upsert", t]);
        if (!t.startsWith("praktikum_")) return { error: null };
        if (galat()) return { error: galat() };
        for (const r of rows) {
          const i = tabel[t].findIndex((x) => kunci[t].every((k) => x[k] === r[k]));
          if (i >= 0) tabel[t][i] = Object.assign({}, tabel[t][i], r);
          else tabel[t].push(Object.assign({}, r));
        }
        return { error: null };
      },
      insert: async (rows) => {
        panggilan.push(["insert", t]);
        if (galat()) return { error: galat() };
        tabel[t].push(...rows.map((r, i) => Object.assign({ id: tabel[t].length + i + 1 }, r)));
        return { error: null };
      },
      then: (res) => {
        if (galat()) return Promise.resolve({ data: null, error: galat() }).then(res);
        return Promise.resolve({ data: (tabel[t] || []).filter((x) => Object.keys(q.f).every((k) => x[k] === q.f[k])), error: null }).then(res);
      },
    };
    return rantai;
  },
};
window.APP_CONFIG.client = klien;

const P = await import("../site/js/praktik.js");
const Auth = await import("../site/js/auth.js");
const D = await import("../site/js/praktik-data.js");
const { susunLaporan } = await import("../site/js/pdf.js");
await Auth.init();
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const gudangStore = () => {
  const s = new Map();
  return { get: (k, f) => (s.has(k) ? s.get(k) : f), set: (k, v) => s.set(k, JSON.parse(JSON.stringify(v))) };
};

console.log("== status dan penggabungan ==");
cek("id praktik berpola bab-NN", P.idPraktik(6) === "bab-06" && P.idPraktik(14) === "bab-14");
cek("status tidak dikenal dianggap belum", P.statusDari(null) === "belum" && P.statusDari({ status: "aneh" }) === "belum" && P.statusDari({ status: "lulus" }) === "lulus");
cek("status yang lebih jauh dipilih", P.lebihJauh("belum", "lulus") === "lulus" && P.lebihJauh("lulus", "sedang") === "lulus" && P.lebihJauh("sedang", "belum") === "sedang");
const lokal = { isi: "lokal", t: "2026-10-01T10:00:00Z", status: "sedang", jumlah_kirim: 2, pertama_dibuka: "2026-10-01T09:00:00Z", lulus_pada: null, riwayat: [] };
const g1 = P.gabungKeadaan(lokal, { isi: "server", diperbarui_pada: "2026-10-02T00:00:00Z" }, { status: "lulus", jumlah_kirim: 1, pertama_dibuka: "2026-10-01T08:00:00Z", lulus_pada: "2026-10-02T00:00:00Z" });
cek("isi yang lebih baru menang, status lebih jauh, jumlah kirim terbesar", g1.isi === "server" && g1.status === "lulus" && g1.jumlah_kirim === 2);
cek("waktu pertama dibuka diambil yang paling awal, lulus yang tercatat", g1.pertama_dibuka === "2026-10-01T08:00:00Z" && g1.lulus_pada === "2026-10-02T00:00:00Z");
const g2 = P.gabungKeadaan(lokal, { isi: "lama", diperbarui_pada: "2026-09-01T00:00:00Z" }, null);
cek("isi server yang lebih lama tidak menimpa", g2.isi === "lokal");
cek("keadaan kosong menerima isi dari server", P.gabungKeadaan(null, { isi: "x", diperbarui_pada: "2026-10-01T00:00:00Z" }, null).isi === "x");
cek("penggabungan tidak mengubah masukan", JSON.stringify(lokal) === JSON.stringify({ isi: "lokal", t: "2026-10-01T10:00:00Z", status: "sedang", jumlah_kirim: 2, pertama_dibuka: "2026-10-01T09:00:00Z", lulus_pada: null, riwayat: [] }));

console.log("\n== hasil uji ==");
const r = P.ringkasHasil([{ nama: "a", lulus: true, pesan: "" }, { nama: "b", lulus: false, pesan: "Tidak cocok: assert x == 1" }, { nama: "rahasia", lulus: false, pesan: "AssertionError: nilai 42", tersembunyi: true }, { nama: "rahasia2", lulus: true, tersembunyi: true }]);
cek("lulus hanya bila semua kasus lulus", !r.lulus && r.benar === 2 && r.total === 4 && P.ringkasHasil([{ nama: "a", lulus: true }]).lulus && !P.ringkasHasil([]).lulus);
cek("kasus tersembunyi yang gagal menyembunyikan nama dan rincian", r.tampil[2].nama === "Kasus tersembunyi" && !r.tampil[2].pesan.includes("42") && r.tampil[1].pesan.includes("Tidak cocok"));
cek("riwayat tidak membocorkan rincian dan memotong pesan panjang", !JSON.stringify(P.hasilUntukRiwayat(r)).includes("42") && P.hasilUntukRiwayat(P.ringkasHasil([{ nama: "z", lulus: false, pesan: "p".repeat(900) }])).kasus[0].pesan.length === 300);

console.log("\n== isi praktik di situs ==");
const folder = join(akar, "site", "data", "kuliah", "algoritma-python", "praktik");
const indeks = JSON.parse(readFileSync(join(folder, "index.json"), "utf8"));
const berkasBab = readdirSync(folder).filter((f) => /^bab-\d\d\.json$/.test(f));
cek("indeks cocok dengan berkas bab-NN.json", JSON.stringify([...indeks.bab].sort((a, b) => a - b)) === JSON.stringify(berkasBab.map((f) => Number(f.slice(4, 6))).sort((a, b) => a - b)));
cek("daftar bagianB di indeks cocok dengan berkas yang punya bagianB", JSON.stringify([...(indeks.bagianB || [])].sort((a, b) => a - b)) === JSON.stringify(berkasBab.filter((f) => "bagianB" in JSON.parse(readFileSync(join(folder, f), "utf8"))).map((f) => Number(f.slice(4, 6))).sort((a, b) => a - b)));
cek("Bagian B: berkas berbeda, tanpa ____, tanpa contoh jawaban", berkasBab.every((f) => { const d = JSON.parse(readFileSync(join(folder, f), "utf8")); return !d.bagianB || (d.bagianB.berkas !== d.berkas && !d.bagianB.awal.includes("____") && !("contoh" in d.bagianB)); }));
cek("definisi Bagian B yang salah ditolak", P.periksaDef({ bab: 1, judul: "x", tujuan: "x", berkas: "a.py", awal: "x", kasus: [{}], langkah: [], bagianB: { judul: "b", tujuan: "t", berkas: "a.py", awal: "x", kasus: [{}], langkah: [] } }).some((m) => m.includes("berbeda")) && P.periksaDef({ bab: 1, judul: "x", tujuan: "x", berkas: "a.py", awal: "x", kasus: [{}], langkah: [], bagianB: {} }).length > 0);
cek("semua definisi sah menurut periksaDef", berkasBab.every((f) => P.periksaDef(JSON.parse(readFileSync(join(folder, f), "utf8"))).length === 0));
cek("bentuk definisi yang salah ditolak", P.periksaDef({}).length > 0 && P.periksaDef(null).length > 0 && P.periksaDef({ bab: 1, judul: "x", tujuan: "x", berkas: "../x.py", awal: "x", kasus: [{}], langkah: [] }).some((m) => m.includes("nama berkas")));
cek("tidak satu pun definisi memuat contoh jawaban (publik)", berkasBab.every((f) => !("contoh" in JSON.parse(readFileSync(join(folder, f), "utf8")))));
cek("kerangka masih dikenali sebagai kerangka", berkasBab.every((f) => { const d = JSON.parse(readFileSync(join(folder, f), "utf8")); return P.masihKerangka(d, d.awal) && !P.masihKerangka(d, d.awal.replaceAll("____", "x")); }));

console.log("\n== keadaan lokal ==");
const st = gudangStore();
cek("bacaLokal pada penyimpanan kosong atau rusak aman", D.bacaLokal({ get: () => null }, "m", 1).status === "belum" && D.bacaLokal({ get: () => "rusak" }, "m", 1).status === "belum" && D.bacaLokal({ get: () => [1] }, "m", 1).status === "belum");
D.simpanLokal(st, "m", 6, { isi: "x = 1\n", status: "sedang", jumlah_kirim: 1 });
cek("simpan lalu baca kembali, dan statusLokal", D.bacaLokal(st, "m", 6).isi === "x = 1\n" && D.statusLokal(st, "m", 6) === "sedang" && D.statusLokal(st, "m", 7) === "belum");
D.simpanLokal(st, "m", 6, { isi: "b = 1\n", status: "lulus", jumlah_kirim: 2 }, "B");
cek("Bagian B disimpan terpisah dari Bagian A", D.bacaLokal(st, "m", 6).isi === "x = 1\n" && D.bacaLokal(st, "m", 6, "B").isi === "b = 1\n" && D.kunciLokal("m", 6, "B") !== D.kunciLokal("m", 6, "A"));
cek("status bab dengan Bagian B: A sedang dan B lulus = sedang; tanpa B hanya A", D.statusLokal(st, "m", 6, true) === "sedang" && D.statusLokal(st, "m", 6, false) === "sedang");
D.simpanLokal(st, "m", 6, { isi: "x = 1\n", status: "lulus", jumlah_kirim: 1 });
cek("A dan B sama-sama lulus = lulus (hijau); bila hanya A lulus tanpa B di bab itu juga lulus", D.statusLokal(st, "m", 6, true) === "lulus" && D.statusLokal(st, "m", 7, true) === "belum");
D.simpanLokal(st, "m", 6, { isi: "x = 1\n", status: "lulus", jumlah_kirim: 1 }, "A");
D.simpanLokal(st, "m", 6, { isi: "b = 1\n", status: "belum", jumlah_kirim: 0 }, "B");
cek("A lulus tetapi B belum = setengah (sedang), bukan hijau", D.statusLokal(st, "m", 6, true) === "sedang" && D.statusLokal(st, "m", 6, false) === "lulus");

console.log("\n== antrean ke server ==");
cek("sinkron aktif setelah masuk", D.aktif());
const def = { berkas: "statistik.py" };
D.sinkronkan("mk", 6, "A", def, { isi: "a = 1\n", status: "sedang", jumlah_kirim: 0 });
D.sinkronkan("mk", 6, "A", def, { isi: "a = 2\n", status: "lulus", jumlah_kirim: 1, lulus_pada: "2026-10-01T00:00:00Z" }, { hasil: { benar: 4, total: 4 }, lulus: true });
const defB = { berkas: "statistik2.py" };
D.sinkronkan("mk", 6, "B", defB, { isi: "b = 9\n", status: "sedang", jumlah_kirim: 2 });
await tidur(60);
cek("antrean tersimpan di browser sebelum terkirim", !!localStorage.getItem("latihan:u1:antrean-praktik"));
await D.kirimSekarang();
cek("berkas: Bagian A dan B masing-masing satu baris (isi terbaru), milik peserta, di praktikum bab-06", tabel.praktikum_berkas.length === 2 && tabel.praktikum_berkas.find((r) => r.nama === "statistik.py").isi === "a = 2\n" && tabel.praktikum_berkas.find((r) => r.nama === "statistik2.py").isi === "b = 9\n" && tabel.praktikum_berkas.every((r) => r.praktikum_id === "bab-06" && r.user_id === "u1"), JSON.stringify(tabel.praktikum_berkas));
cek("status tahap p01 (A lulus) dan p02 (B sedang) terpisah, dan satu versi terkirim", tabel.praktikum_tahap.length === 2 && tabel.praktikum_tahap.find((r) => r.tahap_id === "p01").status === "lulus" && tabel.praktikum_tahap.find((r) => r.tahap_id === "p02").status === "sedang" && tabel.praktikum_versi.length === 1 && tabel.praktikum_versi[0].lulus === true && tabel.praktikum_versi[0].berkas["statistik.py"] === "a = 2\n");
cek("baris tahap memuat nilai bawaan sah", tabel.praktikum_tahap[0].jalur === "web" && tabel.praktikum_tahap[0].pakai_contoh === false);
const st2 = gudangStore();
cek("susul praktik dari server mengisi keadaan lokal Bagian A dan B", (await D.susulPraktik(st2, "mk", 6, Object.assign({}, def, { bagianB: defB }))) === true && D.bacaLokal(st2, "mk", 6).isi === "a = 2\n" && D.bacaLokal(st2, "mk", 6, "B").isi === "b = 9\n" && D.statusLokal(st2, "mk", 6) === "lulus" && D.statusLokal(st2, "mk", 6, true) === "sedang");
cek("susul kedua kali pada bab yang sama dilewati", (await D.susulPraktik(st2, "mk", 6, def)) === false);
tabel.praktikum_tahap.push({ user_id: "u1", matakuliah_id: "mk2", praktikum_id: "bab-02", tahap_id: "p01", status: "sedang", jumlah_kirim: 2 }, { user_id: "u1", matakuliah_id: "mk2", praktikum_id: "bab-04", tahap_id: "p01", status: "lulus", jumlah_kirim: 1 }, { user_id: "u1", matakuliah_id: "mk2", praktikum_id: "kasir", tahap_id: "t01", status: "lulus" });
const st3 = gudangStore();
cek("status semua bab satu kuliah digabung (baris lama non bab-NN diabaikan)", (await D.susulStatusKuliah(st3, "mk2")) === true && D.statusLokal(st3, "mk2", 2) === "sedang" && D.statusLokal(st3, "mk2", 4) === "lulus" && D.statusLokal(st3, "mk2", 1) === "belum");

console.log("\n== gagal dengan aman ==");
mode = "offline";
D.sinkronkan("mk", 7, "A", { berkas: "nama.py" }, { isi: "b", status: "sedang" });
await D.kirimSekarang();
cek("offline: antrean tetap ada dan tabel tidak dianggap hilang", JSON.parse(localStorage.getItem("latihan:u1:antrean-praktik")).berkas["mk|bab-07|nama.py"] !== undefined && D.tabelPraktikumAda() === true);
mode = "normal";
await D.kirimSekarang();
cek("pulih: terkirim", tabel.praktikum_berkas.length === 3);
mode = "datasalah";
D.sinkronkan("mk", 8, "A", { berkas: "fungsi.py" }, { isi: "c", status: "sedang" });
await D.kirimSekarang();
cek("galat data (aturan CHECK): dibuang, tidak menyumbat", Object.keys(JSON.parse(localStorage.getItem("latihan:u1:antrean-praktik")).berkas).length === 0);
mode = "tanpatabel";
D.sinkronkan("mk", 9, "A", { berkas: "karyawan.py" }, { isi: "d", status: "sedang" });
await D.kirimSekarang();
cek("migrasi 0008 belum dijalankan: berhenti diam-diam", D.tabelPraktikumAda() === false);
const sebelum = panggilan.length;
D.sinkronkan("mk", 10, "A", { berkas: "berkas.py" }, { isi: "e", status: "sedang" });
await D.kirimSekarang();
await tidur(80);
cek("setelah itu tidak ada lagi panggilan ke server", panggilan.length === sebelum, String(panggilan.length - sebelum));
cek("membaca dari server juga dilewati tanpa galat", (await D.susulPraktik(gudangStore(), "mk", 11, def)) === false && (await D.susulStatusKuliah(gudangStore(), "mk3")) === false);
cek("mata kuliah tanpa tanda praktik: tanpa permintaan jaringan dan hasil kosong", (await D.muatIndeks("pbo-java", false)).size === 0);

console.log("\n== rekap dosen ==");
const babs = [1, 2, 4];
const pes = [{ id: "u1", nim: "1", nama: "Ani", kelas: "A" }, { id: "u2", nim: "2", nama: "=Budi", kelas: "A" }, { id: "u3", nim: "3", nama: "Cici", kelas: "B" }];
const baris = [
  { user_id: "u1", praktikum_id: "bab-01", tahap_id: "p01", status: "lulus", jumlah_kirim: 2, diperbarui_pada: "2026-10-05T00:00:00Z" },
  { user_id: "u1", praktikum_id: "bab-02", tahap_id: "p01", status: "lulus", jumlah_kirim: 4, diperbarui_pada: "2026-10-06T00:00:00Z" },
  { user_id: "u1", praktikum_id: "bab-04", tahap_id: "p01", status: "lulus", jumlah_kirim: 1, diperbarui_pada: "2026-10-07T00:00:00Z" },
  { user_id: "u2", praktikum_id: "bab-01", tahap_id: "p01", status: "lulus", jumlah_kirim: 1, diperbarui_pada: "2026-10-06T00:00:00Z" },
  { user_id: "u2", praktikum_id: "bab-02", tahap_id: "p01", status: "sedang", jumlah_kirim: 6, diperbarui_pada: "2026-10-08T00:00:00Z" },
  { user_id: "u2", praktikum_id: "kasir", tahap_id: "t01", status: "lulus", jumlah_kirim: 9 },
];
const rk = P.rekapPraktik({ peserta: pes, tahap: baris, babs });
cek("peserta tanpa data tidak dihitung mulai; baris lama bukan bab-NN diabaikan", rk.mulai === 2 && rk.baris[2].mulai === false && rk.baris[1].kirim === 7);
cek("selesai hanya yang semua bab lulus", rk.selesai === 1 && rk.baris[0].selesai && !rk.baris[1].selesai);
cek("kode sel: lulus, sedang, belum", rk.baris[1].sel[1].kode === "lulus" && rk.baris[1].sel[2].kode === "sedang" && rk.baris[1].sel[4].kode === "belum");
cek("per bab: lulus, sedang, rata-rata kirim", rk.perBab[1].lulus === 1 && rk.perBab[1].sedang === 1 && rk.perBab[1].kirimRata === 5 && rk.perBab[0].lulus === 2);
const rkB = P.rekapPraktik({ peserta: pes, tahap: [...baris, { user_id: "u1", praktikum_id: "bab-02", tahap_id: "p02", status: "sedang", jumlah_kirim: 2 }, { user_id: "u2", praktikum_id: "bab-02", tahap_id: "p02", status: "lulus", jumlah_kirim: 1 }], babs, denganB: new Set([2]) });
cek("rekap dengan Bagian B: hijau hanya bila A dan B lulus", rkB.baris[0].sel[2].kode === "sedang" && rkB.baris[0].sel[2].a === "lulus" && rkB.baris[0].sel[2].b === "sedang" && rkB.baris[1].sel[2].kode === "sedang" && rkB.baris[1].sel[2].a === "sedang" && rkB.baris[0].sel[1].kode === "lulus" && rkB.baris[0].sel[1].b === null);
cek("rekap dengan Bagian B: peserta selesai butuh semua bab lulus penuh, per bab menghitung A dan B terpisah", !rkB.baris[0].selesai && rkB.perBab[1].aLulus === 1 && rkB.perBab[1].bLulus === 1 && rkB.perBab[1].adaB === true && rkB.perBab[0].adaB === false && rkB.baris[0].kirim === rk.baris[0].kirim + 2);
cek("statusGabungan: tanpa B hanya A; dengan B", P.statusGabungan(false, "lulus", "belum") === "lulus" && P.statusGabungan(true, "lulus", "lulus") === "lulus" && P.statusGabungan(true, "lulus", "belum") === "sedang" && P.statusGabungan(true, "belum", "sedang") === "sedang" && P.statusGabungan(true, "belum", "belum") === "belum");
const csv = P.csvPraktik(rk, babs);
cek("CSV: kepala, satu baris per peserta, awalan rumus Excel dinetralkan", csv.split("\r\n").length === 5 && csv.startsWith('"NIM","Nama","Kelas","Praktik bab 1"') && csv.includes("\"'=Budi\""));

console.log("\n== lampiran praktik di laporan PDF ==");
const dasar = { matakuliah: "Algoritma", nomor: 6, judul: "List", nama: "Ani", nim: "1", kelas: "A", kolom: [{ id: "tujuan", label: "Tujuan", min: 10 }], jawaban: { tujuan: "x".repeat(20) }, kodeVerifikasi: "ABCD2345" };
const tanpa = susunLaporan(dasar);
const dengan = susunLaporan(Object.assign({}, dasar, { lampiran: { tipe: "kode", judul: "kode terakhir yang dikirim", isi: "print(1)", hasil: "Hasil: lulus" }, lampiranPraktik: { judul: "praktik: Statistik (statistik.py)", isi: "angka = []\n", hasil: "Status praktik: lulus, diperiksa 2 kali." } }));
cek("tanpa lampiran praktik laporan lama tidak berubah", !tanpa.some((b) => String(b.teks || "").includes("praktik")));
cek("lampiran praktik muncul setelah lampiran latihan: judul, hasil, lalu kode", (() => { const i = dengan.findIndex((b) => b.teks === "Lampiran: praktik: Statistik (statistik.py)"); return i > 0 && dengan[i + 1].teks.startsWith("Status praktik") && dengan[i + 2].t === "kode" && dengan[i + 2].teks === "angka = []\n" && dengan.findIndex((b) => b.teks === "Lampiran: kode terakhir yang dikirim") < i; })());

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
