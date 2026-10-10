# Praktik per bab

Setiap bab kode di Algoritma dan Pemrograman (Python) dan PBO (Java) punya satu **praktik** di halaman bab itu sendiri, di antara Latihan dan Laporan. Praktik adalah tugas terbimbing yang lebih mudah dari Latihan: kode sudah hampir jadi dan peserta melengkapi bagian bertanda `____`. Tiap praktik berdiri sendiri (tidak berantai), jadi peserta yang melompat bab tetap bisa mengerjakannya. Bab konsep (Algoritma bab 3; PBO bab 4, 11, 12, 15) tidak punya praktik.

## Alur satu bab

1. **Belajar**: video, ringkasan, rujukan buku (sebelum kelas).
2. **Latihan**: soal bab, dinilai otomatis (sebelum kelas).
3. **Praktik**: dikerjakan di kelas atau sesudahnya.
4. **Laporan**: satu kartu laporan per bab. Kode latihan **dan** kode praktik ikut sebagai lampiran PDF.

Praktik wajib untuk melengkapi bab, tetapi **tidak terkunci**: urutan bebas, tidak ada yang menghalangi membuka laporan atau mengekspornya.

## Yang dilihat peserta

- **Lingkaran status bab tidak berubah** (hijau = latihan lulus, seperti sebelumnya). Di sudut kanan atasnya ada **titik kecil** untuk praktik: kosong (belum), setengah kuning (sedang dikerjakan), hijau (lulus). Dipakai di sidebar, kartu bab, dan kepala halaman bab. Bab tanpa praktik tidak menampilkan titik.
- **Kartu Praktik mengecil secara default**: satu baris tipis (judul, status, *Buka*). Dibuka dengan sekali klik, dan pilihan itu diingat per bab.
- Isi kartu: tujuan, langkah, petunjuk bertahap, editor satu berkas, **Jalankan**, **Periksa praktik**, **Kembalikan kerangka**. Pekerjaan tersimpan otomatis dan tidak ada batas percobaan.
- **Dua bagian di bab yang punya Bagian B.** *Bagian A (terbimbing)*: lengkapi `____`. *Bagian B (kembangkan)*: program dasar yang sudah jalan, tanpa `____`; peserta memperluasnya (kasus tepi, data kosong, fitur kecil) dengan skenario yang berbeda dari Tantangan dan tingkat kesulitan setara Tantangan. Keduanya berdiri sendiri dan bebas urutan. Titik di lingkaran status **hijau hanya bila A dan B sama-sama lulus**; bila salah satu sudah dimulai atau lulus, titiknya setengah kuning. Bab tanpa Bagian B cukup Bagian A. Saat ini Bagian B ada di **semua bab berpraktik**: Algoritma (13 bab) dan PBO (11 bab).
- Salin dan tempel dimatikan; jumlah percobaan tempel dicatat (isinya tidak), seperti di Latihan.

## Laporan akhir (satu PDF)

Di bagian bawah halaman mata kuliah ada kartu **Laporan akhir**. Isinya form akhir (3 kolom yang ditulis peserta sendiri; salin dan tempel dimatikan) dan tombol **Ekspor laporan akhir (PDF)**. PDF-nya menggabungkan, untuk setiap bab: status dan jumlah kirim latihan, **kode latihan** (kiriman lulus terakhir, atau kiriman terakhir bila belum lulus), **kode praktik**, dan refleksi laporan bab, lalu form akhir dan kode verifikasi.

Kode tidak diketik atau ditempel peserta: ia ditarik otomatis dari data yang sudah tersimpan (tabel `percobaan`, `praktikum_*`, `laporan`) digabung dengan keadaan terbaru di browser. Kode yang lebih dari 80 baris dipotong dengan keterangan. Ekspor tidak pernah dikunci. Form akhir disimpan di `praktikum_laporan` dengan `praktikum_id = akhir` (migrasi 0008), jadi tidak perlu migrasi baru; bila tabel itu belum ada, laporan tetap bisa dibuat dari bahan yang ada.

## Yang dilihat dosen

- Tab **Praktik** di dashboard: matriks peserta × bab (lulus, sedang, belum), rata-rata kirim, bab yang paling sering macet, unduh CSV, dan klik simbol untuk melihat **kode praktik peserta** (hanya baca).
- Tab **Laporan akhir**: satu baris per peserta (latihan lulus, praktik lulus, refleksi bab, form akhir, sudah diekspor), tombol *Buka laporan* untuk membaca laporan akhir lengkap di layar (kode, refleksi, form akhir) dan *Unduh PDF*, serta CSV.
- Akun instruktur mendapat tombol **Isi kunci (instruktur)** di kartu praktik (lihat bagian di bawah).

## Memasang

Memakai migrasi `0008_praktikum.sql` yang sudah ada (tabel `praktikum_berkas`, `praktikum_tahap`, `praktikum_versi`). Praktik bab 6 disimpan sebagai `praktikum_id = bab-06`; Bagian A memakai `tahap_id = p01` dan Bagian B `p02` (berkas masing-masing satu baris di `praktikum_berkas`). Tidak ada migrasi baru. Situs aman dipasang sebelum atau sesudah migrasi: bila tabel belum ada, pekerjaan tetap tersimpan di browser dan tab Praktik dosen menampilkan petunjuk menjalankan 0008. Mata kuliah tanpa tanda `"praktik": true` tidak memuat apa pun dari fitur ini dan tidak membuat permintaan jaringan tambahan.

Contoh jawaban praktik **tidak ada di situs**. Ia disimpan di tabel `kunci_jawaban` (migrasi `0009`): Bagian A sebagai nomor bab 50 + bab (praktik bab 6 = baris 56) dan Bagian B sebagai 70 + bab (baris 76), hanya bisa dibaca instruktur.

