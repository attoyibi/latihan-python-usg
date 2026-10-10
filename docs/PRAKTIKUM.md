# Praktikum: proyek berantai

Praktikum adalah satu proyek yang tumbuh dari bab ke bab dan berakhir pada produk yang bisa dijalankan. Di Algoritma dan Pemrograman, proyeknya **Kasir UD Rasa Gresik** (11 tahap, Python). Urutannya mengikuti bab: tahap 1 sampai 4 berupa skrip dengan `input()` dan `print()` (variabel, if, perulangan, list), dan fungsi baru dipakai di tahap 5 (bab 8). Ini tambahan di luar latihan bab; latihan bab tidak berubah.

## Yang dilihat peserta

- **Halaman mata kuliah**: bagian **Praktikum** di paling bawah, dan tanda **Ada praktik** di kartu bab yang punya tahap praktik.
- **Halaman bab**: bar kecil "Ada praktik untuk bab ini" dengan tombol *Kerjakan praktik* dan *Nanti saja* (pilihan itu diingat per bab).
- **Daftar tahap** (`#k/<mata kuliah>/praktikum/<praktikum>`): status tiap tahap, tombol lanjut, ekspor aplikasi (HTML), dan laporan.
- **Halaman tahap**: tujuan, langkah (kotak centang hanya penanda), petunjuk, dan **ruang kerja** bebas: peserta membuat berkas sendiri (baru, ganti nama, hapus), menjalankan, lalu menekan *Kirim jawaban* untuk diuji.

Tidak ada yang terkunci. Tahap boleh dibuka urut apa saja, dilewati, atau diganti berkas contoh. Peserta yang tertinggal mendapat berkas contoh dari tahap sebelumnya otomatis (bertanda *contoh*) supaya tahap ini tetap bisa jalan; laporan mencatat tahap yang memakai contoh. Setiap *Kirim* menyimpan satu versi (semua berkas dan hasil uji) yang bisa dipulihkan dari *Riwayat versi*. Laporan praktikum (3 kolom) dan **Ekspor PDF** selalu aktif.

Hasil akhir diekspor sebagai **satu halaman HTML** yang berdiri sendiri: dibuka dengan klik dua kali, Python dimuat di browser (butuh internet sekali), `input()` ditanyakan lewat kotak dialog.

Salin dan tempel dimatikan di ruang kerja dan laporan seperti di latihan bab; jumlah percobaan tempel dicatat (isinya tidak). Berkas kerja dan jam kirim disimpan di akun dan dapat dilihat dosen.

## Yang dilihat dosen

Tab **Praktikum** di dashboard: matriks peserta × tahap (lulus, lulus dengan contoh, sedang, dilewati), jumlah kirim, status laporan, percobaan tempel, ringkasan per tahap (tahap yang sering macet), tombol *Lihat berkas* (hanya baca), dan unduh CSV. "Belum mulai" bukan berarti tertinggal karena praktikum tidak wajib.

## Memasang

Jalankan `supabase/migrations/0008_praktikum.sql` setelah 0001 sampai 0007 (lihat [PEMASANGAN.md](PEMASANGAN.md)). Migrasi hanya **menambah** empat tabel baru (`praktikum_berkas`, `praktikum_tahap`, `praktikum_versi`, `praktikum_laporan`); tabel dan data yang sudah ada tidak diubah.

Situs aman dipasang sebelum atau sesudah migrasi: bila tabel belum ada, pekerjaan peserta tetap tersimpan di browser dan penyusulan ke server berhenti diam-diam; tab Praktikum dosen menampilkan petunjuk menjalankan 0008. Mata kuliah tanpa tanda `"praktikum": true` tidak menampilkan apa pun dari fitur ini dan tidak membuat permintaan jaringan tambahan.

## Menulis praktikum sendiri

Praktikum adalah berkas JSON di situs, bukan di database; kapan dan oleh siapa dikerjakan tidak ditanam di kode. Beri tanda `"praktikum": true` pada mata kuliahnya di `site/data/matakuliah.json` (mata kuliah tanpa tanda ini tidak memuat apa pun dari fitur ini), lalu letakkan di `site/data/kuliah/<mata kuliah>/praktikum/`:

