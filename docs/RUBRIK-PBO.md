# Rubrik tugas akhir PBO (usulan)

Dokumen ini usulan untuk Anda ubah. **Website tidak menghitung nilai**; ia hanya menampilkan kriteria kepada peserta (halaman daftar tahap tugas akhir) dan menyediakan data untuk dosen. Bila angka atau kriteria di sini berbeda dari yang Anda pakai, ubah juga bagian `penilaian` di `site/data/kuliah/pbo-java/praktikum/tugas-akhir.json` supaya yang dibaca peserta sama dengan yang Anda pakai.

## Prinsip

1. **Yang dinilai kemampuan PBO, bukan perangkat.** Peserta tanpa laptop dan peserta berlaptop mengerjakan soal yang sama, menyerahkan lewat tempat yang sama (tugas akhir di website), dan dinilai dengan rubrik yang sama.
2. **Nilai tertinggi bisa dicapai tanpa laptop.** Antarmuka grafis (Swing) dan basis data (JDBC) hanya *tambahan*; keduanya butuh JDK, basis data, dan layar sungguhan sehingga website tidak bisa menjalankannya. Kedalaman desain (tambahan lain) dinilai setara.
3. **Kriteria terbuka sejak awal.** Peserta melihat kriteria ini sebelum mengerjakan.
4. **Penilaian bukan oleh mesin.** Tugas akhir tidak diuji otomatis. Website hanya memberi *penanda kelengkapan* (apakah pewarisan, abstraksi, eksepsi, collection, dan berkas terlihat di kode) dan memeriksa apakah kode dapat dikompilasi. Itu membantu Anda memeriksa cepat, bukan menggantikan membaca.

## Komponen (total 100 + tambahan sampai 10)

| Komponen | Bobot | Yang diperiksa |
|---|---:|---|
| Fungsi dan kebenaran | 30 | Dikompilasi dan menu berjalan tanpa galat yang tidak tertangani; semua fitur wajib bekerja. |
| Penerapan konsep PBO | 30 | Enkapsulasi, pewarisan, polimorfisme, dan abstraksi dipakai karena perlu, bukan hiasan. Polimorfisme terlihat nyata (pemanggilan lewat tipe induk atau interface). |
| Kualitas desain | 20 | Satu tanggung jawab jelas per kelas, nama bermakna, tidak ada duplikasi besar. `Rancangan.md` lengkap dan sesuai kode. Minimal dua prinsip SOLID dijelaskan dengan contoh dari kodenya. |
| Penanganan kesalahan dan data | 10 | Masukan salah tidak menghentikan program; eksepsi buatan sendiri benar-benar dilempar dan ditangkap; data tersimpan ke berkas dan dapat dimuat kembali. |
| Laporan dan penjelasan | 10 | Laporan jujur dan jelas dengan kalimat sendiri; peserta mampu menjelaskan bagian kodenya. |
| Tambahan | sampai +10 | Antarmuka grafis, JDBC, pola desain lain, pengujian, atau fitur kreatif. Dinilai dari kualitas, bukan perangkat. |

### Skala per komponen (contoh)

| Tingkat | Ciri | Skor komponen |
|---|---|---:|
| Sangat baik | Memenuhi semua, rapi, dan peserta menjelaskan alasannya | 90 sampai 100% |
| Baik | Memenuhi hampir semua, ada kekurangan kecil | 75 sampai 89% |
| Cukup | Memenuhi sebagian pokok, ada bagian yang hanya menempel | 55 sampai 74% |
| Kurang | Banyak bagian tidak jalan atau tidak dijelaskan | di bawah 55% |

### Syarat minimum yang disarankan

Kode dikompilasi dan menu berjalan. Bila tidak dikompilasi, komponen "Fungsi dan kebenaran" paling tinggi "Kurang", tetapi komponen lain tetap dinilai dari apa yang bisa dibaca.

## Tambahan: dua jalan yang setara

| Jalan | Cocok untuk | Contoh yang dinilai |
|---|---|---|
| Visual dan data | Yang punya laptop | Jendela Swing yang memakai Katalog; penyimpanan dengan JDBC (SQLite). Dinilai dari keterbacaan kode dan penjelasan; boleh didemokan singkat. |
| Kedalaman desain | Siapa saja | Fitur rancangan sendiri yang rapi (mis. perpanjangan atau reservasi), dua prinsip SOLID atau pola desain lain yang diterapkan dengan benar, pengujian sendiri, dan diagram kelas yang akurat. |

Bila seseorang ingin keduanya, nilai tambahan tetap dibatasi +10.

## Cara memakai data di dashboard

Tab **Praktikum** di dashboard instruktur (pilih mata kuliah PBO, lalu praktikum **Tugas akhir PBO**):

- ringkasan siapa sudah mulai dan siapa sudah menandai siap dinilai;
- **Lihat berkas** per peserta: seluruh berkas (hanya baca), penanda kelengkapan otomatis, dan laporan peserta;
- jumlah berkas yang diunggah dari perangkat peserta (bukan bukti kecurangan: peserta berlaptop memang mengunggah) dan jumlah percobaan menempel yang diblokir di ruang kerja dan laporan;
- riwayat versi tiap kali peserta menekan *Tandai siap dinilai*.

## Keaslian pengerjaan

Website mencatat hal yang objektif dan terlihat oleh peserta: jam mulai dan selesai tiap tahap, riwayat versi, jumlah percobaan menempel yang diblokir, jumlah berkas yang diunggah, dan latihan per bab. Itu **sinyal untuk memilih siapa yang ditanya**, bukan bukti. Saran: pilih sampel peserta (atau yang polanya janggal) dan minta mereka menjelaskan satu atau dua bagian kodenya selama 5 menit. Kemampuan menjelaskan boleh menyesuaikan komponen "Laporan dan penjelasan" dan, bila jelas bukan karya sendiri, komponen lain.

## Latihan per bab

Latihan per bab (bab 2, 3, 5, 6, 7, 8, 9, 10, 13, 14) **tidak wajib dan tidak terkunci**. Usulan pemakaian: tidak dihitung sebagai nilai, melainkan sebagai latihan; atau dipakai sebagai syarat pengajuan perbaikan, atau diberi poin partisipasi kecil. Keputusannya milik Anda; data per peserta ada di tab Praktikum (bagian "Semua praktikum") dan dapat diunduh sebagai CSV.
