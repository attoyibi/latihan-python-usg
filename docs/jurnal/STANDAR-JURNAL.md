# Standar naskah jurnal (Jurnal Abdiwiguna / Abdi Guna, USG)

Semua naskah jurnal yang dibuat di repositori ini **harus mengikuti template resmi**:
[`standar/Template jurnal PKM_abdi guna_acc direksi.docx`](standar/Template%20jurnal%20PKM_abdi%20guna_acc%20direksi.docx).
Dokumen ini merangkum aturannya supaya bisa diperiksa otomatis. Bila template berubah, ganti berkas di `standar/` dan
sesuaikan angka di sini dan di `tools/jurnal/periksa_naskah.py`.

## Info terbitan (dari Call for Papers Vol. 2 No. 1, Januari 2027)
- Jurnal Abdiwiguna, E-ISSN 3163-9704. Pengiriman lewat OJS: `journal.usg.ac.id/index.php/abdiwiguna`.
- Batas pengiriman **10 Desember 2026**; terbit Januari 2027.
- Fokus dan ruang lingkup yang dipakai naskah ini: **Teknologi** (implementasi teknologi tepat guna, sistem informasi dan digitalisasi, pelatihan keterampilan digital).
- Naskah harus berasal dari **luaran kegiatan pengabdian kepada masyarakat**. Pastikan kegiatannya benar-benar ada dasar pengabdiannya (surat tugas atau skema LPPM).

## Aturan format (dari teks template)
| Hal | Aturan |
|---|---|
| Kertas dan margin | A4, satu kolom. Atas 4 cm, bawah 2,5 cm, kiri 3 cm, kanan 2,5 cm |
| Huruf | Times New Roman 11 pt, satu spasi (judul 14 pt tebal rata tengah) |
| Panjang | 8 sampai 15 halaman, dengan tabel dan gambar yang jelas |
| Judul | Spesifik, tidak lebih dari 20 kata |
| Penulis | Angka di atas nama menunjukkan **afiliasi**, bukan urutan penulis. Penulis korespondensi diberi email |
| Abstract (Inggris) | Satu paragraf, maks 250 kata, *present tense*, tebal-miring pada judul; tanpa data statistik; 3 sampai 5 *keywords* urut abjad |
| Abstrak (Indonesia) | Satu paragraf, maks 250 kata, bahasa baku; 3 sampai 5 kata kunci urut abjad |
| Bagian | PENDAHULUAN (maks 20% isi), METODE (maks 15%), HASIL DAN PEMBAHASAN, KESIMPULAN, DAFTAR PUSTAKA. Judul bagian KAPITAL, tebal, rata tengah |
| Subbagian | Tebal, huruf kapital di awal kata, tanpa indentasi, tanpa sub-subbagian. Di Metode tanpa bullet atau nomor |
| Istilah asing | Dicetak miring |
| Tabel | Judul di atas, tengah, 10 pt; nomor berurutan; **tanpa garis vertikal**; bukan gambar tangkapan layar; sumber ditulis di bawah |
| Gambar | Judul di bawah, tengah, 10 pt; resolusi maksimum 400 dpi; sumber ikut di judul bila dari pihak lain |
| Kutipan dan daftar pustaka | Gaya **APA**. Setiap rujukan di teks ada di daftar pustaka dan sebaliknya |
| Referensi | Template minta minimal 15 dan minimal 70% dalam sepuluh tahun terakhir. **Standar repositori ini lebih ketat: minimal 20 referensi, semuanya dalam 5 tahun terakhir (2021 ke atas), semuanya ber-DOI yang aktif** |
| Dilarang | Wikipedia dan blog tak kredibel sebagai rujukan; hasil penelitian yang tidak dipublikasikan dan komunikasi pribadi dalam daftar pustaka |
| Kemiripan | Maks 25% (periksa dengan alat kemiripan kampus sebelum mengirim) |
| Belum pernah terbit | Naskah belum pernah diterbitkan sebelumnya |

