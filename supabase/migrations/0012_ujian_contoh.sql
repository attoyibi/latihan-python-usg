-- 0012_ujian_contoh.sql
-- Contoh jawaban benar untuk UTS dan UAS, hanya untuk INSTRUKTUR (supaya dosen bisa mencoba ujian tanpa mengetik jawaban).
-- Peserta tidak pernah menerimanya: tabel tanpa hak apa pun untuk anon dan authenticated, dan satu-satunya jalan baca adalah
-- fungsi di bawah yang memeriksa peran instruktur. Sengaja TERPISAH dari ujian_kunci, karena isi ujian_kunci turun ke peserta
-- setelah Tahap 1 dikunci. (Contoh jawaban simulasi bersifat publik di berkas situs; tabel ini untuk UTS/UAS.)
-- Isi tabel dibuat tools/ujian/buat_kunci_ujian.py (kunci/ujian_contoh*.sql, rahasia). Aman dijalankan ulang. Jalankan sesudah 0010.

create table if not exists public.ujian_contoh (
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  ujian_id text not null check (ujian_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(ujian_id) <= 40),
  isi jsonb not null check (octet_length(isi::text) <= 100000),
  diperbarui_pada timestamptz not null default now(),
  primary key (matakuliah_id, ujian_id)
);
revoke all on public.ujian_contoh from anon, authenticated;
alter table public.ujian_contoh enable row level security;

create or replace function public.ujian_contoh_dosen(p_mk text, p_ujian text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_instruktur() then raise exception 'hanya instruktur' using errcode = '42501'; end if;
  return (select isi from public.ujian_contoh where matakuliah_id = p_mk and ujian_id = p_ujian);
end;
$$;
revoke all on function public.ujian_contoh_dosen(text, text) from public, anon;
grant execute on function public.ujian_contoh_dosen(text, text) to authenticated;
