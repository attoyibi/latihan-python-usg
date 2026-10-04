# Analisis dan Rencana: Website Latihan Coding Pendamping Buku Ajar

*Berkas rujukan. Isinya hasil analisis saja, belum ada kode website. Dibuat 4 Oktober 2026.*
*Untuk Buku Ajar "Algoritma dan Pemrograman: Fondasi Berpikir Komputasional dengan Python" (USG Press).*

## 1. Tujuan dan keputusan yang sudah dikunci

| Hal | Keputusan |
|---|---|
| Tujuan | Peserta **bisa coding** (hasil), bukan sekadar menonton video (proksi). |
| Peserta | Sekitar 80 mahasiswa semester 1, banyak yang hanya punya ponsel atau laptop sederhana. |
| Bahasa | **Python saja.** Konteks awal menyebut Java, tetapi buku dan 73 video semuanya Python. |
| Gerbang kemajuan | Lulus coding challenge (program jalan **dan** output cocok). Video opsional, jadi bantuan. |
| Jalur peserta | Yang sudah bisa langsung mengerjakan challenge lalu lanjut. Yang belum bisa gagal dulu, lalu diarahkan ke video dan bagian buku yang relevan. |
| Penyimpanan progress | **Supabase** (free tier). |
| Validasi output | Cocok setelah membuang spasi di ujung baris dan baris kosong di ujung output. Huruf besar dan kecil tetap dibedakan. |
| Dashboard instruktur | **Ya**, ada. Ini cara memantau 80 orang. |
| Layout | Sesuai sketsa: sidebar kiri (daftar bab, bebas lompat), kanan atas penjelasan, kanan bawah video dan code editor berdampingan. |

## 2. Temuan yang mengubah rencana awal

### 2.1 Piston publik tidak bisa dipakai lagi
Saya uji langsung pada 4 Oktober 2026. Endpoint `emkc.org/api/v2/piston/execute` menjawab:
"Public Piston API is now whitelist only as of 2/15/2026". Jadi stack di konteks awal tidak jalan tanpa izin whitelist.

| Opsi | Biaya | Kelebihan | Kekurangan |
|---|---|---|---|
| **A. Pyodide** (Python berjalan di browser lewat WebAssembly) | Gratis, tanpa server | Tidak ada batas request. 80 orang serentak tidak masalah. Tidak ada server yang bisa mati. Mendukung `input()` dan berkas virtual. | Muat pertama sekitar 10 MB (lalu ter-cache). Lebih berat di ponsel murah. Penilaian terjadi di browser, jadi secara teori bisa dicurangi. |
| B. Piston self-host (Docker di VPS atau Oracle free tier) | Gratis sampai murah | Eksekusi di server, lebih sulit dicurangi. | Perlu merawat server. Harus mengatur isolasi dan batas waktu sendiri. |
| C. Ajukan whitelist Piston publik | Gratis | Tanpa server sendiri. | Belum tentu disetujui, dan bisa dicabut. |

**Rekomendasi: A (Pyodide) sebagai mesin utama.** Untuk buku Python dengan 80 peserta, ini paling sederhana dan paling tahan beban. B dicadangkan kalau nanti butuh penilaian yang tak bisa dicurangi (misalnya untuk ujian).

Hal yang harus ditangani pada Pyodide:
- **Perulangan tak berhenti.** Bab 5 sendiri mengajarkan infinite loop, jadi peserta pasti akan membuatnya. Kode dijalankan di Web Worker dan dihentikan paksa setelah sekitar 5 detik.
- **`input()`.** Sebanyak 15 berkas kode di folder `kode/` memakainya. Pada challenge, masukan disuplai otomatis dari test case. Pada mode coba bebas, masukan diketik di kotak di bawah editor.
- **Berkas (Bab 10 dan 11).** Pyodide punya sistem berkas virtual di memori. Cocok untuk latihan baca-tulis, tetapi berkas hilang tiap kali dijalankan ulang. Challenge Bab 10 dan 11 dirancang di satu kali jalan.
- **Pesan kesalahan.** Traceback Python ditampilkan apa adanya. Buku Bab 1.7 memang mengajarkan membaca traceback, jadi ini sejalan.

