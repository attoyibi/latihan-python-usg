// Konfigurasi sambungan ke Supabase.
// Kunci "anon" memang dirancang publik (dibatasi oleh aturan keamanan di database),
// jadi aman ditaruh di sini. JANGAN PERNAH menaruh kunci "service_role" di berkas ini.
// Biarkan kosong untuk menjalankan situs tanpa akun (progres hanya di browser).
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};
