// CATATAN UNTUK PEMAKAI FORK: jangan edit berkas ini. Saat penayangan, tools/buat_config.mjs
// menimpanya dari environment variable SUPABASE_URL dan SUPABASE_ANON_KEY (lihat docs/PEMASANGAN.md).
// Edit manual hanya untuk uji di komputer sendiri, dan jangan di-commit.
//
// Konfigurasi sambungan ke Supabase.
// Kunci "anon" memang dirancang publik (dibatasi oleh aturan keamanan di database),
// jadi aman ditaruh di sini. JANGAN PERNAH menaruh kunci "service_role" di berkas ini.
// Bila kosong, situs menampilkan layar pemasangan (peserta tidak bisa membuka bab).
// MODE_LOKAL: true menjalankan situs tanpa akun dan tanpa login, hanya untuk uji tampilan.
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  MODE_LOKAL: false,
  // "tutup" (bawaan): pendaftaran mandiri disembunyikan; peserta didaftarkan dosen dan hanya masuk.
  // "buka": menampilkan Daftar. Fitur itu belum dikembangkan dan belum diuji dengan Supabase sungguhan.
  PENDAFTARAN: "tutup",
};
