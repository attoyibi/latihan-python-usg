# Halaman publik untuk mesin pencari dan AI

Aplikasi utama (hash routing, wajib masuk) tidak bisa dibaca perayap. Karena itu `tools/buat_halaman_publik.mjs` membuat halaman statis tanpa JavaScript:

- `site/belajar/` (daftar mata kuliah), `site/belajar/<mk>/` (satu mata kuliah), `site/belajar/<mk>/bab-NN/` (satu bab)
- `site/sitemap.xml`, `site/robots.txt` (perayap AI diizinkan eksplisit), `site/llms.txt` dan `site/llms-full.txt`
- blok `<!--PRARENDER-->` di `site/index.html` (daftar mata kuliah untuk perayap tanpa JavaScript)

Yang dimuat hanya data publik: judul, ringkasan, rujukan buku, video, serta judul tantangan dan praktik. Soal lengkap, kerangka kode, kasus uji, dan kunci jawaban tidak pernah ikut.

## Kapan dijalankan

- Otomatis saat penayangan di Vercel (`buildCommand` di `vercel.json`).
- Setelah mengubah `matakuliah.json`, `materi.json`, atau judul tantangan/praktik: `node tools/buat_halaman_publik.mjs`, lalu commit hasilnya. CI menjalankan `--periksa` dan gagal bila berkas belum diperbarui.
- Bila alamat situs bukan `latihan-usg.vercel.app`, isi variabel `SITE_URL` (mis. `https://latihan.contoh.ac.id`) di Vercel, dan jalankan ulang skrip dengan variabel yang sama.

## Kredit pembuat

Footer di semua halaman (aplikasi dan halaman statis) menautkan ke https://muchson.web.id/; data terstruktur (JSON-LD) mencantumkannya sebagai penulis.

## Setelah tayang

Daftarkan `https://<situs>/sitemap.xml` di Google Search Console agar halaman cepat terindeks.