Catatan: margin pada berkas template (3 cm semua sisi) berbeda dari yang tertulis di teksnya (4 / 2,5 / 3 / 2,5 cm).
Repositori ini mengikuti **angka yang tertulis di teks**, karena itu yang diperiksa redaksi.

Isian header dan kaki halaman (nomor DOI artikel, tanggal diterima, review, revisi, dan publikasi) diisi redaksi, jadi
dibiarkan seperti di template.

## Aturan rujukan (tidak boleh ada yang dikarang)
1. Cari lewat Crossref (`api.crossref.org`) atau basis data jurnal, jangan dari ingatan.
2. Tulis rujukan **dari metadata Crossref** (penulis, judul, jurnal, volume, halaman, DOI), bukan diketik ulang dari ingatan.
3. Hanya klaim yang tertera di judul atau abstrak rujukan itu yang boleh ditulis. Jangan menambahkan hasil yang tidak dibaca.
4. Jalankan `python tools/jurnal/verifikasi_doi.py docs/jurnal/naskah/<berkas>.docx`. Alat ini memeriksa setiap DOI:
   terdaftar di doi.org (Handle API), tautan bisa dibuka (HTTP 200, 202, atau 403 dari penerbit yang menolak bot), dan judul serta
   tahun di naskah cocok dengan Crossref.

## Cara membuat naskah
```bash
python tools/jurnal/siapkan_angka.py                      # angka naskah dari data agregat (docs/jurnal/data, tidak di-commit) dan repositori
python tools/jurnal/bangun_naskah.py                      # gambar + DOCX dari template + isi_naskah.py + isi_hasil.py
# ekspor PDF (LibreOffice), lalu:
python tools/jurnal/periksa_naskah.py docs/jurnal/naskah/<berkas>.docx <jumlah-halaman-pdf>
python tools/jurnal/verifikasi_doi.py docs/jurnal/naskah/<berkas>.docx
```
Angka hasil ada di `docs/jurnal/naskah/angka-naskah.json` (agregat anonim; sel berisi kurang dari 5 orang ditulis `<5`).
Data mentah dari Supabase **tidak** disimpan di repositori.

## Sebelum mengirim ke OJS
- [ ] Dasar pengabdian (surat tugas atau skema) jelas dan disebut di Metode atau Ucapan Terima Kasih.
- [ ] Izin etik institusi untuk analisis data perilaku peserta ada, dan teks persetujuan di situs (`TEKS_RISET`) sama dengan yang disetujui.
- [ ] Nama penulis, afiliasi, email korespondensi, dan ORCID (bila ada) sudah benar.
- [ ] Kemiripan (similarity) maksimal 25%.
- [ ] Berkas final dalam DOCX (PDF hanya untuk dokumentasi dan pratinjau).

## Naskah yang sudah ada
- [`naskah/naskah-jurnal-abdiwiguna-platform-latihan-pemrograman.docx`](naskah/naskah-jurnal-abdiwiguna-platform-latihan-pemrograman.docx) dan versi `.pdf` (dokumentasi).
  Judul: *Pendampingan Keterampilan Digital Pemrograman Mahasiswa melalui Platform Latihan Berbasis Browser: Implementasi dan Evaluasi Penggunaan*.
  11 halaman, 27 referensi (2021 sampai 2026), semua DOI lulus `verifikasi_doi.py`, semua pemeriksaan `periksa_naskah.py` lulus.
- Data: rekaman agregat anonim 7 Oktober sampai 2 November 2026 (diambil 2 November 2026). Ini data awal sekitar empat minggu pertama;
  jangan diklaim sebagai efek pembelajaran. Pencatatan waktu aktif (hampir semua nol) dan pengumpulan laporan bab (semua masih draf)
  belum berfungsi baik, dan kedua hal itu tertulis sebagai keterbatasan di naskah.