### 2.2 Buku punya 14 bab, bukan 15
Konteks awal menyebut 15 materi. Buku punya **14 bab** (Minggu 8 dan 16 adalah UTS dan UAS, bukan bab). Rencana ini memakai 14 materi. Kalau Anda ingin 15, satu usulan: tambah "Materi 0: Uji Awal / Orientasi".

### 2.3 Ada 5 bab yang videonya tidak ada di playlist
Playlist Kelas Terbuka berhenti di Python dasar dan tidak membahas flowchart, OOP, searching, sorting, maupun rekursi. Lihat bagian 3.

### 2.4 Bab 3 bukan bab coding
Bab 3 membahas flowchart, pseudocode, dan penelusuran. Gerbang "lulus kode" tidak cocok. Usulan: challenge berbentuk **tabel penelusuran** (peserta mengisi nilai variabel tiap langkah) atau soal pilihan ganda, dengan penilaian otomatis.

## 3. Pemetaan 14 bab ke video

Playlist: Kelas Terbuka, "Belajar Python Bahasa Indonesia [Versi Baru]", 73 video. Nomor di bawah adalah **nomor pada judul video** (bukan urutan playlist). Video 02a adalah Windows dan 02b macOS.

Pemetaan dibuat dari **judul video dan judul sub-bab buku**. Saya belum menonton isinya, jadi perlu Anda cek.

| Bab | Judul bab (ringkas) | Video wajib (bantuan utama) | Video tambahan | Status |
|---|---|---|---|---|
| 1 | Fondasi algoritma dan Python | 01, 02a, 02b, 03 | | Terpetakan |
| 2 | Variabel, tipe data, operator | 04, 05, 06, 07, 08, 09, 10, 11, 12 | 13 (bitwise), 14 (assignment) | Terpetakan |
| 3 | Flowchart, pseudocode, penelusuran | tidak ada | | **Kosong** |
| 4 | Percabangan | 21, 22, 23 | | Terpetakan sebagian (`match-case` tidak ada) |
| 5 | Perulangan | 24, 25, 26, 27, 28 | | Terpetakan |
| 6 | List satu dimensi | 29, 30, 31, 35, 36 | 32 (copy list), 37 (tuple dan set) | Terpetakan |
| 7 | Nested list dan string | 33, 34, 15, 16, 17 | 18, 19, 20 | Terpetakan |
| 8 | Fungsi dan pemrograman modular | 44, 45, 46, 47, 48, 53 | 49 sampai 52 (type hints, args, kwargs, lambda), 54 sampai 58 (import, module, package) | Terpetakan |
| 9 | Kelas, objek, referensi | tidak ada (32 dan 34 membahas copy, untuk bagian referensi) | | **Kosong** (OOP) |
| 10 | File I/O | 64, 65, 66 | | Terpetakan |
| 11 | CRUD sederhana | 67, 68, 69, 70, 71 (seri PROJECT) | | Terpetakan |
| 12 | Linear dan binary search | tidak ada | | **Kosong** |
| 13 | Sorting dan Big-O | tidak ada | | **Kosong** |
| 14 | Rekursi dan proyek akhir | tidak ada | | **Kosong** |

**Video yang tidak dipakai di bab mana pun:** 38 sampai 43b (dictionary, 7 video), 59 sampai 62 (tkinter, pip, numpy, pygame). Buku belum membahas dictionary. Bisa disediakan menu "Materi Tambahan".

**Cara menutup 5 bab yang kosong** (pilih salah satu atau gabungan):
1. Ganti dengan sumber lain yang sudah ada (cari video lain per topik).
2. Rekam video Anda sendiri, dan ini paling cocok dengan buku.
3. Pakai Python Tutor atau animasi dari gambar buku (`img/VIS-*.png`) sebagai pengganti.
4. Untuk bab tanpa video, bagian "bantuan" langsung menampilkan sub-bab buku yang relevan, bukan video.

