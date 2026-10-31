-- 0010_ujian.sql
-- Ujian UTS/UAS dan simulasinya (fitur Double-Check Exam): jadwal per kelas, akomodasi waktu, sesi peserta dengan
-- JAM SERVER, dan kunci (tes tersembunyi, poin kunci teori, butir konsep) yang baru diberikan setelah Tahap 1 dikunci.
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Jalankan SETELAH 0001 sampai 0009. Aman dijalankan ulang. Hanya MENAMBAH tabel dan fungsi baru; tabel lama tidak diubah.
--
-- Prinsip: kunci apa pun hanya turun ke browser setelah jawaban yang bersangkutan terkunci di server, dan jam selalu dari server.
--   * ujian_jadwal     kapan ujian boleh DIMULAI, per kelas (atau '*' = semua kelas). Diatur dosen dari dashboard.
--                      Tanpa baris jadwal yang sedang buka, peserta tidak bisa memulai (UTS tertutup sampai dosen membukanya).
--   * ujian_akomodasi  faktor waktu tambahan per peserta (mis. 1.5). Diatur dosen.
--   * ujian_sesi       satu baris per peserta per ujian. Waktu mulai, batas Tahap 1, dan waktu kunci diisi DATABASE;
--                      peserta hanya bisa mengubah kolom keadaan (pekerjaannya) dan hasil (ringkasan nilai).
--   * ujian_kunci      isi rahasia per ujian. Tidak bisa dibaca siapa pun lewat API, termasuk instruktur;
--                      diisi pemilik lewat SQL buatan tools/ujian/buat_sql_kunci_ujian.py.
--
-- Batas yang masih ada (dicatat, bukan ditutupi): butir Tahap 2 dibuat dan dinilai di browser peserta dari kunci yang sudah
-- turun, jadi peserta yang membuka alat pengembang saat Tahap 2 bisa melihat kunci butir; ringkasan nilai juga dikirim browser.
-- Batas waktu per butir Tahap 2 dihitung di browser dari jam server. Tanpa pengawas, ujian ini tidak mencegah bantuan AI.

-- ---------- jadwal ----------
create table if not exists public.ujian_jadwal (
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  ujian_id text not null check (ujian_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(ujian_id) <= 40),
  kelas text not null check (kelas = '*' or kelas ~ '^[A-Za-z0-9-]{1,30}$'),
  buka timestamptz not null,
  tutup timestamptz not null,
  menit integer check (menit is null or menit between 5 and 600),
  boleh_ulang boolean not null default false,
  diperbarui_pada timestamptz not null default now(),
  primary key (matakuliah_id, ujian_id, kelas),
  check (tutup > buka)
);

-- ---------- akomodasi waktu ----------
create table if not exists public.ujian_akomodasi (
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  ujian_id text not null check (ujian_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(ujian_id) <= 40),
  user_id uuid not null references public.profiles (id) on delete cascade,
  faktor numeric(3, 2) not null check (faktor between 1 and 3),
  diperbarui_pada timestamptz not null default now(),
  primary key (matakuliah_id, ujian_id, user_id)
);

-- ---------- sesi peserta ----------
create table if not exists public.ujian_sesi (
  user_id uuid not null references public.profiles (id) on delete cascade,
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  ujian_id text not null check (ujian_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(ujian_id) <= 40),
  kelas text,
  mulai_pada timestamptz not null default now(),
  batas_tahap1 timestamptz not null,
  faktor numeric(3, 2) not null default 1,
  terkunci_pada timestamptz,
  terlambat boolean not null default false,
  snapshot jsonb check (snapshot is null or octet_length(snapshot::text) <= 200000),
  hash text check (hash is null or hash ~ '^[0-9a-f]{64}$'),
  keadaan jsonb not null default '{}'::jsonb check (octet_length(keadaan::text) <= 600000),
  hasil jsonb not null default '{}'::jsonb check (octet_length(hasil::text) <= 20000),
  ulang integer not null default 0 check (ulang between 0 and 1000),
  diperbarui_pada timestamptz not null default now(),
  primary key (user_id, matakuliah_id, ujian_id)
);
create index if not exists ujian_sesi_ujian_idx on public.ujian_sesi (matakuliah_id, ujian_id);

-- ---------- kunci rahasia ----------
create table if not exists public.ujian_kunci (
  matakuliah_id text not null references public.matakuliah (id) on update cascade on delete cascade,
  ujian_id text not null check (ujian_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(ujian_id) <= 40),
  isi jsonb not null check (octet_length(isi::text) <= 500000),
  diperbarui_pada timestamptz not null default now(),
  primary key (matakuliah_id, ujian_id)
);

