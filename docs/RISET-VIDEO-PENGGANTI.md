# Riset: Video Pengganti untuk Bab yang Kosong di Playlist

*Catatan riset, 4 Oktober 2026. Bagian dari rencana website latihan (lihat `ANALISIS-DAN-RENCANA.md` di folder yang sama). Belum ada website.*

## Cara riset dan batasannya

- Pencarian dilakukan di YouTube dengan kata kunci bahasa Indonesia. Setiap kandidat diperiksa langsung: **judul, channel, durasi, jumlah tayang, tanggal unggah, dan apakah boleh disematkan (embed).** Semua kandidat di bawah ini boleh disematkan.
- **Isi video belum saya tonton.** Penilaian "mudah dipahami" saya dasarkan pada judul, durasi, channel, dan jumlah tayang. Jumlah tayang tinggi bukan jaminan mutu. Anda perlu menonton sekilas pilihan utama sebelum dipasang.
- Kriteria pilihan: bahasa Indonesia, durasi pendek (idealnya di bawah 25 menit per video), Python bila bisa, boleh disematkan, dan sebisanya satu channel per bab supaya suara pengajarnya konsisten.
- Total tontonan per bab dijaga kecil (sekitar 20 sampai 40 menit), karena video hanya bantuan, bukan gerbang.

## Keputusan dari diskusi

| Hal | Keputusan |
|---|---|
| Bab tanpa video di playlist (3, 9, 12, 13, 14) | Cari sumber lain berbahasa Indonesia yang mudah dipahami (hasilnya di bawah). |
| Bab yang bukan koding (Bab 3) | Peserta **mengumpulkan gambar/berkas** (flowchart dan pseudocode), boleh digambar di buku, kertas, atau aplikasi. Yang penting terkumpul. |
| Bab lainnya | Tetap coding challenge. Peserta menulis kode terkait materi bab. |
| Penjelasan di halaman | Hanya **ringkasan** yang cukup untuk mulai coding, ditambah **tautan ke bagian buku yang spesifik** (sub-bab) untuk bacaan lengkap. |

## Hasil per bab

Setiap bab diberi satu **pilihan utama** dan satu sampai dua **cadangan**.

### Bab 3: Flowchart, pseudocode, penelusuran

