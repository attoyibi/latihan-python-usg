# latihan-python-usg

Platform latihan coding Python di browser untuk mata kuliah **Algoritma dan Pemrograman**, pendamping buku ajar *Algoritma dan Pemrograman: Fondasi Berpikir Komputasional dengan Python* (Muhammad Muchson Attoyibi, USG Press, 2026).

Peserta menulis kode Python langsung di browser, dinilai otomatis, lalu mengerjakan laporan praktikum singkat. Bab **tidak dikunci**: peserta bebas memilih bab mana pun, dan tiap bab diberi penanda belum, sedang, atau selesai. Yang sudah mahir langsung mengerjakan tantangan; yang belum bisa membuka petunjuk, bagian buku, dan video bantuan.

## Status

Proyek sedang dibangun bertahap. Daftar lengkapnya ada di [CHECKLIST.md](CHECKLIST.md).

| Sudah jalan | Belum |
|---|---|
| Beranda, Materi, Panduan, halaman bab | Tantangan Bab 1–3 dan 5–14 (baru Bab 4 yang lengkap) |
| Editor kode Python dengan sorotan sintaks | Laporan praktikum dan ekspor PDF |
| Python di browser (Pyodide), batas waktu 5 detik | |
| Penilaian otomatis dengan kasus uji tersembunyi | Penyimpanan progres di Supabase (progres masih di browser) |
| Tiga penanda status bab, tanpa kunci | Log aktivitas, dashboard instruktur, unggah tugas Bab 3 |
| Wajib masuk (kode email) dan isi data awal sebelum bab; halaman Profil untuk mengubah nama, NIM, kelas. Diuji dengan klien tiruan, belum dengan Supabase sungguhan | |
| Video bantuan per bab (YouTube) | |
| Skema database Supabase dan aturan keamanannya (belum dijalankan di proyek sungguhan) | |

Peserta **wajib masuk** dulu dan mengisi data awal (nama, NIM, kelas) sebelum membuka bab; data bisa diubah di halaman Profil. Bila Supabase belum dikonfigurasi, situs menampilkan layar pemasangan.

## Menjalankan

Butuh Python 3 (hanya untuk server statis lokal) dan koneksi internet.

```bash
cd site
python -m http.server 8000
```

Buka `http://localhost:8000`. Tanpa Supabase situs akan meminta pemasangan; untuk mencoba alur masuk dengan login tiruan jalankan `python tools/server_uji.py` (dari akar repositori) lalu buka `http://127.0.0.1:8124`, kode login `123456`.

## Struktur

```
site/                 Situs statis (HTML, CSS, JavaScript biasa, tanpa build)
  data/               Isi: materi.json, config.json, challenges/bab-NN.json
  css/tokens.css      Warna, huruf, ukuran (ganti di sini untuk mengubah tema)
  js/                 app, pyworker (Pyodide), runner, grader
supabase/migrations/  Skema dan aturan keamanan database (tempel ke SQL Editor)
tools/                Validasi isi, uji kunci jawaban, periksa SQL
docs/                 Pemasangan, menambah bab, mengganti tema, rencana, desain
kunci/                Kunci jawaban (TIDAK diterbitkan, ada di .gitignore)
```

## Dokumentasi

- [Pemasangan dari nol](docs/PEMASANGAN.md) (Supabase, penayangan)
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
