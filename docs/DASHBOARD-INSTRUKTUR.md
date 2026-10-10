# Dashboard instruktur

Halaman untuk dosen: siapa yang sudah paham, siapa yang masih memakai bantuan, dan siapa yang tersangkut. Alamatnya `#instruktur` (tautan **Dashboard instruktur** di menu atas).

## Siapa yang bisa membuka
Hanya akun berperan `instruktur`. Dua lapis:
- **Tampilan:** tautan menu hanya muncul untuk instruktur; peserta yang membuka alamatnya langsung hanya melihat "Khusus instruktur".
- **Database (yang sebenarnya menjaga):** aturan keamanan (RLS) hanya mengizinkan instruktur membaca profil dan progres semua peserta. Peserta biasa yang memaksa memanggil API hanya mendapat datanya sendiri. Ini diuji di `tools/uji_sql` (Tahap F), termasuk bahwa peserta tidak bisa menaikkan perannya sendiri.

Menjadikan dosen instruktur: jalankan `supabase/jadikan_instruktur.sql` (lihat [PEMASANGAN.md](PEMASANGAN.md), bagian C). Tidak ada migrasi baru untuk fitur ini; tabel `progres` dan `percobaan` sudah dibuat oleh migrasi 0001.

## Yang ditampilkan
- Ringkasan: jumlah peserta, rata-rata bab kode selesai, yang belum mulai, dan yang tersangkut (kirim 5 kali atau lebih, belum lulus).
- **Perlu dihampiri:** daftar peserta yang tersangkut, paling banyak kirim di atas.
- **Per bab:** berapa yang selesai, berapa **tanpa petunjuk** dan **dengan petunjuk**, sedang, belum, dan rata-rata kirim. Bab dengan rata-rata kirim tinggi dan banyak yang memakai petunjuk adalah bab yang soal atau materinya perlu diperkuat.
- **Peserta dan bab:** tabel tiap peserta di tiap bab. Lambang: ✓ selesai tanpa petunjuk, ✓* selesai memakai petunjuk, ◐ sedang (angka = berapa kali kirim), ○ belum, – tugas unggah (belum dilacak).
- Saringan prodi, angkatan, kelas, pencarian nama atau NIM, dan urutan. **Unduh CSV** menghasilkan rekap yang bisa dibuka di Excel.

## Tantangan dan praktik dalam satu tabel (tab Progres)

Bila mata kuliah punya praktik (migrasi `0008_praktikum.sql`), tab Progres juga menampilkan praktik:
- **Titik kecil di sudut tiap sel** tabel Peserta dan bab, sama seperti di sisi peserta: kosong (belum), setengah (salah satu bagian sudah dimulai atau lulus), hijau (lulus; di bab yang punya Bagian B, hijau hanya bila Bagian A dan B sama-sama lulus). Arahkan kursor ke sel untuk melihat rincian `A` dan `B`.
- **Tabel Per bab** mendapat kolom Praktik lulus dan Praktik sedang, dan kartu ringkasan memuat berapa peserta yang lulus semua praktik.
- **Penyaring "Tampilkan ... di ..."**: pilih *Tantangan belum selesai*, *Praktik belum lulus*, atau *Tantangan atau praktik belum*, lalu batasi ke satu bab atau semua bab. Tabel hanya menampilkan peserta yang masih tertinggal, jadi mudah mencari siapa yang perlu dihampiri. Penyaring ini bisa digabung dengan penyaring prodi, angkatan, kelas, dan pencarian.

Bila migrasi 0008 belum dijalankan, tab Progres menampilkan tantangan seperti biasa dengan satu pesan bahwa data praktik belum bisa dibaca. Tab **Praktik** menampilkan rincian per bab dan kode peserta.

## Arti "paham"
Bab dianggap dikuasai bila peserta lulus **tanpa membuka satu pun petunjuk** (jalur `langsung`). Bila ia lulus setelah membuka petunjuk, jalurnya `bantuan` (✓*). Ini tanda, bukan vonis: petunjuk memang disediakan untuk belajar. Yang perlu diperhatikan adalah pola: peserta yang hampir semua babnya ✓*, atau bab yang hampir semua pesertanya ✓*.

## Dari mana datanya
Tiap kali peserta menjalankan, mengirim jawaban, atau lulus, situs menyimpan ringkasan ke tabel `progres` dan riwayat kirim (beserta kodenya) ke tabel `percobaan`, di balik layar. Bila internet putus, data menunggu di browser dan dikirim saat tersambung. Saat peserta masuk dari perangkat lain, progresnya dipulihkan dari server. Pekerjaan yang sudah ada di browser sebelum fitur ini dinyalakan ikut dikirim saat peserta masuk berikutnya.

