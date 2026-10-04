# Pemasangan dari nol (fork sampai tayang)

Situs ini statis (HTML, CSS, JavaScript). Tanpa server sendiri. Anda hanya butuh tiga akun gratis: **GitHub**, **Supabase**, dan **Vercel** (atau Cloudflare Pages / Netlify).

Prinsipnya: **Anda tidak mengedit berkas apa pun di repositori.** URL dan kunci Supabase diisi sebagai *environment variable* di layanan penayangan, lalu dipasang otomatis saat build. Dengan begitu tombol *Sync fork* tidak pernah bentrok (lihat [MEMPERBARUI.md](MEMPERBARUI.md)).

> Status: situs, banyak mata kuliah, masuk, data awal, dan profil sudah ada. Alur masuk sudah diuji dengan klien tiruan, **belum dengan Supabase sungguhan**. Simpan progres ke database, laporan, dan dashboard belum ditulis; lihat [CHECKLIST.md](../CHECKLIST.md).

## Ringkasan 15 menit

1. **Fork** repositori ini di GitHub (tombol *Fork*).
2. **Supabase:** buat proyek, tempel tiga berkas SQL, atur email (bagian A).
3. **Vercel:** *Add New Project* > pilih fork Anda > isi dua variabel > *Deploy* (bagian B).
4. Kembali ke Supabase, isi *Site URL* dengan alamat dari Vercel (bagian A, langkah 7).
5. Masuk ke situs, isi data awal, lalu jadikan diri Anda instruktur (bagian C).

## A. Supabase

1. Buat proyek di supabase.com (paket gratis cukup untuk sekitar 80 peserta). Pakai proyek **khusus** untuk situs ini.
2. **SQL Editor** > *New query* > tempel isi `supabase/migrations/0001_skema.sql` > **Run**.
3. *New query* lagi > tempel isi `supabase/migrations/0002_keamanan.sql` > **Run**. Ini mengaktifkan aturan keamanan (Row Level Security) dan bucket privat `tugas`.
4. *New query* lagi > tempel isi `supabase/migrations/0003_matakuliah.sql` > **Run**. Ini menambah dukungan banyak mata kuliah (Algoritma Python dan PBO Java sudah terdaftar). Sudah menjalankan 0001 dan 0002 sebelumnya? Cukup jalankan 0003; data yang sudah ada otomatis dimasukkan ke mata kuliah `algoritma-python`.
5. **Authentication > Providers:** pastikan *Email* aktif. Peserta masuk lewat **tautan yang dikirim ke emailnya** (tanpa kata sandi dan tanpa mengetik kode): klik tautan, lalu otomatis kembali ke situs dalam keadaan masuk.
6. **Periksa templat email.** Di **Authentication > Email Templates**, templat *Confirm signup* (pengguna baru) dan *Magic Link* (pengguna lama) harus memuat tautan `{{ .ConfirmationURL }}`. Templat bawaan sudah memuatnya. Bila ingin menyesuaikan kalimatnya, contoh minimal:

   ```html
   <h2>Masuk ke Latihan Pemrograman</h2>
   <p><a href="{{ .ConfirmationURL }}">Klik di sini untuk masuk</a>. Tautan hanya berlaku satu kali.</p>
   ```

7. **Authentication > URL Configuration (wajib, karena masuk lewat tautan):** isi *Site URL* dengan alamat situs setelah tayang, dan tambahkan alamat yang sama ke *Redirect URLs*. Bila tidak, tautan di email membawa peserta ke alamat yang salah (mis. `localhost`). Untuk menguji dari komputer sendiri, tambahkan juga `http://localhost:8000`.
8. **Atur SMTP sendiri (penting).** Pengirim email bawaan Supabase sangat dibatasi dan hanya untuk uji coba; banyak peserta masuk bersamaan akan terkena batas dan kodenya tidak terkirim. Di **Project Settings > Authentication > SMTP Settings** hubungkan layanan email (misalnya Resend atau Brevo, keduanya punya paket gratis).
9. Catat dua nilai dari **Project Settings > API**: **Project URL** dan kunci **anon** (atau *publishable*).

> **Jangan pernah** memakai kunci `service_role` atau `sb_secret_...`. Kunci itu melewati semua aturan keamanan database. Skrip pembangun akan **menolak** kunci itu dan membatalkan penayangan.

## B. Vercel (atau Cloudflare Pages / Netlify)

Repositori sudah membawa setelan yang dibutuhkan (`vercel.json`, `netlify.toml`, `site/_headers`).

### Vercel
1. **Add New > Project**, pilih fork Anda.
2. Biarkan setelan bawaan (dibaca dari `vercel.json`: build `node tools/buat_config.mjs`, keluaran `site`).
3. Di **Environment Variables**, isi:

   | Nama | Nilai |
   |---|---|
   | `SUPABASE_URL` | Project URL, mis. `https://abcdxyz.supabase.co` |
   | `SUPABASE_ANON_KEY` | kunci anon / publishable |

4. **Deploy.** Bila kunci yang dipakai ternyata `service_role`, build dibatalkan dengan pesan yang menjelaskan sebabnya. Bila variabel dikosongkan, situs menampilkan layar "belum tersambung ke Supabase".

### Cloudflare Pages
*Create project > Connect to Git* > pilih fork. **Build command:** `node tools/buat_config.mjs`. **Build output directory:** `site`. Tambahkan dua variabel yang sama di *Settings > Variables and Secrets* (untuk *Production* dan *Preview*).

### Netlify
*Add new site > Import from Git* > pilih fork. Setelan dibaca dari `netlify.toml`. Tambahkan dua variabel yang sama di *Site configuration > Environment variables*.

