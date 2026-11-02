-- 0013_ujian_dosen_bebas.sql
-- Instruktur tidak dihalangi jadwal: ia boleh memulai ujian kapan saja untuk memeriksa soal dan alurnya, dan boleh mengulang
-- ujian apa pun (termasuk UTS/UAS) dari awal. Peserta tetap terikat jadwal kelasnya. Keterangan jadwal tetap tampil untuk dosen.
-- Sesi dosen tercatat seperti sesi peserta (bisa dihapus lewat tab Ujian: Izinkan mengulang). Aman dijalankan ulang. Sesudah 0010.

create or replace function public.ujian_mulai(p_mk text, p_ujian text, p_menit integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  j public.ujian_jadwal;
  f numeric(3, 2);
  m integer;
begin
  if auth.uid() is null then raise exception 'harus masuk dulu' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'lengkapi data diri dulu' using errcode = '42501'; end if;
  if exists (select 1 from public.ujian_sesi where user_id = auth.uid() and matakuliah_id = p_mk and ujian_id = p_ujian) then
    return public.ujian_status(p_mk, p_ujian);
  end if;
  j := public.ujian_jadwal_saya(p_mk, p_ujian);
  if not public.is_instruktur() and (j.ujian_id is null or now() < j.buka or now() >= j.tutup) then
    raise exception 'ujian belum dibuka untuk kelasmu' using errcode = 'P0001', hint = 'jadwal';
  end if;
  m := coalesce(j.menit, p_menit);
  if m is null or m < 5 or m > 600 then raise exception 'durasi tidak sah' using errcode = '22023'; end if;
  select coalesce((select a.faktor from public.ujian_akomodasi a where a.matakuliah_id = p_mk and a.ujian_id = p_ujian and a.user_id = auth.uid()), 1) into f;
  insert into public.ujian_sesi (user_id, matakuliah_id, ujian_id, kelas, mulai_pada, batas_tahap1, faktor)
  values (auth.uid(), p_mk, p_ujian, (select kelas from public.profiles where id = auth.uid()), now(), now() + make_interval(secs => round(m * 60 * f)), f);
  return public.ujian_status(p_mk, p_ujian);
end;
$$;

create or replace function public.ujian_ulang(p_mk text, p_ujian text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  j public.ujian_jadwal;
  n integer;
begin
  if auth.uid() is null then raise exception 'harus masuk dulu' using errcode = '42501'; end if;
  j := public.ujian_jadwal_saya(p_mk, p_ujian);
  if not public.is_instruktur() and (j.ujian_id is null or not j.boleh_ulang) then raise exception 'ujian ini tidak bisa diulang' using errcode = '42501'; end if;
  delete from public.ujian_sesi where user_id = auth.uid() and matakuliah_id = p_mk and ujian_id = p_ujian returning ulang into n;
  return jsonb_build_object('ulang', coalesce(n, 0) + 1);
end;
$$;

revoke all on function public.ujian_mulai(text, text, integer), public.ujian_ulang(text, text) from public, anon;
grant execute on function public.ujian_mulai(text, text, integer), public.ujian_ulang(text, text) to authenticated;