-- ---------- hak akses ----------
revoke all on public.ujian_jadwal, public.ujian_akomodasi, public.ujian_sesi, public.ujian_kunci from anon;
revoke all on public.ujian_jadwal, public.ujian_akomodasi, public.ujian_sesi, public.ujian_kunci from authenticated;
grant select, insert, update, delete on public.ujian_jadwal to authenticated;
grant select, insert, update, delete on public.ujian_akomodasi to authenticated;
grant select, delete on public.ujian_sesi to authenticated;
-- Peserta hanya boleh mengubah pekerjaannya dan ringkasan nilai; waktu, batas, dan snapshot hanya diisi fungsi di bawah.
grant update (keadaan, hasil) on public.ujian_sesi to authenticated;
-- ujian_kunci: tanpa hak apa pun untuk anon dan authenticated (hanya fungsi security definer yang membacanya).

alter table public.ujian_jadwal enable row level security;
alter table public.ujian_akomodasi enable row level security;
alter table public.ujian_sesi enable row level security;
alter table public.ujian_kunci enable row level security;

drop policy if exists ujian_jadwal_baca on public.ujian_jadwal;
create policy ujian_jadwal_baca on public.ujian_jadwal for select to authenticated using (true);
drop policy if exists ujian_jadwal_atur on public.ujian_jadwal;
create policy ujian_jadwal_atur on public.ujian_jadwal for all to authenticated
  using (public.is_instruktur()) with check (public.is_instruktur());

drop policy if exists ujian_akomodasi_baca on public.ujian_akomodasi;
create policy ujian_akomodasi_baca on public.ujian_akomodasi for select to authenticated
  using (user_id = auth.uid() or public.is_instruktur());
drop policy if exists ujian_akomodasi_atur on public.ujian_akomodasi;
create policy ujian_akomodasi_atur on public.ujian_akomodasi for all to authenticated
  using (public.is_instruktur()) with check (public.is_instruktur());

drop policy if exists ujian_sesi_baca on public.ujian_sesi;
create policy ujian_sesi_baca on public.ujian_sesi for select to authenticated
  using (user_id = auth.uid() or public.is_instruktur());
drop policy if exists ujian_sesi_ubah on public.ujian_sesi;
create policy ujian_sesi_ubah on public.ujian_sesi for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Instruktur boleh menghapus sesi peserta (mengizinkan mengulang, mis. karena gangguan teknis).
drop policy if exists ujian_sesi_hapus on public.ujian_sesi;
create policy ujian_sesi_hapus on public.ujian_sesi for delete to authenticated using (public.is_instruktur());

-- ---------- pemeliharaan otomatis ----------
create or replace function public.ujian_sentuh()
returns trigger language plpgsql set search_path = public as $$
begin
  new.diperbarui_pada := now();
  return new;
end;
$$;
drop trigger if exists ujian_jadwal_sentuh on public.ujian_jadwal;
create trigger ujian_jadwal_sentuh before insert or update on public.ujian_jadwal for each row execute function public.ujian_sentuh();
drop trigger if exists ujian_akomodasi_sentuh on public.ujian_akomodasi;
create trigger ujian_akomodasi_sentuh before insert or update on public.ujian_akomodasi for each row execute function public.ujian_sentuh();
drop trigger if exists ujian_sesi_sentuh on public.ujian_sesi;
create trigger ujian_sesi_sentuh before update on public.ujian_sesi for each row execute function public.ujian_sentuh();

-- ---------- fungsi ----------
-- Jadwal yang berlaku untuk peserta ini sekarang: baris kelasnya sendiri lebih dulu, lalu '*'.
create or replace function public.ujian_jadwal_saya(p_mk text, p_ujian text)
returns public.ujian_jadwal
language sql stable security definer set search_path = public as $$
  select j.* from public.ujian_jadwal j
  where j.matakuliah_id = p_mk and j.ujian_id = p_ujian
    and (j.kelas = '*' or j.kelas = (select p.kelas from public.profiles p where p.id = auth.uid())
         or j.kelas = (select p.rombel from public.profiles p where p.id = auth.uid()))
  order by (j.kelas = '*'), j.buka desc
  limit 1;
$$;

