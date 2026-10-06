# Penjalan Java di browser

Mata kuliah berbahasa Java (mis. `pbo-java`) menjalankan kode mahasiswa **di browser**, tanpa server. Caranya:

- **CheerpJ 4** (Leaning Technologies): JVM (Java 17) yang berjalan di WebAssembly. Dimuat dari CDN mereka (`cjrtnc.leaningtech.com`). Gratis untuk penggunaan non-komersial dan pendidikan; baca ketentuan lisensinya bila situsmu dipakai untuk tujuan lain.
- **ECJ** (Eclipse Compiler for Java), `site/vendor/ecj.jar`, versi 3.46.100 dari Maven Central (EPL-2.0). CheerpJ tidak membawa `javac`, jadi ECJ yang mengompilasi.
- **JavaRun**, `site/vendor/javarun.jar`, program kecil buatan sendiri (sumbernya `tools/java-runner/JavaRun.java`). Ia mengompilasi satu berkas `Main.java` di memori dengan ECJ lalu menjalankannya, dengan masukan dari `System.in` dan keluaran ditangkap.

Mengubah `JavaRun.java`? Bangun ulang jar-nya (butuh JDK 17 ke atas):

```bash
python tools/java-runner/build.py
```

## Cara kerja singkat

1. Saat mahasiswa membuka bab Java, `js/javarunner.js` memulai Web Worker `js/javaworker.js`. Worker memuat CheerpJ dan menjalankan `JavaRun serve` sebagai layanan yang hidup terus.
2. Pemuatan pertama dan kompilasi pertama lambat (sekitar 15 sampai 20 detik pada koneksi biasa). Setelah itu, tiap kompilasi dan eksekusi hanya sekitar 0,1 detik. Status di bilah atas menunjukkan "Java siap".
3. Tiap pekerjaan dikirim sebagai berkas, hasilnya dibaca dari berkas lain. Worker dipakai supaya perulangan tak berujung bisa dihentikan: setelah 8 detik worker dimatikan lalu dimulai ulang (butuh pemanasan lagi).

## Bila pemuatan gagal ("Coba lagi")
Pemuatan Java (dan Python) bisa gagal: internet putus atau diblokir, koneksi sangat lambat, atau memori perangkat tidak cukup. Situs mendeteksi empat kasus (skrip tidak bisa diunduh, melebihi batas waktu muat 180 detik untuk Java dan 120 untuk Python, galat saat menyiapkan, worker mati mendadak) dan mengubah spanduk di atas editor menjadi pesan jelas dengan saran dan dua tombol: **Coba lagi** (memulai penjalan dari awal tanpa memuat ulang halaman) dan **Muat ulang halaman**. Kode di editor tidak hilang. Jalankan dan Kirim jawaban saat gagal memberi pesan yang sama, dan jawaban **tidak dihitung sebagai percobaan** serta tidak dikirim ke server. Bila browser mematikan seluruh tab karena memori, tidak ada yang bisa ditangkap; peserta cukup membuka ulang.

Menguji kegagalan di komputer sendiri (server uji): `/__gagal/java/mati` (skrip gagal dimuat), `/__gagal/java/diam` (tidak pernah siap), dan `/__gagal/java/normal` (pulih); sama untuk `python`. Setelah mengubah mode, muat ulang skrip dengan `fetch('/js/javaworker.js', {cache:'reload'})` karena browser menyimpan skrip worker. Tambahkan `?muatmaks=5000` di alamat untuk memperpendek batas waktu muat.

## Batasan yang perlu diketahui

- **Kode soal berupa satu berkas `Main.java`** berisi kelas `Main` dengan `public static void main`, ditambah kelas lain di berkas yang sama (tanpa `public`). Masukan dibaca dengan `Scanner(System.in)`.
- **Tingkat bahasa Java 8** (lambda, generics, interface default sudah bisa). Belum: `var`, `record`, `switch` ekspresi, blok teks. Pustaka bawaan (`List.of`, `Path.of`, `String.isBlank`) tersedia karena runtime-nya Java 17. Dukungan modul ECJ untuk tingkat bahasa lebih tinggi belum berhasil dipasang.
- **Mode tambah berkas (`APPEND`) tidak bekerja** pada sistem berkas CheerpJ (data baru menimpa dari awal berkas). Soal yang membutuhkan penambahan di akhir berkas memakai cara baca lalu tulis ulang. Menimpa (`Files.write` biasa) berjalan normal.
- **Berkas ditulis di `/files/`** (folder kerja), disimpan di IndexedDB browser dan bertahan antar kunjungan.
- **Tanpa GUI dan JDBC.** Swing dan koneksi basis data tidak bisa dijalankan di sini; bab-bab itu dibuat sebagai tugas unggah.
- **Server statis harus mendukung header `Range`** (CheerpJ membaca `.jar` per potongan). Vercel, Netlify, dan GitHub Pages mendukungnya. `tools/server_uji.py` sudah menambahkannya untuk uji lokal.
- Belum diuji di Vercel sungguhan, dan jar dimuat dari alamat situs yang sama.

## Menguji kunci jawaban Java

Kunci disimpan di `kunci/<mata-kuliah>/bab-NN.java` (satu berkas, kelas `Main`) dan dijalankan dengan JDK sungguhan:

```bash
python tools/uji_kunci.py
```
