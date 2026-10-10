-- 0008_praktikum.sql
-- Praktikum: proyek berantai yang dikerjakan peserta di ruang kerja berkas (berkas kerja, status tahap, riwayat versi, laporan).
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Jalankan SETELAH 0001 sampai 0007. Aman dijalankan ulang. Hanya MENAMBAH tabel baru; tabel dan data yang sudah ada
-- (progres, percobaan, laporan, profil, dan seterusnya) tidak diubah.
--
-- Tabel baru (semuanya milik peserta, dibaca instruktur):
--   * praktikum_berkas   berkas kerja terbaru tiap peserta (nama, isi, asal: milik, contoh, atau awal);
--   * praktikum_tahap    status tiap tahap per peserta (belum, sedang, lulus, dilewati), jalur, jumlah kirim, langkah yang dicentang;
--   * praktikum_versi    salinan seluruh berkas tiap kali peserta menekan Kirim, beserta hasil ujinya (hanya tambah);
--   * praktikum_laporan  laporan praktikum (jawaban, kode verifikasi, waktu ekspor), tidak pernah dikunci.
--
-- Definisi praktikum (tahap, langkah, kasus uji, berkas contoh) TIDAK ada di database: ia berkas JSON di situs
-- (site/data/kuliah/<mata kuliah>/praktikum/). Database hanya menyimpan pekerjaan peserta.
--
-- Privasi dan batas: kode yang ditulis peserta di ruang kerja dan jam kirimnya disimpan seperti latihan bab. Jumlah dan
-- ukuran berkas dibatasi supaya database tidak menggembung. Hapus bersama arsip akhir semester (arsip_akhir_semester.sql).

-- ---------- berkas kerja ----------
create table if not exists public.praktikum_berkas (
  user_id uuid not null references public.profiles (id) on delete cascade,
  matakuliah_id text not null references public.matakuliah (id) on update cascade,
  praktikum_id text not null check (praktikum_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(praktikum_id) <= 60),
  nama text not null check (nama ~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}$'),
  isi text not null default '' check (char_length(isi) <= 100000),
  asal text not null default 'milik' check (asal in ('milik', 'contoh', 'awal')),
  diperbarui_pada timestamptz not null default now(),
  primary key (user_id, matakuliah_id, praktikum_id, nama)
);

-- ---------- status tahap ----------
create table if not exists public.praktikum_tahap (
  user_id uuid not null references public.profiles (id) on delete cascade,
  matakuliah_id text not null references public.matakuliah (id) on update cascade,
  praktikum_id text not null check (praktikum_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(praktikum_id) <= 60),
  tahap_id text not null check (tahap_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(tahap_id) <= 40),
  status text not null default 'belum' check (status in ('belum', 'sedang', 'lulus', 'dilewati')),
  jalur text not null default 'web' check (jalur in ('web', 'laptop', 'ponsel')),
  jumlah_kirim integer not null default 0 check (jumlah_kirim between 0 and 100000),
  pertama_dibuka timestamptz,
  lulus_pada timestamptz,
  pakai_contoh boolean not null default false,
  centang jsonb not null default '{}'::jsonb check (octet_length(centang::text) <= 2000),
  diperbarui_pada timestamptz not null default now(),
  primary key (user_id, matakuliah_id, praktikum_id, tahap_id)
);

-- ---------- riwayat versi (setiap Kirim) ----------
create table if not exists public.praktikum_versi (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  matakuliah_id text not null references public.matakuliah (id) on update cascade,
  praktikum_id text not null check (praktikum_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(praktikum_id) <= 60),
  tahap_id text not null check (tahap_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(tahap_id) <= 40),
  berkas jsonb not null check (octet_length(berkas::text) <= 400000),
  hasil jsonb not null default '{}'::jsonb check (octet_length(hasil::text) <= 30000),
  lulus boolean not null default false,
  dibuat_pada timestamptz not null default now(),
  diterima_pada timestamptz
);
create index if not exists praktikum_versi_user_idx on public.praktikum_versi (matakuliah_id, praktikum_id, user_id, id);

-- ---------- laporan praktikum ----------
create table if not exists public.praktikum_laporan (
  user_id uuid not null references public.profiles (id) on delete cascade,
  matakuliah_id text not null references public.matakuliah (id) on update cascade,
  praktikum_id text not null check (praktikum_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(praktikum_id) <= 60),
  jawaban jsonb not null default '{}'::jsonb check (octet_length(jawaban::text) <= 30000),
  jumlah_ketikan jsonb not null default '{}'::jsonb check (octet_length(jumlah_ketikan::text) <= 2000),
  percobaan_tempel integer not null default 0 check (percobaan_tempel between 0 and 100000),
  durasi_menulis_detik integer not null default 0 check (durasi_menulis_detik between 0 and 10000000),
  kode_verifikasi text not null check (char_length(kode_verifikasi) = 8),
  dikumpulkan_pada timestamptz,
  diperbarui_pada timestamptz not null default now(),
  primary key (user_id, matakuliah_id, praktikum_id),
  unique (kode_verifikasi)
);

