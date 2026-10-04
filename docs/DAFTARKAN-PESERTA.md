# Mendaftarkan peserta sendiri (kelas tertutup)

Untuk kelas yang pesertanya sudah diketahui (mis. 80 mahasiswa), Anda bisa mendaftarkan mereka lebih dulu. Peserta tidak perlu mendaftar atau mengisi data apa pun: cukup membuka situs, memilih mata kuliah, dan mengklik tautan masuk yang dikirim ke emailnya. Nama, NIM, dan kelas sudah terisi.

Manfaatnya dibanding pendaftaran mandiri:
- Hanya email yang Anda daftarkan yang bisa masuk. Orang lain tidak bisa membuat akun.
- Data peserta (nama, NIM, kelas) seragam, tidak ada salah ketik atau NIM ganda dari peserta.
- Hari pertama lebih ringan: tidak ada tahap isi data.

Yang **tidak** berubah: tiap peserta tetap menerima satu email tautan masuk saat pertama masuk, jadi batas pengiriman email dan batas per alamat IP tetap berlaku. Baca bagian "Kelas besar" di [PEMASANGAN.md](PEMASANGAN.md).

## Langkah

### 1. Siapkan daftar peserta (CSV)
Buat berkas `peserta.csv` (dari Excel: *Save As > CSV*) dengan judul kolom persis:

```
nama,nim,kelas,email
Siti Aminah,2024110012,SI-1A,siti@kampus.ac.id
```

Pemisah koma atau titik koma sama-sama bisa dibaca. Contoh: [contoh-peserta.csv](contoh-peserta.csv).

> **Jaga datanya.** Berkas ini berisi nama, NIM, dan email mahasiswa. Simpan di komputer Anda, **jangan dimasukkan ke repositori** (nama `peserta*.csv` sudah diabaikan oleh git), dan hapus setelah selesai.

### 2. Simulasi dulu (aman, tidak mengirim apa pun)
```bash
node tools/impor_peserta.mjs peserta.csv
```
Skrip memeriksa setiap baris dan menyebut nomor baris yang bermasalah: nama terlalu pendek, NIM tidak valid, email salah, atau email/NIM ganda di dalam berkas. Perbaiki sampai keluar "Berkas valid".

### 3. Tutup pendaftaran mandiri
Supaya hanya peserta terdaftar yang bisa masuk:
- Di Supabase: **Authentication > Sign In / Providers**, matikan **Allow new users to sign up**. Menurut dokumentasi Supabase, dengan ini hanya pengguna yang sudah ada yang bisa masuk.
- Di Vercel (atau layanan penayangan): tambahkan variabel `PENDAFTARAN` bernilai `tutup`, lalu *Redeploy*. Situs lalu menyebut "email yang didaftarkan dosen", dan tidak membuat akun baru lewat tautan. Tanpa variabel ini nilainya `buka`.

### 4. Daftarkan
Di komputer Anda (bukan di repositori), atur dua variabel lingkungan dengan nilai dari **Project Settings > API**, lalu jalankan.

PowerShell (Windows):
```powershell
$env:SUPABASE_URL = "https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "kunci-rahasia-service_role"
node tools/impor_peserta.mjs peserta.csv --jalankan
```

Bash (Mac/Linux/Git Bash):
```bash
SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="kunci-rahasia" node tools/impor_peserta.mjs peserta.csv --jalankan
```

> **Kunci `service_role` itu rahasia.** Kunci ini melewati semua aturan keamanan database, jadi siapa pun yang memilikinya bisa membaca dan mengubah semua data. Jangan menempelkannya di chat, repositori, atau berkas yang dibagikan. Skrip hanya berjalan di komputer Anda, tidak mencetak kuncinya, dan menolak kunci publik (anon/publishable). Setelah selesai, tutup jendela terminal; bila ragu kunci pernah bocor, buat ulang di Project Settings > API.

Skrip akan:
1. membaca daftar pengguna yang sudah ada;
2. membuat akun untuk email yang belum ada (email langsung terverifikasi);
3. mengisi profil (nama, NIM, kelas).

Hasilnya ringkasan jumlah akun baru, akun yang sudah ada, dan profil tersimpan, plus daftar baris yang gagal beserta sebabnya.

### 5. Jadikan dosen sebagai instruktur
Tambahkan email dosen ke CSV (atau daftarkan manual), lalu jalankan `supabase/jadikan_instruktur.sql`. Lihat [PEMASANGAN.md](PEMASANGAN.md), bagian C.

### 6. Coba satu akun
Buka situs dengan email salah satu peserta, minta tautan masuk, klik tautannya. Pastikan langsung masuk ke mata kuliah tanpa tahap isi data. Coba juga email yang **tidak** terdaftar: situs harus menjawab "Email ini belum terdaftar di kelas".

## Aman dijalankan ulang
Skrip tidak membuat akun ganda. Menjalankannya lagi memperbarui nama, NIM, dan kelas dari CSV, dan **tidak mengubah peran** (peserta atau instruktur) yang sudah ada. Cocok untuk menambah peserta susulan: tambahkan barisnya, jalankan ulang.

## Bila ada baris yang gagal
| Pesan | Artinya | Tindakan |
|---|---|---|
| `NIM ... sudah dipakai profil lain` | NIM itu sudah dimiliki akun lain | Periksa NIM di CSV atau di tabel `profiles`; perbaiki lalu jalankan ulang |
| `akun tidak bisa dibuat: ...` | Supabase menolak email itu | Periksa penulisan email; baca pesan yang disertakan |
| `Kunci ditolak (HTTP 401)` | Kunci salah atau dari proyek lain | Salin ulang kunci `service_role` dari proyek yang sama dengan `SUPABASE_URL` |

Akun yang sudah dibuat tetap ada bila profilnya gagal; cukup perbaiki dan jalankan ulang.

## Email salah ketik
Peserta yang emailnya salah tidak akan menerima tautan. Perbaiki di Supabase: **Authentication > Users**, ubah emailnya (atau hapus dan daftarkan ulang dengan email yang benar).

## Mencoba tampilan kelas tertutup tanpa Supabase
`python tools/server_uji.py` lalu buka `http://127.0.0.1:8124` menjalankan mode **tertutup**: hanya `siti@kampus.ac.id` dan `budi@kampus.ac.id` yang terdaftar (profilnya sudah terisi, jadi langsung masuk), dan `kedaluwarsa@kampus.ac.id` mensimulasikan tautan kedaluwarsa. Email lain ditolak. Tambahkan `?terbuka=1` di alamat (mis. `http://127.0.0.1:8124/?terbuka=1`) untuk mencoba mode pendaftaran mandiri.