- `index.json`: daftar praktikum `[{id, judul, deskripsi, berkas, jumlahTahap}]`. Satu mata kuliah boleh punya banyak praktikum.
- `<berkas>.json` per praktikum:

```json
{
  "id": "kasir", "judul": "...", "deskripsi": "...", "bahasa": "python", "jalur": ["web"], "entri": "kasir.py",
  "gambaran": ["satu kalimat tentang apa yang dibangun"],
  "tahap": [{
    "id": "t01", "judul": "...", "bab": [2], "tujuan": "...",
    "langkah": ["..."], "diminta": ["subtotal.py"],
    "petunjuk": [{"jenis": "soal", "isi": "..."}],
    "awal":   {"subtotal.py": "# kerangka\n"},
    "contoh": {"subtotal.py": "# jawaban contoh\n"},
    "kasus": [
      {"nama": "hitung", "kode": "from subtotal import subtotal\nassert subtotal(2, 5) == 10"},
      {"nama": "menu (tersembunyi)", "jalankan": "kasir.py", "masukan": ["0"], "memuat": "Terima kasih", "tersembunyi": true}
    ]
  }]
}
```

Aturan: `bab` menunjuk bab yang ada (muncul tanda "Ada praktik"); berkas `contoh` dimiliki satu tahap saja; `diminta` ada di `awal` atau `contoh`; kasus `kode` dijalankan dengan `assert` setelah berkas peserta dimuat, kasus `jalankan` menjalankan berkas dengan `masukan` dan memeriksa keluaran. Kasus `tersembunyi` hanya menyembunyikan rincian di layar peserta (kodenya tetap ada di berkas JSON situs, sama seperti soal bab).

Periksa dengan:

```bash
python tools/validasi_konten.py     # struktur dan rujukan bab
python tools/uji_praktikum.py       # semua kasus: kerangka awal harus gagal, contoh jawaban harus lulus
```

## Jawab otomatis (khusus instruktur)

Untuk mencoba atau memperagakan situs, akun **instruktur** mendapat tombol pengisi jawaban. Peserta tidak melihatnya.

- **Praktikum**: *Jawab semua tahap otomatis* di daftar tahap, dan *Jawab otomatis* di tiap tahap. Mengisi berkas contoh lalu mengujinya; hasilnya masuk ke akun instruktur saja dan tidak ikut hitungan kelas.
- **Soal latihan kode** (Python dan Java): *Isi kunci* di bab. Mengisi editor dengan kunci lalu menekan Kirim jawaban.
- **Soal konsep**: *Isi kunci* mengisi semua butir dengan jawaban benar (dari berkas soal) lalu memeriksanya.

Kunci soal kode **tidak ada di situs maupun di GitHub**. Ia disimpan di tabel `kunci_jawaban` (migrasi `0009`) yang hanya bisa dibaca instruktur lewat aturan keamanan database; tidak seorang pun bisa menulisnya lewat API. Memasukkan atau memperbarui kunci:

```bash
python tools/uji_kunci.py        # pastikan semua kunci cocok dengan kasus uji
python tools/buat_sql_kunci.py   # membuat kunci/kunci_jawaban.sql (folder kunci/ diabaikan git)
```

lalu tempel isi `kunci/kunci_jawaban.sql` di Supabase SQL Editor dan Run (aman diulang). Setelah menambah kunci baru atau mengubah soal, ulangi dua langkah itu.

Catatan: laporan praktikum tidak diisi otomatis. Peran instruktur dicek lewat database; menyembunyikan tombol di browser hanyalah kemudahan, bukan pengaman.

## Mencoba di komputer

`python tools/server_uji.py`, buka `http://localhost:8124/`, masuk sebagai `siti@kampus.ac.id` (kata sandi awal `Sandi-Awal-1`, lalu buat yang baru) atau dosen `dosen@kampus.ac.id` / `Dosen-Uji123`. Tambahkan `?tanpa0008=1` untuk meniru database yang belum menjalankan migrasi.

## Batas fase pertama

Hanya jalur **di website** dan hanya Python. Belum ada: jalur laptop (unggah berkas), jalur ponsel, praktikum Java (butuh penjalan Java multi-berkas), dan penghapusan berkas yang menjalar antar perangkat. Kasus uji berjalan di browser peserta, jadi bukan alat ujian tertutup; pakai bersama laporan dan sinyal tempel untuk menilai.