## Menulis praktik sendiri

1. Beri tanda `"praktik": true` pada mata kuliahnya di `site/data/matakuliah.json` (Python atau Java).
2. Buat `site/data/kuliah/<mata kuliah>/praktik/index.json`: `{"bab": [1, 2, 4, ...], "bagianB": [4, 5]}` (`bagianB` hanya berisi bab yang punya Bagian B).
3. Buat satu berkas per bab, `praktik/bab-NN.json`:

```json
{
  "bab": 2, "judul": "Enam operasi pada dua bilangan", "tujuan": "...",
  "berkas": "hitung.py", "masukanContoh": "17\n5",
  "langkah": ["...", "..."],
  "petunjuk": [{"jenis": "soal", "isi": "..."}, {"jenis": "buku", "isi": "..."}],
  "awal": "# hitung.py\na = int(input())\nprint(f\"Kali: {____}\")\n",
  "kasus": [
    {"nama": "dua puluh dan lima", "jalankan": "hitung.py", "masukan": ["20", "5"], "memuat": ["Kali: 100"]},
    {"nama": "fungsi (tersembunyi)", "kode": "from hitung import f\nassert f(2) == 4", "tersembunyi": true}
  ]
}
```

Praktik **Java** memakai satu berkas `Main.java` untuk Bagian A dan `MainB.java` (kelas utama `MainB`, kasus `jalankan` selalu `"MainB"`) untuk Bagian B; keduanya yang berisi kelas-kelas bantu dan `public class Main` (untuk Jalankan); kasus `kode` adalah badan method `main` kelas penguji `Uji` (tersedia `cek(syarat, pesan)`, `sama(diharapkan, nyata)`, `privat(Kelas.class, "atribut")`, `abstrak(Kelas.class)`) dan kasus `jalankan` selalu `"jalankan": "Main"`. Hanya sintaks Java 8 yang didukung penjalan di browser, dan mode tambah (append) pada `FileWriter` belum berfungsi di sana (mengubah isi berkas dilakukan dengan membaca, mengubah di memori, lalu menulis ulang); soal Java yang menulis berkas jangan bergantung pada append.

Bagian B ditulis sebagai kolom `bagianB` di berkas bab yang sama, dengan kolom `judul`, `tujuan`, `langkah`, `berkas` (berbeda dari Bagian A), `masukanContoh`, `petunjuk`, `awal` (program dasar yang sudah jalan, **tanpa `____`**), dan `kasus`; jawabannya di `kunci/<mata kuliah>/praktik-NNb.py`. Kasus yang menguji keluaran program lengkap dengan "tidak boleh memuat" ditulis sebagai kasus `kode` yang menjalankan berkas dengan `runpy` (lihat `bab-04.json`).

Aturan: satu berkas per praktik (`.py` atau `Main.java`); `awal` memuat tanda `____`; minimal dua petunjuk dan tiga kasus; kasus `jalankan` menjalankan berkas dengan `masukan` lalu memeriksa bahwa keluaran memuat semua teks di `memuat`; kasus `kode` dijalankan dengan `assert` setelah berkas peserta dimuat. Kasus `tersembunyi` hanya menyembunyikan rincian di layar peserta. **Jangan** menaruh kolom `contoh` (jawaban) di JSON: validator menolaknya.

4. Simpan contoh jawaban di `kunci/<mata kuliah>/praktik-NN.py` atau `praktik-NN.java` (folder `kunci/` diabaikan git), lalu:

```bash
python tools/validasi_konten.py   # struktur dan rujukan bab
python tools/uji_praktik.py       # praktik Python: kerangka harus gagal; contoh harus meluluskan semua kasus
node tools/uji_praktik_java.mjs   # praktik Java, dengan JVM sungguhan (butuh java di PATH)
python tools/buat_sql_kunci.py    # membuat kunci/kunci_jawaban.sql (termasuk kunci praktik)
```

Tempel isi `kunci/kunci_jawaban.sql` di Supabase SQL Editor dan Run (aman diulang) setiap kali menambah atau mengubah kunci.

## Jawab otomatis (khusus instruktur)

Akun instruktur mendapat tombol **Isi kunci (instruktur)** di soal latihan kode (Python dan Java), soal konsep, dan kartu praktik. Tombol mengisi kunci lalu mengirimkannya. Kunci soal kode dan praktik dibaca dari tabel `kunci_jawaban` (hanya instruktur yang bisa membaca; tidak seorang pun bisa menulis lewat API); kunci soal konsep dibaca dari berkas soal. Hasilnya masuk ke akun instruktur saja dan tidak ikut hitungan kelas. Peran dicek lewat database; menyembunyikan tombol di browser hanya kemudahan.

## Mencoba di komputer

`python tools/server_uji.py`, buka `http://localhost:8124/`, masuk sebagai `siti@kampus.ac.id` (kata sandi awal `Sandi-Awal-1`, lalu buat yang baru) atau dosen `dosen@kampus.ac.id` / `Dosen-Uji123`. Tambahkan `?tanpa0008=1` untuk meniru database yang belum menjalankan migrasi 0008, dan `?tanpa0009=1` untuk meniru yang belum menjalankan 0009. Server uji membaca kunci dari folder `kunci/` lokal.

## Batas saat ini

Tugas akhir PBO (ruang kerja multi-berkas, unggah laptop, rubrik; lihat [RUBRIK-PBO.md](RUBRIK-PBO.md)) masih berupa data dan penjalan tanpa tampilan, karena dibangun di atas ruang praktikum lama yang sudah dihapus. Kasus uji berjalan di browser peserta, jadi ini bukan ujian tertutup; pakai bersama laporan dan sinyal tempel untuk menilai.
