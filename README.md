# latihan-python-usg

Platform latihan di browser untuk **banyak mata kuliah**, berbasis kode maupun tidak. Saat ini:

- **Algoritma dan Pemrograman** (Python), pendamping buku ajar *Algoritma dan Pemrograman: Fondasi Berpikir Komputasional dengan Python* (Muhammad Muchson Attoyibi, USG Press, 2026). Aktif.
- **Pemrograman Berorientasi Objek** (Java). Tempat dan databasenya sudah siap; materinya sedang disiapkan.

Menambah mata kuliah baru cukup satu perintah dan beberapa berkas isi: [docs/MENAMBAH-MATAKULIAH.md](docs/MENAMBAH-MATAKULIAH.md).

Peserta memilih mata kuliah, menulis kode langsung di browser, dinilai otomatis, lalu mengerjakan laporan praktikum singkat. Bab **tidak dikunci**: peserta bebas memilih bab mana pun, dan tiap bab diberi penanda belum, sedang, atau selesai. Yang sudah mahir langsung mengerjakan tantangan; yang belum bisa membuka petunjuk, bagian buku, dan video bantuan.

## Status

Proyek sedang dibangun bertahap. Daftar lengkapnya ada di [CHECKLIST.md](CHECKLIST.md).

| Sudah jalan | Belum |
|---|---|
| Beranda, pemilih mata kuliah, Panduan, halaman bab | Tantangan Bab 1–3 dan 5–14 Algoritma (baru Bab 4 yang lengkap) |
| Banyak mata kuliah: progres terpisah, bahasa per mata kuliah, "Segera hadir" | Materi, soal, dan penjalan kode untuk PBO Java |
| Editor kode Python dengan sorotan sintaks | Laporan praktikum dan ekspor PDF |
| Python di browser (Pyodide), batas waktu 5 detik | |
| Penilaian otomatis dengan kasus uji tersembunyi | Penyimpanan progres di Supabase (progres masih di browser) |
| Tiga penanda status bab, tanpa kunci | Log aktivitas, dashboard instruktur, unggah tugas Bab 3 |
| Halaman depan publik (landing); masuk lewat tautan email baru diminta saat memilih mata kuliah; data awal (nama, NIM, kelas) sekali; halaman Profil. Diuji dengan klien tiruan, belum dengan Supabase sungguhan | |
| Video bantuan per bab (YouTube) | |
| Skema database Supabase dan aturan keamanannya, diuji di PostgreSQL sungguhan lewat PGlite (belum di proyek Supabase sungguhan) | |

Halaman depan terbuka untuk siapa saja. Peserta baru diminta **masuk lewat tautan email** saat memilih mata kuliah, lalu mengisi data awal (nama, NIM, kelas) satu kali; data bisa diubah di halaman Profil. Bila Supabase belum dikonfigurasi, memilih mata kuliah menampilkan layar pemasangan.

## Memakai untuk kelasmu

Proyek ini dirancang agar bisa dipakai kampus atau pengajar lain dengan **kunci Supabase mereka sendiri**, tanpa mengedit satu berkas pun:

1. **Fork** repositori ini.
2. Buat proyek **Supabase** sendiri dan tempel tiga berkas SQL di `supabase/migrations/`.
3. Sambungkan fork ke **Vercel** (atau Cloudflare Pages / Netlify) dan isi dua *environment variable*: `SUPABASE_URL` dan `SUPABASE_ANON_KEY`.

Saat penayangan, `tools/buat_config.mjs` membuat `site/config.js` dari variabel itu. Kunci `service_role` ditolak otomatis. Karena Anda tidak mengubah berkas apa pun, **Sync fork** di GitHub selalu mulus.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fattoyibi%2Flatihan-python-usg&env=SUPABASE_URL,SUPABASE_ANON_KEY&envDescription=URL%20proyek%20Supabase%20dan%20kunci%20anon%20(BUKAN%20service_role)&envLink=https%3A%2F%2Fgithub.com%2Fattoyibi%2Flatihan-python-usg%2Fblob%2Fmain%2Fdocs%2FPEMASANGAN.md&project-name=latihan-python&repository-name=latihan-python)

Tombol di atas membuat *salinan* (bukan fork), jadi tidak ada Sync fork. Untuk pembaruan berkelanjutan, pakai fork. Langkah lengkap: [docs/PEMASANGAN.md](docs/PEMASANGAN.md). Cara menarik pembaruan: [docs/MEMPERBARUI.md](docs/MEMPERBARUI.md).

## Menjalankan

Butuh Python 3 (hanya untuk server statis lokal) dan koneksi internet.

```bash
cd site
python -m http.server 8000
```

Buka `http://localhost:8000`. Tanpa Supabase situs akan meminta pemasangan; untuk mencoba alur masuk dengan login tiruan jalankan `python tools/server_uji.py` (dari akar repositori) lalu buka `http://127.0.0.1:8124`; tombol di kotak "Email tiruan" meniru klik tautan di email.

## Struktur

```
site/                 Situs statis (HTML, CSS, JavaScript biasa, tanpa build)
  data/               Isi: matakuliah.json, config.json, kuliah/<id>/{materi.json, challenges/}
  css/tokens.css      Warna, huruf, ukuran (ganti di sini untuk mengubah tema)
  js/                 app, pyworker (Pyodide), runner, grader
supabase/migrations/  Skema dan aturan keamanan database (tempel ke SQL Editor)
tools/                Validasi isi, uji kunci, uji SQL (PGlite), pembuat config.js dan mata kuliah baru, server uji
vercel.json, netlify.toml, site/_headers   Setelan penayangan
docs/                 Pemasangan, menambah bab, mengganti tema, rencana, desain
kunci/                Kunci jawaban (TIDAK diterbitkan, ada di .gitignore)
```

## Dokumentasi

- [Pemasangan dari nol](docs/PEMASANGAN.md) (fork, Supabase, penayangan)
- [Mendaftarkan peserta sendiri (kelas tertutup)](docs/DAFTARKAN-PESERTA.md)
- [Memperbarui fork](docs/MEMPERBARUI.md)
- [Menambah mata kuliah](docs/MENAMBAH-MATAKULIAH.md)
- [Menambah atau mengubah bab](docs/MENAMBAH-BAB.md)
- [Mengganti tema](docs/MENGGANTI-TEMA.md)
- [Sistem desain](docs/DESIGN.md)
- [Analisis dan rencana](docs/ANALISIS-DAN-RENCANA.md)
- [Riset video pengganti](docs/RISET-VIDEO-PENGGANTI.md)

## Keterbatasan yang perlu diketahui

- Penilaian berjalan di browser peserta. Cocok untuk latihan, **bukan untuk ujian** yang harus tahan kecurangan.
- Test case ada di repositori publik. Kasus "tersembunyi" hanya penghalang ringan.
- Pyodide berukuran sekitar 10 MB saat pertama dimuat, lalu tersimpan di cache browser.

## Lisensi

Kode dan isi di repositori ini berlisensi [MIT](LICENSE) © 2026 Muhammad Muchson Attoyibi. Teks lengkap buku ajar (PDF dan Word) **tidak** termasuk dalam repositori ini dan tetap dilindungi hak cipta penerbitnya; yang ada di sini hanya ringkasan singkat, soal latihan, dan rujukan halaman.

Video yang disematkan adalah milik pembuatnya masing-masing dan hanya ditampilkan lewat penyemat resmi YouTube.
