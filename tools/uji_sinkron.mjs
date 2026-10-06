#!/usr/bin/env node
// Menguji sinkron progres (site/js/sinkron.js) dengan klien Supabase tiruan di memori.
// Jalankan:  node tools/uji_sinkron.mjs
let gagal = 0;
function cek(nama, ok, detail = "") {
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  " + detail));
}

// Lingkungan peramban secukupnya.
const gudang = new Map();
globalThis.localStorage = { getItem: (k) => (gudang.has(k) ? gudang.get(k) : null), setItem: (k, v) => gudang.set(k, String(v)), removeItem: (k) => gudang.delete(k) };
const pendengar = {};
globalThis.document = { addEventListener: (n, f) => (pendengar["d:" + n] = f), visibilityState: "visible" };
globalThis.window = { addEventListener: (n, f) => (pendengar["w:" + n] = f), APP_CONFIG: {} };

// Klien tiruan: mencatat panggilan, bisa dipaksa gagal.
const log = { progres: [], percobaan: [], aktivitas: [], opsi: [], rpc: [] };
let gagalSekarang = null;
let session = { user: { id: "u1", email: "a@x.id" } };
const klien = {
  auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: () => ({ data: { subscription: {} } }) },
  rpc: async (nama, args) => {
    if (gagalSekarang) return { error: gagalSekarang };
    log.rpc.push([nama, args]);
    return { error: null };
  },
  from: (tabel) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nama: "A", nim: "1", kelas: "SI-2024-A", peran: "peserta" }, error: null }), eq: async () => ({ data: log.server || [], error: gagalSekarang }) }) }),
    upsert: async (rows, opsi) => {
      if (gagalSekarang) return { error: gagalSekarang };
      log.progres.push(...rows);
      log.opsi.push(opsi);
      return { error: null };
    },
    insert: async (rows) => {
      if (gagalSekarang) return { error: gagalSekarang };
      if (tabel === "aktivitas") {
        log.aktivitas.push(...rows);
        return { error: null };
      }
      log.percobaan.push(...rows);
      return { error: null };
    },
  }),
};
window.APP_CONFIG.client = klien;

const Auth = await import("../site/js/auth.js");
const Sinkron = await import("../site/js/sinkron.js");
await Auth.init();

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
cek("sinkron aktif setelah masuk dan profil terisi", Sinkron.aktif());

Sinkron.tandai("algoritma-python", { bab: 4, status: "sedang", jumlah_jalankan: 1, jumlah_kirim: 0, pertama_dibuka: "2026-10-06T00:00:00Z", lulus_pada: null, jalur: null });
Sinkron.tandai("algoritma-python", { bab: 4, status: "sedang", jumlah_jalankan: 2, jumlah_kirim: 0, pertama_dibuka: "2026-10-06T00:00:00Z", lulus_pada: null, jalur: null });
cek("perubahan beruntun belum dikirim sebelum jeda berlalu", log.progres.length === 0);
await Sinkron.kirimSekarang();
cek("dikirim sebagai satu baris per bab (yang terbaru)", log.progres.length === 1 && log.progres[0].jumlah_jalankan === 2 && log.progres[0].user_id === "u1" && log.progres[0].matakuliah_id === "algoritma-python");
cek("upsert memakai kunci konflik user_id,matakuliah_id,bab", log.opsi[0] && log.opsi[0].onConflict === "user_id,matakuliah_id,bab");
cek("status menjadi tersimpan", Sinkron.statusSinkron() === "tersimpan");

Sinkron.catat("algoritma-python", 4, { lulus: false, kasus_lulus: 3, kasus_total: 7, kasus_gagal: [3, 4], kode: "print(1)" });
await tidur(50);
cek("percobaan terkirim segera (jeda 0)", log.percobaan.length === 1 && log.percobaan[0].lulus === false && log.percobaan[0].kasus_gagal.join() === "3,4" && log.percobaan[0].jenis === "kirim");
Sinkron.catat("algoritma-python", 4, { lulus: true, kasus_lulus: 7, kasus_total: 7, kode: "x".repeat(25000) });
await tidur(50);
cek("kode lebih dari 20000 karakter dipotong supaya tidak ditolak database", log.percobaan[1] && log.percobaan[1].kode.length === 20000);