Pada tiap bab, bantuan dipasang bertingkat: **petunjuk dari soal, lalu bagian buku, lalu video**. Dengan begitu video bukan satu-satunya jalan keluar saat peserta macet.

## 4. Isi challenge per bab

Sumber soal: bagian **Latihan Bertingkat** dan **Praktikum Terbimbing** di tiap bab, plus kasus UD Rasa Gresik. Kode contoh di folder `kode/bab-NN/` bisa dipakai sebagai **kunci jawaban** dan **starter code**.

Struktur tiap bab: **1 challenge wajib** (menentukan kelulusan) dan **1 tantangan lanjutan opsional** (untuk yang sudah mahir, tidak memengaruhi kelulusan).

Setiap challenge memuat: soal, starter code, 2 sampai 5 test case (sebagian tersembunyi, supaya tidak bisa asal mencetak jawaban), expected output, petunjuk bertingkat, dan tautan ke bagian buku serta video.

| Bab | Bentuk challenge wajib (usulan, perlu Anda tetapkan) | Catatan teknis |
|---|---|---|
| 1 | Program pertama: cetak rekap atau hitung bahan sederhana (`hitung_bahan.py`) | Cukup cetak keluaran. |
| 2 | Kalkulator kebutuhan bahan (variabel, tipe, konversi) | Test case dengan masukan angka. |
| 3 | Isi tabel penelusuran dan susun pseudocode | **Bukan kode.** Penilaian lewat isian atau pilihan. |
| 4 | Hitung potongan dan ongkir (`if-elif-else`) | Pakai test case tepi (batas nilai). |
| 5 | Rekap pesanan dengan `for` dan `while` | Waspadai infinite loop. |
| 6 | Rekap harian dari list satu dimensi | |
| 7 | Bersihkan nama produk yang ejaannya campur (string dan nested list) | Data kotor sebagai test case. |
| 8 | Pecah program menjadi fungsi (`def`, `return`, default) | Uji fungsi dengan beberapa pemanggilan. |
| 9 | Kelas `Pesanan` | Uji lewat cetakan objek dan perilaku referensi. |
| 10 | Tulis dan baca berkas | Berkas virtual, satu kali jalan. |
| 11 | CRUD: tambah, cari, ubah, hapus pesanan | Skenario berurutan dengan masukan terjadwal. |
| 12 | Tulis `binary_search` | Cek hasil dan jumlah langkah. |
| 13 | Tulis bubble sort atau selection sort | Larang `sorted()` lewat pengecekan kode sederhana. |
| 14 | Fungsi rekursif (faktorial, total list). **Proyek akhir kelompok tidak dinilai otomatis.** | Proyek dinilai manual pakai rubrik di buku. |

Tahap ini yang paling memakan waktu, karena 14 bab × (soal + test case + kunci) perlu Anda tinjau. Saya bisa membuat draf dari buku, dan Anda memeriksanya.

## 5. Alur belajar

```
Pilih bab (bebas lompat dari sidebar)
        |
        v
Baca penjelasan (opsional bagi yang sudah bisa)
        |
        v
Kerjakan challenge  ----- lulus ----->  Bab ditandai selesai, tawarkan bab berikutnya
        |
      gagal
        v
Petunjuk 1 -> bagian buku -> video bantuan -> coba lagi
```

- **Tidak ada kunci bab.** Peserta boleh melompat ke bab mana pun. Yang dikunci hanya status "selesai" (harus lulus challenge). Ini sesuai sketsa Anda ("bisa lompat") dan membuat jalur peserta mahir otomatis cepat.
- **Placement tidak perlu.** Peserta mahir akan melewati bab awal dengan cepat karena langsung lulus challenge.

## 6. Layout

