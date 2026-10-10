# Checklist Pembangunan Website Latihan Python

*Berkas kerja utama. Dibaca dan diperbarui di awal dan akhir setiap sesi, supaya pekerjaan bisa dilanjutkan kapan saja walaupun sesi sebelumnya terputus.*
*Rujukan: `docs/ANALISIS-DAN-RENCANA.md` (rencana lengkap) dan `docs/RISET-VIDEO-PENGGANTI.md` (video).*

Penanda: `[x]` selesai dan sudah diuji, `[~]` sedang dikerjakan atau sebagian, `[ ]` belum.

## Cara melanjutkan di sesi baru

1. Baca berkas ini, lalu bagian "Catatan sesi" paling bawah.
2. Kerjakan tahap pertama yang masih berisi `[ ]` atau `[~]`.
3. Setelah selesai, centang item, tulis catatan sesi singkat, lalu berhenti di batas tahap.
4. Kode ada di folder `site/` (tanpa langkah build, buka lewat server statis). Cara menjalankan: `python -m http.server 8000` dari dalam folder `site`, lalu buka `http://localhost:8000`.

## Keputusan yang sudah terkunci

- Bahasa: Python saja. 14 bab (bukan 15).
- Mesin eksekusi: **Pyodide** (di browser, di Web Worker, batas waktu 5 detik).
- Editor: **CodeMirror 5** (bukan Monaco, karena Monaco tidak mendukung ponsel dan banyak peserta memakai ponsel).
- Teknologi situs: HTML, CSS, JavaScript biasa. Tanpa framework dan tanpa langkah build, supaya mudah dirawat.
- Database dan login: Supabase (free tier).
- Gerbang: lulus challenge (output cocok setelah spasi di ujung baris dibuang). Bab bebas dilompati, tanpa kunci. Satu challenge wajib per bab.
- Bab 3: peserta mengumpulkan gambar/PDF (flowchart, pseudocode, tabel penelusuran).
- Video: playlist Kelas Terbuka (sembilan bab), sumber lain (bab 3, 9, 12, 13, 14). Celah: penelusuran, Big-O, `match-case`.
- Penjelasan: ringkasan singkat plus tautan ke sub-bab buku.
- Laporan praktikum: lima kolom diketik sendiri, tempel/salin diblokir, kode dan output terlampir. Peserta ekspor **PDF saja** (diunggah sendiri ke sistem universitas). Teks laporan juga tersimpan di sistem.
- Penilaian: log sistem (objektif) ditambah laporan yang Anda nilai manual.
- Rubrik laporan, skala 1 sampai 4: ketepatan konsep, bahasa sendiri, refleksi kendala, kesesuaian dengan kode.
- Data awal peserta: **nama, NIM, kelas.**
- Penyimpanan data: sampai akhir semester, lalu diarsipkan.
- Dashboard instruktur per pertemuan, dengan unduh CSV.
- **Tanpa kunci antar bab.** Semua bab selalu bisa dibuka dalam urutan bebas. Tiga penanda: belum dikerjakan, sedang dikerjakan, selesai (selalu disertai teks, bukan hanya warna).
- **Gaya visual** mengikuti gambar contoh (teal dan hijau, judul tebal bergradasi, kartu mengambang, panel kode gelap). Detail di `docs/DESIGN.md`; semua nilai ada di `site/css/tokens.css`.
- **Semua fitur dibangun di dalam repositori GitHub** supaya orang lain bisa memakainya ulang (kode terpisah dari isi, konfigurasi di berkas, panduan pemasangan). Konektor Supabase dan Cloudflare ditunda; fokus ke GitHub dulu.

## Menunggu keputusan atau tindakan Anda

- [x] Cara masuk peserta: **tautan email** lewat Supabase (tanpa kode yang diketik). Diganti dari kode 6 digit pada 4 Okt 2026 atas permintaan pemilik
- [ ] Membuat proyek Supabase dan memberi saya URL serta anon key. Kunci anon memang dirancang publik, tetapi jangan kirim `service_role` key. (Tahap 3)
- [ ] Memutuskan tempat hosting: Netlify, Vercel, atau GitHub Pages. (Tahap 8)
- [ ] Meninjau soal, test case, dan pertanyaan konsep tiap bab. (Tahap 6)
- [ ] Menonton pilihan video utama. (Tahap 6)

## Tahap 0: Perencanaan

- [x] Membaca buku, README, dan blueprint
- [x] Memetakan 73 video
- [x] Menguji Piston publik (tidak bisa), memilih Pyodide
- [x] Riset video pengganti untuk lima bab
- [x] Mockup layout, laporan, dan dashboard
- [x] Keputusan terkunci (di atas)

## Tahap G: Repositori GitHub dan kemudahan dipakai orang lain

Dikerjakan paralel dengan tahap lain. Skema database ikut disiapkan di sini supaya Anda tinggal menempelnya. Tujuan: orang lain bisa menyalin repositori, mengganti isi, dan menjalankannya sendiri.

- [x] Memutuskan: **publik**, nama `latihan-python-usg`
- [x] Lisensi **MIT** (kode dan isi repositori); teks lengkap buku tidak ikut diterbitkan
- [x] `git init`, `.gitignore`, commit pertama
- [x] Kunci jawaban (`kunci/`) tidak diterbitkan; test case tersembunyi tetap terbaca (diterima untuk latihan)
- [x] `README.md` (tangkapan layar belum ada)
- [x] `docs/PEMASANGAN.md`
- [x] `docs/MENAMBAH-BAB.md`
- [x] `docs/MENGGANTI-TEMA.md`
- [x] Konfigurasi di `site/data/config.json` dan `site/config.js` (URL dan kunci anon Supabase, kosong secara bawaan)
- [~] Skema dan keamanan di `supabase/migrations/0001_skema.sql` dan `0002_keamanan.sql`, plus `jadikan_instruktur.sql` dan `arsip_akhir_semester.sql`. Sintaks diperiksa dengan parser PostgreSQL; **belum dijalankan di database sungguhan**
- [~] Bab 4 menjadi contoh lengkap; belum ada contoh terpisah dari isi asli
- [x] GitHub Actions `ci.yml` (validasi isi, sintaks JS dan SQL) berjalan dan lulus di GitHub. Penayangan otomatis ditunda (Anda sambungkan Cloudflare/Vercel sendiri)
- [x] `CONTRIBUTING.md` (templat issue belum)

Catatan keamanan isi: bila publik, siapa pun bisa membaca soal, test case, dan kunci. Cara aman: simpan `kunci/` di luar repositori publik (atau repositori privat terpisah), dan anggap test case tersembunyi hanya sebagai penghalang ringan. Penilaian yang tidak boleh dicurangi (ujian) butuh server, bukan situs statis.

### Tambahan Tahap G: fork dan penayangan (4 Okt 2026)

- [x] `tools/buat_config.mjs`: membuat `site/config.js` dari `SUPABASE_URL` dan `SUPABASE_ANON_KEY`; menolak `service_role` dan `sb_secret_`, URL tidak valid, dan karakter berbahaya
- [x] `tools/uji_buat_config.mjs`: 14 uji lulus; dijalankan di CI
- [x] `vercel.json`, `netlify.toml`, `site/_headers` (build, folder keluaran, header keamanan, tanpa cache lama)
- [x] README: bagian "Memakai untuk kelasmu" dan tombol Deploy with Vercel
- [x] `docs/PEMASANGAN.md` ditulis ulang (fork sampai tayang) dan `docs/MEMPERBARUI.md`
- [ ] Penayangan sungguhan di Vercel/Cloudflare belum dicoba (pengaturan oleh pemilik); setelan `vercel.json` belum diuji di Vercel
- [ ] Cabang `dev` untuk pratinjau (belum dibuat)

## Tahap L: Landing publik dan masuk lewat tautan (4 Okt 2026)

