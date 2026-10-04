# Sistem Desain

*Acuan visual: gambar contoh yang Anda berikan (hero WPU Course). Yang ditiru adalah **gaya**-nya (warna, bentuk, tipografi, kartu mengambang), bukan logo, nama, atau teksnya.*

## Ciri gaya dari gambar contoh

| Unsur | Yang terlihat | Dipakai di sini |
|---|---|---|
| Warna merek | Hijau teal tua pada tombol dan navigasi aktif; aksen hijau segar pada kata sorotan | `--brand` teal, `--accent` hijau |
| Judul | Sangat tebal, dua baris; baris kedua gradasi teal ke hijau | Judul beranda dengan teks gradasi |
| Huruf | Sans geometris modern (mirip Plus Jakarta Sans); label kecil berhuruf kapital berspasi lebar | Plus Jakarta Sans; label statistik pakai huruf monospasi |
| Tombol | Utama: teal penuh, sudut membulat; sekunder: abu muda | `.btn-primary`, `.btn-soft`, `.btn-outline` |
| Lencana | Pil kecil dengan titik hijau dan pil kedua di dalamnya | `.pill` |
| Latar | Putih dengan garis kisi sangat halus | Kisi 40 px, 4 persen kontras |
| Panel kode | Jendela gelap teal dengan tiga titik, kode berwarna | Panel kode di hero |
| Kartu mengambang | Kartu putih agak miring, bayangan lembut, ikon di kotak teal pucat | `.float-card` |
| Statistik | Angka tebal, label kapital mono di atasnya, garis pemisah tipis | `.stats` |

## Token

| Token | Terang | Gelap | Pemakaian |
|---|---|---|---|
| `--brand` | `#0b7f7c` | `#2bb3ad` | Tombol utama, tautan, penanda aktif |
| `--brand-strong` | `#075e5c` | `#5fd0cb` | Hover, teks di atas latar brand pucat |
| `--brand-soft` | `#e3f3f2` | `#0f3a3a` | Latar ikon, lencana, sorotan |
| `--accent` | `#1fbf75` | `#3fd68f` | Titik status, ujung gradasi, tanda selesai |
| `--ink` | `#0b1b1c` | `#eaf4f3` | Judul dan teks utama |
| `--muted` | `#5b6b6c` | `#9db3b2` | Teks pendukung |
| `--line` | `#dbe6e5` | `#254242` | Garis dan batas |
| `--bg` | `#ffffff` | `#081616` | Latar halaman |
| `--soft` | `#f3f8f7` | `#0e2323` | Latar kartu sekunder |
| `--code-bg` | `#0b3d3f` | `#062a2c` | Panel kode gelap |
| `--warn` | `#b86e00` | `#f0b45a` | Penanda "sedang dikerjakan" |
| `--danger` | `#b3382c` | `#f09590` | Kesalahan |
| `--radius` | 12 px kartu, 10 px tombol, 999 px pil | | |
| Huruf | Plus Jakarta Sans 400/500/700/800, cadangan system-ui | | |

## Penanda status bab (tanpa kunci)

Semua bab **selalu bisa dibuka**, urutan bebas. Hanya ada penanda, bukan penghalang.

| Status | Penanda | Aturan |
|---|---|---|
| Belum dikerjakan | Lingkaran kosong abu | Belum ada kode diketik atau dijalankan |
| Sedang dikerjakan | Lingkaran setengah isi, oranye | Sudah mengetik, menjalankan, atau mengirim, tetapi belum lulus |
| Selesai | Lingkaran hijau berisi centang | Challenge lulus (Bab 3: tugas terkumpul) |

Penanda selalu disertai teks untuk pembaca layar (tidak hanya warna), dan ada legenda kecil di bawah daftar bab.

## Komponen

- Navigasi atas: logo, tautan (Beranda, Materi, Panduan), lencana status Python di kanan.
- Hero beranda: lencana, judul dua baris dengan gradasi, paragraf, dua tombol, statistik, panel kode dengan tiga kartu mengambang.
- Kisi 14 bab di beranda: kartu dengan nomor, judul, jenis (Kode atau Unggah), dan penanda status.
- Halaman bab: kartu ringkasan, kartu video, kartu tantangan dengan editor, kartu laporan.
- Mode gelap mengikuti perangkat.
- Ponsel: kartu mengambang disembunyikan atau ditumpuk, sidebar jadi menu geser, tombol cukup besar untuk ditekan jari.

## Aturan

1. Warna tidak boleh jadi satu-satunya pembeda status (selalu ada teks atau bentuk).
2. Kontras teks minimal 4,5 banding 1.
3. Tidak ada animasi yang wajib; hormati `prefers-reduced-motion`.
4. Semua nilai warna dan ukuran ada di `site/css/tokens.css`. Orang lain yang memakai repositori ini cukup mengganti berkas itu untuk mengubah tema.
