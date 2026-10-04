#!/usr/bin/env node
// Membuat site/config.js dari environment variable saat penayangan (Vercel, Cloudflare Pages, Netlify).
// Dengan begini orang yang memakai fork tidak perlu mengedit berkas apa pun di repositori,
// sehingga "Sync fork" tidak pernah bentrok.
//
// Variabel:
//   SUPABASE_URL        alamat proyek, mis. https://abcdxyz.supabase.co
//   SUPABASE_ANON_KEY   kunci "anon" (atau "publishable") dari Project Settings > API
//   MODE_LOKAL          opsional, "true" hanya untuk uji tampilan tanpa akun
//   PENDAFTARAN         opsional, "buka" (bawaan) atau "tutup" (hanya email yang didaftarkan dosen)
//
// Bila kedua variabel kosong, config.js dibiarkan apa adanya dan situs menampilkan
// layar "Situs belum tersambung ke Supabase".
//
// Keamanan: kunci "service_role" / "secret" DITOLAK. Kunci itu melewati semua aturan keamanan
// database dan tidak boleh sampai ke browser.
//
// Pemakaian:  node tools/buat_config.mjs [--keluaran jalur/config.js]

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf("--keluaran");
const out = i > -1 && process.argv[i + 1] ? resolve(process.argv[i + 1]) : join(here, "..", "site", "config.js");

const url = (process.env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_ANON_KEY || "").trim();
const lokal = (process.env.MODE_LOKAL || "").trim().toLowerCase() === "true";
const pendaftaran = (process.env.PENDAFTARAN || "buka").trim().toLowerCase();

function gagal(pesan) {
  console.error("[buat_config] GAGAL: " + pesan);
  process.exit(1);
}

if (pendaftaran !== "buka" && pendaftaran !== "tutup") gagal('PENDAFTARAN harus "buka" atau "tutup".');

if (!url && !key && !lokal) {
  console.warn("[buat_config] SUPABASE_URL dan SUPABASE_ANON_KEY belum diisi. config.js tidak diubah; situs akan menampilkan layar pemasangan.");
  process.exit(0);
}

let cleanUrl = "";
let cleanKey = "";

if (url || key) {
  if (!url || !key) gagal("Isi KEDUA variabel: SUPABASE_URL dan SUPABASE_ANON_KEY.");

  let u;
  try {
    u = new URL(url);
  } catch (e) {
    gagal("SUPABASE_URL bukan alamat yang valid.");
  }
  const lokalHost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && lokalHost)) gagal("SUPABASE_URL harus diawali https://.");
  if (!/^[a-z0-9.-]+$/i.test(u.hostname)) gagal("SUPABASE_URL mengandung karakter yang tidak diizinkan.");
  if ((u.pathname && u.pathname !== "/") || u.search || u.hash || u.username || u.password) gagal("SUPABASE_URL hanya boleh berisi alamat dasar, mis. https://abcdxyz.supabase.co.");
  cleanUrl = u.origin;

  if (/^sb_secret_/.test(key)) gagal("Itu kunci RAHASIA (sb_secret_...). Pakai kunci publik (anon atau publishable). Kunci rahasia tidak boleh ada di situs.");
  if (!/^sb_publishable_/.test(key)) {
    const parts = key.split(".");
    if (parts.length !== 3) gagal("SUPABASE_ANON_KEY bukan kunci Supabase yang dikenali.");
    let payload;
    try {
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch (e) {
      gagal("SUPABASE_ANON_KEY rusak atau bukan kunci Supabase.");
    }
    if (payload.role === "service_role") gagal("Itu kunci service_role. Kunci itu melewati semua aturan keamanan database dan TIDAK BOLEH dipakai di situs. Pakai kunci anon.");
    if (payload.role !== "anon") gagal("Kunci harus berperan anon (ditemukan: " + String(payload.role) + ").");
  }
  if (/[\s"'<>\\]/.test(key)) gagal("SUPABASE_ANON_KEY mengandung karakter yang tidak diizinkan.");
  cleanKey = key;
}

const isi = {
  SUPABASE_URL: cleanUrl,
  SUPABASE_ANON_KEY: cleanKey,
  MODE_LOKAL: lokal,
  PENDAFTARAN: pendaftaran,
};
const teks =
  "// Dibuat otomatis oleh tools/buat_config.mjs saat penayangan. Jangan diedit dan jangan di-commit.\n" +
  "window.APP_CONFIG = " + JSON.stringify(isi, null, 2) + ";\n";
writeFileSync(out, teks, "utf8");
console.log("[buat_config] config.js dibuat" + (cleanUrl ? " untuk " + cleanUrl : "") + (lokal ? " (MODE_LOKAL aktif)" : "") + (pendaftaran === "tutup" ? " (pendaftaran ditutup)" : "") + ".");
