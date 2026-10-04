# Pemasangan dari nol (fork sampai tayang)

Situs ini statis (HTML, CSS, JavaScript). Tanpa server sendiri. Anda hanya butuh tiga akun gratis: **GitHub**, **Supabase**, dan **Vercel** (atau Cloudflare Pages / Netlify).

Prinsipnya: **Anda tidak mengedit berkas apa pun di repositori.** URL dan kunci Supabase diisi sebagai *environment variable* di layanan penayangan, lalu dipasang otomatis saat build. Dengan begitu tombol *Sync fork* tidak pernah bentrok (lihat [MEMPERBARUI.md](MEMPERBARUI.md)).

> Status: situs, banyak mata kuliah, masuk, data awal, dan profil sudah ada. Alur masuk sudah diuji dengan klien tiruan, **belum dengan Supabase sungguhan**. Simpan progres ke database, laporan, dan dashboard belum ditulis; lihat [CHECKLIST.md](../CHECKLIST.md).

## Ringkasan 15 menit

1. **Fork** repositori ini di GitHub (tombol *Fork*).
2. **Supabase:** buat proyek, tempel tiga berkas SQL, atur email (bagian A).
3. **Vercel:** *Add New Project* > pilih fork Anda > isi dua variabel > *Deploy* (bagian B).
4. Kembali ke Supabase, isi *Site URL* dengan alamat dari Vercel (bagian A, langkah 8).
5. Masuk ke situs, isi data awal, lalu jadikan diri Anda instruktur (bagian C).

## A. Supabase

1. Buat proyek di supabase.com (paket gratis cukup untuk sekitar 80 peserta). Pakai proyek **khusus** untuk situs ini.
2. **SQL Editor** > *New query* > tempel isi `supabase/migrations/0001_skema.sql` > **Run**.
3. *New query* lagi > tempel isi `supabase/migrations/0002_keamanan.sql` > **Run**. Ini mengaktifkan aturan keamanan (Row Level Security) dan bucket privat `tugas`.
4. *New query* lagi > tempel isi `supabase/migrations/0003_matakuliah.sql` > **Run**. Ini menambah dukungan banyak mata kuliah (Algoritma Python dan PBO Java sudah terdaftar). Sudah menjalankan 0001 dan 0002 sebelumnya? Cukup jalankan 0003; data yang sudah ada otomatis dimasukkan ke mata kuliah `algoritma-python`.
5. **Authentication > Sign In / Providers > Email:** pastikan *Email* aktif (peserta masuk dengan **email dan kata sandi**). Atur panjang kata sandi minimum (*Minimum password length*) ke **8**, sama dengan aturan di situs.
6. **Konfirmasi email.** Untuk **kelas tertutup** (peserta didaftarkan dosen, lihat [DAFTARKAN-PESERTA.md](DAFTARKAN-PESERTA.md)) pendaftaran mandiri dimatikan, jadi pengaturan ini tidak berpengaruh. Untuk **pendaftaran mandiri**, biarkan *Confirm email* aktif supaya tiap pendaftar membuktikan emailnya (satu email per pendaftar). Bila dimatikan, siapa pun bisa membuat akun dengan email orang lain.
7. **Periksa templat email** di **Authentication > Email Templates**: *Confirm signup* dan *Reset Password* harus memuat tautan `{{ .ConfirmationURL }}`. Templat bawaan sudah memuatnya. Contoh minimal bila ingin menyesuaikan kalimat:

   ```html
   <h2>Latihan Pemrograman</h2>
   <p><a href="{{ .ConfirmationURL }}">Klik di sini</a> untuk melanjutkan. Tautan hanya berlaku satu kali.</p>
   ```