## Kolom "Tempel"
Salin dan tempel dimatikan di halaman latihan (kode, kolom masukan, dan teks soal). Tiap percobaan menempel yang diblokir dicatat sebagai **jumlahnya saja** (isi yang ditempel tidak pernah dicatat) dan muncul di kolom Tempel serta CSV. Anggap ini petunjuk untuk dibicarakan, bukan bukti kecurangan: orang bisa menekan Ctrl+V tanpa maksud buruk. Peserta masih bisa mengetik ulang apa yang dilihatnya, dan perangkat lain tidak bisa dikendalikan dari halaman web, jadi ini hambatan, bukan kunci mutlak. Akun instruktur dikecualikan supaya bisa menguji soal. Pemakaian `blokirSalinTempel` (`site/js/anticopas.js`) juga wajib dipasang pada kolom isian laporan saat laporan dibuat.

Yang belum tercatat: tugas unggah (Bab 3 Algoritma; Bab 4, 11, 12, 15 PBO), waktu aktif, dan laporan praktikum. Isinya muncul di dashboard setelah fiturnya dibuat.

## Mencoba tanpa Supabase
`python tools/server_uji.py`, lalu masuk dengan `dosen@kampus.ac.id` dan kata sandi `Dosen-Uji123`. Server uji menyiapkan 26 peserta contoh dengan progres beragam.

## Tab "Sinyal integritas"
Untuk memilih siapa yang perlu ditanya langsung, bukan untuk memvonis. Perlu migrasi `0005_integritas.sql`. Tiap sinyal punya tingkat (tinggi, sedang, rendah) dan alasan dalam kalimat; tidak ada skor tunggal.

**Yang direkam dari peserta** (diumumkan di halaman Panduan dan lewat spanduk sekali per akun): ID perangkat acak di browser (bukan sidik jari perangkat, bukan alamat IP), waktu dan perubahan kode di editor latihan, kode tiap kirim, dan jumlah percobaan menempel. Isi yang ditempel tidak pernah direkam. Hapus di akhir semester (lihat `arsip_akhir_semester.sql`).

| Sinyal | Muncul bila | Yang perlu diingat |
|---|---|---|
| Perangkat dipakai banyak akun | satu browser dipakai masuk oleh 2 akun (sedang) atau 3 atau lebih (tinggi) | Komputer laboratorium sah dipakai bergantian: tandai lewat tombol **Tandai perangkat bersama** supaya tidak jadi sinyal |
| Memakai beberapa perangkat | satu akun, 2 perangkat pribadi atau lebih (rendah) | Ponsel dan laptop itu wajar |
| Selalu perangkat baru | 4 perangkat yang masing-masing sekali pakai dalam 2 minggu | Jendela penyamaran atau data browser dihapus |
| Mengetik terlalu cepat | lebih dari 9 huruf per detik pada jendela 10 detik, di bab yang lulus | Pengetik cepat 6 sampai 8 |
| Potongan kode besar muncul sekaligus | satu perubahan memasukkan 40 karakter atau lebih tanpa lewat tempel | Bisa dari isian otomatis browser atau dikte |
| Ditulis lurus tanpa koreksi | kode 120 karakter atau lebih, semua ditulis di ujung dokumen, hampir tanpa hapus, tidak pernah dijalankan, langsung lulus (tinggi bila ritmenya sangat rata) | Menulis lurus saja belum berarti apa-apa |
| Cara mengetik berubah dari kebiasaannya | kecepatan di satu bab melonjak jauh dari bab-bab lain milik peserta itu sendiri (butuh 3 bab lain sebagai dasar) | Dibandingkan dengan dirinya, bukan dengan teman |
| Mencoba menempel kode | 1 kali atau lebih (rendah), 5 atau lebih (sedang) | Kebiasaan Ctrl+V tanpa maksud buruk |
| Percobaan salah yang identik | dua atau tiga peserta punya percobaan SALAH yang sama persis | Kode awal dan kesalahan umum (dibuat banyak orang) diabaikan otomatis |
| Ciri penulisan khas yang sama | kode lulus dua peserta memakai 3 atau lebih nama atau komentar langka yang sama (kelas minimal 10 yang lulus) | Soal kecil: jawaban mirip itu wajar; yang dilihat adalah nama dan komentar bebas |
| Lulus pada waktu hampir sama | dua akun lulus dalam selang 90 detik pada 3 atau lebih pasangan bab | Teman belajar bersama bisa begitu |

