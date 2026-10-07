-- 0006_kehadiran.sql
-- Kehadiran dan keaktifan: jadwal pertemuan per kelas, sesi belajar (jam dan lama aktif), jam server, dan koreksi manual.
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Jalankan SETELAH 0001 sampai 0005. Aman dijalankan ulang. Tidak mengubah atau menghapus data yang sudah ada.
--
-- Yang berubah (semuanya hanya MENAMBAH):
--   * kolom `diterima_pada` pada percobaan dan aktivitas: jam SERVER saat baris diterima. Baris lama dibiarkan
--     kosong (jam server lama tidak diketahui dan tidak dikarang); yang dipakai untuk baris lama adalah jam
--     perangkat seperti sebelumnya;
--   * tabel `sesi_belajar`: satu baris per sesi membuka situs (mulai, terakhir aktif, lama aktif, bab yang dibuka),
--     ditulis HANYA lewat fungsi `catat_denyut`;
--   * tabel `jadwal_kelas`: tanggal dan jam tiap pertemuan per mata kuliah dan kelas (hanya instruktur);
--   * tabel `jadwal_riwayat`: catatan perubahan jadwal (hanya instruktur);
--   * tabel `koreksi_kehadiran`: koreksi manual status hadir per peserta per pertemuan (hanya instruktur).
--
-- Privasi: yang dicatat hanya kapan situs dibuka dan dipakai aktif serta bab yang dibuka, tanpa isi apa pun.
-- Peserta diberi tahu di halaman bab dan Panduan. Hapus bersama arsip akhir semester (arsip_akhir_semester.sql).

-- ---------- jam server ----------
alter table public.percobaan add column if not exists diterima_pada timestamptz;
alter table public.percobaan alter column diterima_pada set default now();
alter table public.aktivitas add column if not exists diterima_pada timestamptz;
alter table public.aktivitas alter column diterima_pada set default now();

-- Jam server tidak bisa diisi dari browser: selalu dipaksa menjadi jam saat baris masuk.
create or replace function public.set_diterima_pada()
returns trigger
language plpgsql
as $$
begin
  new.diterima_pada := now();
  return new;
end;
$$;
drop trigger if exists percobaan_diterima on public.percobaan;
create trigger percobaan_diterima before insert on public.percobaan
  for each row execute function public.set_diterima_pada();
drop trigger if exists aktivitas_diterima on public.aktivitas;
create trigger aktivitas_diterima before insert on public.aktivitas
  for each row execute function public.set_diterima_pada();

-- ---------- sesi belajar ----------
create table if not exists public.sesi_belajar (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  matakuliah_id text not null references public.matakuliah (id) on update cascade,
  mulai timestamptz not null default now(),
  terakhir timestamptz not null default now(),
  aktif_detik integer not null default 0 check (aktif_detik between 0 and 86400),
  denyut integer not null default 0,
  bab_dibuka smallint[] not null default '{}' check (cardinality(bab_dibuka) <= 40)
);
create index if not exists sesi_belajar_user_idx on public.sesi_belajar (user_id, mulai);
create index if not exists sesi_belajar_kuliah_idx on public.sesi_belajar (matakuliah_id, mulai);