| Peran | Video | Channel | Durasi | Tayang | Unggah | Catatan |
|---|---|---|---|---|---|---|
| Utama (pseudocode) | [Mengenal Pseudocode](https://www.youtube.com/watch?v=Qf4Npdwar_s) | CodePolitan | 3,9 mnt | 24 ribu | 2020 | Sangat singkat, cocok sebagai pengantar. |
| Utama (flowchart perulangan) | [Algoritma - Flowchart Looping & Contoh Sehari-hari](https://www.youtube.com/watch?v=ld6F5qCg84o) | Blank Stuck | 9,8 mnt | 17 ribu | 2020 | Contoh sehari-hari, mudah diikuti. |
| Cadangan (simbol flowchart) | [Algoritma & Pemrograman: Flowchart](https://www.youtube.com/watch?v=BVzBSWkmEDk) | LP3 UHAMKA | 13,6 mnt | 1,8 ribu | 2020 | Gaya kuliah. |
| Cadangan (lengkap) | [Belajar Notasi Algoritma (Pseudocode & Flowchart)](https://www.youtube.com/watch?v=0mvfAXCO9vg) | PAKKODING | 28 mnt | 2,8 ribu | 2020 | Panjang, tetapi mencakup keduanya. |
| Cadangan (kuliah) | [Algoritma, Flowchart, dan Pseudocode - Part 1](https://www.youtube.com/watch?v=Vm0piimEI0o) | FSTeM Univ. Brawijaya | 23,7 mnt | 1,1 ribu | 2024 | Gaya kuliah universitas. |

**Celah:** saya tidak menemukan video bagus tentang **penelusuran (tracing / tabel jejak)**, yaitu sub-bab 3.5 buku. Usulan: pakai bagian buku dan alat Python Tutor (pythontutor.com) sebagai pengganti. Kalau mau video, ini kandidat untuk **Anda rekam sendiri** (sekitar 5 menit).

### Bab 9: Kelas, objek, referensi

Di sini ada pilihan yang bagus: **Kelas Terbuka**, channel yang sama dengan playlist utama, jadi suara pengajar dan gaya penyajiannya konsisten.

| Peran | Video | Channel | Durasi | Tayang | Unggah |
|---|---|---|---|---|---|
| Utama | [Belajar Python OOP #01 - Pendahuluan OOP](https://www.youtube.com/watch?v=1PjHsUnOkes) | Kelas Terbuka | 17,4 mnt | 197 ribu | 2018 |
| Utama | [Belajar Python #25 - Pengenalan Class](https://www.youtube.com/watch?v=LPVs38kR6tg) | Kelas Terbuka | 11 mnt | 35 ribu | 2017 |
| Utama | [Belajar Python OOP #02 - Constructor `__init__()`](https://www.youtube.com/watch?v=w9emRmkbeps) | Kelas Terbuka | 9,5 mnt | 84 ribu | 2018 |
| Latihan | [Belajar Python OOP #05 - Latihan OOP sederhana](https://www.youtube.com/watch?v=6F0T4IEzke4) | Kelas Terbuka | 21,3 mnt | 55 ribu | 2018 |
| Cadangan (panjang) | [Python OOP Dasar Untuk Pemula](https://www.youtube.com/watch?v=WYSLIMQnuR0) | Dea Afrizal | 60 mnt | 42 ribu | 2023 |

- Seri OOP Kelas Terbuka punya setidaknya #01, #02, dan #05. Video #03 dan #04 belum saya temukan ID-nya, perlu dicari bila ingin lengkap.
- Videonya dari 2017–2018. Dasar kelas Python tidak berubah, jadi masih layak, tapi tampilan editornya lama.
- **Bagian referensi objek (sub-bab 9.5)** sudah punya pendamping di playlist utama: video 32 (Copy List) dan 34 (Deep Copy Nested List).

### Bab 12: Linear search dan binary search

| Peran | Video | Channel | Durasi | Tayang | Unggah | Catatan |
|---|---|---|---|---|---|---|
| Utama (konsep binary) | [Konsep Logika dan Cara Kerja Binary Search](https://www.youtube.com/watch?v=Xp68BLKf23w) | SWS Space | 13,4 mnt | 18 ribu | 2020 | Konsep, kemungkinan tidak khusus Python. |
| Utama (Python) | [Metode Pencarian Sequential Search dan Binary Search](https://www.youtube.com/watch?v=8K983gxITCI) | FYN DEV | 15,3 mnt | 45 ribu | 2020 | Keduanya dalam satu video, Python. |
| Cadangan | [Algoritma Linear Search - Teori dan Praktek](https://www.youtube.com/watch?v=n_p2DWEdaMo) | Pojok Code | 7,2 mnt | 1,4 ribu | 2024 | |
| Cadangan | [Algoritma Binary Search - Teori dan Praktek](https://www.youtube.com/watch?v=J12zPyJz-Xk) | Pojok Code | 9,3 mnt | 950 | 2024 | |

### Bab 13: Sorting dan Big-O

| Peran | Video | Channel | Durasi | Tayang | Unggah | Catatan |
|---|---|---|---|---|---|---|
| Utama (konsep bubble) | [Konsep Logika dan Cara Kerja Bubble Sort](https://www.youtube.com/watch?v=fHQQZ28WFuQ) | SWS Space | 6,9 mnt | 35 ribu | 2020 | Singkat dan visual. |
| Utama (Python bubble) | [Bubble Sort dengan Python](https://www.youtube.com/watch?v=GntGHFfHSzk) | elektro programming | 16,3 mnt | 6,4 ribu | 2020 | |
| Utama (Python selection) | [Algoritma Selection Sort Bahasa Python](https://www.youtube.com/watch?v=NSd3ImakPv4) | FYN DEV | 10,8 mnt | 3,2 ribu | 2020 | |
| Cadangan (gabungan) | [Algoritma Pengurutan: Bubble, Selection, Insertion, Merge](https://www.youtube.com/watch?v=PxJcqZbrxHI) | Dr. Achmad Solichin | 22,5 mnt | 11 ribu | 2024 | |
| Big-O (kemungkinan terlalu formal) | [Kompleksitas Waktu Asimptotik (Big O)](https://www.youtube.com/watch?v=2-KIch377YI) | SWS Space | 27,1 mnt | 29 ribu | 2020 | Mata kuliah Analisis & Strategi Algoritma, level universitas. |
| Big-O (lebih ringan?) | [Kompleksitas Algoritma itu Penting?](https://www.youtube.com/watch?v=62qCljKilH8) | Programmer Zaman Now | 7,1 mnt | 6,6 ribu | Juli 2026 | Singkat dan terbaru. |

**Celah:** **Big-O (sub-bab 13.4)** adalah bagian terlemah. Video yang saya temukan cenderung formal atau panjang, dan cocoknya untuk mahasiswa tingkat lanjut. Buku Anda memperkenalkan Big-O secara ringan. Pertimbangkan merekam sendiri sekitar 5 sampai 8 menit.

### Bab 14: Rekursi

| Peran | Video | Channel | Durasi | Tayang | Unggah | Catatan |
|---|---|---|---|---|---|---|
| Utama | [Fungsi Rekursif Pada Python](https://www.youtube.com/watch?v=n6s7IpVrECk) | Wahyono | 9,8 mnt | 6,4 ribu | 2019 | Singkat. |
| Utama (faktorial) | [Tutorial Fungsi Rekursif Python Bahasa Indonesia](https://www.youtube.com/watch?v=VtvxvCkKlok) | elektro programming | 10,7 mnt | 2,9 ribu | 2018 | |
| Cadangan (lebih dalam) | [Penjelasan Rekursif pada Faktorial dan Fibonacci](https://www.youtube.com/watch?v=vQV3ARo2UUU) | elektro programming | 24,2 mnt | 1 ribu | 2019 | Menelusuri jalannya rekursi. |
| Cadangan (kuliah) | [Fungsi Rekursif - Learning by Coding](https://www.youtube.com/watch?v=RNPF9kk2Tyo) | Dr. Achmad Solichin | 21,8 mnt | 2,4 ribu | 2020 | |

- Sub-bab 14.5 (finalisasi proyek kelompok) tidak butuh video. Cukup panduan dan rubrik dari Lampiran C buku.

### Tambahan: `match-case` (Bab 4, sub-bab 4.5)

- Tidak ada video `match-case` berbahasa Indonesia yang saya temukan. Yang ada hanya bahasa Inggris, dan satu video Indonesia tentang cara **lama** (dictionary sebagai pengganti switch): [Percabangan dengan Dictionary (Switch Case)](https://www.youtube.com/watch?v=gSoqc0JetE4), 8,8 mnt, Indonesia Belajar, 2019.
- Karena ini topik kecil di akhir bab, usulan: cukup bagian buku, tanpa video.

## Ringkasan pemetaan setelah riset

| Bab | Sumber video | Status |
|---|---|---|
| 1, 2, 4 (kecuali `match-case`), 5, 6, 7, 8, 10, 11 | Playlist Kelas Terbuka | Sudah |
| 3 | CodePolitan, Blank Stuck, dan lainnya | Ada, **kecuali penelusuran** |
| 9 | Kelas Terbuka OOP (#01, #02, #05, dan #25) | Sudah, channel sama |
| 12 | SWS Space, FYN DEV, Pojok Code | Sudah |
| 13 | SWS Space, elektro programming, FYN DEV | Sudah, **Big-O lemah** |
| 14 | Wahyono, elektro programming | Sudah |

Kandidat untuk **Anda rekam sendiri** (kecil dan terarah): penelusuran / tabel jejak (Bab 3.5), Big-O (Bab 13.4), `match-case` (Bab 4.5).

## Rancangan pengumpulan tugas Bab 3 (non-coding)

Sumber isi: Tugas 1 di buku (dokumen rancangan algoritma untuk tiga kasus).

| Aspek | Usulan |
|---|---|
| Yang dikumpulkan | Foto atau berkas flowchart, pseudocode, dan tabel penelusuran. Boleh digambar tangan, dari buku, atau dari aplikasi. |
| Format | JPG, PNG, atau PDF. Maksimal sekitar 5 MB per berkas, dikompres otomatis di browser. |
| Penyimpanan | Supabase Storage. 80 peserta × beberapa berkas masih muat di kuota gratis. |
| Status | Terkumpul, lalu Disetujui atau Perlu revisi (diatur instruktur dari dashboard). |
| Gerbang | Bab dianggap selesai saat **terkumpul** (cepat), atau saat **disetujui** (lebih ketat tapi menambah beban Anda). Perlu diputuskan. |
| Bantuan swa-periksa | Daftar centang dari sub-bab 3.6 buku ("kapan rancangan dianggap siap") sebelum peserta mengirim. |
| Privasi | Berkas hanya terlihat oleh pemiliknya dan instruktur. |

## Pertanyaan untuk didiskusikan

1. Gerbang Bab 3: selesai saat terkumpul, atau harus disetujui?
2. Apakah Anda ingin merekam sendiri video pendek untuk tiga celah (penelusuran, Big-O, `match-case`), atau cukup bagian buku?
3. Apakah beberapa suara pengajar berbeda dalam satu bab bisa diterima, atau Anda ingin satu channel saja per bab?
4. Perlu pengecekan isi: Anda yang menonton pilihan utama, atau saya bantu ringkas lewat transkrip?
