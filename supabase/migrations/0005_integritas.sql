-- 0005_integritas.sql
-- Sinyal keaslian pengerjaan: perangkat yang dipakai masuk, serta pola dan rekaman cara peserta menulis kode.
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Jalankan SETELAH 0001 sampai 0004. Aman dijalankan ulang.
--
-- Yang berubah:
--   * kolom `pola` (ringkasan angka cara menulis) dan `rekaman` (urutan perubahan kode, untuk diputar ulang)
--     pada tabel `percobaan`;
--   * tabel `sesi_perangkat`: akun mana pernah masuk dari perangkat (ID acak di browser) mana;
--   * tabel `perangkat_bersama`: perangkat yang ditandai instruktur sebagai milik bersama (mis. laboratorium);
--   * fungsi `catat_perangkat`: satu-satunya jalan peserta menulis ke `sesi_perangkat` (selalu atas nama dirinya).
--
-- Privasi: ID perangkat adalah angka acak buatan situs ini, bukan sidik jari perangkat. Yang direkam dari cara
-- menulis hanya waktu dan perubahan di dalam editor latihan. Hapus data ini bersama arsip akhir semester
-- (lihat arsip_akhir_semester.sql). Peserta tidak bisa membaca data orang lain.

alter table public.percobaan add column if not exists pola jsonb;
alter table public.percobaan add column if not exists rekaman jsonb;

-- Batas ukuran, supaya satu baris tidak bisa menggembungkan database.
alter table public.percobaan drop constraint if exists percobaan_pola_ukuran;
alter table public.percobaan add constraint percobaan_pola_ukuran check (pola is null or octet_length(pola::text) <= 4000);
alter table public.percobaan drop constraint if exists percobaan_rekaman_ukuran;
alter table public.percobaan add constraint percobaan_rekaman_ukuran check (rekaman is null or octet_length(rekaman::text) <= 120000);

create table if not exists public.sesi_perangkat (
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 64),
  pertama_dilihat timestamptz not null default now(),
  terakhir_dilihat timestamptz not null default now(),
  jumlah_masuk integer not null default 1,
  agen text check (agen is null or char_length(agen) <= 80),
  primary key (user_id, device_id)
);
create index if not exists sesi_perangkat_device_idx on public.sesi_perangkat (device_id);

create table if not exists public.perangkat_bersama (
  device_id text primary key check (char_length(device_id) between 8 and 64),
  catatan text check (catatan is null or char_length(catatan) <= 200),
  ditandai_oleh uuid references public.profiles (id) on delete set null,
  dibuat_pada timestamptz not null default now()
);

-- Peserta mencatat perangkatnya lewat fungsi ini; identitasnya selalu diambil dari sesi masuk, bukan dari parameter.
create or replace function public.catat_perangkat(p_device text, p_agen text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'harus masuk dulu' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    return; -- belum punya profil: tidak dicatat
  end if;
  insert into public.sesi_perangkat (user_id, device_id, agen)
  values (auth.uid(), p_device, left(p_agen, 80))
  on conflict (user_id, device_id) do update
    set terakhir_dilihat = now(),
        jumlah_masuk = public.sesi_perangkat.jumlah_masuk + 1,
        agen = coalesce(excluded.agen, public.sesi_perangkat.agen);
end;
$$;

revoke all on function public.catat_perangkat(text, text) from public, anon;
grant execute on function public.catat_perangkat(text, text) to authenticated;

-- Keamanan: peserta hanya membaca catatannya sendiri dan tidak menulis langsung; instruktur membaca semuanya.
revoke all on public.sesi_perangkat, public.perangkat_bersama from anon;
revoke all on public.sesi_perangkat, public.perangkat_bersama from authenticated;
grant select on public.sesi_perangkat to authenticated;
grant select, insert, update, delete on public.perangkat_bersama to authenticated;

alter table public.sesi_perangkat enable row level security;
alter table public.perangkat_bersama enable row level security;

drop policy if exists sesi_perangkat_baca on public.sesi_perangkat;
create policy sesi_perangkat_baca on public.sesi_perangkat
  for select to authenticated
  using (user_id = auth.uid() or public.is_instruktur());

drop policy if exists perangkat_bersama_kelola on public.perangkat_bersama;
create policy perangkat_bersama_kelola on public.perangkat_bersama
  for all to authenticated
  using (public.is_instruktur())
  with check (public.is_instruktur());
