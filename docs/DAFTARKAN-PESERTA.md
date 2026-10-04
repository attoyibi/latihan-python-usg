# Mendaftarkan peserta sendiri (kelas tertutup)

Untuk kelas yang pesertanya sudah diketahui (mis. 80 mahasiswa), Anda bisa mendaftarkan mereka lebih dulu. Tiap peserta menerima **email dan kata sandi awal**, tidak perlu mendaftar, dan datanya (nama, NIM, kelas) sudah terisi. Saat pertama masuk, peserta diminta **membuat kata sandi baru** milik sendiri.

Manfaatnya dibanding pendaftaran mandiri:
- Hanya email yang Anda daftarkan yang bisa masuk. Orang lain tidak bisa membuat akun.
- Data peserta seragam, tidak ada salah ketik atau NIM ganda dari peserta.
- **Tidak ada email konfirmasi.** Masuk dengan kata sandi tidak mengirim email, jadi batas pengiriman email tidak menjadi masalah untuk 80 orang.

Yang tetap berlaku: batas masuk **30 per 5 menit per alamat IP** (peserta di satu Wi-Fi berbagi satu IP). Baca bagian "Kelas besar" di [PEMASANGAN.md](PEMASANGAN.md).

## Langkah

### 1. Siapkan daftar peserta (CSV)
Buat berkas `peserta.csv` (dari Excel: *Save As > CSV*) dengan judul kolom persis:

```
nama,nim,kelas,email
Siti Aminah,2024110012,SI-1A,siti@kampus.ac.id
```

Pemisah koma atau titik koma sama-sama bisa dibaca. Contoh: [contoh-peserta.csv](contoh-peserta.csv).

Kolom tambahan **opsional**: `sandi`, bila Anda ingin menentukan sendiri kata sandi awal tiap peserta (minimal 8 karakter, memuat huruf dan angka). Bila kolom itu tidak ada atau kosong, skrip membuatkan kata sandi **acak** untuk tiap peserta.

> **Jaga datanya.** Berkas ini berisi nama, NIM, dan email mahasiswa. Simpan di komputer Anda, **jangan dimasukkan ke repositori** (nama `peserta*.csv` dan `sandi-awal*.csv` sudah diabaikan oleh git), dan hapus setelah selesai.

### 2. Simulasi dulu (aman, tidak mengirim apa pun)
```bash
node tools/impor_peserta.mjs peserta.csv
```
Skrip memeriksa setiap baris dan menyebut nomor baris yang bermasalah: nama terlalu pendek, NIM tidak valid, email salah, sandi terlalu lemah, atau email/NIM ganda di dalam berkas. Perbaiki sampai keluar "Berkas valid".

### 3. Tutup pendaftaran mandiri
Supaya hanya peserta terdaftar yang bisa masuk:
- Di Supabase: **Authentication > Sign In / Providers**, matikan **Allow new users to sign up**. Menurut dokumentasi Supabase, dengan ini hanya pengguna yang sudah ada yang bisa masuk.
- Di situs: `PENDAFTARAN` kini **bawaan `tutup`**, jadi tombol Daftar sudah tersembunyi dan situs menyebut "akun dari dosen". Tidak ada yang perlu Anda atur di Vercel. (`PENDAFTARAN=buka` akan menampilkan Daftar kembali, tetapi fitur itu belum dikembangkan.)

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
2. membuat akun untuk email yang belum ada (email langsung terverifikasi) dengan kata sandi awal, bertanda **wajib ganti kata sandi**;
3. mengisi profil (nama, NIM, kelas);
4. menyimpan daftar kata sandi awal ke berkas `sandi-awal-<tanggal-jam>.csv` di folder tempat Anda menjalankannya.

Hasilnya ringkasan jumlah akun baru dan profil tersimpan, plus daftar baris yang gagal beserta sebabnya. **Kata sandi tidak pernah dicetak ke layar**, hanya ke berkas itu.

### 5. Bagikan kata sandi awal
Buka `sandi-awal-....csv`, lalu sampaikan kata sandi awal ke tiap peserta lewat jalur yang aman (mis. pesan pribadi atau dibagikan langsung, **bukan** daftar yang terbuka untuk satu kelas). Setelah semua menerima, **hapus berkas itu**.

