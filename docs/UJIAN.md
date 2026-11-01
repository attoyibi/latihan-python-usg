# Ujian UTS/UAS dan simulasi

Status: branch `fitur/ujian`, belum digabung ke `main`. Lihat Tahap U di `CHECKLIST.md`.

## Apa ini
Ujian dua tahap yang berjalan sendiri, dari prototype *Double-Check Exam*:

1. **Tahap 1** (UTS 75 menit): 2 soal teori (esai singkat, dinilai dari poin kunci) dan 2 soal praktik (koding Python, dinilai tes). Terkunci saat dikumpulkan atau saat waktu habis.
2. **Tahap 2**: butir pilihan ganda yang dibuat dari **kode peserta sendiri** (tebak keluaran, temukan baris yang salah, konsep teori, ketentuan berubah), batas waktu per butir.
3. **Nilai** otomatis skala 100: tidak pernah melebihi nilai Tahap 1, turun bila pemahaman di Tahap 2 jauh di bawahnya (paling banyak 40 poin). Satu kali uji ulang bila hasilnya jauh berbeda.

**UAS** (Bab 8–14) memakai alur dan bobot yang sama dengan UTS, Tahap 1 90 menit: praktik fungsi dan pengurutan (peringkat nilai) serta kelas dan CRUD (stok gudang), teori fungsi/rekursi dan searching/sorting.

**Simulasi** (Bab 1–4) memakai alur yang sama dengan soal lebih mudah, Tahap 1 30 menit, 5 butir Tahap 2, nilai tidak dihitung, dan boleh diulang.

## Tahap 2 terbuka (mode bawaan sekarang)
Pilihan ganda Tahap 2 diganti **pertanyaan terbuka kecil** (`config.stage2.mode = "open"` di `exam.json`; mode lama tetap ada di kode). Per ujian: satu pertanyaan konsep untuk tiap soal teori (`probe` di `theory.json`, dijawab satu kalimat), serta untuk tiap soal praktik satu pertanyaan "apa yang dikerjakan baris N kodemu" (baris dipilih dari kodenya sendiri) dan satu "ketentuan berubah: bagian mana yang kamu ubah". Tidak dinilai otomatis: jawabannya dibandingkan dengan jawaban teori, kode, dan hasil tes Tahap 1 untuk melihat apakah Tahap 1 mencerminkan pemahaman peserta.
- **Peserta** tidak melihat nilai. Setelah selesai ia hanya melihat "tersimpan dan dikunci" dan bisa mengunduh PDF jawabannya. Jawaban dikunci di server oleh `ujian_selesai` (migrasi `0011_ujian_selesai.sql`): sesudahnya server menolak perubahan.
- **Dosen** (tab Ujian di dashboard): unduh CSV untuk analisis (satu baris per pertanyaan per peserta, dengan pembanding Tahap 1), unduh format hasil analisis (`id_baris, peserta_id, konsistensi, skor, catatan`), unggah hasil analisis yang sudah diisi AI (disimpan di server dan tampil di bawah tiap jawaban), unduh PDF satu peserta atau semua peserta. `konsistensi` salah satu dari `konsisten`, `sebagian`, `tidak_konsisten`, `tidak_jelas`; `skor` 0-100 (boleh kosong).
- Tanpa migrasi 0011 semuanya tetap jalan kecuali penguncian di server dan penyimpanan analisis (dosen mendapat pesan jelas).