```
+------------------+----------------------------------------+
| DAFTAR MATERI    |  PENJELASAN MATERI                     |
| (bisa lompat)    |  (ringkasan buku + gambar + tautan)    |
|                  +-------------------+--------------------+
| 1 [v] Bab 1      |  VIDEO            |  CODE EDITOR       |
| 2 [v] Bab 2      |  (YouTube embed)  |  (Monaco)          |
| 3 [ ] Bab 3      |                   |  [Jalankan][Kirim] |
| ...              |                   |  Output / Error    |
+------------------+-------------------+--------------------+
```

- Di layar sempit (ponsel), area kanan ditumpuk menjadi tab: Penjelasan, Video, Editor. Sidebar menjadi menu geser.
- Monaco Editor berat di ponsel kecil. Alternatif yang lebih ringan adalah CodeMirror 6. Perlu diputuskan saat membangun.
- Isi penjelasan diambil dari naskah markdown buku, jadi satu sumber kebenaran. Gambar `img/VIS-NN-XX.png` dipakai ulang.

## 7. Rancangan data (Supabase)

| Tabel | Isi | Fungsi |
|---|---|---|
| `peserta` | id, nama, NIM, kelas, peran (peserta/instruktur) | Identitas. |
| `materi` | nomor bab, judul, id video | Data statis, bisa juga berupa berkas JSON. |
| `percobaan` | peserta, bab, waktu, kode yang dikirim, lulus atau tidak, kasus yang gagal | Riwayat tiap pengiriman. |
| `progres` | peserta, bab, status, jumlah percobaan, waktu lulus pertama | Ringkasan yang dibaca dashboard. |
| `aktivitas` | peserta, bab, jenis (buka video, buka petunjuk, buka buku), waktu | Melihat apakah bantuan dipakai. |

- **Login:** usulan masuk lewat tautan email atau NIM, tanpa mengelola kata sandi sendiri. Perlu diputuskan.
- **Keamanan:** gunakan Row Level Security supaya peserta hanya melihat datanya sendiri dan instruktur melihat semua.
- **Privasi:** data berisi nama dan NIM mahasiswa. Perlu pemberitahuan penggunaan data di halaman login.
- **Batas gratis:** Supabase gratis cukup untuk 80 peserta. Proyek bisa dijeda bila tidak aktif lama, jadi aktifkan kembali sebelum semester dimulai.

## 8. Dashboard instruktur

1. **Matriks 80 peserta × 14 bab**, diberi warna: belum mulai, sedang dicoba, lulus.
2. **Bab yang paling sering gagal**, untuk bahan pengulangan di kelas.
3. **Peserta yang macet**: sudah banyak percobaan tanpa lulus, atau lama tak aktif.
4. **Jalur cepat vs jalur video**: berapa peserta lulus langsung tanpa membuka video. Ini sesuai tujuan Anda mengukur kemampuan, bukan tontonan.
5. Ekspor CSV untuk nilai.

## 9. Risiko dan hal yang perlu diperhatikan

| Risiko | Penanganan |
|---|---|
| Kecurangan karena penilaian di browser | Test case tersembunyi, serta simpan kode tiap percobaan untuk diperiksa. Untuk ujian sungguhan, pakai server (opsi B). |
| Ponsel lama lambat memuat Pyodide | Tampilkan indikator muat, dan pastikan tetap bisa dipakai di laptop atau lab. |
| Video diblokir atau dihapus pemiliknya | Simpan id video di satu berkas data. Siapkan cadangan. |
| Hak cipta buku | Isi buku di website sebaiknya dibatasi untuk peserta yang login. Video hanya disematkan (embed), tidak diunduh. |
| Soal dari buku terlalu mirip dengan kunci yang beredar | Variasikan angka pada test case tersembunyi. |
| Pemetaan video belum diverifikasi | Anda cek 5 sampai 10 video kunci lebih dulu. |

## 10. Rencana tahapan (usulan)

