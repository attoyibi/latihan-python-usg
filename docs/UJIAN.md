# Ujian UTS/UAS dan simulasi

Status: branch `fitur/ujian`, belum digabung ke `main`. Lihat Tahap U di `CHECKLIST.md`.

## Apa ini
Ujian dua tahap yang berjalan sendiri, dari prototype *Double-Check Exam*:

1. **Tahap 1** (UTS 75 menit): 2 soal teori (esai singkat, dinilai dari poin kunci) dan 2 soal praktik (koding Python, dinilai tes). Terkunci saat dikumpulkan atau saat waktu habis.
2. **Tahap 2**: butir pilihan ganda yang dibuat dari **kode peserta sendiri** (tebak keluaran, temukan baris yang salah, konsep teori, ketentuan berubah), batas waktu per butir.
3. **Nilai** otomatis skala 100: tidak pernah melebihi nilai Tahap 1, turun bila pemahaman di Tahap 2 jauh di bawahnya (paling banyak 40 poin). Satu kali uji ulang bila hasilnya jauh berbeda.

**UAS** (Bab 8–14) memakai alur dan bobot yang sama dengan UTS, Tahap 1 90 menit: praktik fungsi dan pengurutan (peringkat nilai) serta kelas dan CRUD (stok gudang), teori fungsi/rekursi dan searching/sorting.

**Simulasi** (Bab 1–4) memakai alur yang sama dengan soal lebih mudah, Tahap 1 30 menit, 5 butir Tahap 2, nilai tidak dihitung, dan boleh diulang.

## Yang dipegang server (migrasi `0010_ujian.sql`)
| Bagian | Cara kerja |
|---|---|
| Jadwal per kelas | Tabel `ujian_jadwal`. Peserta hanya bisa **memulai** saat jadwal kelasnya (rombel A–D atau "Semua kelas") buka. UTS dan UAS tidak punya jadwal bawaan: tertutup sampai dosen membukanya. |
| Jam | Waktu mulai, batas Tahap 1, dan waktu kunci diisi database. Peserta tidak bisa mengubahnya. |
| Akomodasi | Tabel `ujian_akomodasi`: faktor waktu per peserta (×1,25 / ×1,5 / ×2), diatur dosen. |
| Kunci | Tabel `ujian_kunci` tidak bisa dibaca lewat API oleh siapa pun. Tes tersembunyi, poin kunci teori, butir konsep, dan varian **baru turun setelah Tahap 1 dikunci** (`ujian_kunci_tahap1`). Jawaban yang sudah dikunci tidak bisa diganti. |
| Pekerjaan dan nilai | Kolom `keadaan` (pekerjaan, bisa dilanjutkan di perangkat lain) dan `hasil` (ringkasan nilai untuk dosen). Hanya dua kolom ini yang boleh diubah peserta. |
| Mengulang | Simulasi: peserta sendiri (`ujian_ulang`, hanya bila jadwal `boleh_ulang`). UTS: dosen menekan "Izinkan mengulang" (menghapus sesi). |

Diuji di PostgreSQL sungguhan (PGlite) oleh `tools/uji_sql`: ±50 uji khusus ujian (Tahap N).

### Batas yang masih ada (jujur)
- Butir Tahap 2 disusun dan dinilai di browser peserta dari kunci yang sudah turun. Peserta yang membuka alat pengembang saat Tahap 2 bisa melihat kunci butir. Batas waktu per butir dihitung di browser (dari jam server saat halaman dibuka).
- Ringkasan nilai di kolom `hasil` dikirim browser peserta. Jawaban mentahnya (`snapshot`, `keadaan`) tersimpan di server, jadi pemeriksaan ulang oleh dosen bisa ditambahkan nanti.
- Tanpa pengawas, ujian ini tidak mencegah bantuan AI atau orang lain. Ini alat pengukur pemahaman, bukan detektor kecurangan.
- Pernyataan soal (judul, teks, kode awal, contoh terlihat) ada di berkas publik situs, jadi bisa dibaca sebelum ujian dibuka. Yang rahasia hanya tes tersembunyi, poin kunci, dan butir Tahap 2.
- **Soal UTS contoh (dari prototype) sudah pernah terbit** di repositori publik ini (riwayat git). Untuk UTS sungguhan, tulis soal baru (lihat di bawah); soal baru tidak pernah masuk repo.

## Untuk dosen (dashboard, tab Ujian)
1. **Jadwal**: pilih kelas (atau Semua kelas), waktu buka dan tutup, durasi Tahap 1 (kosong = bawaan), lalu Simpan. "Tutup sekarang" mengakhiri kesempatan memulai; peserta yang sudah mulai tetap menyelesaikan waktunya.
2. **Akomodasi**: masukkan NIM dan faktor waktu, sebelum peserta itu menekan Mulai.
3. **Peserta dan nilai**: status, waktu mulai dan kunci (tanda "terlambat" bila mengunci jauh lewat batas), S1, S2, nilai, keterangan. Unduh CSV. "Izinkan mengulang" menghapus sesi peserta itu.

## Memasang di Supabase (sekali)
1. Jalankan `supabase/migrations/0010_ujian.sql` (SQL Editor atau MCP). Cek dengan `supabase/periksa_migrasi.sql` (kolom `0010_ujian`).
2. Buat kunci: `python tools/ujian/buat_kunci_ujian.py` lalu jalankan `kunci/ujian_kunci.sql`. Tanpa kunci, peserta tidak bisa mengumpulkan Tahap 1 (pesan "kunci ujian belum dipasang").
3. Buka jadwal UTS dari dashboard.

## Menulis atau mengganti soal
Soal ditulis sebagai Python di `tools/ujian/<id>_def.py` (contoh: `simulasi_def.py`), lalu:
```
python tools/ujian/buat_ujian.py <id>        # menjalankan kunci, menghitung tes, memeriksa varian bug -> kunci/ujian/<id>/
python tools/ujian/buat_kunci_ujian.py       # memisahkan publik (site/...) dan rahasia (kunci/ujian_kunci.sql)
```
Soal teori lengkap (`theory.json` dengan `keyPoints` dan `concepts`) disimpan di `kunci/ujian/<id>/`. Folder `kunci/` diabaikan git. Untuk ujian baru, tambahkan juga `site/data/kuliah/<mk>/ujian/<id>/exam.json` dan barisnya di `index.json`.

## Letak berkas
| Bagian | Tempat |
|---|---|
| Logika murni (disalin utuh dari prototype) | `site/js/ujian/logic/` |
| Layar peserta | `site/js/ujian/screens/` |
| Data, sesi, kirim ke server | `site/js/ujian/data.js`, `store.js`, `server.js` |
| Tab dosen | `site/js/ujian/dosen.js` |
| Gaya (di bawah `.uj` / berawalan `uj-`) | `site/css/ujian.css` |
| Definisi publik | `site/data/kuliah/<mk>/ujian/` |
| Unit test logika | `tools/uji_ujian/logika.test.mjs` (data contoh di `tools/uji_ujian/data/`) |

## Mencoba di komputer sendiri
`python tools/server_uji.py`, buka `http://localhost:8124/`, masuk sebagai `dosen@kampus.ac.id` (kata sandi di `tools/klien-tiruan.js`). Klien tiruan meniru tabel dan fungsi ujian; kuncinya dibaca dari `kunci/ujian/<id>.json`. `?tanpa0010=1` meniru proyek yang belum menjalankan migrasi.
