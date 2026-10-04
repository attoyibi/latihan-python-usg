# Pemasangan dari nol

Situs ini statis (HTML, CSS, JavaScript). Tanpa server sendiri dan tanpa langkah build. Ada tiga bagian yang bisa dipasang terpisah:

1. **Situs** (wajib).
2. **Akun dan penyimpanan data** lewat Supabase (opsional; tanpa ini progres hanya tersimpan di browser peserta).
3. **Penayangan** lewat Cloudflare Pages, Vercel, atau GitHub Pages.

> Status: situs, skema database, **masuk dan data awal (nama, NIM, kelas)** sudah ada. Alur masuk sudah diuji dengan klien tiruan, **belum dengan Supabase sungguhan**. Simpan progres ke database, laporan, dan dashboard belum ditulis; lihat [CHECKLIST.md](../CHECKLIST.md).

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
4. **Authentication > Providers**: pastikan *Email* aktif. Peserta masuk dengan **kode 6 digit yang dikirim ke email** (tanpa kata sandi); tautan di email juga berfungsi.
   - **Ubah templat email** supaya memuat kode. Di **Authentication > Email Templates**, edit **dua** templat: *Confirm signup* (dipakai pengguna baru) dan *Magic Link* (pengguna lama). Isi minimal:

     ```html
     <h2>Kode masuk</h2>
     <p>Kodemu: <strong>{{ .Token }}</strong></p>
     <p>Atau <a href="{{ .ConfirmationURL }}">masuk lewat tautan ini</a>.</p>
     ```

   - **Atur SMTP sendiri (penting).** Pengirim email bawaan Supabase sangat dibatasi dan hanya untuk uji coba; 80 peserta masuk bersamaan akan terkena batas dan kodenya tidak terkirim. Di **Project Settings > Authentication > SMTP Settings** hubungkan layanan email (misalnya Resend atau Brevo, keduanya punya paket gratis).
   - **Authentication > URL Configuration**: isi *Site URL* dengan alamat situs setelah tayang, dan tambahkan alamat itu (serta `http://localhost:8000`) ke *Redirect URLs*.
5. Salin **Project URL** dan **anon public key** dari **Project Settings > API**, lalu isi di `site/config.js`:

   ```js
   window.APP_CONFIG = { SUPABASE_URL: "https://xxxx.supabase.co", SUPABASE_ANON_KEY: "..." };
   ```

   Kunci `anon` memang publik. **Jangan pernah** memasukkan kunci `service_role` ke repositori atau ke `config.js`.
6. Jadikan diri Anda instruktur: masuk ke situs sekali dan isi data awal, lalu jalankan `supabase/jadikan_instruktur.sql` (ganti NIM-nya). Peran instruktur sengaja tidak bisa diubah dari situs.

Catatan: SQL sudah diperiksa sintaksnya dengan parser PostgreSQL (`python tools/periksa_sql.py`), tetapi **belum dijalankan di proyek Supabase sungguhan**. Jalankan di proyek kosong dulu dan laporkan bila ada galat.

### Cara kerja masuk

- Bila `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di `site/config.js` **kosong**, situs berjalan **mode lokal**: tanpa akun dan tanpa gerbang, progres hanya di browser.
- Bila terisi, pengunjung harus **masuk dulu**, lalu **mengisi nama, NIM, dan kelas** satu kali. Sebelum itu semua halaman (termasuk bab) tertutup. Data itu tersimpan di tabel `profiles`, NIM tidak boleh kembar, dan bisa diubah lewat tautan nama di pojok kanan atas.
- Progres di browser dipisah per akun, jadi komputer bersama (warnet, lab) tidak bercampur.

### Menguji tanpa Supabase

`tools/klien-tiruan.js` berisi klien tiruan di memori. Salin situs ke folder sementara, ganti `config.js` dengan berkas itu, lalu jalankan server statis. Kode login yang diterima adalah `123456`, dan alamat email yang mengandung kata `limit` memicu galat batas email.

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