| Tahap | Isi | Hasil |
|---|---|---|
| 0 | Anda memutuskan hal di bagian 11 | Keputusan terkunci |
| 1 | Prototipe satu bab (Bab 4, karena jelas dan tidak butuh berkas): layout, editor, Pyodide, penilaian | Bisa dicoba |
| 2 | Supabase: login, progres, percobaan | Progres tersimpan |
| 3 | Isi 14 bab: penjelasan, challenge, test case, video | Konten lengkap |
| 4 | Dashboard instruktur | Pantauan 80 peserta |
| 5 | Uji coba dengan 5 sampai 10 mahasiswa, perbaiki, lalu rilis | Siap dipakai |

## 11. Hal yang belum diputuskan (butuh jawaban Anda)

1. Mesin eksekusi: setuju **Pyodide**, atau ingin Piston self-host?
2. Satu challenge wajib per bab sudah cukup, atau ingin lebih banyak?
3. Cara login peserta: tautan email, NIM, atau akun kampus?
4. Bab 3 (non-coding): isian tabel penelusuran atau pilihan ganda?
5. Untuk 5 bab tanpa video: cari sumber lain, rekam sendiri, atau cukup pakai bagian buku?
6. Apakah halaman penjelasan boleh memuat isi buku utuh, atau hanya ringkasan dengan tautan ke PDF?
7. Hosting website: Netlify, Vercel, atau GitHub Pages (semuanya gratis)?
8. Apakah ada tenggat (misalnya awal semester)?

## 12. Lampiran: daftar 73 video

Sumber: playlist `PLZS-MHyEIRo59lUBwU-XHH7Ymmb04ffOY`, channel Kelas Terbuka.