-- Status untuk layar Mulai: jam server, jadwal yang berlaku, dan sesi (bila sudah ada).
create or replace function public.ujian_status(p_mk text, p_ujian text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  j public.ujian_jadwal;
  s public.ujian_sesi;
begin
  if auth.uid() is null then raise exception 'harus masuk dulu' using errcode = '42501'; end if;
  j := public.ujian_jadwal_saya(p_mk, p_ujian);
  select * into s from public.ujian_sesi where user_id = auth.uid() and matakuliah_id = p_mk and ujian_id = p_ujian;
  return jsonb_build_object(
    'sekarang', now(),
    'jadwal', case when j.ujian_id is null then null else jsonb_build_object('kelas', j.kelas, 'buka', j.buka, 'tutup', j.tutup, 'menit', j.menit, 'boleh_ulang', j.boleh_ulang) end,
    'buka', j.ujian_id is not null and now() >= j.buka and now() < j.tutup,
    'sesi', case when s.user_id is null then null else jsonb_build_object(
      'mulai_pada', s.mulai_pada, 'batas_tahap1', s.batas_tahap1, 'faktor', s.faktor, 'terkunci_pada', s.terkunci_pada,
      'terlambat', s.terlambat, 'keadaan', s.keadaan, 'hasil', s.hasil, 'ulang', s.ulang, 'diperbarui_pada', s.diperbarui_pada) end
  );
end;
$$;

-- Memulai ujian: hanya saat jadwal kelasnya buka. Waktu mulai dan batas Tahap 1 dari jam server.
-- p_menit = durasi Tahap 1 bawaan ujian (dari exam.json); jadwal dosen boleh menggantinya. Memanggil ulang = sesi yang sama.
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
  if j.ujian_id is null or now() < j.buka or now() >= j.tutup then
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

-- Mengunci Tahap 1: menyimpan snapshot jawaban (sekali saja) dan baru setelah itu memberikan kunci ujian.
-- Lewat batas lebih dari 2 menit (mis. halaman ditutup lalu dibuka lagi) tetap diterima tetapi ditandai terlambat.
create or replace function public.ujian_kunci_tahap1(p_mk text, p_ujian text, p_snapshot jsonb, p_hash text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.ujian_sesi;
  k jsonb;
begin
  if auth.uid() is null then raise exception 'harus masuk dulu' using errcode = '42501'; end if;
  select * into s from public.ujian_sesi where user_id = auth.uid() and matakuliah_id = p_mk and ujian_id = p_ujian for update;
  if s.user_id is null then raise exception 'ujian belum dimulai' using errcode = 'P0001'; end if;
  select isi into k from public.ujian_kunci where matakuliah_id = p_mk and ujian_id = p_ujian;
  if k is null then raise exception 'kunci ujian belum dipasang oleh pengajar' using errcode = 'P0001', hint = 'kunci'; end if;
  if s.terkunci_pada is null then
    update public.ujian_sesi
       set terkunci_pada = now(), snapshot = p_snapshot, hash = p_hash, terlambat = now() > s.batas_tahap1 + interval '2 minutes'
     where user_id = auth.uid() and matakuliah_id = p_mk and ujian_id = p_ujian;
  end if;
  return jsonb_build_object('kunci', k, 'sekarang', now());
end;
$$;

-- Kunci untuk sesi yang sudah terkunci (muat ulang halaman di Tahap 2 atau Hasil). Tidak pernah sebelum terkunci.
create or replace function public.ujian_ambil_kunci(p_mk text, p_ujian text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  k jsonb;
begin
  if not exists (select 1 from public.ujian_sesi where user_id = auth.uid() and matakuliah_id = p_mk and ujian_id = p_ujian and terkunci_pada is not null) then
    raise exception 'Tahap 1 belum dikunci' using errcode = '42501';
  end if;
  select isi into k from public.ujian_kunci where matakuliah_id = p_mk and ujian_id = p_ujian;
  return k;
end;
$$;

-- Mengulang dari awal: hanya untuk ujian yang jadwalnya boleh diulang (simulasi). Sesi dihapus, hitungan ulang disimpan.
create or replace function public.ujian_ulang(p_mk text, p_ujian text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  j public.ujian_jadwal;
  n integer;
begin
  if auth.uid() is null then raise exception 'harus masuk dulu' using errcode = '42501'; end if;
  j := public.ujian_jadwal_saya(p_mk, p_ujian);
  if j.ujian_id is null or not j.boleh_ulang then raise exception 'ujian ini tidak bisa diulang' using errcode = '42501'; end if;
  delete from public.ujian_sesi where user_id = auth.uid() and matakuliah_id = p_mk and ujian_id = p_ujian returning ulang into n;
  return jsonb_build_object('ulang', coalesce(n, 0) + 1);
end;
$$;

revoke all on function public.ujian_jadwal_saya(text, text), public.ujian_status(text, text), public.ujian_mulai(text, text, integer),
  public.ujian_kunci_tahap1(text, text, jsonb, text), public.ujian_ambil_kunci(text, text), public.ujian_ulang(text, text) from public, anon;
grant execute on function public.ujian_status(text, text), public.ujian_mulai(text, text, integer),
  public.ujian_kunci_tahap1(text, text, jsonb, text), public.ujian_ambil_kunci(text, text), public.ujian_ulang(text, text) to authenticated;

-- Simulasi Algoritma terbuka untuk semua kelas dan boleh diulang. UTS sengaja TIDAK diberi jadwal: dosen membukanya
-- dari tab Ujian di dashboard. Baris yang sudah ada (diubah dosen) tidak ditimpa.
insert into public.ujian_jadwal (matakuliah_id, ujian_id, kelas, buka, tutup, menit, boleh_ulang)
select 'algoritma-python', 'simulasi', '*', now(), now() + interval '1 year', null, true
where exists (select 1 from public.matakuliah where id = 'algoritma-python')
on conflict (matakuliah_id, ujian_id, kelas) do nothing;