8. **Authentication > URL Configuration (wajib):** isi *Site URL* dengan alamat situs setelah tayang, dan tambahkan alamat yang sama ke *Redirect URLs*. Tautan di email konfirmasi dan atur ulang kata sandi membawa peserta kembali ke situs; bila tidak diisi, tautannya mengarah ke alamat yang salah (mis. `localhost`). Untuk menguji dari komputer sendiri, tambahkan juga `http://localhost:8000`.
9. **Pasang SMTP sendiri (sangat disarankan).** Masuk dengan kata sandi **tidak** mengirim email, tetapi *konfirmasi pendaftaran* dan *Lupa kata sandi* mengirim email. Menurut dokumentasi Supabase, pengirim email bawaan:
   - dibatasi **2 email per jam untuk seluruh proyek** (bukan per peserta), dan angkanya bisa berubah tanpa pemberitahuan;
   - **hanya mengirim ke anggota tim proyek**. Peserta yang bukan anggota tidak akan menerima email apa pun;
   - tidak dijamin ketersediaannya dan hanya untuk uji coba.

   Pada kelas tertutup dengan akun dari dosen, SMTP hanya dibutuhkan bila ada peserta yang lupa kata sandi. Pada pendaftaran mandiri, SMTP wajib karena setiap pendaftar butuh email konfirmasi.

   Caranya: **Project Settings > Authentication > SMTP Settings**, aktifkan *Enable Custom SMTP*, lalu isi `host`, `port`, `user`, `password`, alamat pengirim, dan nama pengirim dari layanan email pilihan Anda. Layanan yang disebut dokumentasi Supabase: Resend, AWS SES, Postmark, SendGrid, ZeptoMail, dan Brevo. Periksa sendiri batas paket gratis dan syarat verifikasi domain atau pengirim di layanan itu. Setelah SMTP sendiri aktif, batas bawaan Supabase menjadi **30 email per jam**; naikkan di **Authentication > Rate Limits** bila perlu.
10. Catat dua nilai dari **Project Settings > API**: **Project URL** dan kunci **anon** (atau *publishable*).

> **Jangan pernah** memakai kunci `service_role` atau `sb_secret_...`. Kunci itu melewati semua aturan keamanan database. Skrip pembangun akan **menolak** kunci itu dan membatalkan penayangan.

## Sudah punya proyek Supabase? Perbarui, jangan mulai dari nol

Tidak perlu membuat proyek baru dan tidak perlu menghapus apa pun. Migrasi bersifat menambah dan aman untuk data yang sudah ada.

1. Di **SQL Editor**, jalankan `supabase/periksa_migrasi.sql`. Hasilnya satu baris dengan tiga kolom:

   | `0001_skema` | `0002_keamanan` | `0003_matakuliah` | Yang perlu dijalankan |
   |---|---|---|---|
   | false | false | false | `0001`, lalu `0002`, lalu `0003` |
   | true | true | false | **hanya `0003`** |
   | true | true | true | tidak ada, sudah mutakhir |

2. Jalankan hanya migrasi yang masih `false`, **berurutan** (0001, 0002, 0003), masing-masing di query baru.
3. Menjalankan ulang migrasi yang sudah terpasang juga aman (sudah diuji, termasuk menjalankan ulang `0001` dan `0002` setelah `0003`), tetapi tidak perlu.
4. Pastikan setelahnya `supabase/periksa_migrasi.sql` menunjukkan ketiganya `true`.

Data yang sudah ada (profil peserta, dan progres atau laporan bila sudah ada) tidak hilang. Data lama dari sebelum `0003` otomatis dianggap milik mata kuliah `algoritma-python`.

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
   | `PENDAFTARAN` (opsional) | `tutup` bila peserta didaftarkan dosen (lihat [DAFTARKAN-PESERTA.md](DAFTARKAN-PESERTA.md)); bawaan `buka` |

4. **Deploy.** Bila kunci yang dipakai ternyata `service_role`, build dibatalkan dengan pesan yang menjelaskan sebabnya. Bila variabel dikosongkan, situs menampilkan layar "belum tersambung ke Supabase".

### Cloudflare Pages
*Create project > Connect to Git* > pilih fork. **Build command:** `node tools/buat_config.mjs`. **Build output directory:** `site`. Tambahkan dua variabel yang sama di *Settings > Variables and Secrets* (untuk *Production* dan *Preview*).

### Netlify
*Add new site > Import from Git* > pilih fork. Setelan dibaca dari `netlify.toml`. Tambahkan dua variabel yang sama di *Site configuration > Environment variables*.