| No. judul | Judul | ID YouTube |
|---|---|---|
| 01 | Apa Itu Python | iA8lLwmtKQM |
| 02a | Instalasi Python dan VS Code di Windows (Edisi 2026) | YQSnfUsEZjc |
| 02b | Instalasi Python dan VS Code di MacOS | HSAm6s10G7g |
| 03 | Cara Kerja Program dan bytecode | -auWrbiaoGc |
| 04 | Mengenal Variabel | gxmTFXfrMzk |
| 05 | Tipe Data | b3X0CH98Y9g |
| 06 | Casting Tipe Data | 3d8JbMafZOY |
| 07 | Mengambil Input Data dari User | Ar1xxIsyuvI |
| 08 | Operasi Aritmatika | RoDGGTWbKK4 |
| 09 | Latihan Perhitungan Sederhana | SmiUsrGTnpY |
| 10 | Operasi Komparasi | Kv_lDWq8kCc |
| 11 | Operasi Logika atau Boolean | Sl7zqPpC2VI |
| 12 | Latihan Komparasi dan Logika | -FqgZRDRuIM |
| 13 | Operator Bitwise | -VrqfCGwr88 |
| 14 | Operator Assignment | 49KDyhzgCmA |
| 15 | Pengenalan String | fhAEh1Z9YuY |
| 16 | Operasi dan manipulasi string (part 1) | MPvC9uWATLI |
| 17 | Operasi dan manipulasi string (part 2) | ORda-LwrEwE |
| 18 | Format String | D66WxqZnjXg |
| 19 | String width and Alignment | q9GW5rzOMu4 |
| 20 | Latihan Date and Time | n9vTAmq3GHE |
| 21 | IF dan ELSE Statement | rF8rh40z_X0 |
| 22 | ELIF Statement | ICowoqcLp4E |
| 23 | Latihan Percabangan - Kalkulator Sederhana | 61OgFKJim6E |
| 24 | For Loop | Z4qfMhx4XzQ |
| 25 | While Loop | ZupffvoCChQ |
| 26 | Continue dan Pass | hGvikdHVRME |
| 27 | Break | B6scLunzn0I |
| 28 | Latihan Perulangan | szyfqq_whIg |
| 29 | List | tERK7b5Woqs |
| 30 | Manipulasi List | Xqvui6Bmrj0 |
| 31 | Operasi List | HVyMl3GIw20 |
| 32 | Copy List | mATeKWmB7YM |
| 33 | Nested List / List Bersarang | u3xOkmxzeBE |
| 34 | Deep Copy Nested List | scxyFiudGug |
| 35 | Looping List dan Enumerate | gyO6OzzMtJs |
| 36 | Latihan List | cS-VYthhO9A |
| 37 | Tuples dan Set | BWQn2TQqvY8 |
| 38 | Dictionary | Z0hbtSr-Oaw |
| 39 | Operasi Dictionary | 6khlVRLJTl0 |
| 40 | Looping Dictionary | tEqYmvykGII |
| 41 | Copy & Pop Dictionary | NTHdVRV2qhE |
| 42 | Multi keys & Nesting Dictionary | rO-aLyWJ1Jk |
| 43a | Latihan Dictionary Part 1 | WLHNJCW62qo |
| 43b | Latihan Dictionary Part 2 | OrCG-jbyAO8 |
| 44 | Pengenalan Fungsi | ywE2eqG3-kc |
| 45 | Fungsi dengan argument | wQwf5eKpxqs |
| 46 | Fungsi dengan return | ADcQu-8R0Ok |
| 47 | Default Argument Fungsi | dZGr1bbfHZU |
| 48 | Latihan Fungsi | AcyUE59S53U |
| 49 | Type Hints pada Fungsi | NR3m8VJA738 |
| 50 | *args pada fungsi | mTlO4mFvD5A |
| 51 | **kwargs pada fungsi | 2BSf8Kr-0cw |
| 52 | Anonymous dan Lambda Function | pZye35-Nx4o |
| 53 | Global dan Local Scope | KzinFz7ExJ4 |
| 54 | Import Statement | bk3IYcuZyt8 |
| 55 | Membuat Module | N4XExIBYriI |
| 56 | Membuat Package Sederhana | WVRMWH4EmfY |
| 57 | __init__.py pada Package | 7GhxT1svylc |
| 58 | Menggunakan Standard Library | LWIzgB8NOyk |
| 59 | tkinter (GUI) | L4dbeLNDFlc |
| 60 | Mengenal PIP | WL1d21PcDC8 |
| 61 | Package Numpy | y9fw9g6xSIU |
| 62 | Explore Pygame | cQOhLpmR6CY |
| 63 | __main__ sebagai gerbang program | XQThsEBvX_8 |
| 64 | Read external file - Open dan With | 9xiuFrL0wSw |
| 65 | Write external file | 3FfNwPIAtNw |
| 66 | Exception, Error, Try and Except | ObTWBJ4QCPQ |
| 67 | PROJECT - Persiapan | PmdQwH_NU3U |
| 68 | PROJECT - Init Database dan Read | Dz3BGBy0cEM |
| 69 | PROJECT - Create | TnZCxPbT1I8 |
| 70 | PROJECT - Update | nOH5fy3Wz2c |
| 71 | PROJECT - Delete | GSBZyHoJPuE |

> Catatan: pada judul asli, nomor 69 sampai 73 playlist adalah project "Persiapan, Init Database dan Read, Create, Update, Delete" yang di judulnya diberi nomor 67 sampai 71. Tabel di atas memakai nomor di judul. Cek ulang urutan Create/Update/Delete saat memasang.


## 13. Keputusan terbaru (4 Oktober 2026)

- Mesin eksekusi: **Pyodide saja.**
- Bab tanpa video: cari sumber lain berbahasa Indonesia yang mudah dipahami. Hasil riset ada di `RISET-VIDEO-PENGGANTI.md`.
- Bab non-coding (Bab 3): peserta **mengumpulkan gambar/berkas** flowchart dan pseudocode. Bab lain tetap coding challenge.
- Halaman penjelasan: **ringkasan** yang cukup untuk mulai coding, plus tautan ke sub-bab buku yang spesifik.


## 14. Laporan, log aktivitas, penilaian, dan dashboard (diputuskan 4 Oktober 2026)

