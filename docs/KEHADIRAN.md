# Kehadiran dan keaktifan

Tab **Kehadiran** di dashboard instruktur menjawab dua pertanyaan: siapa yang sudah menyiapkan diri sebelum kelas, dan seberapa aktif tiap peserta belajar. Absensi resmi tetap SIAKAD; situs ini menambahkan dua hal yang tidak dimiliki SIAKAD. Perlu migrasi `0006_kehadiran.sql` (lihat [PEMASANGAN.md](PEMASANGAN.md)).

## Cara kerja singkat

1. Kamu mengisi **jadwal tiap kelas** di tab Jadwal (kelas, hari, jam, jumlah pertemuan). Jadwal disimpan per mata kuliah dan per kelas, jadi kelas yang masuk hari berbeda punya tenggat berbeda.
2. Situs mencatat **sesi belajar** peserta: kapan situs dibuka, berapa lama benar-benar aktif, dan bab yang dibuka. Aktif berarti tab terlihat **dan** ada gerakan (ketuk, ketik, gulir, gerak kursor) dalam 90 detik terakhir. Yang dicatat hanya waktu dan bab, tanpa isi apa pun. Akun instruktur tidak dicatat.
3. Dashboard menghitung kesiapan, kehadiran, aktivitas, dan skor dari: sesi, riwayat percobaan (kirim kode atau periksa jawaban), progres lulus, dan laporan.

## Aturan hitung

Semuanya ada di `site/js/kehadiran.js` dan mudah diubah (konstanta di bagian atas berkas).

| Hal | Aturan |
|---|---|
| Tenggat pertemuan | Jam mulai kelas. Jendela kesiapan = 6 hari sebelum jam mulai sampai jam mulai. |
| Siap | Ada pengerjaan (kirim kode atau periksa jawaban, atau lulus bab) di jendela itu. Bila pencatatan sesi sudah berjalan sejak jendela dimulai, peserta juga harus aktif minimal 20 menit. Untuk jendela sebelum pencatatan sesi berjalan, menit aktif tidak diminta karena datanya memang tidak ada. |
| Status pertemuan | `libur` (tidak dihitung), `belum` (kelas belum mulai), `hadir` (siap), `tidak` (tidak siap). Koreksi manual menimpa hasil otomatis. |
| Mepet | Selesai kurang dari 3 jam sebelum kelas mulai. Hanya informasi. |
| Saat kelas | Aktif di situs minimal 15 menit selama jam kuliah, atau mengirim jawaban saat kelas. Hanya informasi tambahan; tidak memengaruhi status hadir. |
| Hanya membaca | Membuka situs minimal 2 menit aktif pada hari itu tanpa mengirim jawaban. |
| Skor keaktifan | 0 sampai 100: waktu aktif 30, bab lulus 30, hari mengerjakan 20, laporan 20. Bila belum ada data sesi, bobot waktu dibuang dan skor diskalakan dari tiga komponen lain agar peserta lama tidak dirugikan. Hanya ringkasan untuk membantu nilai akhir, bukan nilai itu sendiri. |

## Per bulan dan semester (tab Aktivitas)

Selain Per hari dan Per minggu, tab **Aktivitas** punya **Per bulan** dan **Semester** untuk melihat keaktifan sepanjang semester. Tidak ada tabel baru: semuanya dihitung dari data yang sama (percobaan, sesi, progres, laporan).

- **Periode otomatis dari jadwal kelas**: dari Senin pekan pertemuan pertama sampai akhir pekan pertemuan terakhir (pertemuan libur tidak dihitung). Memilih satu kelas membatasi periode ke jadwal kelas itu; memilih Semua kelas memakai gabungan jadwalnya. Bila belum ada jadwal, awal periode diambil dari data aktivitas paling awal.
- **Per bulan**: pilih bulan di baris tombol; tiap peserta punya hari aktif, hari mengerjakan, menit aktif, pengerjaan, Jalankan, dan bab lulus. Bentuk Kalender menampilkan semua bulan sekaligus. Bisa diunduh CSV.
- **Semester**: satu baris per peserta untuk seluruh periode: strip minggu demi minggu (makin pekat makin banyak hari aktif), hari aktif, menit aktif, pengerjaan, Jalankan, bab lulus, persen hadir, dan skor. Judul kolom bisa diklik untuk mengurutkan. Bila ada beberapa kelas, tampil rata-rata per kelas. Bentuk Kalender menampilkan peserta × minggu. Ketuk satu peserta untuk melihat kurva mingguannya selama semester. Bisa diunduh CSV.
- Hari yang belum terjadi tidak dihitung dan minggu yang belum berlangsung ditandai putus-putus. Sesi yang melewati tengah malam dihitung pada hari ia dimulai.
- **Menit aktif baru terkumpul sejak pencatatan sesi berjalan**, jadi bulan atau minggu sebelumnya bisa menunjukkan 0 menit walau peserta aktif; hari aktif, pengerjaan, dan bab lulus tetap terisi dari data lama.

