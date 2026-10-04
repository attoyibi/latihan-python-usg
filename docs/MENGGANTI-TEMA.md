# Mengganti tema dan nama situs

- **Nama situs, mata kuliah, institusi, bahasa:** `site/data/config.json`.
- **Warna, huruf, radius, bayangan:** `site/css/tokens.css`. Semua komponen membaca nilai dari sana, jadi cukup mengganti satu berkas. Ada dua blok: terang, dan gelap (mengikuti pengaturan perangkat).
- **Logo:** ikon SVG di `site/index.html` (elemen `.logo`).
- **Huruf:** `--font` di `tokens.css` dan tautan Google Fonts di `index.html`.

Aturan agar tetap terbaca: kontras teks minimal 4,5 banding 1, dan status bab jangan hanya dibedakan dengan warna. Selengkapnya di [DESIGN.md](DESIGN.md).