### Tombol sekali klik
Tombol *Deploy with Vercel* di README membuat **salinan** repositori (bukan fork) dan langsung meminta kedua variabel. Praktis, tetapi salinan itu tidak terhubung ke repositori asal sehingga tidak ada *Sync fork*. Untuk yang ingin menerima pembaruan, pakai fork.

## C. Setelah tayang

1. Buka situs, masuk dengan email Anda, dan isi nama, NIM, dan kelas.
2. **Jadikan diri Anda (dan dosen lain) instruktur.** Pendaftaran instruktur dilakukan manual di Supabase, bukan dari situs: orang itu masuk ke situs dan mengisi data awal dulu, lalu Anda menjalankan `supabase/jadikan_instruktur.sql` di SQL Editor (ganti `GANTI_DENGAN_EMAIL_ANDA` dengan emailnya), atau cukup ubah kolom `peran` menjadi `instruktur` di Table Editor > `profiles`. Berkas yang sama memuat cara memeriksa dan mencabutnya. Hanya ada dua peran: `peserta` dan `instruktur`.
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
- **Masuk baru diminta saat memilih mata kuliah.** Layar **Masuk** memakai **email dan kata sandi** (dengan tombol tampilkan kata sandi). Mata kuliah yang tadi dipilih diingat, jadi setelah masuk peserta langsung diarahkan ke sana.
- **Daftar (pendaftaran mandiri):** email dan kata sandi, lalu email konfirmasi yang harus diklik. Setelah itu peserta mengisi **nama, NIM, dan kelas** satu kali. Data tersimpan di tabel `profiles`, NIM tidak boleh kembar, dan bisa diubah di halaman **Profil**.
- **Lupa kata sandi:** peserta meminta tautan atur ulang lewat email, mengkliknya, lalu membuat kata sandi baru.
- **Kelas tertutup (opsional, disarankan untuk kelas besar):** dosen mendaftarkan peserta lewat `tools/impor_peserta.mjs` dengan **kata sandi awal**, dan pendaftaran mandiri ditutup (`PENDAFTARAN=tutup`). Peserta tidak mendaftar dan datanya sudah terisi; saat pertama masuk mereka **wajib membuat kata sandi baru**. Panduan: [DAFTARKAN-PESERTA.md](DAFTARKAN-PESERTA.md).
- **Keluar** mengembalikan peserta ke halaman depan.
- Halaman bab dan Profil tertutup sampai peserta masuk, juga bila alamatnya diketik langsung.
- Bila `SUPABASE_URL` dan `SUPABASE_ANON_KEY` kosong, halaman depan tetap tampil, tetapi memilih mata kuliah menampilkan layar "belum tersambung ke Supabase". `MODE_LOKAL=true` (variabel opsional) menjalankan situs tanpa akun, hanya untuk uji tampilan; jangan dipakai saat tayang.
- Progres di browser dipisah per akun, jadi komputer bersama (warnet, lab) tidak bercampur.
- Mesin Python di browser (sekitar 10 MB) hanya dimuat setelah peserta masuk, bukan untuk pengunjung halaman depan.

### Hal yang perlu diperhatikan

- Tautan di email (konfirmasi dan atur ulang kata sandi) berlaku **satu kali**. Email kampus yang memakai pemindai keamanan (mis. Safe Links) dapat membuka tautan lebih dulu sehingga muncul pesan "kedaluwarsa atau sudah dipakai". Untuk pendaftaran mandiri, uji dengan email kampus yang dipakai peserta. Untuk akun dari dosen hal ini hampir tidak relevan, karena masuk tidak memakai tautan.
- Kata sandi disimpan oleh Supabase (di-hash), tidak pernah oleh situs ini. Situs hanya meneruskannya sekali ke Supabase.
- Peserta yang lupa kata sandi dan emailnya tidak menerima apa pun dapat dibantu dosen: jalankan `tools/impor_peserta.mjs ... --reset-sandi` untuk mengatur ulang kata sandinya.

## Kelas besar: hari pertama dengan banyak peserta (80 orang atau lebih)

Keuntungan masuk dengan kata sandi: **masuk tidak mengirim email**. Pada kelas tertutup dengan akun dari dosen, hampir tidak ada email sama sekali (hanya bila ada yang lupa kata sandi). Angka di bawah dari dokumentasi Supabase dan situs layanan masing-masing pada 4 Oktober 2026; periksa lagi sebelum memakainya, karena bisa berubah.

