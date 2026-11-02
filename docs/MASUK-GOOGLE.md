# Masuk dengan Google

Tombol "Masuk dengan Google" di halaman Masuk dan Daftar. Akun Google yang belum terdaftar otomatis dibuatkan akun oleh
Supabase, lalu peserta mengisi nama (sudah terisi dari akun Google), NIM, dan kelas satu kali seperti biasa. Bila email
Google sama dengan akun yang sudah ada, Supabase menyambungkannya ke akun itu.

Tombol hanya tampil bila `MASUK_GOOGLE` dinyalakan **dan** pendaftaran terbuka (`PENDAFTARAN=buka`). Saat pendaftaran
ditutup tombol disembunyikan, karena masuk dengan Google bisa membuat akun baru.

## Memasang (sekali)
1. **Google Cloud Console > APIs & Services > Credentials > OAuth client (Web application)**
   - Authorized JavaScript origins: alamat situs, mis. `https://latihan-usg.vercel.app`.
   - Authorized redirect URIs: **hanya** `https://<proyek>.supabase.co/auth/v1/callback` (bukan alamat situs).
   - OAuth consent screen: isi nama aplikasi dan email dukungan. Selama status *Testing*, hanya akun yang
     didaftarkan sebagai test user yang bisa masuk; tekan *Publish app* agar semua akun Google bisa.
2. **Supabase > Authentication > Sign In / Providers > Google**: aktifkan, tempel Client ID dan Client Secret.
   Client Secret hanya disimpan di Supabase, tidak pernah di repositori atau di situs.
3. **Supabase > Authentication > URL Configuration**
   - Site URL: alamat situs utama.
   - Redirect URLs: setiap alamat situs diikuti `/**`, mis. `https://latihan-usg.vercel.app/**`,
     `https://latihan-usg-pratinjau.vercel.app/**`, dan untuk pratinjau Vercel
     `https://latihan-usg-pratinjau-*-attoyibis-projects.vercel.app/**`. Alamat yang tidak terdaftar dikembalikan ke Site URL.
4. **Vercel > Settings > Environment Variables**: `MASUK_GOOGLE` = `ya`, lalu deploy ulang.

## Mencoba di komputer sendiri
`python tools/server_uji.py`, buka `http://localhost:8124/?terbuka=1#masuk`. Klien tiruan meniru Google (akun
"Gani Pratama"); `&googlebatal=1` meniru pengguna yang membatalkan.