### 14.1 Laporan praktikum
- Dibuka setelah challenge lulus (Bab 3: setelah tugas terkumpul).
- Lima kolom, semuanya diketik sendiri: tujuan, pertanyaan konsep khusus bab, langkah, kendala, kesimpulan. Batas minimal 30 sampai 60 karakter per kolom.
- Tempel, salin, potong, seret, dan klik kanan diblokir di kolom laporan.
- Kode terakhir yang lulus dan outputnya terlampir otomatis.
- **Peserta hanya mengekspor PDF**, lalu mengunggahnya sendiri ke sistem formal universitas. Header PDF: nomor materi, nama materi, nama, kelas (dari data awal peserta, belum dibangun). Usulan tambahan: kode verifikasi di kaki halaman supaya PDF yang diunggah bisa dicocokkan dengan catatan di sistem ini.
- Teks laporan **juga tersimpan di sistem**, supaya Anda bisa membaca, menilai, dan mengunduhnya.

### 14.2 Dua lapis penilaian
| Lapis | Sumber | Sifat |
|---|---|---|
| A. Log sistem | Otomatis dari aktivitas peserta | Objektif, tanpa campur tangan Anda |
| B. Laporan | Anda menilai manual | Menilai kualitas pemahaman |

Rubrik laporan (usulan, skala 1 sampai 4, perlu Anda tetapkan): ketepatan konsep, kejelasan dengan bahasa sendiri, kejujuran refleksi kendala, kesesuaian dengan kode yang ditulis. Ditambah kolom komentar singkat. Layar penilaian menampilkan laporan, kode, dan ringkasan log berdampingan, dengan antrean "belum dinilai".

### 14.3 Yang dicatat sistem (per peserta per bab)
| Kelompok | Data |
|---|---|
| Waktu | Waktu pertama buka bab; waktu lulus pertama; **durasi aktif** (berhenti dihitung bila tab tersembunyi atau tidak ada aktivitas sekitar 60 detik); durasi mengerjakan laporan |
| Percobaan | Jumlah Jalankan; jumlah Kirim; Kirim yang gagal sebelum lulus; test case yang gagal; kode tiap pengiriman |
| Bantuan | Buka petunjuk (tingkat berapa); buka tautan buku; video diputar (mulai, jeda, lama tonton) |
| Jalur | **Lulus tanpa membuka video** (jalur cepat) atau lulus setelah memakai bantuan |
| Laporan | Panjang tiap jawaban; jumlah ketikan per kolom; jumlah percobaan tempel yang diblokir; jumlah ekspor PDF |
| Status | Belum mulai, sedang dicoba, lulus, laporan dikumpulkan, laporan dinilai (beserta skor) |

Catatan agar log tetap adil:
- Durasi bukan nilai. Peserta mahir akan cepat dan itu baik. Durasi dipakai sebagai petunjuk, bukan penentu nilai.
- Beri tahu peserta data apa yang dicatat dan untuk apa (pemberitahuan di halaman masuk). Ini data mahasiswa.
- Tentukan lama penyimpanan data (misalnya sampai akhir semester, lalu diarsipkan atau dihapus).

### 14.4 Dashboard per pertemuan
Tujuan: tahu setiap pertemuan berapa anak yang berhasil.
1. Pilih pertemuan (bab). Tampil: **berapa lulus, sedang dicoba, belum mulai** dari seluruh peserta.
2. Waktu aktif median dan sebaran, rata-rata percobaan.
3. **Lulus tanpa video vs lewat video.**
4. Laporan masuk dan sudah dinilai.
5. Daftar peserta dengan penanda: macet (banyak percobaan tanpa lulus), tidak aktif, atau jawaban laporan mencurigakan (panjang tetapi ketikan sangat sedikit).
6. Perbandingan antar pertemuan (bab mana yang paling banyak gagal).

