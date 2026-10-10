#!/usr/bin/env node
// Menguji lapisan data praktikum (site/js/praktikum-data.js): penggabungan dengan server dan antrean yang aman bila migrasi 0008 belum ada.
// Jalankan: node tools/uji_praktikum_data.mjs
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

const tabel = { praktikum_berkas: [], praktikum_tahap: [], praktikum_versi: [], praktikum_laporan: [] };
let mode = "normal"; // normal | offline | tanpatabel | datasalah
const panggilan = [];
const galat = () => (mode === "offline" ? { code: "", message: "Failed to fetch" } : mode === "tanpatabel" ? { code: "PGRST205", message: "Could not find the table 'public.praktikum_berkas' in the schema cache" } : mode === "datasalah" ? { code: "23514", message: "check constraint" } : null);
const kunci = { praktikum_berkas: ["user_id", "matakuliah_id", "praktikum_id", "nama"], praktikum_tahap: ["user_id", "matakuliah_id", "praktikum_id", "tahap_id"], praktikum_laporan: ["user_id", "matakuliah_id", "praktikum_id"] };
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
      delete: () => {
        q.hapus = true;
        return rantai;
      },
      then: (res) => {
        if (q.hapus) {
          panggilan.push(["delete", t]);
          if (galat()) return Promise.resolve({ error: galat() }).then(res);
          tabel[t] = tabel[t].filter((x) => !Object.keys(q.f).every((kk) => x[kk] === q.f[kk]));
          return Promise.resolve({ error: null }).then(res);
        }
        if (galat()) return Promise.resolve({ data: null, error: galat() }).then(res);
        return Promise.resolve({ data: (tabel[t] || []).filter((x) => Object.keys(q.f).every((k) => x[k] === q.f[k])), error: null }).then(res);
      },
    };
    return rantai;
  },
};
window.APP_CONFIG.client = klien;

const Auth = await import("../site/js/auth.js");
const D = await import("../site/js/praktikum-data.js");
await Auth.init();
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("== penggabungan ==");
const lokal = { "a.py": { isi: "lokal", asal: "milik", t: "2026-10-01T10:00:00Z" }, "b.py": { isi: "b", asal: "milik", t: "2026-10-01T10:00:00Z" } };
const g = D.gabungBerkas(lokal, [{ nama: "a.py", isi: "server-baru", asal: "milik", diperbarui_pada: "2026-10-02T00:00:00Z" }, { nama: "b.py", isi: "server-lama", asal: "milik", diperbarui_pada: "2026-09-30T00:00:00Z" }, { nama: "c.py", isi: "c", asal: "contoh", diperbarui_pada: "2026-10-01T00:00:00Z" }]);
cek("berkas: yang lebih baru menang, yang hanya di server ikut masuk", g["a.py"].isi === "server-baru" && g["b.py"].isi === "b" && g["c.py"].asal === "contoh");
cek("berkas yang sudah dihapus di lokal tidak dihidupkan lagi", !("c.py" in D.gabungBerkas({}, [{ nama: "c.py", isi: "c", diperbarui_pada: "2026-10-01T00:00:00Z" }], ["c.py"])));
const gt = D.gabungTahap({ t01: { status: "sedang", jumlah_kirim: 2, centang: { 0: true } }, t02: { status: "lulus", jumlah_kirim: 1 } }, [{ tahap_id: "t01", status: "lulus", jumlah_kirim: 1, centang: { 1: true } }, { tahap_id: "t02", status: "sedang", jumlah_kirim: 5 }, { tahap_id: "t03", status: "dilewati", jumlah_kirim: 0 }]);
cek("tahap: status yang lebih jauh dipertahankan, jumlah kirim terbesar", gt.t01.status === "lulus" && gt.t01.jumlah_kirim === 2 && gt.t02.status === "lulus" && gt.t02.jumlah_kirim === 5 && gt.t03.status === "dilewati");
cek("tahap: centang digabung", gt.t01.centang[0] === true && gt.t01.centang[1] === true);
cek("kerja kosong dari penyimpanan kosong dan rusak", D.bacaKerja({ get: () => null }, "x", "y").tahap && D.bacaKerja({ get: () => "rusak" }, "x", "y").berkas && JSON.stringify(D.bacaKerja({ get: () => [1] }, "x", "y")).includes("berkas"));
cek("kerja menyimpan dan membaca kembali", (() => { const s = new Map(); const st = { get: (k, f) => (s.has(k) ? s.get(k) : f), set: (k, v) => s.set(k, JSON.parse(JSON.stringify(v))) }; D.simpanKerja(st, "m", "p", { berkas: { "a.py": { isi: "1", asal: "milik" } }, tahap: {}, laporan: null, riwayat: [] }); return D.bacaKerja(st, "m", "p").berkas["a.py"].isi === "1"; })());

