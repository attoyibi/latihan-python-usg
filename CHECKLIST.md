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
- [ ] **SMTP sendiri di Supabase (wajib):** pengirim bawaan hanya 2 email/jam per proyek dan hanya ke anggota tim; batas setelah SMTP sendiri 30/jam, naikkan di Authentication > Rate Limits sebelum hari pertama kelas
- [x] Pesan galat email dibedakan: jeda per alamat ("Tunggu N detik") dan batas proyek ("Batas pengiriman email sedang tercapai"); diuji (`tools/uji_pesan.mjs`, di CI)

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
