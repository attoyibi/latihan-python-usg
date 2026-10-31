# Ujian UTS/UAS (fitur dalam pengembangan)

Status: **branch `fitur/ujian`, belum digabung ke `main`, belum aman untuk ujian sungguhan.** Lihat Tahap U di `CHECKLIST.md`.

## Apa ini
Ujian dua tahap yang berjalan sendiri, dari prototype *Double-Check Exam*:

1. **Tahap 1** (75 menit): 2 soal teori (esai singkat, dinilai dari poin kunci) dan 2 soal praktik (koding Python, dinilai tes). Terkunci saat dikumpulkan atau saat waktu habis.
2. **Tahap 2** (±19 menit): 9 butir pilihan ganda yang dibuat dari **kode peserta sendiri** (tebak keluaran, temukan baris yang salah, konsep teori, ketentuan berubah), batas waktu per butir.
3. **Nilai** otomatis skala 100: tidak pernah melebihi nilai Tahap 1, turun bila pemahaman di Tahap 2 jauh di bawahnya (paling banyak 40 poin). Satu kali uji ulang bila hasilnya jauh berbeda.

Batasan jujur: tanpa pengawas, Tahap 2 tidak bisa mencegah bantuan AI atau orang lain. Ini alat pengukur pemahaman, bukan detektor kecurangan.

## Simulasi (latihan sebelum UTS/UAS)
Ujian `simulasi` (Bab 1–4) memakai alur yang sama persis, dengan soal lebih mudah, Tahap 1 30 menit, dan 5 butir Tahap 2. Ditandai `"latihan": true` di `index.json`: nilainya ditulis "tidak dihitung" dan peserta bisa menekan **Ulangi simulasi dari awal**. Soal ada di `tools/ujian/simulasi_def.py`; bangun ulang datanya dengan `python tools/ujian/buat_ujian.py simulasi` (menjalankan kunci untuk menghitung tes dan memeriksa varian bug). Soal teori dan konfigurasi: `simulasi/theory.json`, `simulasi/exam.json`.

## Letak berkas
| Bagian | Tempat |
|---|---|
| Logika murni (disalin utuh dari prototype, jangan diubah di sini saja) | `site/js/ujian/logic/` |
| Layar peserta | `site/js/ujian/screens/` (start, stage1, stage2, result) |
| Pintu masuk dari `app.js` | `site/js/ujian/index.js` (`kartuUjian`, `renderUjian`) |
| Data dan penyimpanan per akun | `site/js/ujian/data.js`, `store.js` |
| Gaya (semua di bawah `.uj` / berawalan `uj-`) | `site/css/ujian.css` |
| Definisi ujian | `site/data/kuliah/<mk>/ujian/index.json` dan `<id>/{exam,tasks,theory,templates}.json` |
| Contoh jawaban (tidak terbit) | `kunci/ujian/<id>/solutions.json` |
| Unit test | `tools/uji_ujian/logika.test.mjs` (data kohort contoh `tools/uji_ujian/cohort.json`) |

Soal dibuat dengan skrip di repo prototype (`prototype/tools/tasks_def.py` lalu `build_tasks.py`); JSON hasilnya disalin ke sini. Jangan mengedit `tasks.json` dengan tangan.

## Mencoba di komputer sendiri
```
python tools/server_uji.py
```
Buka `http://localhost:8124/`, masuk sebagai `budi@kampus.ac.id` (kata sandi di `tools/klien-tiruan.js`), buka mata kuliah Algoritma, lalu kartu **Ujian**. Keadaan ujian tersimpan di browser dengan kunci `ujian:<user>:<mk>:<id>`; hapus kunci itu di DevTools untuk mengulang.

## Konfigurasi (di `exam.json`, bagian `config`)
Durasi Tahap 1 (`tahap1Minutes`), batas per butir (`stage2.limitSec`), jumlah butir per jenis, bobot, rumus nilai (`grade`), soal aktif (`activeTasks`), dan akomodasi waktu (`accommodations` = daftar **NIM**, `accommodationFactor`).

## Belum ada (berikutnya)
Penyimpanan di Supabase dengan jam server, kunci jawaban di tabel tertutup, tab dosen, jadwal per kelas. Rancangannya ada di panduan integrasi prototype bagian 4.
