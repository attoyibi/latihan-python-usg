-- 0007_riset_perilaku.sql
-- Jejak peserta (semua Jalankan dan Kirim, hasil, jenis galat, petunjuk) dan persetujuan penelitian.
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Jalankan SETELAH 0001 sampai 0006. Aman dijalankan ulang. Hanya MENAMBAH; data yang sudah ada tidak diubah.
--
-- Yang berubah:
--   * tabel `percobaan` mendapat kolom: hasil (lulus, gagal, galat, jalan, timeout), galat_jenis, galat_pesan,
--     cocok_contoh (keluaran Jalankan cocok dengan contoh atau tidak), petunjuk (berapa petunjuk terbuka saat itu).
--     Baris lama dibiarkan kosong pada kolom baru. Baris jenis 'jalankan' (setiap tombol Jalankan) memakai kolom
--     jenis yang sudah ada sejak 0001;
--   * `profiles` mendapat riset_setuju (null = belum menjawab), riset_setuju_pada, dan kode_riset (kode acak untuk
--     ekspor anonim; dibuat otomatis saat peserta setuju, tidak bisa diubah peserta);
--   * tabel `riset_ekspor_log`: catatan siapa mengekspor apa dan kapan (hanya instruktur).
--
-- Privasi: yang disimpan dari Jalankan adalah kode yang dijalankan, hasilnya, jenis galat (bukan keluaran program),
-- dan cara menulisnya. Peserta diberi tahu di halaman bab dan Panduan, dan diminta persetujuan terpisah sebelum
-- datanya ikut diekspor untuk penelitian. Hapus bersama arsip akhir semester (arsip_akhir_semester.sql).

-- ---------- percobaan: kolom hasil dan galat ----------
alter table public.percobaan add column if not exists hasil text;
alter table public.percobaan add column if not exists galat_jenis text;
alter table public.percobaan add column if not exists galat_pesan text;
alter table public.percobaan add column if not exists cocok_contoh boolean;
alter table public.percobaan add column if not exists petunjuk smallint;

alter table public.percobaan drop constraint if exists percobaan_hasil_sah;
alter table public.percobaan add constraint percobaan_hasil_sah
  check (hasil is null or hasil in ('lulus', 'gagal', 'galat', 'jalan', 'timeout'));
alter table public.percobaan drop constraint if exists percobaan_galat_ukuran;
alter table public.percobaan add constraint percobaan_galat_ukuran
  check ((galat_jenis is null or char_length(galat_jenis) <= 60) and (galat_pesan is null or char_length(galat_pesan) <= 300));
alter table public.percobaan drop constraint if exists percobaan_petunjuk_sah;
alter table public.percobaan add constraint percobaan_petunjuk_sah check (petunjuk is null or petunjuk between 0 and 9);
-- Baris Jalankan lebih kecil daripada Kirim: rekaman dibatasi lebih ketat agar database tidak menggembung.
alter table public.percobaan drop constraint if exists percobaan_rekaman_jalankan_ukuran;
alter table public.percobaan add constraint percobaan_rekaman_jalankan_ukuran
  check (jenis <> 'jalankan' or rekaman is null or octet_length(rekaman::text) <= 40000);

create index if not exists percobaan_kuliah_user_idx on public.percobaan (matakuliah_id, user_id, bab, id);

-- ---------- persetujuan penelitian ----------
alter table public.profiles add column if not exists riset_setuju boolean;
alter table public.profiles add column if not exists riset_setuju_pada timestamptz;
alter table public.profiles add column if not exists kode_riset text;
create unique index if not exists profiles_kode_riset_uq on public.profiles (kode_riset) where kode_riset is not null;

-- Kode riset dibuat otomatis saat peserta setuju dan tidak bisa diubah peserta (instruktur dan perintah administrasi boleh).
-- Waktu persetujuan dicatat otomatis oleh database. Menarik persetujuan tidak menghapus kode (supaya konsisten),
-- tetapi peserta yang tidak setuju tidak ikut ekspor.
create or replace function public.jaga_persetujuan_riset()
returns trigger
language plpgsql
as $$
declare
  v_admin boolean := auth.uid() is null or public.is_instruktur();
begin
  if tg_op = 'INSERT' then
    if not v_admin then
      new.kode_riset := null;
    end if;
  else
    if not v_admin then
      new.kode_riset := old.kode_riset;
    end if;
  end if;
  if new.riset_setuju is not null and (tg_op = 'INSERT' or new.riset_setuju is distinct from old.riset_setuju) then
    new.riset_setuju_pada := now();
  elsif tg_op = 'UPDATE' then
    new.riset_setuju_pada := old.riset_setuju_pada;
  end if;
  if new.riset_setuju is true and new.kode_riset is null then
    new.kode_riset := 'R-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_persetujuan_riset on public.profiles;
create trigger profiles_persetujuan_riset before insert or update on public.profiles
  for each row execute function public.jaga_persetujuan_riset();

-- ---------- catatan ekspor ----------
create table if not exists public.riset_ekspor_log (
  id bigint generated always as identity primary key,
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  oleh uuid references public.profiles (id) on delete set null,
  jumlah_peserta integer not null check (jumlah_peserta >= 0),
  jumlah_baris integer not null check (jumlah_baris >= 0),
  opsi jsonb not null default '{}'::jsonb check (octet_length(opsi::text) <= 2000),
  dibuat_pada timestamptz not null default now()
);

revoke all on public.riset_ekspor_log from anon, authenticated;
grant select, insert on public.riset_ekspor_log to authenticated;
grant usage, select on sequence public.riset_ekspor_log_id_seq to authenticated;
alter table public.riset_ekspor_log enable row level security;

drop policy if exists riset_ekspor_log_baca on public.riset_ekspor_log;
create policy riset_ekspor_log_baca on public.riset_ekspor_log
  for select to authenticated using (public.is_instruktur());
drop policy if exists riset_ekspor_log_tambah on public.riset_ekspor_log;
create policy riset_ekspor_log_tambah on public.riset_ekspor_log
  for insert to authenticated with check (public.is_instruktur());