| Batas | Nilai bawaan | Berlaku untuk | Dampak bila 80 orang serentak |
|---|---|---|---|
| Masuk dan daftar | 30 per 5 menit | **per alamat IP** | Peserta di satu Wi-Fi kampus berbagi satu IP: hanya 30 masuk per 5 menit, sisanya ditolak sementara |
| Email (pengirim bawaan Supabase) | 2 per jam, hanya ke anggota tim | seluruh proyek | Konfirmasi dan atur ulang kata sandi tidak terkirim ke peserta |
| Email (SMTP sendiri) | 30 per jam | seluruh proyek | Berlaku bila banyak yang mendaftar mandiri atau lupa kata sandi bersamaan |
| Kuota harian layanan SMTP | contoh: Resend gratis 100 per hari | akun layanan email | Relevan untuk pendaftaran mandiri 80 orang |

Batas masuk dan daftar tercantum "dapat diatur" di dokumentasi Supabase (**Authentication > Rate Limits**). Saya belum memastikan apakah paket gratis mengizinkan mengubahnya; periksa di dashboard Anda.

### Rencana yang disarankan

1. **Pakai kelas tertutup:** daftarkan peserta lewat CSV ([DAFTARKAN-PESERTA.md](DAFTARKAN-PESERTA.md)). Tidak ada email konfirmasi, tidak ada tahap isi data, dan hari pertama hanya berupa masuk dengan kata sandi.
2. **Hindari masuk serentak dari satu Wi-Fi.** Karena batas 30 per 5 menit per IP, bagi peserta menjadi kelompok sekitar 25 orang yang masuk bergantian, atau minta mereka **masuk sebelum pertemuan** dari ponsel dengan data seluler (IP berbeda). Sesi tersimpan di browser, jadi masuk hanya sekali.
3. **Pasang SMTP sendiri** untuk jaga-jaga: peserta yang lupa kata sandi butuh email atur ulang.
4. **Siapkan cadangan:** simpan berkas kata sandi awal (aman) untuk membantu peserta yang lupa, atau atur ulang dengan `--reset-sandi`.
5. **Latihan dulu.** Seminggu sebelum semester, ajak 5 sampai 10 peserta masuk sungguhan, termasuk pergantian kata sandi awal.

### Yang akan peserta lihat
- Kata sandi atau email salah: "Email atau kata sandi salah."
- Batas per alamat IP: "Terlalu banyak orang mencoba masuk dari jaringan yang sama pada saat ini. Tunggu beberapa menit lalu coba lagi, atau pakai data seluler."
- Batas email proyek: "Batas pengiriman email sedang tercapai, jadi email belum bisa dikirim. Coba lagi sekitar satu jam lagi, atau hubungi dosen."
- Jeda per alamat email: "Tunggu N detik sebelum meminta lagi."

## Akhir semester

Kebijakan: data peserta disimpan sampai akhir semester lalu diarsipkan. Ikuti urutan di `supabase/arsip_akhir_semester.sql` (unduh dulu, hapus belakangan).

## Hal yang perlu diperhatikan

- **Proyek Supabase gratis dijeda bila lama tidak aktif** (tidak ada permintaan selama sekitar seminggu). Buka dashboard dan aktifkan kembali sebelum semester dimulai.
- Penilaian jawaban terjadi di browser, jadi peserta yang mahir secara teori bisa memalsukannya. Cukup untuk latihan, **tidak untuk ujian**.
- Soal dan test case ada di repositori publik. Kunci jawaban sebaiknya disimpan di `kunci/` yang tidak diterbitkan.
- Data mahasiswa (nama, NIM, kelas, kode, laporan) bersifat pribadi. Beri tahu peserta data apa yang dicatat dan untuk apa.
- SQL sudah diuji di PostgreSQL sungguhan lewat PGlite, lengkap dengan aturan keamanannya (`cd tools/uji_sql && npm install && npm run uji`), tetapi **belum dijalankan di proyek Supabase sungguhan**. Skema `auth` dan `storage` di uji itu hanya tiruan. Jalankan di proyek kosong dulu dan laporkan bila ada galat.
