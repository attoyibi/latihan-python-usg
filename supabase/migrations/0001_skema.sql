-- 0001_skema.sql
-- Skema awal: profil, progres, percobaan, aktivitas, laporan, penilaian, unggahan.
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Jalankan SEBELUM 0002_keamanan.sql. Aman dijalankan ulang (memakai "if not exists").

-- Fungsi pembantu: mengisi kolom diperbarui_pada otomatis.
create or replace function public.set_diperbarui_pada()
returns trigger
language plpgsql
as $$
begin
  new.diperbarui_pada = now();
  return new;
end;
$$;

-- Data awal peserta: nama, NIM, kelas. Satu baris per akun masuk.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null check (char_length(nama) between 2 and 100),
  nim text not null check (char_length(nim) between 3 and 30),
  kelas text not null check (char_length(kelas) between 1 and 30),
  peran text not null default 'peserta' check (peran in ('peserta', 'instruktur')),
  dibuat_pada timestamptz not null default now(),
  unique (nim)
);

-- Ringkasan per peserta per bab (dibaca dashboard).
create table if not exists public.progres (
  user_id uuid not null references public.profiles (id) on delete cascade,
  bab smallint not null check (bab between 1 and 99),
  status text not null default 'belum' check (status in ('belum', 'sedang', 'selesai')),
  jumlah_jalankan integer not null default 0,
  jumlah_kirim integer not null default 0,
  pertama_dibuka timestamptz,
  lulus_pada timestamptz,
  durasi_aktif_detik integer not null default 0,
  jalur text check (jalur in ('langsung', 'bantuan')),
  diperbarui_pada timestamptz not null default now(),
  primary key (user_id, bab)
);

drop trigger if exists progres_diperbarui on public.progres;
create trigger progres_diperbarui
  before update on public.progres
  for each row execute function public.set_diperbarui_pada();

-- Riwayat setiap jalankan/kirim, beserta kode yang ditulis.
create table if not exists public.percobaan (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  bab smallint not null check (bab between 1 and 99),
  jenis text not null check (jenis in ('jalankan', 'kirim')),
  lulus boolean,
  kasus_lulus smallint,
  kasus_total smallint,
  kasus_gagal smallint[],
  kode text check (char_length(kode) <= 20000),
  dibuat_pada timestamptz not null default now()
);
create index if not exists percobaan_user_bab_idx on public.percobaan (user_id, bab, dibuat_pada);

-- Jejak aktivitas: buka bab, petunjuk, buku, video, tempel yang diblokir, ekspor PDF.
create table if not exists public.aktivitas (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  bab smallint not null check (bab between 1 and 99),
  jenis text not null check (char_length(jenis) between 2 and 40),
  detail jsonb not null default '{}'::jsonb,
  dibuat_pada timestamptz not null default now()
);
create index if not exists aktivitas_user_bab_idx on public.aktivitas (user_id, bab, dibuat_pada);

-- Laporan praktikum (lima kolom diketik sendiri).
create table if not exists public.laporan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bab smallint not null check (bab between 1 and 99),
  jawaban jsonb not null default '{}'::jsonb,
  jumlah_ketikan jsonb not null default '{}'::jsonb,
  percobaan_tempel integer not null default 0,
  durasi_menulis_detik integer not null default 0,
  kode_verifikasi text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  status text not null default 'draf' check (status in ('draf', 'dikumpulkan')),
  dikumpulkan_pada timestamptz,
  dibuat_pada timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),
  unique (user_id, bab),
  unique (kode_verifikasi)
);

drop trigger if exists laporan_diperbarui on public.laporan;
create trigger laporan_diperbarui
  before update on public.laporan
  for each row execute function public.set_diperbarui_pada();

-- Penilaian laporan oleh instruktur (rubrik skala 1 sampai 4).
create table if not exists public.penilaian_laporan (
  laporan_id uuid primary key references public.laporan (id) on delete cascade,
  penilai uuid references public.profiles (id) on delete set null,
  skor_konsep smallint check (skor_konsep between 1 and 4),
  skor_bahasa smallint check (skor_bahasa between 1 and 4),
  skor_refleksi smallint check (skor_refleksi between 1 and 4),
  skor_kode smallint check (skor_kode between 1 and 4),
  komentar text check (char_length(komentar) <= 2000),
  dinilai_pada timestamptz not null default now()
);

-- Berkas tugas yang tidak berupa kode (misalnya flowchart Bab 3). Berkasnya di Storage.
create table if not exists public.unggahan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bab smallint not null check (bab between 1 and 99),
  path text not null,
  nama_berkas text,
  ukuran_byte integer check (ukuran_byte <= 10485760),
  status text not null default 'terkumpul' check (status in ('terkumpul', 'disetujui', 'perlu_revisi')),
  catatan text check (char_length(catatan) <= 2000),
  dibuat_pada timestamptz not null default now()
);
create index if not exists unggahan_user_bab_idx on public.unggahan (user_id, bab);

-- Tampilan rekap untuk dashboard. security_invoker membuat tampilan ini
-- tunduk pada aturan keamanan tabel asal: peserta hanya melihat datanya sendiri,
-- instruktur melihat semuanya.
-- Dibuat hanya bila belum ada. Migrasi 0003 membuat ulang tampilan ini dengan kolom mata kuliah;
-- menjalankan ulang berkas ini sesudahnya tidak boleh mengembalikannya ke versi lama.
do $$
begin
  if not exists (select 1 from pg_views where schemaname = 'public' and viewname = 'rekap_progres') then
    create view public.rekap_progres
    with (security_invoker = true) as
    select
      p.id as user_id,
      p.nama,
      p.nim,
      p.kelas,
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
    left join public.laporan l on l.user_id = p.id and l.bab = g.bab
    left join public.penilaian_laporan n on n.laporan_id = l.id;
  end if;
end
$$;