### 14.5 Unduh data (untuk Anda)
- Rekap per pertemuan atau per semester dalam CSV/Excel: nama, NIM, kelas, status, waktu lulus, durasi aktif, percobaan, jalur, skor laporan.
- Unduh teks laporan dan kode peserta.
- Dipakai untuk memasukkan nilai ke sistem formal universitas.

### 14.6 Tahap kerja yang terdampak
Tahap 2 (Supabase) harus merancang tabel log sejak awal, karena data yang tidak dicatat sejak hari pertama tidak bisa dipulihkan. Tabel `aktivitas` di bagian 7 diperluas dengan kelompok data 14.3 dan tabel `laporan` serta `penilaian_laporan`.

## 15. Desain, navigasi, dan repositori (diputuskan 4 Oktober 2026)

- **Navigasi tanpa kunci.** Peserta bebas membuka bab mana pun. Setiap bab diberi penanda: belum dikerjakan, sedang dikerjakan, selesai. Ini sejalan dengan tujuan "yang sudah bisa tidak dipaksa lewat jalur sama".
- **Gaya visual** mengikuti gambar contoh: teal dan hijau, judul tebal dengan gradasi, kartu mengambang, panel kode gelap, latar kisi halus. Spesifikasi di `DESIGN.md` (folder yang sama).
- **Semua dibangun di repositori GitHub** agar mudah dipakai orang lain: kode terpisah dari isi, konfigurasi di berkas, panduan pemasangan, skema database dan kebijakan keamanan ikut disimpan. Rincian di checklist, Tahap G.
- **Konektor Supabase dan Cloudflare** ditunda. Urutan: GitHub dulu, lalu fitur, lalu sambungan layanan.
- **Risiko repositori publik:** soal, test case, dan kunci terbaca semua orang; isi ringkasan berasal dari buku yang berhak cipta. Perlu keputusan lisensi dan pemisahan kunci jawaban.

## 16. Banyak mata kuliah (diputuskan 4 Oktober 2026)

- **Satu situs, banyak mata kuliah**, berbasis kode maupun tidak. Awal: Algoritma dan Pemrograman (Python) dan Pemrograman Berorientasi Objek (Java).
- **Isi dipisah per mata kuliah** di `site/data/kuliah/<id>/`; daftar mata kuliah di `site/data/matakuliah.json`. Menambah mata kuliah tidak menyentuh kode.
- **Progres terpisah per mata kuliah**, baik di browser maupun di database (kolom `matakuliah_id`).
- **Database:** tabel `matakuliah`; migrasi `0003` bersifat aditif dan memindahkan data lama ke `algoritma-python`. Menambah mata kuliah = satu baris `insert` (dicetak oleh `tools/kuliah_baru.py`).
- **Java:** tempat sudah ada; yang belum ada adalah mesin yang menjalankan kode Java. Python dijalankan di browser lewat Pyodide, Java butuh pilihan lain (JVM di browser, server eksekusi sendiri, atau layanan berbayar). Keputusan ditunda dan perlu riset ulang pada saat itu.
- **Belum diputuskan:** kelas per mata kuliah (sekarang satu data diri), instruktur per mata kuliah (sekarang satu peran global), dan unggah berkas untuk mata kuliah tanpa kode.

## 17. Landing publik dan masuk lewat tautan (diputuskan 4 Oktober 2026)

- **Kunjungan pertama tidak dipaksa masuk.** Halaman depan publik dan statis menampilkan mata kuliah yang tersedia. Masuk baru diminta saat peserta memilih mata kuliah.
- **Masuk hanya lewat tautan email** (magic link), tanpa kode yang diketik. Mata kuliah yang dipilih diingat dan dibuka setelah masuk.
- **Risiko yang dicatat:** pemindai keamanan email (mis. Safe Links) bisa membuka tautan sekali pakai lebih dulu sehingga peserta melihat "kedaluwarsa". Perlu diuji dengan email kampus yang dipakai peserta; cadangannya adalah mengembalikan kode angka.
- **Hemat unduhan:** mesin Python (sekitar 10 MB) hanya dimuat untuk peserta yang sudah masuk.