## Penggunaan AI yang bertanggung jawab
Tujuannya mengukur penggunaan AI yang terarah, bukan melarangnya: AI boleh dipakai di Tahap 1 (dan dideklarasikan), tetapi jawaban harus diramu sendiri dan bisa dipertanggungjawabkan di Tahap 2.
- Layar peserta menekankan parafrase: teori minimal 60 kata (rentang 80-200 kata untuk UTS/UAS), dengan kalimat sendiri dan contoh sendiri.
- Salin, tempel, dan seret-lepas dimatikan di Tahap 1 dan Tahap 2 (percobaan dihitung). Berpindah tab atau jendela dicatat oleh `site/js/ujian/fokus.js` (jumlah, lama, jam; bukan isi tab lain, yang memang tidak terlihat dari halaman web) dan tampil di tab Ujian dosen, di CSV, dan di PDF. Ini petunjuk, bukan bukti.
- Kode tidak harus benar: apa pun hasil tesnya, peserta yang sudah mengumpulkan tetap masuk Tahap 2. Pada Tahap 2 terbuka, kandidat butir pilihan ganda tidak dihitung lagi (jauh lebih sedikit penjalanan, terutama di Java).
- UTS dan UAS: Tahap 1 60 menit. Simulasi tetap 30 menit (Python) dan 40 menit (Java).
- **Contoh jawaban:** simulasi punya tombol untuk semua peserta (`contoh.json` publik). UTS/UAS hanya memberinya kepada **instruktur** lewat fungsi `ujian_contoh_dosen` (migrasi `0012_ujian_contoh.sql`; isinya di tabel `ujian_contoh` yang tidak bisa dibaca peserta, berbeda dari `ujian_kunci` yang turun ke peserta setelah Tahap 1). Isi tabel dari `kunci/ujian_contoh.sql` dan `kunci/ujian_contoh_pbo-java.sql` buatan `buat_kunci_ujian.py`.

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

## Ujian mata kuliah Java (pbo-java)
Mesin yang sama dipakai untuk `pbo-java`; bahasanya diambil dari `bahasa` di `matakuliah.json` (`site/js/ujian/bahasa.js`): penjalan CheerpJ + ECJ (Java 8, lihat `PENJALAN-JAVA.md`), editor `text/x-java`, tombol simbol Java, dan teks layar "Java". Soal praktik berupa satu berkas dengan kelas `Main`, masukan lewat `Scanner`. Butir "temukan baris yang salah" memakai aturan mutasi Java (tanpa `+=`/`-=` dan `break`/`continue` karena mudah membuat perulangan tanpa henti, dan penjalan yang kena batas waktu harus dimulai ulang). Ujian: simulasi (Bab 1-4), UTS (Bab 1-7, 90 menit), UAS (Bab 8-15, 100 menit; JDBC dan GUI diuji lewat soal teori karena tidak bisa dijalankan di browser). Tanpa jadwal bawaan; dosen membukanya dari tab Ujian.

Definisi soal Java memuat kunci jawaban dan masukan tes tersembunyi, jadi disimpan RAHASIA di `kunci/ujian/pbo-java/<id>_def.py` (diabaikan git; soal teorinya `THEORY` ada di berkas yang sama):
```
python tools/ujian/buat_ujian.py <id> pbo-java      # menjalankan kunci dengan JDK (javac --release 8) -> kunci/ujian/pbo-java/<id>/
python tools/ujian/buat_kunci_ujian.py pbo-java     # berkas publik + kunci/ujian_kunci_pbo-java.sql (hanya baris pbo-java)
python tools/ujian/periksa_ujian.py pbo-java        # kunci lulus, kode awal gagal, varian bug salah, publik tanpa rahasia
node tools/ujian/uji_ujian_java.mjs pbo-java        # Tahap 1 dan butir Tahap 2 ujung ke ujung dengan JDK
```
`buat_kunci_ujian.py` tanpa argumen membuat berkas untuk semua mata kuliah; tiap mata kuliah punya berkas SQL sendiri, jadi menjalankan `ujian_kunci_pbo-java.sql` tidak menyentuh baris `algoritma-python`. Server uji lokal membaca kunci pbo-java dari `kunci/ujian/pbo-java/<id>.json` dan memberi simulasi pbo-java jadwal terbuka (di Supabase sungguhan, simulasi pbo-java ditutup sampai dosen membuka jadwalnya).

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
