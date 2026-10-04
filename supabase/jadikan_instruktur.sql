-- Menjadikan sebuah akun sebagai instruktur.
-- Langkah: (1) masuk ke situs satu kali dan isi data awal, supaya profil terbentuk;
-- (2) ganti NIM di bawah dengan NIM/ID akun Anda; (3) jalankan di SQL Editor.
-- Peran instruktur sengaja TIDAK bisa diubah dari situs, hanya dari sini.

update public.profiles
set peran = 'instruktur'
where nim = 'GANTI_DENGAN_NIM_ANDA';

-- Cek hasilnya:
-- select nama, nim, peran from public.profiles where peran = 'instruktur';