Saat pertama masuk, peserta mengisi email dan kata sandi awal, lalu langsung diminta membuat kata sandi baru. Setelah itu kata sandi awal tidak berlaku lagi.

### 6. Jadikan dosen sebagai instruktur
Tambahkan email dosen ke CSV (atau daftarkan manual), lalu jalankan `supabase/jadikan_instruktur.sql`. Lihat [PEMASANGAN.md](PEMASANGAN.md), bagian C.

### 7. Coba satu akun
Buka situs dengan email dan kata sandi awal salah satu peserta. Pastikan situs meminta kata sandi baru, lalu langsung masuk ke mata kuliah tanpa tahap isi data. Coba juga email yang **tidak** terdaftar: situs harus menjawab "Email atau kata sandi salah".

## Aman dijalankan ulang
Skrip tidak membuat akun ganda. Menjalankannya lagi memperbarui nama, NIM, dan kelas dari CSV, **tidak mengubah kata sandi** akun yang sudah ada, dan **tidak mengubah peran** (peserta atau instruktur). Cocok untuk menambah peserta susulan: tambahkan barisnya, jalankan ulang. Berkas kata sandi baru hanya berisi peserta yang baru dibuat.

## Peserta lupa kata sandi
- Peserta bisa memakai **Lupa kata sandi** di layar masuk (butuh email terkirim; lihat catatan SMTP di PEMASANGAN).
- Atau Anda atur ulang: buat CSV berisi peserta itu saja, lalu jalankan dengan `--reset-sandi`:
  ```bash
  node tools/impor_peserta.mjs lupa.csv --jalankan --reset-sandi
  ```
  Kata sandi baru masuk ke berkas kata sandi, dan peserta diminta menggantinya lagi saat masuk.

## Bila ada baris yang gagal
| Pesan | Artinya | Tindakan |
|---|---|---|
| `NIM ... sudah dipakai profil lain` | NIM itu sudah dimiliki akun lain | Periksa NIM di CSV atau di tabel `profiles`; perbaiki lalu jalankan ulang |
| `akun tidak bisa dibuat: ...` | Supabase menolak email atau kata sandi itu | Periksa penulisan email dan panjang minimum kata sandi di Supabase; baca pesan yang disertakan |
| `Kunci ditolak (HTTP 401)` | Kunci salah atau dari proyek lain | Salin ulang kunci `service_role` dari proyek yang sama dengan `SUPABASE_URL` |
| `Berkas '...' sudah ada` | Berkas kata sandi dengan nama itu sudah ada | Pindahkan atau hapus, atau pilih nama lain dengan `--sandi=...` |

Akun yang sudah dibuat tetap ada bila profilnya gagal; cukup perbaiki dan jalankan ulang.

## Email salah ketik
Peserta yang emailnya salah tidak akan bisa masuk (kata sandi awalnya terkait email itu). Perbaiki di Supabase: **Authentication > Users**, ubah emailnya (atau hapus dan daftarkan ulang dengan email yang benar).

## Mencoba tanpa Supabase
`python tools/server_uji.py` lalu buka `http://127.0.0.1:8124` menjalankan mode **tertutup** dengan akun contoh:

| Email | Kata sandi | Keterangan |
|---|---|---|
| `siti@kampus.ac.id` | `Sandi-Awal-1` | kata sandi awal: wajib diganti saat pertama masuk; profil terisi |
| `budi@kampus.ac.id` | `Rahasia-Budi1` | langsung masuk |
| `lupa@kampus.ac.id` | `Rahasia-Lupa1` | untuk mencoba Lupa kata sandi (tanpa profil) |
| `kedaluwarsa@kampus.ac.id` | `Rahasia-Lama1` | tautan atur ulang kata sandinya kedaluwarsa |

Tambahkan `?terbuka=1` di alamat (mis. `http://127.0.0.1:8124/?terbuka=1`) untuk mencoba mode pendaftaran mandiri: tombol Daftar muncul dan butuh konfirmasi email. "Email" di mode uji muncul sebagai kotak kuning "Email tiruan" di pojok kanan bawah; tombolnya meniru klik tautan di email.
