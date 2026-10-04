-- 0003_matakuliah.sql
-- Mendukung banyak mata kuliah dalam satu situs.
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Jalankan SETELAH 0001_skema.sql dan 0002_keamanan.sql. Aman dijalankan ulang.
--
-- Yang berubah:
--   * tabel baru `matakuliah` (daftar mata kuliah);
--   * kolom `matakuliah_id` pada progres, percobaan, aktivitas, laporan, dan unggahan;
--   * data lama (bila ada) otomatis dianggap milik 'algoritma-python';
--   * kunci unik progres dan laporan kini mencakup mata kuliah;
--   * tampilan `rekap_progres` ikut memuat mata kuliah.
--
-- Menambah mata kuliah baru nanti: cukup satu baris INSERT di tabel `matakuliah`
-- (lihat docs/MENAMBAH-MATAKULIAH.md atau jalankan tools/kuliah_baru.py yang mencetak SQL-nya).

create table if not exists public.matakuliah (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 60),
  nama text not null check (char_length(nama) between 2 and 120),
  deskripsi text check (char_length(deskripsi) <= 600),
  jenis text not null default 'kode' check (jenis in ('kode', 'teks', 'campuran')),
  bahasa text check (bahasa is null or char_length(bahasa) between 1 and 30),
  aktif boolean not null default false,
  urutan smallint not null default 100,
  dibuat_pada timestamptz not null default now()
);

insert into public.matakuliah (id, nama, deskripsi, jenis, bahasa, aktif, urutan)
values
  ('algoritma-python', 'Algoritma dan Pemrograman', 'Fondasi berpikir komputasional dengan Python.', 'kode', 'python', true, 10),
  ('pbo-java', 'Pemrograman Berorientasi Objek', 'Konsep kelas dan objek dengan Java.', 'kode', 'java', false, 20)
on conflict (id) do nothing;

-- Kolom matakuliah_id pada tabel data peserta. Baris lama diisi 'algoritma-python'
-- (satu-satunya mata kuliah sebelum migrasi ini), lalu kolom diwajibkan terisi.
do $$
declare
  t text;
begin
  foreach t in array array['progres', 'percobaan', 'aktivitas', 'laporan', 'unggahan']
  loop
    execute format('alter table public.%I add column if not exists matakuliah_id text', t);
    execute format('update public.%I set matakuliah_id = %L where matakuliah_id is null', t, 'algoritma-python');
    execute format('alter table public.%I alter column matakuliah_id set not null', t);
    if not exists (
      select 1 from pg_constraint
      where conname = t || '_matakuliah_fk'
        and conrelid = format('public.%I', t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (matakuliah_id) references public.matakuliah (id) on update cascade',
        t, t || '_matakuliah_fk'
      );
    end if;
  end loop;
end
$$;

-- Kunci utama dan kunci unik kini mencakup mata kuliah.
alter table public.progres drop constraint if exists progres_pkey;
alter table public.progres add primary key (user_id, matakuliah_id, bab);

alter table public.laporan drop constraint if exists laporan_user_id_bab_key;
alter table public.laporan drop constraint if exists laporan_user_kuliah_bab_key;
alter table public.laporan add constraint laporan_user_kuliah_bab_key unique (user_id, matakuliah_id, bab);

-- Indeks pencarian per mata kuliah.
drop index if exists public.percobaan_user_bab_idx;
create index if not exists percobaan_user_kuliah_bab_idx on public.percobaan (user_id, matakuliah_id, bab, dibuat_pada);
drop index if exists public.aktivitas_user_bab_idx;
create index if not exists aktivitas_user_kuliah_bab_idx on public.aktivitas (user_id, matakuliah_id, bab, dibuat_pada);
drop index if exists public.unggahan_user_bab_idx;
create index if not exists unggahan_user_kuliah_bab_idx on public.unggahan (user_id, matakuliah_id, bab);

-- Tampilan rekap dibuat ulang karena kolomnya bertambah.
drop view if exists public.rekap_progres;
create view public.rekap_progres
with (security_invoker = true) as
select
  p.id as user_id,
  p.nama,
  p.nim,
  p.kelas,
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

-- Keamanan tabel matakuliah: semua yang sudah masuk boleh membaca daftar,
-- hanya instruktur yang boleh menambah, mengubah, atau menghapus.
alter table public.matakuliah enable row level security;
revoke all on public.matakuliah from anon;
grant select, insert, update, delete on public.matakuliah to authenticated;

drop policy if exists matakuliah_baca on public.matakuliah;
create policy matakuliah_baca on public.matakuliah
  for select to authenticated
  using (true);

drop policy if exists matakuliah_tulis on public.matakuliah;
create policy matakuliah_tulis on public.matakuliah
  for all to authenticated
  using (public.is_instruktur())
  with check (public.is_instruktur());

-- Konvensi berkas di Storage ('tugas'): <user_id>/<matakuliah_id>/bab-NN/nama-berkas
-- Kebijakan 0002 hanya memeriksa folder pertama (user_id), jadi tetap berlaku.
