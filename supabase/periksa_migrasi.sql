-- Memeriksa migrasi mana yang sudah dijalankan di proyek Supabase ini.
-- Jalankan di SQL Editor. Aman: hanya membaca, tidak mengubah apa pun.
--
-- Hasilnya satu baris. Kolom bernilai true berarti migrasi itu sudah terpasang.
--   0001 = tabel dasar, 0002 = aturan keamanan, 0003 = banyak mata kuliah.
-- 0004 = kelas terstruktur (prodi, angkatan, rombel).
-- 0005 = sinyal keaslian pengerjaan (perangkat, pola dan rekaman menulis).
-- Jalankan hanya migrasi yang masih false, berurutan (0001, 0002, 0003, 0004, lalu 0005).

select
  to_regclass('public.profiles') is not null as "0001_skema",
  exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
  ) as "0002_keamanan",
  to_regclass('public.matakuliah') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'progres' and column_name = 'matakuliah_id'
    ) as "0003_matakuliah",
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'angkatan'
  ) as "0004_kelas",
  to_regclass('public.sesi_perangkat') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'percobaan' and column_name = 'rekaman'
    ) as "0005_integritas";
