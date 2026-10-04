# Menambah atau mengubah bab

Semua isi ada di `site/data/`, terpisah dari kode. Anda tidak perlu menyentuh JavaScript untuk menambah bab.

## 1. Daftar bab: `site/data/materi.json`

Satu objek per bab, urut dari 1:

```json
{
  "bab": 4,
  "judul": "Percabangan",
  "ringkasan": "Dua tiga kalimat yang cukup untuk mulai mengerjakan.",
  "buku": { "teks": "Bab IV, bagian D: if tunggal, if-else, if-elif-else", "halaman": 102 },
  "video": [
    { "id": "rF8rh40z_X0", "judul": "IF dan ELSE Statement", "channel": "Kelas Terbuka", "sumber": "playlist" }
  ],
  "jenis": "kode",
  "challenge": true
}
```

- `id` video adalah 11 karakter setelah `v=` pada tautan YouTube.
- `sumber`: `playlist` untuk video utama, `lain` untuk sumber pengganti (diberi label berbeda).
- `jenis`: `kode` (ada editor) atau `unggah` (tugas berupa berkas, misalnya flowchart).
- `challenge`: `true` bila ada berkas soal di `site/data/challenges/`.

## 2. Soal: `site/data/challenges/bab-NN.json`

```json
{
  "bab": 4,
  "judul": "Potongan harga bertingkat",
  "soal": ["Paragraf 1.", "Paragraf 2."],
  "starter": "kode awal yang tampil di editor\n",
  "contohMasukan": "120\n35000",
  "petunjuk": [
    { "jenis": "teks", "isi": "Petunjuk dari soal." },
    { "jenis": "buku", "isi": "Baca bagian ... (hlm. ...)." },
    { "jenis": "video", "isi": "Tonton ...", "video": ["rF8rh40z_X0"] }
  ],
  "tests": [
    { "input": ["10", "40000"], "expected": "Total tagihan: Rp400,000", "hidden": false },
    { "input": ["99", "40000"], "expected": "Total tagihan: Rp3,643,200", "hidden": true }
  ]
}
```

- Petunjuk selalu tiga tingkat berurutan: teks, buku, video.
- `input` adalah baris-baris yang dibaca `input()` secara berurutan.
- Penilaian membandingkan keluaran `print` setelah spasi di ujung baris dan baris kosong di ujung dibuang. Teks di dalam `input("...")` tidak dihitung.
- Sediakan minimal 3 kasus dan sedikitnya satu `hidden: true`. Sertakan kasus batas (nilai tepat di pembatas).
- Rancang soal agar keluarannya pasti: hindari keluaran yang bergantung waktu atau urutan yang tidak terjamin.

## 3. Kunci jawaban dan uji

Tulis kunci di `kunci/bab-NN.py` (folder ini **tidak ikut diterbitkan**), lalu:

```bash
python tools/uji_kunci.py        # kunci harus menghasilkan setiap expected
python tools/validasi_konten.py  # struktur JSON benar
```

Jangan menulis `expected` dengan tangan. Jalankan kuncinya, lalu salin keluarannya.

## 4. Lihat hasilnya

```bash
cd site
python -m http.server 8000
```

Buka `http://localhost:8000/#bab-4`.