## Jam yang dipercaya

Baris yang masuk ke database diberi **jam server** (`diterima_pada`) oleh database sendiri; browser tidak bisa mengisinya. Yang dipakai adalah jam server bila ada, jika tidak jam perangkat (data lama, sebelum migrasi). Peserta yang mengubah jam perangkatnya tidak bisa membuat tugas tampak selesai lebih awal. Bila jam perangkat menyimpang lebih dari 10 menit dari jam server, dashboard memberi tahu di rincian peserta. Semua tanggal ditampilkan dalam WIB.

## Mengatur jadwal

Tab **Jadwal** → pilih kelas → isi tanggal pertemuan pertama, jam mulai dan selesai, jumlah pertemuan, dan (opsional) tanggal yang dilewati seperti libur nasional, UTS, dan UAS → **Buat jadwal**. Tanggal yang dilewati tidak memakai nomor pertemuan.

- **Ubah**: memindahkan satu pertemuan ke tanggal dan jam lain.
- **Geser**: memindahkan pertemuan itu dan semua sesudahnya ke hari lain pada minggu yang sama (mis. kelas pindah ke Jumat mulai pertemuan 5).
- **Libur / Aktifkan**: pertemuan libur tidak dihitung dalam persentase hadir.
- Mengubah pertemuan yang **sudah atau sedang berlangsung** meminta konfirmasi dan menampilkan dampaknya ("P3: hadir 6 menjadi 0"). Status dihitung ulang otomatis dari jadwal yang berlaku, jadi tidak ada yang perlu diperbaiki manual.
- Semua perubahan tercatat di **riwayat perubahan** (hanya bisa ditambah).
- Membuat ulang jadwal kelas yang sudah ada menimpa semuanya dan meminta konfirmasi.
- Peserta yang kelasnya tidak cocok dengan jadwal mana pun tampil di peringatan dan belum ikut terhitung. Perbaiki lewat jadwal kelas itu atau kelas peserta.

## Koreksi manual

Di tab **Per pertemuan**, tombol **Koreksi** pada tiap peserta: pilih hadir atau tidak hadir beserta alasan (mis. sakit), atau kembali ke otomatis. Koreksi tercatat atas nama pemberinya dan ditandai di matriks dengan tanda bintang.

## Privasi dan keamanan

- Peserta diberi tahu di halaman bab (sekali per akun) dan di Panduan bahwa jam dan lama aktif dicatat untuk kehadiran dan keaktifan.
- Hanya akun instruktur yang membaca data semua peserta (aturan keamanan di database). Peserta hanya bisa menulis sesinya sendiri lewat fungsi `catat_denyut`; tambahan waktu aktif dibatasi waktu nyata di server sehingga tidak bisa digelembungkan dari browser.
- Hapus data ini bersama arsip akhir semester (`supabase/arsip_akhir_semester.sql`).

## Batas yang jujur

- Situs hanya tahu akun itu aktif di situs, bukan siapa yang duduk di depan layar. Tidak menggantikan absensi kelas.
- Menonton video YouTube tidak terukur (video tidak bisa dipantau dari situs); menonton lama tanpa menyentuh halaman tidak terhitung aktif.
- Data sesi baru terkumpul sejak migrasi `0006` dan versi situs ini dipasang. Pertemuan sebelum itu dihitung dari waktu mengerjakan saja.
- Tampilan "Langsung" di tab Per pertemuan memakai tombol Muat ulang data, bukan pembaruan otomatis.
- Perangkat yang tidur atau tab di latar belakang tidak dihitung aktif.
- Belum diuji di Supabase sungguhan, hanya di klien tiruan dan di PostgreSQL lokal (PGlite).
- Impor kehadiran SIAKAD belum ada.

## Menguji di server uji

```bash
python tools/server_uji.py
```

Buka `http://localhost:8124/?tanpakonfirmasi=1&sekarang=2026-10-06T01:47:00Z#instruktur`, masuk sebagai `dosen@kampus.ac.id` / `Dosen-Uji123`, lalu tab Kehadiran. Parameter `sekarang` menggeser jam "sekarang" (hanya di server uji) supaya data contoh bisa dicoba pada waktu tertentu.

Uji otomatis: `node tools/uji_kehadiran.mjs`, `node tools/uji_sesi.mjs`, dan tahap I di `tools/uji_sql` (`npm run uji`).
