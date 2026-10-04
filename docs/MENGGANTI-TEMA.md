# Mengganti tema dan nama situs

- **Nama situs, institusi, dan pilihan kelas:** `site/data/config.json`. Daftar mata kuliah ada di `site/data/matakuliah.json`.
- **Warna, huruf, radius, bayangan:** `site/css/tokens.css`. Semua komponen membaca nilai dari sana, jadi cukup mengganti satu berkas. Ada dua blok: terang, dan gelap (mengikuti pengaturan perangkat).
- **Logo:** ikon SVG di `site/index.html` (elemen `.logo`).
- **Huruf:** `--font` di `tokens.css` dan tautan Google Fonts di `index.html`.

Aturan agar tetap terbaca: kontras teks minimal 4,5 banding 1, dan status bab jangan hanya dibedakan dengan warna. Selengkapnya di [DESIGN.md](DESIGN.md).

## Pilihan kelas (prodi, angkatan, kelas)

Kelas peserta dipilih dari tiga menu dan disimpan sebagai `PRODI-ANGKATAN-HURUF`, mis. `SI-2024-A`. Daftarnya diatur di `site/data/config.json`:

```json
{
  "prodi": [{ "kode": "SI", "nama": "Sistem Informasi" }],
  "angkatanMulai": 2024,
  "kelas": ["A", "B", "C", "D"]
}
```

- `prodi`: tambahkan program studi lain bila perlu, mis. `{ "kode": "TI", "nama": "Teknik Informatika" }`. Kode 2 sampai 6 huruf.
- `angkatanMulai`: tahun pertama. Daftar angkatan **terbentuk otomatis** dari tahun ini sampai tahun berjalan, dan bertambah sendiri tiap tahun.
- `kelas`: huruf kelas yang tersedia. Hanya satu huruf per kelas.