// Gagal jaringan: data tertahan di antrean, lalu terkirim saat pulih.
const sebelum = log.progres.length;
gagalSekarang = { message: "Failed to fetch" };
Sinkron.tandai("algoritma-python", { bab: 5, status: "selesai", jumlah_jalankan: 3, jumlah_kirim: 2, pertama_dibuka: null, lulus_pada: "2026-10-06T01:00:00Z", jalur: "langsung" });
await Sinkron.kirimSekarang();
cek("saat gagal: status gagal dan belum ada yang terkirim", Sinkron.statusSinkron() === "gagal" && log.progres.length === sebelum);
cek("saat gagal: antrean tersimpan di browser", [...gudang.keys()].some((k) => k.includes("antrean-sinkron")) && JSON.parse(gudang.get("latihan:u1:antrean-sinkron")).progres.length === 1);
gagalSekarang = null;
await Sinkron.kirimSekarang();
cek("saat pulih: data yang tertahan terkirim", log.progres.length === sebelum + 1 && log.progres.at(-1).bab === 5 && log.progres.at(-1).jalur === "langsung");
cek("setelah terkirim, antrean browser kosong", JSON.parse(gudang.get("latihan:u1:antrean-sinkron")).progres.length === 0);
cek("status kembali tersimpan", Sinkron.statusSinkron() === "tersimpan");

// Pola dan rekaman cara menulis ikut terkirim bersama percobaan.
Sinkron.catat("algoritma-python", 4, { lulus: true, kasus_lulus: 7, kasus_total: 7, kode: "print(1)", pola: { cps: 3.2, linier: 0.5 }, rekaman: { awal: "", e: [["e", 0, 0, 0, "print(1)", 8, 900]] } });
await tidur(50);
const terakhir = log.percobaan.at(-1);
cek("pola dan rekaman menulis terkirim bersama percobaan", terakhir.pola.cps === 3.2 && terakhir.rekaman.e[0][4] === "print(1)", JSON.stringify(terakhir));
Sinkron.catat("algoritma-python", 5, { lulus: false, kasus_lulus: 0, kasus_total: 7, kode: "x" });
await tidur(50);
cek("percobaan tanpa pola tetap terkirim (pola dan rekaman null)", log.percobaan.at(-1).pola === null && log.percobaan.at(-1).rekaman === null);

// Perangkat: dilaporkan lewat fungsi database, sekali per akun per perangkat.
cek("lapor perangkat memanggil fungsi catat_perangkat", (await Sinkron.laporPerangkat("dev-aaaaaaaaaaaaaaaaaaaaaaaa", "Chrome di Windows")) === true && log.rpc[0][0] === "catat_perangkat" && log.rpc[0][1].p_device === "dev-aaaaaaaaaaaaaaaaaaaaaaaa" && log.rpc[0][1].p_agen === "Chrome di Windows");
await Sinkron.laporPerangkat("dev-aaaaaaaaaaaaaaaaaaaaaaaa", "Chrome di Windows");
cek("laporan yang sama tidak diulang pada muat halaman yang sama", log.rpc.length === 1);
cek("fungsi tidak menerima user_id dari klien (identitas dari sesi)", !("user_id" in log.rpc[0][1] || "p_user" in log.rpc[0][1]));
gagalSekarang = { message: "Failed to fetch" };
cek("gagal melapor perangkat tidak melempar galat dan mengembalikan false", (await Sinkron.laporPerangkat("dev-bbbbbbbbbbbbbbbbbbbbbbbb", "x")) === false);
gagalSekarang = null;

