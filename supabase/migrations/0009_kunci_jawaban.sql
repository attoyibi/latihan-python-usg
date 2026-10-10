-- 0009_kunci_jawaban.sql
-- Kunci jawaban soal latihan per bab, untuk tombol "Isi kunci" khusus instruktur.
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Jalankan SETELAH 0001 sampai 0008. Aman dijalankan ulang. Hanya MENAMBAH satu tabel baru.
--
-- Kunci TIDAK ada di situs (folder site/ diterbitkan ke publik) dan TIDAK ada di repositori (folder kunci/ diabaikan git).
-- Isinya dimasukkan sekali oleh pemilik proyek lewat SQL Editor memakai berkas yang dibuat tools/buat_sql_kunci.py
-- (kunci/kunci_jawaban.sql). Dari browser, tabel ini HANYA bisa dibaca instruktur; tidak seorang pun (termasuk instruktur)
-- bisa menulis atau menghapusnya lewat API.

create table if not exists public.kunci_jawaban (
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  bab integer not null check (bab between 1 and 99),
  bahasa text not null check (char_length(bahasa) between 1 and 30),
  isi text not null check (char_length(isi) <= 50000),
  diperbarui_pada timestamptz not null default now(),
  primary key (matakuliah_id, bab)
);

revoke all on public.kunci_jawaban from anon;
revoke all on public.kunci_jawaban from authenticated;
grant select on public.kunci_jawaban to authenticated;

alter table public.kunci_jawaban enable row level security;

drop policy if exists kunci_jawaban_baca on public.kunci_jawaban;
create policy kunci_jawaban_baca on public.kunci_jawaban
  for select to authenticated using (public.is_instruktur());