console.log("\n== antrean ke server ==");
cek("sinkron aktif setelah masuk", D.aktif());
D.antreBerkas("mk", "kasir", "harga.py", { isi: "x = 1\n", asal: "milik" });
D.antreBerkas("mk", "kasir", "harga.py", { isi: "x = 2\n", asal: "milik" });
D.antreBerkas("mk", "kasir", "lama.py", { isi: "z", asal: "milik" });
D.antreHapusBerkas("mk", "kasir", "lama.py");
D.antreTahap("mk", "kasir", "t01", { status: "lulus", jumlah_kirim: 2, lulus_pada: "2026-10-01T00:00:00Z" });
D.antreLaporan("mk", "kasir", { jawaban: { apa: "..." }, jumlah_ketikan: {}, percobaan_tempel: 0, durasi_menulis_detik: 5, kode_verifikasi: "ABCD2345" });
D.antreVersi("mk", "kasir", "t01", { "harga.py": "x = 2\n" }, { benar: 3, total: 3 }, true);
await tidur(60);
cek("antrean tersimpan di browser sebelum terkirim", !!localStorage.getItem("latihan:u1:antrean-praktikum"));
await D.kirimSekarang();
cek("berkas: hanya versi terbaru terkirim dan berkas yang dihapus tidak ikut", tabel.praktikum_berkas.length === 1 && tabel.praktikum_berkas[0].isi === "x = 2\n" && tabel.praktikum_berkas[0].user_id === "u1", JSON.stringify(tabel.praktikum_berkas));
cek("tahap, versi, dan laporan terkirim", tabel.praktikum_tahap.length === 1 && tabel.praktikum_versi.length === 1 && tabel.praktikum_laporan.length === 1 && tabel.praktikum_versi[0].lulus === true);
cek("baris tahap memuat nilai bawaan sah", tabel.praktikum_tahap[0].jalur === "web" && tabel.praktikum_tahap[0].pakai_contoh === false);
cek("antrean kosong setelah terkirim", JSON.parse(localStorage.getItem("latihan:u1:antrean-praktikum")).versi.length === 0);
const ambil = await D.ambilServer("mk", "kasir");
cek("ambil dari server mengembalikan berkas, tahap, laporan", ambil && ambil.berkas.length === 1 && ambil.tahap.length === 1 && ambil.laporan.kode_verifikasi === "ABCD2345");
cek("ambil dari server tanpa baris: kosong, bukan null", (await D.ambilServer("mk", "lain")).berkas.length === 0);
cek("riwayat versi terbaca", (await D.ambilVersi("mk", "kasir", "t01")).length === 1);

console.log("\n== gagal dengan aman ==");
mode = "offline";
D.antreBerkas("mk", "kasir", "baru.py", { isi: "1", asal: "milik" });
await D.kirimSekarang();
cek("offline: antrean tetap ada untuk dicoba lagi", JSON.parse(localStorage.getItem("latihan:u1:antrean-praktikum")).berkas["mk|kasir|baru.py"] !== undefined && tabel.praktikum_berkas.length === 1);
cek("offline: tidak dianggap tabel hilang", D.tabelPraktikumAda() === true);
mode = "normal";
await D.kirimSekarang();
cek("pulih: terkirim", tabel.praktikum_berkas.length === 2);
mode = "datasalah";
D.antreBerkas("mk", "kasir", "rusak.py", { isi: "1", asal: "milik" });
await D.kirimSekarang();
cek("galat data (aturan CHECK): dibuang, tidak menyumbat selamanya", Object.keys(JSON.parse(localStorage.getItem("latihan:u1:antrean-praktikum")).berkas).length === 0);
mode = "tanpatabel";
D.antreBerkas("mk", "kasir", "x.py", { isi: "1", asal: "milik" });
await D.kirimSekarang();
cek("migrasi 0008 belum dijalankan: berhenti diam-diam, tidak melempar galat", D.tabelPraktikumAda() === false);
const sebelum = panggilan.length;
D.antreBerkas("mk", "kasir", "y.py", { isi: "1", asal: "milik" });
D.antreTahap("mk", "kasir", "t02", { status: "sedang" });
await D.kirimSekarang();
await tidur(80);
cek("setelah itu tidak ada lagi panggilan ke server", panggilan.length === sebelum, String(panggilan.length - sebelum));
cek("membaca dari server juga dilewati tanpa galat", (await D.ambilServer("mk", "kasir")) === null && (await D.ambilVersi("mk", "kasir", "t01")).length === 0);

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