-- ---------- pemeliharaan otomatis ----------
-- Waktu pembaruan diisi database; waktu terima versi diisi database (tidak bisa dipalsukan dari browser).
create or replace function public.praktikum_set_waktu()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'praktikum_versi' then
    new.diterima_pada := now();
  else
    new.diperbarui_pada := now();
  end if;
  return new;
end;
$$;
drop trigger if exists praktikum_berkas_waktu on public.praktikum_berkas;
create trigger praktikum_berkas_waktu before insert or update on public.praktikum_berkas
  for each row execute function public.praktikum_set_waktu();
drop trigger if exists praktikum_tahap_waktu on public.praktikum_tahap;
create trigger praktikum_tahap_waktu before insert or update on public.praktikum_tahap
  for each row execute function public.praktikum_set_waktu();
drop trigger if exists praktikum_laporan_waktu on public.praktikum_laporan;
create trigger praktikum_laporan_waktu before insert or update on public.praktikum_laporan
  for each row execute function public.praktikum_set_waktu();
drop trigger if exists praktikum_versi_waktu on public.praktikum_versi;
create trigger praktikum_versi_waktu before insert on public.praktikum_versi
  for each row execute function public.praktikum_set_waktu();

-- Batas jumlah berkas kerja per peserta per praktikum, supaya satu akun tidak bisa menggembungkan database.
create or replace function public.praktikum_batasi_berkas()
returns trigger
language plpgsql
as $$
begin
  -- Upsert (insert ... on conflict do update) memicu trigger insert walau barisnya sudah ada: pembaruan tidak dihitung.
  if exists (select 1 from public.praktikum_berkas
               where user_id = new.user_id and matakuliah_id = new.matakuliah_id and praktikum_id = new.praktikum_id and nama = new.nama) then
    return new;
  end if;
  if (select count(*) from public.praktikum_berkas
        where user_id = new.user_id and matakuliah_id = new.matakuliah_id and praktikum_id = new.praktikum_id) >= 40 then
    raise exception 'terlalu banyak berkas (maksimal 40 per praktikum)' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists praktikum_berkas_batas on public.praktikum_berkas;
create trigger praktikum_berkas_batas before insert on public.praktikum_berkas
  for each row execute function public.praktikum_batasi_berkas();

-- ---------- keamanan ----------
revoke all on public.praktikum_berkas, public.praktikum_tahap, public.praktikum_versi, public.praktikum_laporan from anon;
revoke all on public.praktikum_berkas, public.praktikum_tahap, public.praktikum_versi, public.praktikum_laporan from authenticated;
grant select, insert, update, delete on public.praktikum_berkas to authenticated;
grant select, insert, update on public.praktikum_tahap, public.praktikum_laporan to authenticated;
grant select, insert on public.praktikum_versi to authenticated;
grant usage, select on sequence public.praktikum_versi_id_seq to authenticated;

alter table public.praktikum_berkas enable row level security;
alter table public.praktikum_tahap enable row level security;
alter table public.praktikum_versi enable row level security;
alter table public.praktikum_laporan enable row level security;

-- Berkas kerja: peserta mengelola miliknya sendiri; instruktur hanya membaca.
drop policy if exists praktikum_berkas_baca on public.praktikum_berkas;
create policy praktikum_berkas_baca on public.praktikum_berkas
  for select to authenticated using (user_id = auth.uid() or public.is_instruktur());
drop policy if exists praktikum_berkas_tulis on public.praktikum_berkas;
create policy praktikum_berkas_tulis on public.praktikum_berkas
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists praktikum_tahap_baca on public.praktikum_tahap;
create policy praktikum_tahap_baca on public.praktikum_tahap
  for select to authenticated using (user_id = auth.uid() or public.is_instruktur());
drop policy if exists praktikum_tahap_tambah on public.praktikum_tahap;
create policy praktikum_tahap_tambah on public.praktikum_tahap
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists praktikum_tahap_ubah on public.praktikum_tahap;
create policy praktikum_tahap_ubah on public.praktikum_tahap
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Riwayat versi: peserta menambah dan membaca miliknya; tidak bisa diubah atau dihapus.
drop policy if exists praktikum_versi_baca on public.praktikum_versi;
create policy praktikum_versi_baca on public.praktikum_versi
  for select to authenticated using (user_id = auth.uid() or public.is_instruktur());
drop policy if exists praktikum_versi_tambah on public.praktikum_versi;
create policy praktikum_versi_tambah on public.praktikum_versi
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists praktikum_laporan_baca on public.praktikum_laporan;
create policy praktikum_laporan_baca on public.praktikum_laporan
  for select to authenticated using (user_id = auth.uid() or public.is_instruktur());
drop policy if exists praktikum_laporan_tambah on public.praktikum_laporan;
create policy praktikum_laporan_tambah on public.praktikum_laporan
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists praktikum_laporan_ubah on public.praktikum_laporan;
create policy praktikum_laporan_ubah on public.praktikum_laporan
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
