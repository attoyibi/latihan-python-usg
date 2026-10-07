# Jejak peserta dan riset perilaku belajar

Dua tab di dashboard instruktur untuk melihat apa yang dikerjakan peserta di situs dan, bila kamu meneliti, menjadikannya data. Perlu migrasi `0007_riset_perilaku.sql` (lihat [PEMASANGAN.md](PEMASANGAN.md)). Berbeda dari **Sinyal integritas** (siapa yang perlu ditanya), di sini tidak ada penilaian curiga: hanya catatan apa yang dilakukan peserta, berhasil maupun gagal.

## Yang dicatat

Setiap kali peserta menekan **Jalankan** atau **Kirim jawaban** (atau **Periksa jawaban** di bab konsep), satu baris disimpan di tabel `percobaan`:

| Isi | Keterangan |
|---|---|
| Waktu | Jam server bila ada, jika tidak jam perangkat. |
| Bab, jenis | `jalankan`, `kirim`, atau konsep (periksa). |
| Hasil | Jalankan: berjalan, galat, atau terlalu lama. Kirim: lulus atau gagal beserta jumlah kasus uji. |
| Jenis galat | Mis. `SyntaxError`, `NameError` (Python), `CannotResolve`, `NullPointerException` (Java), plus satu baris pesan singkat. **Keluaran program peserta tidak disimpan.** |
| Cocok contoh | Untuk Jalankan: keluaran cocok dengan contoh atau tidak (bila dibandingkan). |
| Petunjuk | Berapa petunjuk (0 sampai 3) sudah terbuka pada saat itu. |
| Cara menulis | Mengetik (huruf per detik), persen dihapus, linier, lompat, jumlah Jalankan, dan rekaman yang bisa diputar ulang. |
| Kode | Kode yang dijalankan atau dikirim (maks 20.000 karakter). |

Buka buku dan menonton video belum tercatat per kejadian (video YouTube tidak bisa dipantau dari situs). Jam dan lama aktif di situs ada di data sesi (lihat [KEHADIRAN.md](KEHADIRAN.md)).

## Tab Jejak peserta

1. **Semua peserta** yang pernah masuk, termasuk yang belum mengerjakan apa pun: terakhir aktif, sesi, menit aktif, jumlah Jalankan dan Kirim, persen lulus, galat. Bisa dicari, disaring per kelas, diurutkan (klik judul kolom), dan diunduh sebagai CSV.
2. Ketuk satu peserta: **riwayat** satu baris per Jalankan atau Kirim. Kolom bisa dipilih lewat **Pilih kolom** (Waktu, Bab, Jenis, Hasil, Galat, Mengetik, Dihapus, Linier, Lompat, Jalankan, Petunjuk, Aktif, Puncak, Panjang kode); pilihanmu diingat di browser. Saringan: bab, jenis, hasil. Urutan terlama atau terbaru dulu. Unduh CSV riwayat satu peserta.
3. **Putar** pada tiap baris memutar ulang cara peserta menulis: dari awal bab sampai baris itu (rekaman bagian-bagian digabung), atau hanya bagian baris itu. Kecepatan 1x sampai 64x, penggeser waktu, dan penanda saat Jalankan ditekan. Rekaman baris Jalankan berisi catatan sejak Kirim terakhir sampai tombol itu ditekan; bila terlalu besar (di atas 20 ribu karakter) rekaman tidak disimpan dan yang tampil hanya kodenya.

Data lama (sebelum fitur ini) hanya berisi Kirim, tanpa Jalankan dan hasil rinci; kolom yang kosong tampil sebagai tanda strip.

## Persetujuan penelitian

