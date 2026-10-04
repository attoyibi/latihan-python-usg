# Pemasangan dari nol

Situs ini statis (HTML, CSS, JavaScript). Tanpa server sendiri dan tanpa langkah build. Ada tiga bagian yang bisa dipasang terpisah:

1. **Situs** (wajib).
2. **Akun dan penyimpanan data** lewat Supabase (opsional; tanpa ini progres hanya tersimpan di browser peserta).
3. **Penayangan** lewat Cloudflare Pages, Vercel, atau GitHub Pages.

> Status: situs dan skema database sudah siap. Kode di situs yang memakai Supabase (masuk, simpan progres, laporan, dashboard) **belum ditulis**; lihat [CHECKLIST.md](../CHECKLIST.md). Mengikuti bagian 2 sekarang menyiapkan database untuk tahap itu.

## 1. Menjalankan di komputer sendiri

```bash
git clone https://github.com/attoyibi/latihan-python-usg.git
cd latihan-python-usg/site
python -m http.server 8000
```

Buka `http://localhost:8000`. Butuh internet karena editor, Python di browser (Pyodide), huruf, dan video dimuat dari CDN.

## 2. Menyiapkan Supabase

1. Buat proyek di supabase.com (paket gratis cukup untuk sekitar 80 peserta). Pakai proyek **khusus** untuk situs ini.
2. Buka **SQL Editor**, buat query baru, tempel isi `supabase/migrations/0001_skema.sql`, klik **Run**.
3. Buat query baru lagi, tempel isi `supabase/migrations/0002_keamanan.sql`, lalu **Run**. Berkas ini mengaktifkan aturan keamanan (Row Level Security) dan bucket penyimpanan privat `tugas`.
4. **Authentication > Providers**: aktifkan *Email*. **Authentication > URL Configuration**: isi *Site URL* dengan alamat situs Anda setelah tayang (bagian 3).
5. Salin **Project URL** dan **anon public key** dari **Project Settings > API**, lalu isi di `site/config.js`:

   ```js
   window.APP_CONFIG = { SUPABASE_URL: "https://xxxx.supabase.co", SUPABASE_ANON_KEY: "..." };
   ```

   Kunci `anon` memang publik. **Jangan pernah** memasukkan kunci `service_role` ke repositori atau ke `config.js`.
6. Jadikan diri Anda instruktur: masuk ke situs sekali dan isi data awal, lalu jalankan `supabase/jadikan_instruktur.sql` (ganti NIM-nya). Peran instruktur sengaja tidak bisa diubah dari situs.

Catatan: SQL sudah diperiksa sintaksnya dengan parser PostgreSQL (`python tools/periksa_sql.py`), tetapi **belum dijalankan di proyek Supabase sungguhan**. Jalankan di proyek kosong dulu dan laporkan bila ada galat.

## 3. Menayangkan

Setelan sama untuk semua layanan: **tanpa perintah build**, **folder keluaran `site`**.

- **Cloudflare Pages:** *Create project > Connect to Git* > pilih repositori. Framework preset *None*, build command kosong, build output directory `site`.
- **Vercel:** *Add New Project* > pilih repositori. Framework *Other*, Build Command kosong, Output Directory `site`.
- **GitHub Pages:** *Settings > Pages*, sumber *GitHub Actions*, atau salin isi `site/` ke cabang `gh-pages`.

Setelah tayang, isi *Site URL* Supabase (langkah 4 di atas) dengan alamat barunya.

## 4. Akhir semester

Kebijakan: data peserta disimpan sampai akhir semester lalu diarsipkan. Ikuti urutan di `supabase/arsip_akhir_semester.sql` (unduh dulu, hapus belakangan).

## Keamanan singkat

- Penilaian jawaban terjadi di browser, jadi peserta yang mahir secara teori bisa memalsukannya. Cukup untuk latihan, **tidak untuk ujian**.
- Soal dan test case ada di repositori publik. Kunci jawaban ada di `kunci/` dan tidak diterbitkan.
- Data mahasiswa (nama, NIM, kelas, kode, laporan) bersifat pribadi. Beri tahu peserta data apa yang dicatat dan untuk apa.
