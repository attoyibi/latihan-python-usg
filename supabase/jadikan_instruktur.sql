-- Menjadikan sebuah akun sebagai instruktur (dosen/admin).
--
-- Langkah:
--   1. Orang yang akan jadi instruktur membuka situs, memilih mata kuliah, masuk lewat tautan email,
--      dan mengisi data awal satu kali. Dengan begitu akunnya dan profilnya terbentuk.
--   2. Di Supabase > SQL Editor, jalankan SALAH SATU perintah di bawah (ganti nilainya).
--
-- Peran instruktur sengaja TIDAK bisa diubah dari situs (diuji: peserta yang mencoba menaikkan
-- perannya sendiri ditolak). Hanya bisa dari SQL Editor atau Table Editor di dashboard Supabase.
--
-- Peran yang tersedia hanya dua: 'peserta' dan 'instruktur'. Tidak ada peran admin terpisah.

-- Cara A (disarankan): berdasarkan alamat email yang dipakai untuk masuk.
update public.profiles
set peran = 'instruktur'
where id = (select id from auth.users where lower(email) = lower('GANTI_DENGAN_EMAIL_ANDA'));

-- Cara B: berdasarkan NIM yang diisi di data awal (hapus tanda -- di depan untuk memakainya).
-- update public.profiles set peran = 'instruktur' where nim = 'GANTI_DENGAN_NIM';

-- Memeriksa siapa saja instruktur saat ini:
-- select p.nama, p.nim, u.email, p.peran
-- from public.profiles p join auth.users u on u.id = p.id
-- where p.peran = 'instruktur';

-- Mencabut peran instruktur (kembali jadi peserta):
-- update public.profiles
-- set peran = 'peserta'
-- where id = (select id from auth.users where lower(email) = lower('GANTI_DENGAN_EMAIL'));

-- Alternatif tanpa SQL: Supabase > Table Editor > tabel profiles > ubah kolom peran
-- menjadi instruktur pada baris orang tersebut.