**Putar ulang cara mengetik:** buka Rincian peserta lalu tekan "Putar ulang" pada sinyal atau pada riwayat kiriman. Rekaman diputar seperti film (bisa 1x sampai 64x, jeda panjang dipersingkat, penekanan tombol Jalankan ditandai). Ini cara paling meyakinkan menilai manusia: kamu melihat sendiri apakah kode ditulis lurus dari atas ke bawah atau diperbaiki dan dijalankan di tengah jalan.

**Cara memakainya:** pilih beberapa peserta dari daftar (tinggi dulu), putar ulang rekamannya, lalu minta mereka menjelaskan atau mengubah satu baris kodenya langsung. Itu yang paling andal; sistem tidak bisa melihat bila peserta menyerahkan laptopnya atau berbagi layar.

**Batas yang jujur:** ID perangkat hilang bila data browser dihapus; alamat IP belum dicatat (butuh fungsi server tambahan); soal bervariasi per peserta belum ada. Semua sinyal punya penjelasan wajar, jadi jangan dijadikan satu-satunya dasar penilaian atau tuduhan.

## Tab Laporan: membaca dan menilai laporan

Laporan peserta selalu terbuka dan tidak pernah dikunci, jadi laporan yang belum lengkap atau kodenya belum lulus juga muncul di sini. Tabel menunjukkan kolom yang memadai (dari lima), jumlah karakter, **persen diketik** (huruf yang tercatat diketik langsung dibanding isi laporan; angka rendah berarti isi masuk lewat jalan lain), percobaan tempel yang diblokir, menit menulis, dan kapan terakhir diekspor PDF.

Tekan "Baca dan nilai" untuk membaca lima kolom (tujuan, pertanyaan konsep, langkah, kendala, kesimpulan) lalu beri skor 1 sampai 4 pada empat rubrik: ketepatan konsep, kejelasan dengan bahasa sendiri, kejujuran refleksi kendala, kesesuaian dengan kode atau hasil, plus komentar opsional. Penilaian hanya bisa ditulis akun instruktur dan tidak ditampilkan ke peserta. "Unduh CSV" mengekspor daftar beserta nilainya. Saringan: bab, hanya yang belum dinilai, cari nama atau NIM.

## Tab Kehadiran: kesiapan, kehadiran, aktivitas, keaktifan

Perlu migrasi `0006_kehadiran.sql`. Rincian cara kerja, aturan hitung, dan batasnya ada di [KEHADIRAN.md](KEHADIRAN.md). Ringkasnya, tab ini punya enam bagian: **Kesiapan** (siapa sudah menyiapkan diri sebelum kelas berikutnya), **Per pertemuan** (kesiapan, keterlibatan saat kelas, dan status hadir, dengan koreksi manual), **Semua pertemuan** (matriks dan CSV), **Aktivitas** (per hari atau per minggu, daftar atau kalender), **Keaktifan** (skor 0 sampai 100 beserta rinciannya), dan **Jadwal** (jadwal tiap kelas, bisa diubah, digeser, atau ditandai libur). Absensi resmi tetap SIAKAD.

## Tab Praktik

Perlu migrasi `0008_praktikum.sql`. Matriks peserta × bab praktik (lulus, sedang, belum), jumlah kirim, bab yang paling sering macet, klik simbol untuk melihat kode praktik peserta (hanya baca), dan unduh CSV. Rincian di [PRAKTIK.md](PRAKTIK.md).

## Tab Laporan akhir

Satu baris per peserta: latihan lulus, praktik lulus, refleksi bab, form akhir, dan sudah diekspor atau belum. *Buka laporan* menampilkan laporan akhir lengkap (kode latihan dan praktik tiap bab, refleksi, form akhir) dan tombol *Unduh PDF*; ada juga unduh CSV. Hanya dibaca. Rincian di [PRAKTIK.md](PRAKTIK.md).

## Tab Jejak peserta dan Riset

Perlu migrasi `0007_riset_perilaku.sql`. Rincian ada di [RISET-PERILAKU.md](RISET-PERILAKU.md). **Jejak peserta** menampilkan semua peserta yang masuk (termasuk yang belum mengerjakan apa pun); tiap peserta bisa dibuka menjadi riwayat satu baris per Jalankan atau Kirim dengan kolom yang bisa dipilih (Waktu, Bab, Hasil, Mengetik, Dihapus, Linier, Lompat, Jalankan, dan lainnya) dan dapat diputar ulang cara menulisnya. **Riset** hanya memuat peserta yang menyetujui: ringkasan kohort dan ekspor data anonim (CSV atau JSON, beserta kamus data).
