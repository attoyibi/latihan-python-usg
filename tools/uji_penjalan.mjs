#!/usr/bin/env node
// Menguji pemantau penjalan (site/js/penjalan.js): siap, gagal muat, batas waktu muat, galat fatal, mati mendadak,
// mulai ulang ("Coba lagi"), dan batas waktu pekerjaan. Memakai Worker palsu.
// Jalankan:  node tools/uji_penjalan.mjs
let gagal = 0;
function cek(nama, ok, detail = "") {
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  " + detail));
}
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
// Bila ada janji yang menggantung (penjalan tidak pernah menyelesaikan), proses berhenti tanpa mencapai akhir: itu kegagalan.
let tamat = false;
process.on("exit", () => {
  if (!tamat) {
    console.log("GAGAL tes tidak selesai (ada yang menggantung)");
    process.exitCode = 1;
  }
});

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = { APP_CONFIG: {} };

// Worker palsu yang bisa diatur perilakunya lewat `perilaku` sebelum dibuat.
let perilaku = "siap";
const semua = [];
class WorkerPalsu {
  constructor() {
    this.pendengar = { message: [], error: [] };
    this.mati = false;
    semua.push(this);
    setTimeout(() => {
      if (this.mati) return;
      if (perilaku === "siap") this.kirim({ type: "ready" });
      else if (perilaku === "error") this.picu("error", { message: "gagal diunduh", preventDefault() {} });
      else if (perilaku === "fatal") this.kirim({ type: "fatal", error: "kehabisan memori" });
      // "diam": tidak melakukan apa pun
    }, 5);
  }
  addEventListener(n, f) {
    (this.pendengar[n] = this.pendengar[n] || []).push(f);
  }
  removeEventListener(n, f) {
    this.pendengar[n] = (this.pendengar[n] || []).filter((x) => x !== f);
  }
  kirim(data) {
    this.picu("message", { data });
  }
  picu(n, e) {
    (this.pendengar[n] || []).slice().forEach((f) => f(e));
  }
  postMessage(m) {
    if (this.mati) return;
    if (m && m.id !== undefined) {
      setTimeout(() => {
        if (this.mati) return;
        this.kirim({ type: "started", id: m.id });
        if (m.perilaku === "selesai") setTimeout(() => this.kirim({ type: "done", id: m.id, stdout: "halo", error: null }), 5);
        else if (m.perilaku === "crash") setTimeout(() => this.picu("error", { message: "oom", preventDefault() {} }), 5);
        // "gantung": tidak pernah selesai
      }, 1);
    }
  }
  terminate() {
    this.mati = true;
  }
}
globalThis.Worker = WorkerPalsu;

const { buatPemantau } = await import("../site/js/penjalan.js");
const baru = (maks = 200) => buatPemantau({ nama: "uji" + Math.random(), urlWorker: "x.js", maksMuatMs: maks });

// ---- siap ----
{
  perilaku = "siap";
  const p = baru();
  const log = [];
  p.langgan((siap, g) => log.push([siap, g && g.pesan]));
  p.mulai();
  await p.tunggu();
  cek("memuat lalu siap", p.siap() && !p.gagal());
  cek("pendengar menerima status memuat lalu siap", log[0][0] === false && log.at(-1)[0] === true);
  cek("mulai() berkali-kali tidak membuat worker ganda", (p.mulai(), p.mulai(), semua.filter((w) => !w.mati).length === 1));
  const h = await p.jalankan({ perilaku: "selesai" }, 500, (m) => ({ timeout: false, stdout: m.stdout, error: m.error }));
  cek("pekerjaan selesai mengembalikan hasil", h.stdout === "halo" && !h.timeout);
}

// ---- gagal diunduh (peristiwa error) ----
{
  perilaku = "error";
  const p = baru();
  let dilihat = null;
  p.langgan((siap, g) => g && (dilihat = g));
  p.mulai();
  let galat = null;
  await p.tunggu().catch((e) => (galat = e));
  cek("gagal diunduh ditandai gagal dengan pesan yang bisa dibaca", p.gagal() && /diunduh|diblokir/.test(p.gagal().pesan) && galat && dilihat);
  cek("tunggu() ditolak (bukan menggantung) saat gagal", !!galat);
  perilaku = "siap";
  p.ulangi();
  await p.tunggu();
  cek("Coba lagi (ulangi) memulihkan dari gagal", p.siap() && p.gagal() === null);
}

// ---- terlalu lama memuat ----
{
  perilaku = "diam";
  const p = baru(60);
  p.mulai();
  let galat = null;
  await p.tunggu().catch((e) => (galat = e));
  cek("batas waktu muat terlewati: gagal dengan pesan 'terlalu lama'", p.gagal() && /lebih dari/.test(p.gagal().pesan) && galat);
  cek("worker yang menggantung dimatikan", semua.at(-1).mati);
}

// ---- galat fatal dari worker ----
{
  perilaku = "fatal";
  const p = baru();
  p.mulai();
  await p.tunggu().catch(() => {});
  cek("galat fatal worker ditampilkan", p.gagal() && p.gagal().pesan.includes("kehabisan memori"));
}

// ---- mati mendadak saat bekerja ----
{
  perilaku = "siap";
  const p = baru();
  await p.tunggu();
  const h = await p.jalankan({ perilaku: "crash" }, 500, () => ({}));
  cek("worker mati saat bekerja: pekerjaan diselesaikan dengan galat, tidak menggantung", /berhenti mendadak/.test(h.error) && p.gagal() && !p.siap(), JSON.stringify(h));
  perilaku = "siap";
  p.ulangi();
  await p.tunggu();
  cek("bisa dipulihkan setelah mati mendadak", p.siap());
}

// ---- batas waktu pekerjaan: dimatikan dan dimulai ulang otomatis ----
{
  perilaku = "siap";
  const p = baru();
  await p.tunggu();
  const awal = semua.length;
  const h = await p.jalankan({ perilaku: "gantung" }, 30, () => ({}));
  cek("pekerjaan melewati batas waktu: timeout", h.timeout === true);
  await tidur(30);
  cek("worker dimulai ulang otomatis untuk pekerjaan berikutnya", semua.length === awal + 1 && semua[awal - 1].mati);
  await p.tunggu();
  cek("siap kembali setelah timeout", p.siap());
}

// ---- jalankan sebelum siap ----
{
  perilaku = "siap";
  const p = baru();
  const h = await p.jalankan({}, 100, () => ({}));
  cek("jalankan sebelum siap tidak menggantung", /belum siap/.test(h.error));
}

tamat = true;
console.log(gagal ? "\n" + gagal + " uji GAGAL." : "\nSemua uji lulus.");
process.exit(gagal ? 1 : 0);
