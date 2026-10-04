#!/usr/bin/env node
// Menguji terjemahan galat Supabase menjadi pesan untuk peserta (friendly di site/js/auth.js).
// Jalankan:  node tools/uji_pesan.mjs
import { friendly } from "../site/js/auth.js";

let gagal = 0;
function uji(nama, galat, harapSubstring) {
  const hasil = friendly(galat);
  const ok = hasil.includes(harapSubstring);
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : `  -> "${hasil}" tidak memuat "${harapSubstring}"`));
}

uji("jeda per alamat email", { message: "For security purposes, you can only request this after 43 seconds." }, "Tunggu 43 detik");
uji("jeda 1 detik (tunggal)", { message: "you can only request this after 1 second" }, "Tunggu 1 detik");
uji("batas pengiriman proyek", { message: "email rate limit exceeded", code: "over_email_send_rate_limit" }, "Batas pengiriman email");
uji("batas permintaan umum", { message: "Too many requests" }, "Batas pengiriman email");
uji("NIM kembar", { code: "23505", message: "duplicate key" }, "NIM ini sudah dipakai");
uji("isian melanggar aturan", { code: "23514", message: "check constraint" }, "belum sesuai aturan");
uji("tabel belum ada", { code: "42P01", message: 'relation "public.profiles" does not exist' }, "Database belum disiapkan");
uji("email tidak valid", { message: "Unable to validate email address: invalid format" }, "Alamat email tidak valid");
uji("tanpa jaringan", { message: "Failed to fetch" }, "Tidak bisa terhubung");
uji("galat tak dikenal tetap terbaca", { message: "sesuatu yang aneh" }, "Terjadi masalah");

console.log(gagal ? `\n${gagal} uji gagal.` : "\nSemua uji pesan lulus.");
process.exit(gagal ? 1 : 0);
