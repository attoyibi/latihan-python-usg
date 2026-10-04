-- 0002_keamanan.sql
-- Row Level Security: peserta hanya mengakses data sendiri, instruktur membaca semuanya.
-- Jalankan SETELAH 0001_skema.sql. Aman dijalankan ulang.

-- Fungsi pembantu. security definer supaya membaca tabel profiles tanpa memicu
-- aturan RLS lagi (mencegah "infinite recursion detected in policy").
create or replace function public.peran_saya()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select peran from public.profiles where id = auth.uid();
$$;

create or replace function public.is_instruktur()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select peran = 'instruktur' from public.profiles where id = auth.uid()), false);
$$;

revoke all on function public.peran_saya() from public, anon;
revoke all on function public.is_instruktur() from public, anon;
grant execute on function public.peran_saya() to authenticated;
grant execute on function public.is_instruktur() to authenticated;

-- Pengunjung yang belum masuk tidak boleh menyentuh tabel apa pun.
revoke all on public.profiles, public.progres, public.percobaan, public.aktivitas,
  public.laporan, public.penilaian_laporan, public.unggahan, public.rekap_progres from anon;

-- Izin dasar untuk pengguna yang sudah masuk. Pembatasan sebenarnya ada di kebijakan RLS di bawah;
-- tanpa kebijakan yang cocok, perintah tetap ditolak.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.progres, public.percobaan,
  public.aktivitas, public.laporan, public.penilaian_laporan, public.unggahan to authenticated;
grant select on public.rekap_progres to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.progres enable row level security;
alter table public.percobaan enable row level security;
alter table public.aktivitas enable row level security;
alter table public.laporan enable row level security;
alter table public.penilaian_laporan enable row level security;
alter table public.unggahan enable row level security;

-- profiles --------------------------------------------------------------
drop policy if exists profiles_baca on public.profiles;
create policy profiles_baca on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_instruktur());

-- Peserta hanya boleh membuat profil dirinya dan hanya dengan peran 'peserta'.
drop policy if exists profiles_buat on public.profiles;
create policy profiles_buat on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and peran = 'peserta');

-- Peserta boleh memperbaiki nama/NIM/kelas, tetapi tidak boleh mengubah perannya.
drop policy if exists profiles_ubah on public.profiles;
create policy profiles_ubah on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and peran = public.peran_saya());

-- progres ---------------------------------------------------------------
drop policy if exists progres_baca on public.progres;
create policy progres_baca on public.progres
  for select to authenticated
  using (user_id = auth.uid() or public.is_instruktur());

drop policy if exists progres_buat on public.progres;
create policy progres_buat on public.progres
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists progres_ubah on public.progres;
create policy progres_ubah on public.progres
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- percobaan: hanya tambah dan baca (riwayat tidak boleh diubah atau dihapus peserta)
drop policy if exists percobaan_baca on public.percobaan;
create policy percobaan_baca on public.percobaan
  for select to authenticated
  using (user_id = auth.uid() or public.is_instruktur());

drop policy if exists percobaan_buat on public.percobaan;
create policy percobaan_buat on public.percobaan
  for insert to authenticated
  with check (user_id = auth.uid());

-- aktivitas: hanya tambah dan baca
drop policy if exists aktivitas_baca on public.aktivitas;
create policy aktivitas_baca on public.aktivitas
  for select to authenticated
  using (user_id = auth.uid() or public.is_instruktur());

drop policy if exists aktivitas_buat on public.aktivitas;
create policy aktivitas_buat on public.aktivitas
  for insert to authenticated
  with check (user_id = auth.uid());

-- laporan: boleh diedit hanya selagi masih draf
drop policy if exists laporan_baca on public.laporan;
create policy laporan_baca on public.laporan
  for select to authenticated
  using (user_id = auth.uid() or public.is_instruktur());

drop policy if exists laporan_buat on public.laporan;
create policy laporan_buat on public.laporan
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists laporan_ubah on public.laporan;
create policy laporan_ubah on public.laporan
  for update to authenticated
  using (user_id = auth.uid() and status = 'draf')
  with check (user_id = auth.uid());

-- penilaian_laporan: peserta boleh membaca penilaian atas laporannya; hanya instruktur yang menulis
drop policy if exists penilaian_baca on public.penilaian_laporan;
create policy penilaian_baca on public.penilaian_laporan
  for select to authenticated
  using (
    public.is_instruktur()
    or exists (select 1 from public.laporan l where l.id = laporan_id and l.user_id = auth.uid())
  );

drop policy if exists penilaian_tulis on public.penilaian_laporan;
create policy penilaian_tulis on public.penilaian_laporan
  for all to authenticated
  using (public.is_instruktur())
  with check (public.is_instruktur());

-- unggahan: peserta menambah dan membaca miliknya; hanya instruktur yang mengubah status
drop policy if exists unggahan_baca on public.unggahan;
create policy unggahan_baca on public.unggahan
  for select to authenticated
  using (user_id = auth.uid() or public.is_instruktur());

drop policy if exists unggahan_buat on public.unggahan;
create policy unggahan_buat on public.unggahan
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists unggahan_ubah on public.unggahan;
create policy unggahan_ubah on public.unggahan
  for update to authenticated
  using (public.is_instruktur())
  with check (public.is_instruktur());

drop policy if exists unggahan_hapus on public.unggahan;
create policy unggahan_hapus on public.unggahan
  for delete to authenticated
  using (user_id = auth.uid() and status <> 'disetujui');

-- Storage: bucket privat 'tugas'. Berkas disimpan di folder bernama id pengguna: <user_id>/nama-berkas
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tugas', 'tugas', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists tugas_baca on storage.objects;
create policy tugas_baca on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tugas'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_instruktur())
  );

drop policy if exists tugas_unggah on storage.objects;
create policy tugas_unggah on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tugas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists tugas_hapus on storage.objects;
create policy tugas_hapus on storage.objects
  for delete to authenticated
  using (bucket_id = 'tugas' and (storage.foldername(name))[1] = auth.uid()::text);
