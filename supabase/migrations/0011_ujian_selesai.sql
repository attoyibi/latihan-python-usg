-- 0011_ujian_selesai.sql
-- Tahap 2 ujian menjadi pertanyaan terbuka: setelah peserta selesai, jawabannya DIKUNCI di server (tidak bisa diubah lagi),
-- dan hasil analisis (AI atau dosen) per peserta bisa disimpan untuk dilihat kembali di dashboard.
--   * ujian_sesi.selesai_pada  diisi fungsi ujian_selesai (jam server). Sesudahnya server menolak perubahan kolom keadaan
--                              dan hasil dari peserta (pemicu di bawah).
--   * ujian_sesi.analisis      hasil analisis per butir. Hanya bisa diisi lewat ujian_analisis_simpan oleh instruktur;
--                              peserta dan klien lain tidak punya hak menulis kolom ini.
-- Aman dijalankan ulang. Tidak mengubah data lama. Jalankan sesudah 0010.

alter table public.ujian_sesi add column if not exists selesai_pada timestamptz;
alter table public.ujian_sesi add column if not exists analisis jsonb not null default '{}'::jsonb
  check (octet_length(analisis::text) <= 300000);

-- Peserta menutup jawabannya: waktu dari jam server, hanya bila Tahap 1 sudah dikunci, dan tidak bisa dibuka lagi.
create or replace function public.ujian_selesai(p_mk text, p_ujian text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  t timestamptz;
begin
  if auth.uid() is null then raise exception 'harus masuk dulu' using errcode = '42501'; end if;
  update public.ujian_sesi set selesai_pada = coalesce(selesai_pada, now())
    where user_id = auth.uid() and matakuliah_id = p_mk and ujian_id = p_ujian and terkunci_pada is not null
    returning selesai_pada into t;
  if t is null then raise exception 'Tahap 1 belum dikunci atau ujian belum dimulai' using errcode = '42501'; end if;
  return t;
end;
$$;

-- Setelah selesai, peserta tidak bisa lagi mengubah pekerjaan maupun ringkasan nilainya.
create or replace function public.ujian_jaga_selesai()
returns trigger language plpgsql as $$
begin
  if old.selesai_pada is not null and (new.keadaan is distinct from old.keadaan or new.hasil is distinct from old.hasil) then
    raise exception 'jawaban sudah dikumpulkan dan dikunci' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists ujian_sesi_jaga_selesai on public.ujian_sesi;
create trigger ujian_sesi_jaga_selesai before update on public.ujian_sesi for each row execute function public.ujian_jaga_selesai();

-- Instruktur menyimpan hasil analisis satu peserta (menggantikan isi lama).
create or replace function public.ujian_analisis_simpan(p_mk text, p_ujian text, p_user uuid, p_analisis jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_instruktur() then raise exception 'hanya instruktur' using errcode = '42501'; end if;
  update public.ujian_sesi set analisis = coalesce(p_analisis, '{}'::jsonb)
    where user_id = p_user and matakuliah_id = p_mk and ujian_id = p_ujian;
  if not found then raise exception 'sesi peserta tidak ditemukan' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.ujian_selesai(text, text), public.ujian_analisis_simpan(text, text, uuid, jsonb) from public, anon;
grant execute on function public.ujian_selesai(text, text), public.ujian_analisis_simpan(text, text, uuid, jsonb) to authenticated;