-- Peserta mencatat sesinya lewat fungsi ini. Identitas selalu dari sesi masuk. Tambahan waktu aktif dibatasi
-- agar tidak melebihi waktu nyata di server sejak denyut sebelumnya (jadi tidak bisa digelembungkan).
create or replace function public.catat_denyut(p_sesi uuid, p_matakuliah text, p_bab integer default null, p_tambah integer default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tambah integer := least(greatest(coalesce(p_tambah, 0), 0), 120);
  v_ada public.sesi_belajar%rowtype;
begin
  if auth.uid() is null then
    raise exception 'harus masuk dulu' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    return; -- belum punya profil: tidak dicatat
  end if;
  if not exists (select 1 from public.matakuliah where id = p_matakuliah) then
    return;
  end if;

  select * into v_ada from public.sesi_belajar where id = p_sesi;
  if not found then
    insert into public.sesi_belajar (id, user_id, matakuliah_id, aktif_detik, denyut, bab_dibuka)
    values (p_sesi, auth.uid(), p_matakuliah, least(v_tambah, 90), 1,
            case when p_bab between 1 and 99 then array[p_bab::smallint] else '{}'::smallint[] end);
    return;
  end if;
  if v_ada.user_id <> auth.uid() then
    return; -- sesi milik orang lain: diabaikan tanpa memberi tahu
  end if;

  update public.sesi_belajar
     set terakhir = now(),
         denyut = denyut + 1,
         aktif_detik = least(86400, aktif_detik + least(v_tambah, greatest(0, extract(epoch from (now() - v_ada.terakhir))::integer) + 5)),
         bab_dibuka = case
           when p_bab between 1 and 99 and not (p_bab::smallint = any (bab_dibuka)) and cardinality(bab_dibuka) < 40
             then bab_dibuka || p_bab::smallint
           else bab_dibuka end
   where id = p_sesi;
end;
$$;

revoke all on function public.catat_denyut(uuid, text, integer, integer) from public, anon;
grant execute on function public.catat_denyut(uuid, text, integer, integer) to authenticated;

-- ---------- jadwal pertemuan per kelas ----------
create table if not exists public.jadwal_kelas (
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  kelas text not null check (char_length(kelas) between 1 and 30),
  pertemuan smallint not null check (pertemuan between 1 and 40),
  mulai timestamptz not null,
  selesai timestamptz not null,
  libur boolean not null default false,
  dipindah boolean not null default false,
  catatan text check (catatan is null or char_length(catatan) <= 200),
  diperbarui_pada timestamptz not null default now(),
  primary key (matakuliah_id, kelas, pertemuan),
  check (selesai > mulai)
);

create table if not exists public.jadwal_riwayat (
  id bigint generated always as identity primary key,
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  kelas text not null check (char_length(kelas) between 1 and 30),
  oleh uuid references public.profiles (id) on delete set null,
  ringkasan text not null check (char_length(ringkasan) between 1 and 400),
  dibuat_pada timestamptz not null default now()
);
create index if not exists jadwal_riwayat_idx on public.jadwal_riwayat (matakuliah_id, kelas, dibuat_pada);

create table if not exists public.koreksi_kehadiran (
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pertemuan smallint not null check (pertemuan between 1 and 40),
  status text not null check (status in ('hadir', 'tidak')),
  alasan text check (alasan is null or char_length(alasan) <= 200),
  oleh uuid references public.profiles (id) on delete set null,
  dibuat_pada timestamptz not null default now(),
  primary key (matakuliah_id, user_id, pertemuan)
);

-- ---------- keamanan ----------
revoke all on public.sesi_belajar, public.jadwal_kelas, public.jadwal_riwayat, public.koreksi_kehadiran from anon;
revoke all on public.sesi_belajar, public.jadwal_kelas, public.jadwal_riwayat, public.koreksi_kehadiran from authenticated;
-- Sesi: peserta hanya membaca miliknya dan tidak menulis langsung (hanya lewat catat_denyut).
grant select on public.sesi_belajar to authenticated;
grant select, insert, update, delete on public.jadwal_kelas, public.koreksi_kehadiran to authenticated;
grant select, insert on public.jadwal_riwayat to authenticated;
grant usage, select on sequence public.jadwal_riwayat_id_seq to authenticated;

alter table public.sesi_belajar enable row level security;
alter table public.jadwal_kelas enable row level security;
alter table public.jadwal_riwayat enable row level security;
alter table public.koreksi_kehadiran enable row level security;

drop policy if exists sesi_belajar_baca on public.sesi_belajar;
create policy sesi_belajar_baca on public.sesi_belajar
  for select to authenticated
  using (user_id = auth.uid() or public.is_instruktur());

drop policy if exists jadwal_kelas_kelola on public.jadwal_kelas;
create policy jadwal_kelas_kelola on public.jadwal_kelas
  for all to authenticated
  using (public.is_instruktur())
  with check (public.is_instruktur());

drop policy if exists jadwal_riwayat_baca on public.jadwal_riwayat;
create policy jadwal_riwayat_baca on public.jadwal_riwayat
  for select to authenticated
  using (public.is_instruktur());
drop policy if exists jadwal_riwayat_tambah on public.jadwal_riwayat;
create policy jadwal_riwayat_tambah on public.jadwal_riwayat
  for insert to authenticated
  with check (public.is_instruktur());

drop policy if exists koreksi_kehadiran_kelola on public.koreksi_kehadiran;
create policy koreksi_kehadiran_kelola on public.koreksi_kehadiran
  for all to authenticated
  using (public.is_instruktur())
  with check (public.is_instruktur());
