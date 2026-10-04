// Konfigurasi sambungan ke Supabase.
// Kunci "anon" memang dirancang publik (dibatasi oleh aturan keamanan di database),
// jadi aman ditaruh di sini. JANGAN PERNAH menaruh kunci "service_role" di berkas ini.
// Bila kosong, situs menampilkan layar pemasangan (peserta tidak bisa membuka bab).
// MODE_LOKAL: true menjalankan situs tanpa akun dan tanpa login, hanya untuk uji tampilan.
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  MODE_LOKAL: false,
};
