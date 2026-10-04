-- 0004_kelas_terstruktur.sql
-- Kelas peserta kini berformat PRODI-ANGKATAN-HURUF, mis. SI-2024-A, dan mudah difilter.
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Jalankan SETELAH 0001, 0002, dan 0003. Aman dijalankan ulang.
--
-- Yang berubah:
--   * tiga kolom turunan di tabel `profiles`: prodi, angkatan, rombel. Nilainya DIHITUNG OTOMATIS dari
--     kolom `kelas`, jadi tidak ada data ganda dan tidak bisa saling bertentangan;
--   * kolom `kelas` tetap satu-satunya yang diisi (oleh situs). Nilai lama seperti "SI-1A" tetap aman:
--     prodi terbaca, angkatan dan rombel kosong sampai peserta memilih kelas yang baru;
--   * tampilan `rekap_progres` ikut memuat prodi, angkatan, dan rombel.
--
-- Contoh memfilter di SQL Editor atau Table Editor:
--   select nama, nim, kelas from public.profiles where prodi = 'SI' and angkatan = 2024 and rombel = 'A';
--
-- Sengaja TIDAK ada aturan CHECK pada format kelas di database, supaya perintah administrasi
-- (mis. menjadikan seseorang instruktur) tidak gagal pada baris dengan kelas lama. Formatnya
-- diperiksa oleh situs dan skrip impor.

alter table public.profiles
  add column if not exists prodi text
    generated always as (
      case when kelas ~ '^[A-Za-z]{2,6}-' then upper(split_part(kelas, '-', 1)) end
    ) stored,
  add column if not exists angkatan smallint
    generated always as (
      case when kelas ~ '^[A-Za-z]{2,6}-[0-9]{4}-[A-Za-z]$' then split_part(kelas, '-', 2)::smallint end
    ) stored,
  add column if not exists rombel text
    generated always as (
      case when kelas ~ '^[A-Za-z]{2,6}-[0-9]{4}-[A-Za-z]$' then upper(split_part(kelas, '-', 3)) end
    ) stored;

create index if not exists profiles_kelas_idx on public.profiles (prodi, angkatan, rombel);

-- Tampilan rekap dibuat ulang hanya bila belum memuat kolom baru (aman diulang).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rekap_progres' and column_name = 'angkatan'
  ) then
    drop view if exists public.rekap_progres;
    create view public.rekap_progres
    with (security_invoker = true) as
    select
      p.id as user_id,
      p.nama,
      p.nim,
      p.kelas,
      p.prodi,
      p.angkatan,
      p.rombel,
      g.matakuliah_id,
      m.nama as matakuliah,
      g.bab,
      g.status,
      g.jumlah_jalankan,
      g.jumlah_kirim,
      g.pertama_dibuka,
      g.lulus_pada,
      g.durasi_aktif_detik,
      g.jalur,
      l.status as status_laporan,
      l.percobaan_tempel,
      n.skor_konsep,
      n.skor_bahasa,
      n.skor_refleksi,
      n.skor_kode
    from public.profiles p
    join public.progres g on g.user_id = p.id
    join public.matakuliah m on m.id = g.matakuliah_id
    left join public.laporan l on l.user_id = p.id and l.matakuliah_id = g.matakuliah_id and l.bab = g.bab
    left join public.penilaian_laporan n on n.laporan_id = l.id;

    revoke all on public.rekap_progres from anon;
    grant select on public.rekap_progres to authenticated;
  end if;
end
$$;
