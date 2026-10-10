# Uji lapangan: Supabase sungguhan dan ponsel sungguhan

Semua uji otomatis memakai klien Supabase tiruan, PostgreSQL tiruan (PGlite), dan emulasi layar ponsel. Dua hal berikut hanya bisa dibuktikan dengan akun Supabase asli dan ponsel asli. Kerjakan sekali setelah menayangkan, dengan **akun uji** (satu peserta uji dan satu instruktur), bukan akun peserta nyata.

## A. Supabase sungguhan

Siapkan: migrasi `0001` sampai `0009` terpasang (`supabase/periksa_migrasi.sql` menunjukkan sembilan kolom `true`), dan `kunci/kunci_jawaban.sql` sudah dijalankan.

| # | Langkah (akun peserta uji) | Yang harus terjadi |
|---|---|---|
| 1 | Buka bab berpraktik, buka kartu Praktik, ketik sebagian, tunggu 5 detik | Di Table Editor `praktikum_berkas` muncul satu baris (`praktikum_id = bab-NN`, `nama` sesuai berkas); `praktikum_tahap` berstatus `sedang` |
| 2 | Tekan Periksa praktik sampai lulus | `praktikum_tahap.status = lulus`, `jumlah_kirim` naik, satu baris baru di `praktikum_versi`; titik di lingkaran status menjadi hijau |
| 3 | Masuk dari browser atau perangkat lain dengan akun yang sama | Titik praktik dan isi kode muncul tanpa mengetik ulang |
| 4 | Isi form akhir di halaman mata kuliah, tunggu 5 detik | `praktikum_laporan` punya baris `praktikum_id = akhir` dengan jawaban dan `kode_verifikasi` 8 karakter |
| 5 | Ekspor laporan akhir (PDF) | PDF terunduh: identitas, ringkasan, tiap bab dengan status, kode latihan, kode praktik, refleksi, form akhir, kode verifikasi di kaki |
| 6 | Masih sebagai peserta: lihat kartu praktik dan kartu soal latihan | Tombol **Isi kunci** TIDAK muncul (hanya untuk instruktur) |

| # | Langkah (akun instruktur) | Yang harus terjadi |
|---|---|---|
| 7 | Dashboard, tab Praktik | Peserta uji muncul dengan simbol sesuai; klik simbol menampilkan kode peserta (hanya baca) |
| 8 | Dashboard, tab Laporan akhir, Buka laporan | Laporan lengkap peserta uji tampil dan bisa diunduh sebagai PDF |
| 9 | Soal latihan atau praktik, tombol Isi kunci | Kunci terisi dan dinilai lulus (membuktikan tabel `kunci_jawaban` terbaca instruktur) |
| 10 | Coba tombol Isi kunci sebagai peserta lewat konsol: `await ...from("kunci_jawaban").select()` | Hasil kosong (RLS), bukan galat dan bukan isi kunci |

Jika langkah 1 sampai 5 gagal dengan galat di konsol browser, salin pesannya; penyebab paling umum: migrasi 0008 belum dijalankan (pekerjaan tetap aman di browser), atau kunci asing profil belum ada.

Yang perlu diperhatikan khusus: **ukuran data**. Laporan akhir mengambil semua baris `percobaan` jenis kirim milik satu peserta. Bila ada akun uji dengan ratusan kiriman, ekspor harus tetap selesai dalam beberapa detik. Catat waktunya.

## B. Ponsel sungguhan

Uji di minimal satu ponsel Android (Chrome) dan satu iPhone (Safari), memakai alamat situs sebenarnya.

| # | Yang diuji | Yang harus terjadi |
|---|---|---|
| 1 | Daftar bab dan sidebar | Titik kecil praktik terlihat di sudut lingkaran status, tidak terpotong |
| 2 | Kartu Praktik mengecil lalu dibuka | Terbuka dengan satu ketukan; tidak ada geser samping |
| 3 | Mengetik di editor | Papan ketik tidak menutupi baris yang sedang diketik; tanda kurung dan indentasi bisa diketik |
| 4 | Jalankan lalu Periksa praktik (Python dan Java) | Selesai; Java butuh waktu muat lebih lama pertama kali |
| 5 | Ketuk Tempel lalu Tahan di editor | Tempel ditolak dengan pesan (salin-tempel dimatikan) |
| 6 | Form akhir lalu Ekspor PDF | PDF terunduh dan bisa dibuka; tombol cukup besar untuk diketuk |
| 7 | Putar layar (tegak dan mendatar) | Tata letak tetap terbaca |

Catat tipe ponsel, versi browser, dan apa yang terasa lambat atau sulit; hal-hal itu paling berguna untuk perbaikan berikutnya.
