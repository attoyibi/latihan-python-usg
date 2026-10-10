# Praktikum: proyek berantai

Praktikum adalah satu proyek yang tumbuh dari bab ke bab dan berakhir pada produk yang bisa dijalankan. Di Algoritma dan Pemrograman, proyeknya **Kasir UD Rasa Gresik** (10 tahap, Python). Ini tambahan di luar latihan bab; latihan bab tidak berubah.

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

Situs aman dipasang sebelum atau sesudah migrasi: bila tabel belum ada, pekerjaan peserta tetap tersimpan di browser dan penyusulan ke server berhenti diam-diam; tab Praktikum dosen menampilkan petunjuk menjalankan 0008. Mata kuliah tanpa folder `praktikum/` (mis. PBO) tidak menampilkan apa pun dari fitur ini.

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

## Mencoba di komputer

`python tools/server_uji.py`, buka `http://localhost:8124/`, masuk sebagai `siti@kampus.ac.id` (kata sandi awal `Sandi-Awal-1`, lalu buat yang baru) atau dosen `dosen@kampus.ac.id` / `Dosen-Uji123`. Tambahkan `?tanpa0008=1` untuk meniru database yang belum menjalankan migrasi.

## Batas fase pertama

Hanya jalur **di website** dan hanya Python. Belum ada: jalur laptop (unggah berkas), jalur ponsel, praktikum Java (butuh penjalan Java multi-berkas), dan penghapusan berkas yang menjalar antar perangkat. Kasus uji berjalan di browser peserta, jadi bukan alat ujian tertutup; pakai bersama laporan dan sinyal tempel untuk menilai.