// Jejak aktivitas (percobaan tempel yang diblokir): digabung per jenis dan bab, hanya jumlah yang dicatat.
Sinkron.aktivitas("algoritma-python", 4, "tempel_diblokir", { lokasi: "latihan" });
Sinkron.aktivitas("algoritma-python", 4, "tempel_diblokir", { lokasi: "latihan" });
Sinkron.aktivitas("algoritma-python", 4, "tempel_diblokir", { lokasi: "latihan" });
Sinkron.aktivitas("algoritma-python", 5, "tempel_diblokir", { lokasi: "latihan" });
await Sinkron.kirimSekarang();
cek("tiga tempel beruntun di bab yang sama digabung jadi satu baris berisi jumlahnya", log.aktivitas.filter((a) => a.bab === 4).length === 1 && log.aktivitas.find((a) => a.bab === 4).detail.jumlah === 3, JSON.stringify(log.aktivitas));
cek("bab lain tercatat terpisah", log.aktivitas.find((a) => a.bab === 5).detail.jumlah === 1);
cek("baris aktivitas membawa user_id, jenis, dan matakuliah_id", log.aktivitas.every((a) => a.user_id === "u1" && a.jenis === "tempel_diblokir" && a.matakuliah_id === "algoritma-python"));
cek("isi yang ditempel tidak pernah ikut tercatat", !JSON.stringify(log.aktivitas).includes("kode") && Object.keys(log.aktivitas[0].detail).sort().join() === "jumlah,lokasi");

// Galat data permanen tidak boleh menyumbat antrean selamanya.
gagalSekarang = { code: "23514", message: "check constraint" };
Sinkron.tandai("algoritma-python", { bab: 6, status: "sedang", jumlah_jalankan: 1, jumlah_kirim: 0, pertama_dibuka: null, lulus_pada: null, jalur: null });
await Sinkron.kirimSekarang();
gagalSekarang = null;
const n = log.progres.length;
await Sinkron.kirimSekarang();
cek("galat data (23514) dibuang, bukan diulang terus", log.progres.length === n);

// Akun lain di komputer yang sama tidak mengirim antrean orang lain.
gagalSekarang = { message: "Failed to fetch" };
Sinkron.tandai("algoritma-python", { bab: 7, status: "sedang", jumlah_jalankan: 1, jumlah_kirim: 0, pertama_dibuka: null, lulus_pada: null, jalur: null });
await Sinkron.kirimSekarang();
gagalSekarang = null;
session = { user: { id: "u2", email: "b@x.id" } };
await Auth.init();
const sebelumU2 = log.progres.length;
await Sinkron.kirimSekarang();
cek("akun lain tidak mengirim antrean akun sebelumnya", log.progres.length === sebelumU2 && !log.progres.some((r) => r.user_id === "u2"));
session = { user: { id: "u1", email: "a@x.id" } };
await Auth.init();
await Sinkron.kirimSekarang();
cek("antrean akun pertama tetap utuh dan terkirim saat ia kembali", log.progres.at(-1).bab === 7 && log.progres.at(-1).user_id === "u1");

// Membaca progres dari server.
log.server = [{ bab: 4, status: "selesai" }];
const baris = await Sinkron.ambilProgres("algoritma-python");
cek("ambilProgres mengembalikan baris dari server", Array.isArray(baris) && baris[0].bab === 4);
gagalSekarang = { message: "boom" };
cek("ambilProgres mengembalikan null bila gagal (bukan memalsukan data kosong)", (await Sinkron.ambilProgres("algoritma-python")) === null);
gagalSekarang = null;

// Tanpa sesi: tidak mengirim apa pun.
session = null;
await Auth.init();
const total = log.progres.length + log.percobaan.length;
Sinkron.tandai("algoritma-python", { bab: 9, status: "sedang", jumlah_jalankan: 1, jumlah_kirim: 0, pertama_dibuka: null, lulus_pada: null, jalur: null });
await Sinkron.kirimSekarang();
cek("tanpa sesi masuk tidak ada yang dikirim", log.progres.length + log.percobaan.length === total);

console.log(gagal ? `\n${gagal} uji GAGAL.` : "\nSemua uji lulus.");
process.exit(gagal ? 1 : 0);