- Peserta ditanya sekali di halaman bab (**Setuju**, **Tidak setuju**, atau **Nanti**, yang menunda tiga hari) dan bisa mengubah pilihan kapan saja di **Profil** > Penelitian. Teksnya menjelaskan tujuan, bahwa data dipakai anonim dengan kode acak, dan bahwa menolak tidak berpengaruh pada nilai, akses, atau perlakuan dosen.
- Database mencatat pilihan dan waktunya. **Kode riset** (`R-` diikuti 8 karakter acak) dibuat otomatis saat peserta setuju dan tidak bisa diubah peserta. Menarik persetujuan tidak menghapus kode (supaya konsisten), tetapi peserta itu tidak ikut ekspor berikutnya.
- Tab Jejak peserta tetap menampilkan **semua** peserta karena itu bagian dari mengajar dan memantau. Hanya tab **Riset** dan ekspor yang dibatasi pada yang setuju.
- **Izin etik institusi dan nomor persetujuan etik adalah urusanmu sebagai peneliti**; situs tidak menggantikannya. Pastikan itu ada sebelum data dipakai untuk paper, dan sesuaikan teks persetujuan (`TEKS_RISET` di `site/js/app.js`) dengan yang disetujui komite etik.

## Tab Riset

- **Persetujuan:** berapa yang menyetujui, menolak, dan belum menjawab.
- **Kohort** (hanya yang setuju): jenis galat saat menjalankan (dikelompokkan: Sintaks, Nama tidak dikenal, Tipe dan nilai, Pembagian nol, Akses data, Berjalan terlalu lama, Lainnya), median Kirim sampai lulus pertama per bab, persen bab lulus tanpa petunjuk, dan perilaku saat tersangkut (butuh tiga Kirim atau lebih): membuka petunjuk, menghapus banyak dan menulis ulang, kembali di hari lain (jeda lebih dari 6 jam). Angkanya deskriptif; hati-hati menyimpulkan dari kohort kecil.
- **Ekspor data anonim:** CSV atau JSON, ditambah **kamus data** yang menjelaskan tiap kolom (bisa dikutip di bagian metode paper). Identitas diganti `kode_riset`; nama, NIM, kelas, dan tanggal kalender tidak disertakan (waktu = hari ke-n sejak awal data, dan detik sejak mulai bab). Opsional: angkatan, kode lengkap (bisa memuat identitas bila peserta menuliskannya sendiri di kodenya), dan rekaman menulis. Setiap ekspor tercatat di **riwayat ekspor** (siapa, kapan, apa yang disertakan) dan riwayat itu tidak bisa diubah.

## Keamanan dan privasi

- Baris percobaan hanya terbaca oleh peserta itu sendiri dan akun instruktur (aturan keamanan database). Persetujuan dan kode riset orang lain tidak terbaca peserta.
- Rekaman Jalankan dibatasi 20 ribu karakter di klien dan 40 ribu di database supaya database tidak menggembung. Perkiraan: 80 peserta × 14 bab × sekitar 15 Jalankan × beberapa KB per baris = puluhan MB per semester.
- Hapus atau arsipkan bersama data lain di akhir semester (`supabase/arsip_akhir_semester.sql` sudah memuat langkahnya, termasuk menghapus kunci pemetaan `kode_riset`). Untuk paper, simpan ekspor anonim dan kamus datanya di tempat aman sebelum menghapus.

## Bila migrasi belum dijalankan

Situs tidak macet: Kirim tetap tersimpan seperti biasa (tanpa kolom baru) dan baris Jalankan dilewati. Tab Jejak peserta memuat Kirim saja dengan peringatan, sedangkan tab Riset dan pilihan persetujuan menampilkan pesan belum dipasang. Jalankan `0007` lalu muat ulang.

## Menguji di server uji

```bash
python tools/server_uji.py
```

Buka `http://localhost:8124/?tanpakonfirmasi=1&sekarang=2026-10-06T01:47:00Z#instruktur`, masuk sebagai `dosen@kampus.ac.id` / `Dosen-Uji123`, lalu tab Jejak peserta atau Riset. Tambahkan `&tanpa0007=1` untuk meniru database yang belum menjalankan migrasi.

Uji otomatis: `node tools/uji_galat.mjs`, `node tools/uji_jejak.mjs`, `node tools/uji_riset.mjs`, `node tools/uji_rekam.mjs`, `node tools/uji_sinkron.mjs`, dan tahap J dan K di `tools/uji_sql` (`npm run uji`).
