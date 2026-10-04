# Menambah mata kuliah

Satu situs bisa memuat banyak mata kuliah: berbasis kode (Python, Java, ...) maupun tidak berkode (tugas diunggah). Peserta memilih mata kuliah di beranda atau menu **Mata kuliah**. Progresnya dicatat **terpisah** untuk tiap mata kuliah.

## Cara tercepat

```bash
python tools/kuliah_baru.py basis-data "Basis Data" --bahasa sql --deskripsi "Dasar SQL."
```

Alat ini membuat kerangka folder, menambah daftar di `site/data/matakuliah.json`, dan **mencetak SQL** yang perlu dijalankan sekali di Supabase. Mata kuliah baru memakai `aktif: false`, jadi tampil sebagai "Segera hadir" sampai Anda siap.

Untuk mata kuliah tanpa kode:

```bash
python tools/kuliah_baru.py jaringan-komputer "Jaringan Komputer" --bahasa none --jenis teks
```

## Langkah manual (bila tidak memakai alat)

1. **Daftarkan** di `site/data/matakuliah.json`:

   ```json
   {
     "id": "pbo-java",
     "nama": "Pemrograman Berorientasi Objek",
     "deskripsi": "Konsep kelas, objek, pewarisan, dan polimorfisme dengan Java.",
     "bahasa": "java",
     "jenis": "kode",
     "aktif": false,
     "urutan": 20
   }
   ```

   | Kolom | Arti |
   |---|---|
   | `id` | unik; huruf kecil, angka, strip; dipakai di alamat (`#k/pbo-java`), folder, dan database |
   | `bahasa` | `python`, `java`, ... atau `null` untuk tanpa kode; menentukan sorotan sintaks dan penjalan |
   | `jenis` | `kode`, `teks` (tanpa kode), atau `campuran` |
   | `aktif` | `false` = tampil "Segera hadir" dan belum bisa dibuka |
   | `urutan` | urutan tampil; yang kecil lebih dulu |

2. **Buat folder** `site/data/kuliah/<id>/` berisi `materi.json` (daftar bab) dan folder `challenges/`. Format bab dan soal sama persis dengan [MENAMBAH-BAB.md](MENAMBAH-BAB.md).
3. **Daftarkan di database** (sekali) di Supabase > SQL Editor:

   ```sql
   insert into public.matakuliah (id, nama, deskripsi, jenis, bahasa, aktif, urutan)
   values ('pbo-java', 'Pemrograman Berorientasi Objek', 'Konsep kelas dan objek dengan Java.', 'kode', 'java', false, 20)
   on conflict (id) do update set nama = excluded.nama, deskripsi = excluded.deskripsi,
     jenis = excluded.jenis, bahasa = excluded.bahasa, urutan = excluded.urutan;
   ```

4. Periksa: `python tools/validasi_konten.py`.
5. Bila sudah siap dibuka: ubah `"aktif": true` di `matakuliah.json` **dan** jalankan `update public.matakuliah set aktif = true where id = 'pbo-java';` di SQL Editor.

> Mata kuliah **aktif** wajib punya minimal satu bab. Validasi menolak mata kuliah aktif yang kosong.

## Struktur data

```
site/data/
  matakuliah.json                      daftar mata kuliah
  kuliah/<id>/materi.json              daftar bab
  kuliah/<id>/challenges/bab-NN.json   soal per bab
kunci/<id>/bab-NN.py                   kunci jawaban (tidak diterbitkan)
```

Progres di browser memakai kunci `done:<id>:<bab>`, jadi bab 4 di Java tidak tercampur dengan bab 4 di Python. Di database, tabel `progres`, `percobaan`, `aktivitas`, `laporan`, dan `unggahan` punya kolom `matakuliah_id`.

## Java dan bahasa lain: yang sudah dan belum siap

**Sudah siap:** tempatnya. Mata kuliah `pbo-java` sudah terdaftar (belum aktif), editornya mengenali sorotan sintaks Java, progresnya terpisah, dan tabel databasenya ada.

**Belum ada: mesin yang menjalankan kode Java.** Situs hanya bisa menjalankan Python (lewat Pyodide di browser). Untuk bahasa lain, tombol *Jalankan* dan *Kirim jawaban* dinonaktifkan dengan keterangan "Penjalan kode ... belum tersedia". Mata kuliah Java bisa diisi materi, video, dan soal sekarang, tetapi penilaian otomatisnya baru bisa dipakai setelah mesin dipilih.

Pilihan yang akan dipertimbangkan saat sampai di tahap itu (belum diputuskan, dan kebijakan layanan gratis sering berubah, jadi perlu dicek ulang saat itu):

| Pilihan | Gambaran | Hal yang perlu dicek |
|---|---|---|
| JVM di browser (mis. CheerpJ) | Java berjalan di browser peserta, tanpa server | Ketentuan lisensi untuk pemakaian kampus, ukuran unduhan, dukungan `Scanner`/input |
| Server eksekusi sendiri (mis. Piston atau Judge0 yang dipasang sendiri) | Kode dikirim ke server Anda | Biaya server, isolasi keamanan, perawatan |
| Layanan eksekusi berbayar | Tanpa server sendiri | Biaya per eksekusi, batas permintaan |

Untuk menyiapkan Java di sisi pelaksanaan, tempat yang diubah hanya satu: `supports()` dan `run()` di `site/js/runner.js`. Soal Java memakai format yang sama (`input` berupa baris masukan, `expected` berupa keluaran).

## Mata kuliah tanpa kode

Atur `"bahasa": null` dan `"jenis": "teks"`. Setiap bab diberi `"jenis": "unggah"`: peserta mengumpulkan foto atau PDF (seperti Bab 3 di Algoritma). Fitur unggah berkasnya masih dalam rencana (Tahap 7 di [CHECKLIST.md](../CHECKLIST.md)); sampai itu selesai, halaman bab hanya menampilkan ringkasan dan video.

## Satu hal yang belum diputuskan
Data diri (nama, NIM, **kelas**) berlaku untuk semua mata kuliah. Bila kelas peserta berbeda tiap mata kuliah, peserta mengubahnya di halaman Profil, atau kita tambahkan tabel pendaftaran per mata kuliah. Saat ini dibiarkan satu data diri.