## Praktikum Java (PBO)

PBO memakai bentuk yang berbeda dari Kasir: **latihan mandiri per bab** dan satu **tugas akhir**.

- **Latihan per bab** (`jenis: "latihan"`): bab 2, 3, 5, 6, 7, 8, 9, 10, 13, dan 14, masing-masing dengan dua tahap kecil. Tiap latihan berdiri sendiri (topik dan kelasnya berbeda dari latihan lain), diuji otomatis seperti Kasir, dan tidak punya laporan atau ekspor. Peserta yang melewatkan satu bab tidak terseret ke bab berikutnya. Berkas contoh tersedia bagi yang tertinggal.
- **Tugas akhir** (`jenis: "proyek"`, `izinUnggah: true`): satu aplikasi konsol yang menggabungkan semua konsep, dengan ruang kerja multi-berkas, tombol **Unggah berkas dari laptop**, **Periksa kompilasi**, penanda kelengkapan otomatis, laporan 3 kolom, ekspor kode (HTML), dan **Tandai siap dinilai**. Soalnya sama untuk semua peserta: yang berlaptop mengunggah berkas `.java` dan `Rancangan.md` dari laptopnya, yang tidak berlaptop mengerjakannya langsung di sini, dan dosen menilai dari satu tempat dengan tampilan yang sama. Tugas akhir **tidak diuji otomatis** (tahap bertanda `dinilaiDosen`); rubriknya ada di [RUBRIK-PBO.md](RUBRIK-PBO.md) dan tampil juga di halaman daftar tahap.

Penguji Java memakai penjalan multi-berkas ([PENJALAN-JAVA.md](PENJALAN-JAVA.md)). Skema kasus Java:

```json
{"nama": "info", "kode": "Produk p = new Produk(\"Pudak\", 5000, 20);
sama(\"Pudak Rp5000 x20\", p.info());"}
{"nama": "menu", "jalankan": "Main", "masukan": ["1", "Bumi", "0"], "memuat": ["Dipinjam: Bumi"]}
```

Kasus `kode` adalah isi method `main` kelas penguji `Uji` yang dikompilasi bersama berkas peserta; tersedia `cek(syarat, pesan)`, `sama(diharapkan, nyata)`, `privat(Kelas.class, "atribut")`, `abstrak(Kelas.class)`, dan `import java.util.*`. Bahasa Java dibatasi tingkat Java 8 (tanpa `var`, `record`, dan sejenisnya). Berkas `Uji.java`, `GagalUji.java`, dan `JavaRun.java` tidak boleh dipakai peserta.

Memeriksa isi (butuh `java` di PATH, memakai penyusun dan penjalan yang sama dengan browser):

```bash
node tools/uji_praktikum_java.mjs   # contoh lulus, kerangka gagal, produk berjalan; juga memeriksa kunci tugas akhir bila ada
```

### Menambah atau mengubah latihan

Latihan dibangun dari satu berkas JSON per latihan (`site/data/kuliah/pbo-java/praktikum/<id>.json`) yang didaftarkan di `index.json`. Aturannya sama dengan skema di atas, ditambah: `jenis` (`latihan` atau `proyek`), `bab` (nomor bab latihan), `tanpaLaporan` (sembunyikan laporan dan ekspor), `izinUnggah`, `penilaian` (rubrik yang ditampilkan), dan pada tahap: `dinilaiDosen` (tanpa kasus uji) serta `kunciBab` (contoh jawaban diambil dari tabel kunci, bukan dari berkas situs).

### Contoh jawaban tugas akhir (instruktur)

Contoh jawaban tugas akhir **tidak** ada di situs karena nilai peserta ditentukan olehnya. Letakkan sebagai `kunci/pbo-java/tugas-akhir.json` (objek nama berkas -> isi), lalu jalankan `python tools/buat_sql_kunci.py` dan tempel `kunci/kunci_jawaban.sql` di SQL Editor (disimpan sebagai bab 99). Tombol *Jawab otomatis (instruktur)* di tahap tugas akhir mengisi berkas dari tabel itu dan memeriksa kompilasinya. Tombol *Jawab semua praktikum otomatis (instruktur)* di bagian Praktikum halaman mata kuliah menjalankan semua latihan dan tugas akhir sekaligus (sekitar satu menit).