### Tombol sekali klik
Tombol *Deploy with Vercel* di README membuat **salinan** repositori (bukan fork) dan langsung meminta kedua variabel. Praktis, tetapi salinan itu tidak terhubung ke repositori asal sehingga tidak ada *Sync fork*. Untuk yang ingin menerima pembaruan, pakai fork.

## C. Setelah tayang

1. Buka situs, masuk dengan email Anda, dan isi nama, NIM, dan kelas.
2. Jadikan diri Anda instruktur: jalankan `supabase/jadikan_instruktur.sql` di SQL Editor (ganti NIM-nya). Peran instruktur sengaja tidak bisa diubah dari situs.
3. Ganti isi sesuai kelas Anda di `site/data/`: nama situs di `config.json`, daftar mata kuliah di `matakuliah.json`, dan bab serta soal di `kuliah/<id>/`. Panduan: [MENAMBAH-MATAKULIAH.md](MENAMBAH-MATAKULIAH.md) dan [MENAMBAH-BAB.md](MENAMBAH-BAB.md). **Jangan ubah** `site/js` dan `site/css` bila ingin pembaruan tetap mulus.

## Menjalankan dan menguji di komputer sendiri

```bash
git clone https://github.com/NAMA-ANDA/latihan-python-usg.git
cd latihan-python-usg
python tools/server_uji.py
```

Buka `http://127.0.0.1:8124`. Server ini menyajikan `site/` dengan login **tiruan**, tanpa Supabase: setelah memasukkan email, kotak "Email tiruan" muncul di pojok kanan bawah, dan tombolnya meniru klik tautan di email. Data tiruan hanya ada di browser. Butuh internet karena editor, Python di browser (Pyodide), huruf, dan video dimuat dari CDN.

## Cara kerja masuk

- **Halaman depan terbuka untuk siapa saja.** Pengunjung pertama melihat landing page statis: daftar mata kuliah yang tersedia, cara kerja, dan panduan. Tidak ada yang meminta masuk di sini.
- **Masuk baru diminta saat memilih mata kuliah.** Peserta memasukkan email, lalu mengklik **tautan masuk** yang dikirim ke emailnya (tanpa kata sandi). Mata kuliah yang tadi dipilih diingat, jadi setelah masuk peserta langsung diarahkan ke sana.
- **Pertama kali masuk:** peserta mengisi **nama, NIM, dan kelas** satu kali, lalu langsung ke mata kuliah pilihannya. Data itu tersimpan di tabel `profiles`, NIM tidak boleh kembar, dan bisa diubah di halaman **Profil**.
- **Keluar** mengembalikan peserta ke halaman depan.
- Halaman bab dan Profil tertutup sampai peserta masuk, juga bila alamatnya diketik langsung.
- Bila `SUPABASE_URL` dan `SUPABASE_ANON_KEY` kosong, halaman depan tetap tampil, tetapi memilih mata kuliah menampilkan layar "belum tersambung ke Supabase". `MODE_LOKAL=true` (variabel opsional) menjalankan situs tanpa akun, hanya untuk uji tampilan; jangan dipakai saat tayang.
- Progres di browser dipisah per akun, jadi komputer bersama (warnet, lab) tidak bercampur.
- Mesin Python di browser (sekitar 10 MB) hanya dimuat setelah peserta masuk, bukan untuk pengunjung halaman depan.

### Hal yang perlu diperhatikan pada masuk lewat tautan

- **Tautan berlaku satu kali.** Beberapa layanan email (terutama email kampus atau kantor dengan pemindai keamanan, mis. Safe Links) membuka tautan lebih dulu untuk memeriksanya, sehingga tautan sudah terpakai saat peserta mengkliknya dan muncul pesan "kedaluwarsa atau sudah dipakai". **Uji dengan email kampus yang benar-benar dipakai peserta sebelum semester dimulai.** Bila sering terjadi, beri tahu pengembang: ada cadangan berupa kode angka yang diketik.
- Tautan membuka browser mana pun yang dipakai peserta untuk membuka email (mis. browser di dalam aplikasi email). Sesi masuk berada di browser tempat tautan dibuka. Bila itu bukan browser yang dipakai belajar, peserta cukup melanjutkan di browser tempat tautan terbuka.
- Pengiriman email bawaan Supabase sangat terbatas; pasang SMTP sendiri (langkah 8).

## Akhir semester

Kebijakan: data peserta disimpan sampai akhir semester lalu diarsipkan. Ikuti urutan di `supabase/arsip_akhir_semester.sql` (unduh dulu, hapus belakangan).

## Hal yang perlu diperhatikan

- **Proyek Supabase gratis dijeda bila lama tidak aktif** (tidak ada permintaan selama sekitar seminggu). Buka dashboard dan aktifkan kembali sebelum semester dimulai.
- Penilaian jawaban terjadi di browser, jadi peserta yang mahir secara teori bisa memalsukannya. Cukup untuk latihan, **tidak untuk ujian**.
- Soal dan test case ada di repositori publik. Kunci jawaban sebaiknya disimpan di `kunci/` yang tidak diterbitkan.
- Data mahasiswa (nama, NIM, kelas, kode, laporan) bersifat pribadi. Beri tahu peserta data apa yang dicatat dan untuk apa.
- SQL sudah diuji di PostgreSQL sungguhan lewat PGlite, lengkap dengan aturan keamanannya (`cd tools/uji_sql && npm install && npm run uji`), tetapi **belum dijalankan di proyek Supabase sungguhan**. Skema `auth` dan `storage` di uji itu hanya tiruan. Jalankan di proyek kosong dulu dan laporkan bila ada galat.