- [x] Halaman depan publik statis: hero, daftar mata kuliah yang tersedia, cara kerja; tanpa login; Pyodide tidak dimuat untuk pengunjung
- [x] Masuk baru diminta saat memilih mata kuliah (atau menekan Masuk); mata kuliah pilihan diingat dan dibuka setelah masuk (juga setelah kembali dari tautan email yang membuka alamat tanpa #)
- [x] Masuk hanya lewat tautan email: layar "Cek emailmu" dengan kirim ulang (jeda 60 detik) dan ganti email; lanjut sendiri bila tautan dibuka di browser yang sama
- [x] Tautan kedaluwarsa atau sudah dipakai: pesan yang jelas, bukan layar kosong
- [x] Pengguna baru: tautan, data awal (nama, NIM, kelas), langsung ke mata kuliah pilihan. Pengguna lama: langsung ke Dashboard
- [x] Keluar kembali ke halaman depan; halaman bab dan Profil tertutup tanpa login (juga lewat alamat langsung)
- [x] Panduan, Mata kuliah, dan landing terbuka tanpa login; tombol Masuk di header untuk pengunjung
- [x] Server uji (`tools/server_uji.py`) kini meniru email: kotak "Email tiruan" dengan tombol klik tautan (termasuk simulasi tautan kedaluwarsa dan batas email)
- [ ] **Uji dengan email kampus sungguhan**: pemindai keamanan email dapat menghabiskan tautan sekali pakai sebelum peserta mengkliknya. Bila terjadi, aktifkan kembali cadangan kode angka
- [ ] Redirect URL dan Site URL di Supabase harus diisi alamat situs (kini wajib)
- [ ] **Hari pertama kelas (80+ orang):** daftar sebelum pertemuan dari data seluler, kuota harian SMTP cukup, naikkan batas email dan batas per IP, latihan dengan 5 sampai 10 peserta (lihat `docs/PEMASANGAN.md`, bagian Kelas besar)
- [ ] **SMTP sendiri di Supabase (wajib):** pengirim bawaan hanya 2 email/jam per proyek dan hanya ke anggota tim; batas setelah SMTP sendiri 30/jam, naikkan di Authentication > Rate Limits sebelum hari pertama kelas
- [x] Pesan galat email dibedakan: jeda per alamat ("Tunggu N detik") dan batas proyek ("Batas pengiriman email sedang tercapai"); diuji (`tools/uji_pesan.mjs`, di CI)

## Tahap Q: Kelas sebagai pilihan (4 Okt 2026)

Kelas bukan lagi teks bebas: dipilih dari Prodi, Angkatan, dan Kelas agar bisa difilter.

- [x] Tiga pilihan di formulir data awal dan halaman Profil: **Prodi** (mulai dari SI), **Angkatan** (otomatis dari 2024 sampai tahun berjalan, terbaru dulu), **Kelas** (A sampai D). Daftarnya di `site/data/config.json` (`prodi`, `angkatanMulai`, `kelas`)
- [x] Disimpan sebagai `PRODI-ANGKATAN-HURUF`, mis. `SI-2024-A`; wajib lengkap
- [x] Kelas lama (mis. `SI-1A`) tidak hilang: peserta melihat catatan "Kelas lamamu tercatat ..." dan diminta memilih yang baru
- [x] Migrasi `0004_kelas_terstruktur.sql`: kolom turunan `prodi`, `angkatan`, `rombel` dihitung otomatis dari `kelas` (tanpa data ganda), diindeks, dan ikut di `rekap_progres`; tanpa aturan CHECK supaya perintah administrasi tidak gagal pada kelas lama
- [x] `0003` dan `0001` kini aman diulang setelah `0004` (tampilan tidak dikembalikan ke versi lama); diuji (118 uji SQL, termasuk uji sengaja-rusak)
- [x] Skrip impor menolak format kelas lama dengan petunjuk, dan membesarkan huruf kecil
- [x] `periksa_migrasi.sql` memeriksa 0004; panduan "Sudah punya proyek Supabase?" diperbarui
- [ ] Jalankan `0004` di proyek Supabase sungguhan (oleh pemilik) dan pilih ulang kelas di Profil untuk akun yang masih berkelas lama
- [ ] Kelas per mata kuliah (sekarang satu kelas untuk semua) tetap keputusan terbuka

## Tahap P: Masuk dengan email dan kata sandi (4 Okt 2026)

> **Daftar mandiri disembunyikan dan tidak dikembangkan dulu** (keputusan pemilik). Butir Daftar di bawah menunjukkan yang sudah ada dan diuji dengan klien tiruan, bukan pekerjaan lanjutan.

Mengganti masuk lewat tautan email. Alasan: layar masuk tidak lagi langsung meminta email seperti pendaftaran, dan masuk tidak mengirim email sehingga 80 peserta tidak terbentur batas email.

- [x] Layar **Masuk**: email dan kata sandi, tombol tampilkan kata sandi, tautan Lupa kata sandi, tautan ke Daftar (atau catatan "akun dibuat dosen" pada kelas tertutup)
- [x] Layar **Daftar** (pendaftaran mandiri): email, kata sandi, ulangi; aturan minimal 8 karakter dengan huruf dan angka; email konfirmasi dengan kirim ulang; email yang sudah terdaftar terdeteksi; masuk sebelum konfirmasi ditolak dengan tombol kirim ulang
- [x] **Lupa kata sandi**: tautan email, layar atur kata sandi baru; tautan kedaluwarsa memberi pesan jelas
- [x] **Kata sandi awal dari dosen** bertanda wajib ganti: layar "Buat kata sandi baru" menahan semua halaman sampai diganti; kata sandi baru harus berbeda dari yang lama
- [x] `tools/impor_peserta.mjs`: kata sandi awal acak atau dari kolom `sandi`, ditulis ke berkas (tidak ke layar), `--reset-sandi`, tidak mengubah kata sandi akun yang ada saat diulang. Diuji dengan server tiruan (35 uji, peka terhadap perusakan)
- [x] Pesan galat baru (kata sandi salah, belum dikonfirmasi, sudah terdaftar, lemah, sama dengan lama, pendaftaran ditutup); diuji
- [x] Server uji meniru semua alur, dengan akun contoh
- [ ] **Belum diuji dengan Supabase sungguhan:** `signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`, `resend` dan endpoint admin, semuanya baru terhadap klien dan server tiruan
- [ ] Aktifkan kata sandi minimal 8 dan periksa pengaturan Confirm email di Supabase (oleh pemilik)

## Tahap K: Kelas tertutup, peserta didaftarkan dosen (4 Okt 2026)

- [x] Mode `PENDAFTARAN=tutup` (variabel lingkungan, dibuat ke `config.js` oleh `tools/buat_config.mjs`; diuji): tombol Daftar disembunyikan, halaman Daftar menjawab "Pendaftaran ditutup"
- [x] `tools/impor_peserta.mjs`: dari CSV (koma atau titik koma, BOM, nama berkutip) membuat akun (email terverifikasi) dan mengisi profil; simulasi bawaan, `--jalankan` untuk mengirim; aman diulang; peran tidak diubah; menolak kunci publik dan URL tidak aman; kunci tidak dicetak. Diuji dengan server Supabase tiruan (20 uji, peka terhadap perusakan), di CI
- [x] `docs/DAFTARKAN-PESERTA.md` dan `docs/contoh-peserta.csv`; `.gitignore` menolak `peserta*.csv`
- [x] Server uji meniru kelas tertutup (dua peserta terdaftar dengan profil terisi; email lain ditolak; `?terbuka=1` untuk mandiri)
- [ ] **Belum diuji dengan Supabase sungguhan:** endpoint admin (`POST /auth/v1/admin/users`, `GET /auth/v1/admin/users`) dan PostgREST disusun dari dokumentasi resmi, tetapi baru diuji terhadap server tiruan buatan sendiri
- [ ] Matikan "Allow new users to sign up" di Supabase dan set `PENDAFTARAN=tutup` (oleh pemilik)
- [ ] Siapkan CSV 80 peserta dan jalankan `--jalankan` (oleh pemilik; jangan dikirim ke chat atau repositori)

## Tahap M: Banyak mata kuliah (4 Okt 2026)

Satu situs memuat banyak mata kuliah (kode maupun tanpa kode). Sekarang ada dua: Algoritma Python (aktif) dan PBO Java (tempat dan database siap, materi belum).

- [x] Data per mata kuliah: `site/data/matakuliah.json` dan `site/data/kuliah/<id>/{materi.json, challenges/}`
- [x] Pemilih mata kuliah (beranda dan menu Mata kuliah): kartu dengan progres, "Segera hadir" untuk yang belum aktif
- [x] Alamat per mata kuliah: `#k/<id>` dan `#k/<id>/bab-N`; tautan lama `#bab-N` dan `#materi` dialihkan
- [x] Progres terpisah per mata kuliah (kunci `done:<id>:<bab>`), "mata kuliah terakhir" diingat per akun
- [x] Sidebar menampilkan mata kuliah aktif dan tautan "Ganti mata kuliah"
- [x] Bahasa per mata kuliah: sorotan sintaks (Python, Java), starter bebas per bahasa, penjalan hanya bila didukung (Java: tombol dinonaktifkan dengan keterangan)
- [x] Migrasi `0003_matakuliah.sql`: tabel `matakuliah`, kolom `matakuliah_id` di lima tabel, kunci unik per mata kuliah, tampilan `rekap_progres` diperbarui, data lama dipindah ke `algoritma-python`
- [x] `tools/uji_sql`: 0001 sampai 0003 dijalankan di PostgreSQL sungguhan (PGlite) beserta 68 uji keamanan; terbukti peka (7 uji gagal saat aturan sengaja dirusak); masuk CI
- [x] `tools/kuliah_baru.py`: membuat kerangka mata kuliah dan mencetak SQL pendaftarannya
- [x] `tools/validasi_konten.py` dan `tools/uji_kunci.py` memahami banyak mata kuliah
- [x] `docs/MENAMBAH-MATAKULIAH.md`; dokumen lain diperbarui
- [x] Dashboard (beranda) kini berisi pilihan mata kuliah, bukan daftar bab; menu "Beranda" diganti "Dashboard"; sapaan "Halo, <nama>"
- [x] "Bab selesai" dihitung per mata kuliah: kartu mata kuliah (angka dan bilah), halaman mata kuliah, chip di sidebar, dan Profil (daftar per mata kuliah). Statistik dashboard menjumlah semua mata kuliah aktif dengan penyebut yang jelas (mis. 1 dari 16). Diuji dengan satu dan dua mata kuliah aktif
- [ ] **Mesin penjalan Java belum dipilih** (CheerpJ, server eksekusi sendiri, atau layanan berbayar). Riset ulang saat tahap ini dimulai karena kebijakan layanan gratis sering berubah
- [ ] Isi PBO Java: bab, video, soal, kunci (oleh pemilik; alat dan panduan sudah ada)
- [ ] Putuskan: kelas per mata kuliah (sekarang satu data diri untuk semua) dan instruktur per mata kuliah (sekarang satu peran instruktur global)
- [ ] Mata kuliah tanpa kode: unggah berkas (bergantung Tahap 7)
- [x] Panduan memperbarui proyek Supabase yang sudah ada: `supabase/periksa_migrasi.sql` (diuji pada empat keadaan) dan bagian di `docs/PEMASANGAN.md`
- [x] `0001` kini aman dijalankan ulang setelah `0003` (sebelumnya gagal "cannot drop columns from view"); diuji di `tools/uji_sql` (Tahap E, 99 uji)
- [ ] Jalankan `0003` di proyek Supabase sungguhan

## Tahap 1: Kerangka dan prototipe Bab 4

Tujuan: satu bab berjalan penuh di browser (baca ringkasan, lihat video, tulis kode, jalankan, kirim, dapat hasil). Belum ada login atau database. Status sementara disimpan di browser.

- [x] Struktur folder `site/` (index.html, css, js, data)
- [x] `data/materi.json`: 14 bab (judul, ringkasan, tautan buku, video, sumber video)
- [x] Tata letak: sidebar bab, ringkasan, video, editor, panel laporan (hanya tempat; isi di Tahap 2)
- [x] Tata letak responsif untuk ponsel (sidebar menjadi menu geser, panel menjadi tab)
- [~] Terang dan gelap mengikuti perangkat (gaya sudah ada, tampilan gelap belum dilihat)
- [x] Penyemat video YouTube per bab
- [x] Editor CodeMirror 5 dengan sorotan Python
- [x] Pyodide di Web Worker dengan batas waktu 5 detik (perulangan tak berhenti terhenti sendiri)
- [x] Dukungan `input()` dari test case dan dari kotak masukan (mode coba bebas)
- [x] Penilai: banyak test case, sebagian tersembunyi, bandingkan output
- [x] Pesan hasil yang jelas (lulus, test case gagal, error Python ditampilkan)
- [x] Challenge Bab 4 (potongan harga) dengan test case yang sudah diverifikasi di Python
- [x] Petunjuk bertingkat (soal, bagian buku, video)
- [x] Status selesai per bab tersimpan di browser sementara
- [x] Uji di browser: lulus, gagal, error sintaks, infinite loop
- [~] Uji tampilan ponsel (tata letak dan tidak ada geser horizontal sudah diuji di emulasi 375 px; animasi menu geser dan pengetikan di ponsel sungguhan belum diuji)

### Tambahan Tahap 1: desain dan navigasi (4 Okt 2026)

- [x] `DESIGN.md` dan `site/css/tokens.css` (token warna, huruf, radius; terang dan gelap)
- [x] Halaman beranda bergaya contoh (hero, panel kode, kartu mengambang, statistik)
- [x] Halaman Materi (kisi 14 bab), Panduan, dan halaman bab
- [x] Navigasi tanpa kunci; tiga penanda status (belum, sedang, selesai) di sidebar dan kisi
- [x] `data/config.json` untuk nama situs dan mata kuliah
- [ ] Logo final (sementara ikon kurung kode)
- [ ] Tinjau tampilan ponsel sungguhan

## Tahap 2: Laporan dan ekspor PDF

- [ ] Panel laporan lima kolom, terbuka setelah lulus
- [ ] Pertanyaan konsep khusus bab (14 pertanyaan)
- [ ] Blokir tempel, salin, potong, seret, klik kanan
- [ ] Batas minimal karakter dan pesan kesalahan per kolom
- [ ] Penghitung ketikan per kolom
- [ ] Lampiran kode dan output terakhir yang lulus
- [ ] Ekspor PDF (header: nomor materi, materi, nama, NIM, kelas; isi; lampiran; kode verifikasi)
- [ ] Uji PDF memuat teks Indonesia dan kode dengan benar

## Tahap 3: Data awal dan Supabase

- [ ] Proyek Supabase dibuat oleh Anda (lihat daftar tunggu)
- [~] Skema tabel ditulis (`supabase/migrations`) dan diuji di PostgreSQL sungguhan (PGlite); belum dijalankan di Supabase sungguhan
- [~] Row Level Security ditulis dan diuji di PostgreSQL sungguhan (peserta, peserta lain, instruktur, pengunjung); belum diuji di Supabase sungguhan
- [x] Halaman data awal: nama, NIM, kelas (wajib diisi sebelum mengerjakan; validasi; NIM kembar ditolak; bisa diubah di #profil). Diuji dengan klien tiruan
- [x] Masuk lewat tautan email, tanpa kata sandi; kirim ulang dengan jeda 60 detik; sesi bertahan setelah muat ulang. Diuji dengan klien tiruan; **belum dengan Supabase sungguhan**
- [ ] Progres dipindah dari browser ke Supabase (sementara: browser, dipisah per akun)
- [ ] Laporan tersimpan di Supabase
- [ ] Uji dua akun berbeda tidak saling melihat data
- [ ] Uji login sungguhan: templat email memuat kode, SMTP sendiri, Redirect URL (lihat `docs/PEMASANGAN.md`)
- [x] Halaman Profil (menu atas dan klik nama): ubah nama, NIM, kelas; NIM kembar ditolak; ringkasan bab selesai. Diuji dengan klien tiruan
- [x] Bab tertutup sebelum masuk dan sebelum data awal, termasuk lewat alamat langsung; tanpa konfigurasi tampil layar pemasangan (`MODE_LOKAL` hanya untuk uji)
- [x] `tools/server_uji.py`: server uji dengan login tiruan
- [x] Pendaftaran instruktur manual lewat SQL atau Table Editor (`supabase/jadikan_instruktur.sql`: cara email dan NIM, periksa, cabut), diuji di PostgreSQL (82 uji)
- [ ] Instruktur: tautan ke dashboard muncul bila `peran = 'instruktur'`

## Tahap 4: Log aktivitas

- [ ] Durasi aktif (berhenti saat tab tersembunyi atau diam sekitar 60 detik)
- [ ] Jalankan dan kirim: waktu, kode, hasil, test case yang gagal
- [ ] Bantuan: petunjuk, tautan buku, video (lewat YouTube iframe API)
- [ ] Jalur: lulus langsung atau lewat bantuan
- [ ] Laporan: durasi, jumlah ketikan, percobaan tempel yang diblokir
- [ ] Pemberitahuan data apa yang dicatat (halaman masuk)

## Tahap 5: Dashboard dan penilaian

- [ ] Halaman instruktur dilindungi peran
- [ ] Ringkasan per pertemuan: lulus, sedang dicoba, belum mulai
- [ ] Waktu median, percobaan, jalur cepat berbanding video
- [ ] Daftar peserta dengan penanda (macet, tidak aktif, mencurigakan)
- [ ] Antrean penilaian laporan dengan rubrik 1 sampai 4 dan komentar
- [ ] Unduh CSV rekap per pertemuan dan per semester
- [ ] Perbandingan antar pertemuan

## Tahap 6: Isi 14 bab

Tiap bab: ringkasan, tautan sub-bab buku, video, challenge, test case (diverifikasi dengan Python sungguhan), petunjuk bertingkat, pertanyaan konsep.

| Bab | Ringkasan | Video | Challenge | Test case terverifikasi | Pertanyaan konsep | Ditinjau Anda |
|---|---|---|---|---|---|---|
| 1 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 3 (unggah) | [ ] | [ ] | n/a | n/a | [ ] | [ ] |
| 4 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 5 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 6 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 7 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 8 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 9 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 10 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 11 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 12 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 13 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 14 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Tahap 7: Unggah tugas Bab 3

- [ ] Unggah foto/PDF ke Supabase Storage dengan kompresi di browser
- [ ] Daftar centang swa-periksa (sub-bab 3.6)
- [ ] Status terkumpul, disetujui, perlu revisi
- [ ] Peserta dan instruktur saja yang dapat melihat berkas

## Tahap 8: Uji coba dan rilis

- [ ] Uji coba 5 sampai 10 mahasiswa (ponsel dan laptop)
- [ ] Perbaikan hasil uji coba
- [ ] Hosting dan alamat web
- [ ] Pemberitahuan privasi dan lama penyimpanan data
- [ ] Prosedur arsip akhir semester
- [ ] Panduan singkat untuk peserta dan untuk Anda

## Catatan sesi

- **4 Okt 2026:** Tahap 0 selesai. Keputusan terkunci. Editor diganti dari Monaco ke CodeMirror 5 karena Monaco tidak mendukung ponsel. Challenge Bab 4 mengikuti aturan buku: pesanan 100 boks ke atas dapat potongan 12 persen, 50 sampai 99 boks 8 persen, sisanya 0; keluaran `Total tagihan: Rp{...}` (lihat `kode/bab-04/hitung_potongan.py`).
- **4 Okt 2026 (2):** Tahap 1 selesai, kecuali dua butir `[~]` di atas. Berkas di `site/`: `index.html`, `css/style.css`, `js/app.js`, `js/runner.js`, `js/pyworker.js`, `js/grader.js`, `data/materi.json` (14 bab), `data/challenges/bab-04.json`. Kunci jawaban ada di `kunci/bab-04.py` (di luar `site/` supaya tidak ikut diterbitkan). Hasil uji: kode awal 3 dari 7 kasus; solusi benar 7 dari 7; `while True` dihentikan setelah 5 detik; error sintaks tampil. Saat dinilai, teks prompt di `input()` tidak dihitung (hanya keluaran `print` yang dibandingkan); saat Jalankan, prompt ditampilkan. Test case tersembunyi masih terbaca di berkas JSON oleh peserta yang teliti; diterima untuk latihan, bukan ujian. **Berikutnya: Tahap 2 (laporan dan PDF).**
- **4 Okt 2026 (3): Cek penghubung.** GitHub: `gh` sudah masuk sebagai `attoyibi` (izin repo dan workflow), `git` sudah dikonfigurasi, tetapi folder proyek belum menjadi repositori. Supabase: konektor ada di registri tetapi belum terhubung; CLI belum terpasang. Cloudflare: konektor ada di registri tetapi belum terhubung; `wrangler` belum terpasang. Netlify: konektor sudah terhubung (alternatif hosting). Konektor harus diaktifkan oleh Anda dari pengaturan konektor; saya tidak bisa memulai otorisasinya.
- **4 Okt 2026 (4): Desain dan keputusan baru.** Tanpa kunci antar bab (sudah demikian), ditambah tiga penanda status. Gaya visual mengikuti gambar contoh; token di `site/css/tokens.css`. Situs kini punya beranda, Materi, Panduan, dan halaman bab. Fokus pindah ke GitHub: ditambahkan Tahap G. Konektor Supabase/Cloudflare ditunda. Menunggu keputusan: publik atau privat, nama repositori, lisensi.
- **4 Okt 2026 (5): Repositori.** Keputusan: publik, `latihan-python-usg`, MIT; Supabase dan Cloudflare/Vercel disambungkan sendiri oleh pemilik. Ditambahkan: README, LICENSE, panduan di `docs/`, skema SQL di `supabase/`, alat di `tools/`, CI. Pemeriksaan sebelum terbit: tidak ada kunci atau data pribadi (dipindai), `kunci/` diabaikan git. **Belum ada di aplikasi:** semua kode yang memakai Supabase (Tahap 3 dan seterusnya). Berikutnya: Tahap 2 (laporan dan PDF), lalu Tahap 3.
- **4 Okt 2026 (6):** Repositori terbit di https://github.com/attoyibi/latihan-python-usg (publik, MIT). CI lulus pada commit pertama.
- **4 Okt 2026 (7): Masuk dan data awal.** Ditambahkan `site/js/auth.js` dan layar masuk/data awal di `app.js`. Tanpa konfigurasi Supabase situs tetap berjalan mode lokal. Diuji dengan klien tiruan (`tools/klien-tiruan.js`): belum masuk -> masuk -> kode salah/benar -> wajib isi data -> validasi -> NIM kembar -> simpan -> keluar -> pengguna kedua tidak melihat progres pengguna pertama. Peringatan penting untuk Anda: SMTP bawaan Supabase terlalu terbatas untuk 80 peserta, pasang SMTP sendiri; dan edit dua templat email agar memuat `{{ .Token }}`. Berikutnya: sinkron progres ke Supabase (Tahap 3 lanjutan) atau Tahap 2 (laporan).
- **4 Okt 2026 (8): Wajib login dan halaman Profil.** Login kini wajib juga saat Supabase belum dikonfigurasi (layar pemasangan; jalan pintas hanya `MODE_LOKAL: true`). Ditambah menu Profil dengan avatar inisial, email, ringkasan, dan formulir ubah nama/NIM/kelas. Diuji: akses bab lewat alamat langsung sebelum data awal ditolak; ubah ketiga data tersimpan; validasi NIM. Catatan uji: peramban menyimpan cache berkas statis, jadi muat ulang paksa setelah mengubah kode.
- **4 Okt 2026 (9): Fork dan penayangan.** Konfigurasi Supabase kini diisi lewat environment variable saat build, bukan mengedit berkas, sehingga fork tidak bentrok saat Sync. Skrip menolak kunci `service_role` (diuji 14 kasus). Belum diuji di Vercel sungguhan.
- **4 Okt 2026 (10): Banyak mata kuliah.** Situs kini memuat banyak mata kuliah; progres, rute, dan database terpisah per mata kuliah. Algoritma Python aktif; PBO Java hanya tempat (tombol jalankan nonaktif; mesin Java belum dipilih). SQL diuji di PGlite (68 uji, termasuk uji sengaja-rusak). Diuji di browser dengan login tiruan: pemilih, rute, tautan lama, bab tak dikenal, progres terpisah, dan mode Java dengan data uji sementara (sudah dikembalikan). Yang belum: Supabase sungguhan, mesin Java, isi Java. Catatan: pesan 404 Vercel dari sesi sebelumnya belum terjawab (menunggu alamat atau setelan dari pemilik).
- **4 Okt 2026 (11): Dashboard per mata kuliah.** Dashboard menampilkan pilihan mata kuliah dengan progres per mata kuliah; semua keterangan "bab selesai" disesuaikan (kartu, halaman mata kuliah, sidebar, Profil, Panduan). Tafsiran dari permintaan: "dashboard bab" = layar utama yang tadinya daftar bab. Bila yang dimaksud sidebar di halaman bab, itu belum diubah (sidebar tetap daftar bab dari mata kuliah yang sedang dibuka, dengan tautan Ganti mata kuliah).
- **4 Okt 2026 (12): Landing publik dan masuk lewat tautan.** Pengunjung pertama kini melihat halaman depan statis (bukan form login); masuk diminta saat memilih mata kuliah; masuk hanya lewat tautan email (kode angka dihapus); mata kuliah pilihan diingat sepanjang alur. Diuji di browser dengan klien tiruan: kunjungan pertama, pilih mata kuliah, tautan, data awal, langsung ke mata kuliah (dengan alamat kosong seperti tautan asli), keluar, pengguna lama, #masuk saat login, tautan kedaluwarsa, halaman privat tanpa login, dan situs tanpa konfigurasi. Belum diuji dengan Supabase sungguhan dan email sungguhan.
- **4 Okt 2026 (13): Pendaftaran instruktur.** `jadikan_instruktur.sql` kini memakai email (disarankan) atau NIM, plus perintah memeriksa dan mencabut; diuji di PGlite. Yang BELUM ada: layar instruktur di situs (dashboard, penilaian laporan, Tahap 5) dan sinkronisasi progres ke Supabase, jadi saat ini instruktur hanya bisa melihat data lewat dashboard Supabase.
- **4 Okt 2026 (14): Memperbarui Supabase yang sudah ada.** Ditemukan lewat uji: menjalankan ulang `0001` setelah `0003` gagal karena `0001` membuat ulang tampilan `rekap_progres` ke versi lama. Diperbaiki (tampilan hanya dibuat bila belum ada). Ditambah `supabase/periksa_migrasi.sql` agar pemilik bisa memeriksa migrasi mana yang sudah terpasang, dan bagian "Sudah punya proyek Supabase?" di panduan. Berkas `0001` dan `0002` TIDAK berubah isinya yang berdampak pada proyek yang sudah menjalankannya (hanya cara membuat tampilan saat diulang).
- **4 Okt 2026 (15): Galat "Terlalu banyak permintaan email".** Penyebab: batas pengirim email bawaan Supabase (2/jam per proyek, hanya ke anggota tim), bukan galat kode. Panduan SMTP diperjelas dengan angka dari dokumentasi resmi; pesan di situs dibedakan antara jeda per alamat dan batas proyek.
- **4 Okt 2026 (16): Kapasitas kelas besar.** Dari dokumentasi Supabase: klik tautan dan masuk dibatasi 30 per 5 menit per alamat IP, sehingga banyak peserta di satu Wi-Fi kampus bisa terhambat; email proyek 30 per jam setelah SMTP sendiri. Ditambah bagian "Kelas besar" di panduan, pesan untuk batas per IP, dan rencana daftar sebelum pertemuan.
- **4 Okt 2026 (17): Kelas tertutup.** Peserta bisa didaftarkan dosen lewat CSV sehingga mereka tidak mendaftar dan datanya sudah terisi; pendaftaran mandiri bisa ditutup. Skrip impor memakai kunci service_role di komputer pemilik (tidak pernah di chat atau repositori). Diuji dengan server tiruan; endpoint asli belum diuji.
- **4 Okt 2026 (18): Masuk dengan email dan kata sandi.** Atas permintaan pemilik (layar masuk tidak boleh langsung meminta email) masuk lewat tautan diganti email dan kata sandi: Masuk, Daftar, Lupa kata sandi, kata sandi awal wajib ganti untuk akun dari dosen. Keuntungan kapasitas: masuk tidak mengirim email. Batas yang masih berlaku: masuk 30 per 5 menit per IP. Diuji di browser dengan klien tiruan (semua alur) dan di skrip impor dengan server tiruan; belum dengan Supabase sungguhan.
- **4 Okt 2026 (19): Daftar disembunyikan.** Atas permintaan pemilik, fokus ke masuk saja: `PENDAFTARAN` kini bawaan `tutup` (tombol dan halaman Daftar tersembunyi, teks menyebut akun dari dosen). Kode fitur Daftar tidak diubah dan tidak dikembangkan; tetap bisa dinyalakan dengan `PENDAFTARAN=buka`. Penutup sungguhan tetap di Supabase: matikan Allow new users to sign up.
- **4 Okt 2026 (20): Kelas sebagai pilihan.** Prodi, Angkatan (otomatis dari 2024), Kelas (A sampai D) menggantikan kolom teks. Disimpan `SI-2024-A`; kolom turunan di database untuk memfilter; kelas lama tetap aman. Diuji di PostgreSQL (118 uji) dan di browser (kelas lama, kelas baru, validasi, onboarding, tahun otomatis).

## Catatan sesi: soal untuk semua bab Algoritma
- Soal Bab 1, 2, 4-14 (kode, Python) dan tugas Bab 3 (flowchart/pseudocode, `tugas` di materi.json) selesai. Tiap soal adalah variasi kecil dari contoh buku/video, memuat kotak "Belajar dari" (`rujukan`: bab, bagian, halaman, video, clue) dan 3 petunjuk.
- Kunci di `kunci/algoritma-python/` (gitignored); `python tools/uji_kunci.py` lulus 67 dari 67 kasus; `validasi_konten.py` kini mewajibkan `rujukan`.
- Diuji di browser (server uji): kotak rujukan tampil, Bab 3 menampilkan tugas, kunci Bab 10 (baca/tulis berkas) lulus di Pyodide. Soal Bab 11 dan Bab 14 belum dicoba lewat Pyodide.
- Belum: unggah tugas Bab 3 (Tahap 7); nomor halaman per sub-bab selain yang ada di materi.json perlu dicek dosen.
- Kotak "Contoh" (masukan + keluaran harapan dari kasus uji terlihat pertama) di atas editor, dan pembanding setelah Jalankan bila masukan sama dengan kasus terlihat (cocok / selisih baris). Diuji di server uji: kode benar cocok, "5.5" vs "5.50" terdeteksi, masukan lain tanpa pembanding.

## Catatan sesi: mata kuliah PBO (Java)
- Sumber: Buku-Ajar-PBO (15 bab, studi kasus SIP-USG) dan playlist Kelas Terbuka "Belajar Java OOP [Lanjut]" (38 video, id sudah dipetakan ke bab). Bab tanpa video di playlist (UML, Exception, File I/O, JDBC, Swing, SOLID, Design Pattern) memakai video sumber lain berbahasa Indonesia (ditandai "Sumber lain").
- 11 soal kode (Bab 1, 2, 3, 5, 6, 7, 8, 9, 10, 13, 14) berbentuk satu berkas Java dengan kelas Main, masukan lewat Scanner. 4 bab berjenis unggah (Bab 4 UML, 11 JDBC, 12 Swing, 15 proyek) karena butuh gambar, basis data, atau jendela. Kunci di `kunci/pbo-java/bab-NN.java` (gitignored); `tools/uji_kunci.py` kini juga menjalankan kunci Java dengan javac+java: 117 dari 117 kasus cocok (67 Python + 50 Java), diuji dengan JDK sungguhan.
- `matakuliah.json`: pbo-java aktif=true, TETAPI penjalan Java belum ada: tombol Jalankan/Kirim nonaktif dan situs menjelaskannya.
- Penjalan Java SELESAI dan diuji di browser (server uji): CheerpJ 4 di dalam Web Worker + ECJ 3.46.100 (`site/vendor/ecj.jar`) + `JavaRun` buatan sendiri (`site/vendor/javarun.jar`, sumber `tools/java-runner`). Kompilasi/eksekusi pertama ±15 detik, selanjutnya ±0,1 detik. Kesebelas kunci Java lulus semua kasus lewat antarmuka sebenarnya; kode awal gagal; galat kompilasi, pengecualian saat jalan, dan perulangan tak berujung (dihentikan setelah 8 detik, halaman tetap hidup) tertangani. Detail dan batasan (Java 8 sintaks, APPEND tidak jalan, perlu Range) di `docs/PENJALAN-JAVA.md`.
- Bab 10 Java diubah dari "mode tambah" menjadi "baca lalu tulis ulang" karena APPEND tidak bekerja di sistem berkas CheerpJ.
- Belum: uji di Vercel sungguhan (jar dimuat per potongan lewat Range), tingkat bahasa Java di atas 8 (var, record).

## Catatan sesi: sinkron progres dan dashboard instruktur
- Sinkron progres ke Supabase SELESAI (`site/js/sinkron.js`): ringkasan per bab ke tabel `progres` (upsert), tiap kirim jawaban ke `percobaan` (kode dipotong 20.000 karakter), antrean di browser bila gagal, galat data permanen dibuang, antrean dipisah per akun. Saat masuk, progres server digabung dengan browser (ambil yang lebih maju) dan sisa yang hanya ada di browser dikirim. Jalur lulus: `langsung` (tanpa petunjuk) atau `bantuan`.
- Dashboard instruktur SELESAI (`#instruktur`, `site/js/instruktur.js` + `rekap.js`): ringkasan, daftar tersangkut, tabel per bab, tabel peserta x bab, saringan prodi/angkatan/kelas/cari, urutan, CSV. Hanya peran instruktur (tampilan disembunyikan; yang menjaga adalah RLS). Docs: `docs/DASHBOARD-INSTRUKTUR.md`. Tanpa migrasi baru.
- Uji: `uji_rekap.mjs`, `uji_sinkron.mjs` (masuk CI), `uji_sql` Tahap F (144 uji; perintah upsert/insert persis seperti yang dikirim situs, peserta vs instruktur vs anon; mutasi RLS progres_baca terbukti terdeteksi). Di browser (server uji): dosen melihat 28 peserta, saringan dan CSV jalan; peserta tidak melihat tautan dan mendapat "Khusus instruktur"; progres Budi tersimpan lalu dipulihkan setelah penyimpanan lokal dihapus.
- BELUM terbukti di Supabase sungguhan (semua di atas memakai klien tiruan dan PGlite). Belum dilacak: tugas unggah, waktu aktif, laporan.

## Catatan sesi: tata letak halaman bab yang bisa diatur
- `site/js/tata.js`: pegangan geser antara video dan soal (lebar 20 sampai 70 persen, bawaan 38; bisa juga dengan tombol panah, klik dua kali = kembali), pegangan tarik tinggi editor (bawaan 380 px), tombol Sembunyikan/Tampilkan video (iframe dikosongkan saat disembunyikan supaya berhenti diputar), Kembalikan ukuran, dan Mode fokus (soal dan petunjuk di kolom kiri, editor besar di kanan, tanpa video, menu, dan laporan; Esc untuk keluar). "Belajar dari" dan "Contoh" kini bisa dilipat. Semua pilihan diingat di browser (per akun); mode fokus tidak diingat.
- Diuji di browser (server uji): geser dan tarik dengan mouse sungguhan, tersimpan; video tersembunyi bertahan saat pindah bab dan iframe 0; fokus dan Esc; di lebar ponsel pegangan lebar disembunyikan dan tidak ada gulir mendatar; Kirim jawaban dan petunjuk tetap bekerja setelah susunan kartu diubah.

## Catatan sesi: indikator menunggu, salin-tempel dimatikan
- Indikator menunggu (`site/js/kemajuan.js`): spanduk di atas editor "Menyiapkan Java/Python, sisa sekitar N detik" dengan bilah kemajuan dan hitung mundur dari lama muat sebelumnya (disimpan di browser; bawaan Java 22 dtk, Python 9 dtk), teks jujur bila lewat perkiraan; saat Jalankan, hitungan "N dari batas 5/8 detik"; saat Kirim, bilah "Memeriksa kasus i dari n"; bila ditekan sebelum penjalan siap, ada pesan dan hitung mundur menunggu, lalu otomatis jalan. Diuji di browser dengan Java sungguhan (hitung mundur 20 sampai 7 detik, kasus 1 sampai 4).
- Salin, potong, dan tempel dimatikan (`site/js/anticopas.js`) pada kartu latihan: peristiwa paste/drop/copy/cut, Ctrl+V, Shift+Insert, beforeinput (papan ketik layar), dan perubahan CodeMirror berasal tempel; pesan singkat muncul. Jumlah percobaan tempel dicatat ke tabel `aktivitas` (jenis `tempel_diblokir`, tanpa isi), tampil di kolom Tempel dashboard dan CSV. Instruktur dikecualikan. Diuji di browser: semua jalur diblokir, mengetik tetap jalan, instruktur tidak diblokir; 149 uji SQL, `uji_rekap`, `uji_sinkron` diperbarui.
- BELUM: formulir laporan (belum dibuat) wajib memasang `blokirSalinTempel` pada setiap kolom isiannya; dan batasan: hanya hambatan, tidak bisa mencegah mengetik ulang atau memakai perangkat lain.

## Catatan sesi: sinyal keaslian pengerjaan (joki dan cara menulis)
- Migrasi `0005_integritas.sql`: kolom `pola` dan `rekaman` di `percobaan`, tabel `sesi_perangkat` (hanya lewat fungsi `catat_perangkat`, identitas dari sesi), tabel `perangkat_bersama` (hanya instruktur). `periksa_migrasi.sql`, PEMASANGAN, dan arsip akhir semester diperbarui. PERLU DIJALANKAN oleh pemilik di Supabase sungguhan.
- Situs: ID perangkat acak (`perangkat.js`, localStorage + cookie, bukan sidik jari); perekam cara menulis (`rekam.js`): pola (kecepatan, rasio hapus, linier vs lompat, ritme, jeda, jalankan sebelum kirim) dan rekaman padat yang bisa diputar ulang; dikirim bersama tiap kirim jawaban. Spanduk pemberitahuan sekali per akun dan bagian di Panduan.
- Dashboard, tab Sinyal integritas (`integritas.js` analisis murni, `integritas-ui.js` tampilan): 11 jenis sinyal bertingkat dengan alasan kalimat (perangkat dipakai banyak akun, perangkat baru, kecepatan, potongan besar, lurus tanpa koreksi, ritme berubah dari kebiasaan sendiri, tempel, percobaan salah identik, ciri khas sama, lulus serentak), tombol tandai perangkat laboratorium, pemutar ulang cara mengetik, CSV. Tanpa skor tunggal; peringatan "bukan bukti" di halaman.
- Uji: `uji_rekam` (pola, pemadatan, putar ulang berakhir pada kode yang sama persis, ID perangkat), `uji_integritas` (tiap sinyal muncul pada kasus tepat dan TIDAK pada kasus wajar; 5 mutasi sengaja terdeteksi), SQL Tahap G (176 uji; mutasi RLS sesi_perangkat terdeteksi), `uji_sinkron` diperluas. Browser (server uji): daftar sinyal, tandai lab, putar ulang rekaman sampai kode akhir, kirim sungguhan menghasilkan pola dan rekaman, spanduk pemberitahuan.
- BELUM: IP (butuh Edge Function), soal bervariasi per peserta, ambang sinyal belum dikalibrasi dengan data kelas sungguhan (perlu dilihat pada beberapa minggu pertama), semua belum diuji di Supabase sungguhan.

## Catatan sesi: pendaftaran mandiri tanpa email
- Penyebab "daftar dua kali lalu terhenti": batas pengiriman email Supabase (konfirmasi email memakai satu email per peserta). Solusi: matikan "Confirm email" di Supabase dan setel `PENDAFTARAN=buka`; panduan di `docs/PENDAFTARAN-MANDIRI.md`. Kode situs tidak perlu diubah: alur Daftar sudah menangani sesi langsung (perluKonfirmasi false), lalu mengarah ke isi data diri.
- Server uji: `?tanpakonfirmasi=1` meniru konfirmasi dimatikan. Diuji: tiga pendaftaran berturut-turut masing-masing langsung masuk ke "Isi data dirimu dulu" tanpa kotak email, email ganda ditolak dengan pesan jelas.
- BELUM: diuji dengan Supabase sungguhan; captcha Turnstile (belum ada widget di Masuk/Daftar); kode kelas dan daftar peserta (opsional, bila nanti perlu membatasi orang luar).
- Pendaftaran mandiri kini BAWAAN (`PENDAFTARAN` bawaan `buka` di `config.js`, `auth.js`, `buat_config.mjs`; isi `tutup` untuk kelas tertutup). Profil kini juga punya "Ganti kata sandi" (tanpa email). Siklus peserta baru diuji di server uji (`?tanpakonfirmasi=1`): daftar, isi data diri, ubah nama di Profil, ganti kata sandi (validasi lemah dan tidak sama), kata sandi lama ditolak, Lupa kata sandi via tautan tiruan lalu masuk dengan yang baru. BELUM dengan Supabase sungguhan; pemilik perlu mematikan "Confirm email" dan memastikan "Allow new users to sign up" menyala.

## Catatan sesi: ponsel dan pemulihan saat Java/Python gagal dimuat
- `site/js/penjalan.js`: pemantau worker bersama untuk Python dan Java. Mendeteksi skrip gagal diunduh, batas waktu muat (Java 180 dtk, Python 120 dtk), galat fatal, dan worker mati mendadak; menyediakan `ulangi()`; pekerjaan yang sedang berjalan saat worker mati diselesaikan dengan galat (tidak menggantung). Spanduk di atas editor berubah menjadi pesan galat dengan saran dan tombol "Coba lagi" dan "Muat ulang halaman". Kirim dan Jalankan saat gagal memberi pesan jelas; jawaban tidak dihitung sebagai percobaan dan tidak dikirim ke server.
- Ponsel (emulasi 375 px): kepala halaman tidak lagi melebarkan halaman (sebelumnya halaman melebar sampai 480 px di bab); kepala diringkas (status penjalan dan Keluar disembunyikan; ada di spanduk dan Profil); sasaran sentuh minimal 40 px; huruf 16 px pada kolom isian dan editor agar iOS tidak memperbesar; baris kode dilipat; video disembunyikan secara bawaan di layar sempit; spanduk pencatatan dirapikan.
- Uji: `uji_penjalan.mjs` (16 uji, mutasi terdeteksi, tes menggantung dihitung gagal), dan di browser dengan penyuntikan kegagalan di server uji (Java dan Python: gagal, pesan, Coba lagi, pulih, Jalankan berhasil).
- BELUM terbukti: Java dan Python di ponsel sungguhan (iOS Safari, Android lama). Emulasi desktop tidak menguji memori, kecepatan, atau papan ketik layar. Ukuran unduhan awal Java di ponsel belum diukur. Uji di satu atau dua ponsel peserta sebelum kelas.

## Catatan sesi: laporan selalu terbuka, tantangan konsep, penilaian
- Laporan (lima kolom: tujuan, pertanyaan konsep, langkah, kendala, kesimpulan) tidak pernah dikunci; Ekspor PDF (jsPDF dari CDN, dimuat saat ekspor) selalu aktif walau kode gagal atau laporan belum lengkap. Status selalu `draf`, `dikumpulkan_pada` dicatat tiap ekspor, kode verifikasi 8 karakter, tempel diblokir, ketikan nyata dan durasi dicatat.
- Setiap bab punya tantangan: bab teori (Algoritma 3; PBO 4, 11, 12, 15) berjenis `konsep` (`site/js/konsep.js`): lulus 70 persen, ulang tanpa batas, pilihan diacak, kunci tampil setelah lulus, hasil ikut sinkron dan masuk dashboard.
- Dashboard instruktur: tab "Laporan" dengan rubrik 1 sampai 4 (`penilaian.js`, `laporan-ui.js`, tabel `penilaian_laporan`), CSV. Terverifikasi di browser dengan klien tiruan; uji: uji_konsep, uji_penilaian, uji_laporan, tes SQL 196.
- BELUM: Supabase sungguhan; tampilan ponsel komponen konsep/laporan; uji PDF di ponsel; uji integritas untuk percobaan konsep identik.

## Catatan sesi: kehadiran dan keaktifan
- Migrasi `0006_kehadiran.sql` (hanya menambah): jam server `diterima_pada` (dipaksa trigger, data lama dibiarkan kosong), tabel `sesi_belajar` (ditulis hanya lewat `catat_denyut`, tambahan waktu dibatasi waktu nyata server), `jadwal_kelas`, `jadwal_riwayat`, `koreksi_kehadiran` (hanya instruktur). Diuji di harness SQL (234 uji, termasuk di atas data lama).
- `site/js/kehadiran.js` (logika murni, 89 uji, mutasi terdeteksi), `pencatat.js` dan `sesi.js` (pencatat sesi; aktif = tab terlihat dan ada gerakan dalam 90 detik; akun instruktur tidak dicatat; 22 uji), `kehadiran-ui.js` (tab dashboard).
- Aturan: siap sebelum kelas = mengerjakan dalam 6 hari sebelum jam mulai; bila pencatatan sesi sudah berjalan sejak jendela dimulai juga aktif minimal 20 menit. Hadir = siap. Libur dan koreksi manual diperhitungkan. Mengubah jadwal pertemuan yang sudah berlangsung meminta konfirmasi dan menampilkan dampaknya.
- Pemberitahuan ke peserta diperbarui (info bar `info-pencatatan-2` dan Panduan): jam dan lama aktif dicatat untuk kehadiran dan keaktifan.
- BELUM: Supabase sungguhan; impor kehadiran SIAKAD (format CSV belum diketahui); tampilan Langsung memakai muat ulang manual, bukan pembaruan otomatis; menonton video YouTube tidak terukur; uji di ponsel peserta sungguhan.

## Catatan sesi: jejak peserta dan riset perilaku
- Migrasi `0007_riset_perilaku.sql` (hanya menambah): kolom hasil, galat_jenis, galat_pesan, cocok_contoh, petunjuk pada `percobaan` (baris Jalankan memakai kolom jenis yang sudah ada); persetujuan penelitian di `profiles` (riset_setuju, riset_setuju_pada, kode_riset dibuat otomatis dan tidak bisa diubah peserta); `riset_ekspor_log` (hanya tambah, hanya instruktur). Uji SQL 265, termasuk di atas data lama.
- Setiap tombol Jalankan kini dicatat (kode, hasil, jenis galat dari `galat.js`, cocok dengan contoh, petunjuk, pola menulis, dan rekaman kecil via `rekam.lihat()` yang tidak memutus rantai rekaman Kirim). Keluaran program tidak disimpan.
- Sinkron: baris percobaan dikirim per sepuluh; antrean offline dibatasi 300 baris (Jalankan terlama dibuang dulu); bila database belum punya kolom baru, Kirim tetap terkirim tanpa kolom itu dan Jalankan dilewati (tidak macet).
- Tab Jejak peserta (`jejak.js`, `jejak-ui.js`, `putar-ui.js`): daftar semua peserta, riwayat dengan kolom bisa dipilih (diingat di browser), putar ulang per baris dari awal bab atau hanya langkah itu (`gabungRekaman`). Tab Riset (`riset.js`, `riset-ui.js`): kohort dan ekspor anonim (kode_riset, hari ke-n, tanpa nama NIM kelas), kamus data, riwayat ekspor.
- Persetujuan penelitian: pertanyaan sekali di halaman bab dan pilihan di Profil; menolak atau belum menjawab = tidak ikut ekspor; tidak berpengaruh ke nilai.
- Uji: uji_galat 23, uji_jejak 33, uji_riset 37, uji_rekam, uji_sinkron (baris Jalankan, batch, cadangan tanpa kolom baru, batas antrean).
- BELUM: Supabase sungguhan; izin etik dan nomor persetujuan etik (urusan peneliti); buka buku dan video belum tercatat per kejadian; petunjuk tercatat sebagai tingkat pada tiap baris, bukan kejadian bertanda waktu sendiri; analisis statistik lanjutan (hanya deskriptif); uji di ponsel peserta sungguhan.

## Catatan sesi: bulan dan semester
- Tab Aktivitas: Per bulan dan Semester (periode otomatis dari jadwal kelas lewat `periodeSemester`, `daftarMinggu`, `daftarBulan`, `ringkasRentang`, `kurvaMingguan`, `rataRingkas`, `csvSemester` di `kehadiran.js`; tanpa tabel baru). Daftar dan kalender, urut kolom, rata-rata per kelas, CSV, kurva mingguan di rincian peserta.
- Sesi yang melewati tengah malam kini dihitung pada hari ia dimulai (sebelumnya terhitung aktif di dua hari). Waktu Jalankan dicatat terpisah di `kejadian.jalan`.
- Perbaikan: urutan nama pada klik pertama di Jejak peserta dan Semester kini A ke Z. Uji kehadiran 111.

## Praktikum proyek berantai (migrasi 0008)

- [x] Migrasi `0008_praktikum.sql` (hanya menambah empat tabel; RLS peserta mengelola miliknya, instruktur membaca; jam server; batas 40 berkas); uji PGlite pada data lama
- [x] Penguji Python bersama browser dan CPython (`praktikum_harness.py`), diuji 117 kasus dengan Python sungguhan (`tools/uji_praktikum.py`)
- [x] (diganti) Praktikum proyek Kasir berantai dihapus; diganti praktik per bab mandiri (lihat bagian di bawah)
- [x] Halaman mata kuliah (bagian Praktikum, tanda Ada praktik), notifikasi di bab, daftar tahap, ruang kerja berkas, riwayat versi, laporan 3 kolom dan PDF, ekspor satu halaman HTML
- [x] Tab Praktikum di dashboard dosen (matriks, per tahap, lihat berkas, CSV)
- [x] Diuji di browser (Pyodide nyata, ekspor HTML dengan `input()`, ponsel 375 px, tanpa migrasi 0008, PBO tidak berubah)
- [ ] Belum diuji di Supabase sungguhan dan ponsel sungguhan; jalur laptop, jalur ponsel, dan praktikum Java belum ada

## Jawab otomatis untuk instruktur (migrasi 0009)

- [x] Migrasi `0009_kunci_jawaban.sql`: tabel hanya dibaca instruktur, tanpa tulis lewat API; uji PGlite (337 uji)
- [x] `tools/buat_sql_kunci.py` membuat `kunci/kunci_jawaban.sql` dari kunci lokal (24 kunci; folder kunci/ tidak terbit)
- [x] Tombol *Isi kunci (instruktur)* di soal kode Python dan Java, soal konsep, dan praktikum; diuji di browser
- [ ] Setelah dipush: jalankan 0009 lalu `kunci/kunci_jawaban.sql` di Supabase SQL Editor

## Praktik per bab (menggantikan praktikum proyek berantai)

- [x] Praktik mandiri satu berkas di 13 bab kode Algoritma (bab 1, 2, 4 sampai 14); contoh jawaban tidak ada di situs (tabel `kunci_jawaban`, nomor 50 + bab)
- [x] Kartu Praktik mengecil secara default di halaman bab; titik kecil di sudut lingkaran status (lingkaran hijau latihan tidak berubah)
- [x] Lampiran PDF laporan bab memuat kode latihan dan kode praktik; tab Praktik di dashboard dosen dengan kode peserta
- [x] Dihapus: ruang praktikum, daftar tahap, penjelajah berkas, ekspor HTML, laporan praktikum terpisah, proyek Kasir
- [x] Praktik PBO (Java) dalam format yang sama: 11 praktik `Main.java`, diuji dengan JVM sungguhan (`tools/uji_praktik_java.mjs`) dan di CheerpJ

## Praktikum Java (PBO): sebagian ditunda

Catatan: bagian ini dibangun di atas ruang praktikum lama yang sudah dihapus. Latihan per bab sudah digantikan praktik per bab (lihat bagian Praktik per bab). Yang masih berupa data dan penjalan tanpa tampilan: **tugas akhir** (ruang kerja multi-berkas, unggah laptop, rubrik, dashboard) dan penjalan Java multi-berkas.


- [x] JavaRun menerima paket beberapa berkas `.java` sekaligus (`tools/java-runner/JavaRun.java`, jar dibangun ulang); mode satu `Main.java` untuk soal bab tetap bekerja
- [x] Penyusun pekerjaan dan pembaca hasil (`site/js/praktikum-java.js`), kelas penguji `Uji`, dan `runProyekJava`; terbukti di CheerpJ nyata (baca-tulis berkas, batas waktu perulangan tak berujung, kode Swing dan JDBC dapat dikompilasi)
- [x] 10 latihan mandiri per bab (20 tahap) dengan contoh dan kerangka; diuji dengan JVM sungguhan (`node tools/uji_praktikum_java.mjs`)
- [x] Tugas akhir: ruang kerja multi-berkas, unggah dari laptop, periksa kompilasi, penanda kelengkapan otomatis, laporan, ekspor kode, dinilai dosen (`docs/RUBRIK-PBO.md`)
- [x] Kunci jawaban: latihan per bab (contoh di JSON), tugas akhir (tabel `kunci_jawaban` bab 99, `kunci/pbo-java/tugas-akhir.json`), tombol Jawab otomatis (instruktur) termasuk Jawab semua praktikum
- [x] Dashboard: ringkasan semua praktikum, lihat berkas, penanda kelengkapan, laporan, jumlah unggah
- [ ] Belum diuji di Supabase sungguhan dan ponsel sungguhan; GUI/JDBC tidak dapat dijalankan di browser

## Laporan akhir satu PDF

- [x] Kartu Laporan akhir di halaman mata kuliah: form akhir 3 kolom (tersimpan di `praktikum_laporan`, `praktikum_id = akhir`) dan ekspor PDF gabungan semua bab (status, kode latihan, kode praktik, refleksi bab)
- [x] Tab Laporan akhir di dashboard dosen: ringkasan per peserta, buka laporan lengkap di layar, unduh PDF dan CSV
- [x] Diuji: 27 uji paket dan blok PDF, termasuk tabel yang belum ada; di browser (ekspor PDF, tab dosen)
- [ ] Belum diuji di Supabase sungguhan (kueri `percobaan` dan `praktikum_*` besar), dan di ponsel sungguhan

## Praktik: Bagian A dan B

- [x] Kartu praktik dua bagian: A terbimbing, B kembangkan (program dasar yang sudah jalan, tanpa `____`); titik hijau hanya bila A dan B lulus (tanpa migrasi: `p01` dan `p02`)
- [x] Bagian B untuk semua bab berpraktik: Algoritma 13 bab (Python) dan PBO 11 bab (Java, `MainB.java`); jawabannya di `kunci/` dan `kunci_jawaban` nomor 70 + bab; validator, uji Python, dan uji JVM memeriksanya
- [x] Laporan bab, laporan akhir, dan dashboard dosen memuat kode dan status A dan B
- [ ] Kesetaraan kesulitan Bagian B dengan Tantangan perlu dilihat dari kelas (waktu pengerjaan dan banyaknya yang tersangkut)

## Dashboard dosen: tantangan dan praktik dalam satu tabel

- [x] Tab Progres: titik kecil praktik di tiap sel (hijau bila A dan B lulus), kolom Praktik lulus dan sedang di tabel Per bab, kartu ringkasan, dan penyaring "Tampilkan peserta yang belum ... di bab ..." (tantangan, praktik, atau salah satunya)
- [x] Diuji: logika penyaring (6 uji) dan di browser (titik, kolom, filter, pesan bila migrasi 0008 belum ada)
