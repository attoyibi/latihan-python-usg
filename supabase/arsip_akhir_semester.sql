-- Arsip akhir semester (templat). BACA DULU sebelum menjalankan.
--
-- Kebijakan: data peserta disimpan sampai akhir semester, lalu diarsipkan.
-- Urutan yang aman:
--   1. Unduh rekap (CSV) dari dashboard atau lewat Table Editor > Export.
--   2. Ekspor tabel penting ke berkas (Supabase > Database > Backups, atau pg_dump).
--   3. Setelah arsip tersimpan di tempat lain dan sudah diperiksa, barulah hapus.
--
-- Perintah di bawah BERSIFAT MERUSAK dan tidak bisa dibatalkan. Dibiarkan sebagai
-- komentar. Hapus tanda komentar hanya setelah langkah 1 dan 2 selesai.

-- Contoh: hapus riwayat percobaan dan aktivitas, simpan progres dan laporan.
-- delete from public.percobaan;
-- delete from public.aktivitas;

-- Contoh: hapus seluruh data peserta semester ini (akun, progres, laporan, unggahan).
-- Berkas di Storage ('tugas') harus dihapus terpisah lewat dashboard Storage.
-- delete from auth.users where id in (select id from public.profiles where peran = 'peserta');
