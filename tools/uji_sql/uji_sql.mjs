// Menjalankan seluruh migrasi di PostgreSQL sungguhan (PGlite, berjalan di Node, tanpa Docker)
// lalu menguji aturan keamanannya dari sudut pandang peserta, peserta lain, instruktur, dan pengunjung.
//
// Skema Supabase (auth, storage, peran anon/authenticated) ditiru secukupnya di bawah ini.
// Ini BUKAN pengganti uji di proyek Supabase sungguhan, tetapi menangkap galat SQL dan celah RLS.
//
// Jalankan:  cd tools/uji_sql && npm install && npm run uji

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrasi = (f) => readFileSync(join(root, "supabase", "migrations", f), "utf8");

const U1 = "11111111-1111-1111-1111-111111111111"; // peserta 1
const U2 = "22222222-2222-2222-2222-222222222222"; // peserta 2
const IN = "33333333-3333-3333-3333-333333333333"; // instruktur

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text, owner uuid
);
create function storage.foldername(name text) returns text[] language sql immutable
  as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;

grant usage on schema public, auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
-- Supabase memberi hak penuh ke anon/authenticated pada tabel baru di schema public:
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

const db = new PGlite();
let total = 0;
let gagal = 0;

function cek(nama, kondisi, detail = "") {
  total++;
  if (!kondisi) {
    gagal++;
    console.log("GAGAL " + nama + (detail ? "  -> " + detail : ""));
  } else {
    console.log("OK    " + nama);
  }
}

async function q(sql, params) {
  try {
    const r = await db.query(sql, params);
    return { rows: r.rows, n: r.affectedRows != null ? r.affectedRows : r.rows.length };
  } catch (e) {
    return { error: String(e.message || e), code: e.code };
  }
}

async function jalankan(nama, sql) {
  try {
    await db.exec(sql);
    cek(nama, true);
    return true;
  } catch (e) {
    cek(nama, false, String(e.message || e));
    return false;
  }
}

async function sebagai(peran, uid, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
  await db.exec("set role " + peran);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const ditolak = (r, kode) => !!r.error && (!kode || r.code === kode);
const RLS = "42501";

// ---------- siapkan ----------
await db.exec(STUB);
await db.query("insert into auth.users (id, email) values ($1,'u1@x.id'), ($2,'u2@x.id'), ($3,'dosen@x.id')", [U1, U2, IN]);

console.log("== Tahap A: migrasi 0001 dan 0002 ==");
if (!(await jalankan("0001_skema.sql berjalan", migrasi("0001_skema.sql")))) process.exit(1);
if (!(await jalankan("0002_keamanan.sql berjalan", migrasi("0002_keamanan.sql")))) process.exit(1);
await jalankan("0001 dan 0002 aman dijalankan ulang", migrasi("0001_skema.sql") + migrasi("0002_keamanan.sql"));

cek("pengunjung (anon) ditolak membaca profiles", ditolak(await sebagai("anon", null, () => q("select * from public.profiles")), RLS));

const buatProfil = (uid, nama, nim, peran) =>
  q("insert into public.profiles (id, nama, nim, kelas" + (peran ? ", peran" : "") + ") values ($1,$2,$3,'SI-1A'" + (peran ? ",$4" : "") + ")", peran ? [uid, nama, nim, peran] : [uid, nama, nim]);

cek("peserta 1 membuat profilnya", !(await sebagai("authenticated", U1, () => buatProfil(U1, "Siti Aminah", "2024110012"))).error);
cek("peserta tidak bisa membuat profil atas nama orang lain", ditolak(await sebagai("authenticated", U1, () => buatProfil(U2, "Palsu", "999")), RLS));
cek("peserta tidak bisa mendaftar sebagai instruktur", ditolak(await sebagai("authenticated", U2, () => buatProfil(U2, "Budi", "2024110099", "instruktur")), RLS));
cek("NIM kembar ditolak", ditolak(await sebagai("authenticated", U2, () => buatProfil(U2, "Budi", "2024110012")), "23505"));
cek("peserta 2 membuat profilnya", !(await sebagai("authenticated", U2, () => buatProfil(U2, "Budi Santoso", "2024110099"))).error);
await db.query("insert into public.profiles (id, nama, nim, kelas, peran) values ($1,'Dosen','D001','Dosen','instruktur')", [IN]);

cek("peserta hanya melihat profilnya sendiri", (await sebagai("authenticated", U1, () => q("select * from public.profiles"))).rows.length === 1);
cek("instruktur melihat semua profil", (await sebagai("authenticated", IN, () => q("select * from public.profiles"))).rows.length === 3);
cek("peserta tidak bisa menaikkan perannya", ditolak(await sebagai("authenticated", U1, () => q("update public.profiles set peran = 'instruktur' where id = $1", [U1])), RLS));
cek("peserta bisa mengubah nama, NIM, kelas sendiri", (await sebagai("authenticated", U1, () => q("update public.profiles set nama='Siti Aminah Putri', kelas='SI-1B' where id = $1", [U1]))).n === 1);

// data peserta
const sisip = (uid, sql, ...p) => sebagai("authenticated", uid, () => q(sql, p));
cek("peserta menyimpan progres sendiri", !(await sisip(U1, "insert into public.progres (user_id, bab, status) values ($1, 4, 'selesai')", U1)).error);
cek("peserta tidak bisa menyimpan progres atas nama lain", ditolak(await sisip(U1, "insert into public.progres (user_id, bab) values ($1, 4)", U2), RLS));
cek("peserta menyimpan percobaan", !(await sisip(U1, "insert into public.percobaan (user_id, bab, jenis, lulus, kode) values ($1, 4, 'kirim', true, 'print(1)')", U1)).error);
cek("peserta menyimpan aktivitas", !(await sisip(U1, "insert into public.aktivitas (user_id, bab, jenis) values ($1, 4, 'buka_bab')", U1)).error);
cek("percobaan tidak bisa diubah peserta", (await sisip(U1, "update public.percobaan set lulus = false where user_id = $1", U1)).n === 0);
cek("percobaan tidak bisa dihapus peserta", (await sisip(U1, "delete from public.percobaan where user_id = $1", U1)).n === 0);
cek("peserta membuat laporan draf", !(await sisip(U1, "insert into public.laporan (user_id, bab, jawaban) values ($1, 4, '{\"tujuan\":\"x\"}')", U1)).error);
cek("peserta mengumpulkan laporan", (await sisip(U1, "update public.laporan set status = 'dikumpulkan' where user_id = $1", U1)).n === 1);
cek("laporan terkumpul tidak bisa diubah lagi", (await sisip(U1, "update public.laporan set jawaban = '{}' where user_id = $1", U1)).n === 0);
cek("peserta 2 tidak melihat progres peserta 1", (await sisip(U2, "select * from public.progres")).rows.length === 0);
cek("peserta 2 tidak melihat laporan peserta 1", (await sisip(U2, "select * from public.laporan")).rows.length === 0);
cek("instruktur melihat progres peserta", (await sisip(IN, "select * from public.progres")).rows.length === 1);

const lap = (await q("select id from public.laporan where user_id = $1", [U1])).rows[0].id;
cek("peserta tidak bisa menulis penilaian", ditolak(await sisip(U1, "insert into public.penilaian_laporan (laporan_id, skor_konsep) values ($1, 4)", lap), RLS));
cek("instruktur menulis penilaian", !(await sisip(IN, "insert into public.penilaian_laporan (laporan_id, penilai, skor_konsep, skor_bahasa, skor_refleksi, skor_kode) values ($1, $2, 4, 3, 3, 4)", lap, IN)).error);
cek("skor di luar 1 sampai 4 ditolak", ditolak(await sisip(IN, "update public.penilaian_laporan set skor_konsep = 9 where laporan_id = $1", lap), "23514"));
cek("peserta membaca penilaian atas laporannya", (await sisip(U1, "select * from public.penilaian_laporan")).rows.length === 1);
cek("peserta lain tidak membaca penilaian itu", (await sisip(U2, "select * from public.penilaian_laporan")).rows.length === 0);

cek("peserta menambah unggahan", !(await sisip(U1, "insert into public.unggahan (user_id, bab, path, ukuran_byte) values ($1, 3, $2, 1000)", U1, U1 + "/bab-03/a.png")).error);
cek("ukuran unggahan di atas 10 MB ditolak", ditolak(await sisip(U1, "insert into public.unggahan (user_id, bab, path, ukuran_byte) values ($1, 3, 'x', 99999999)", U1), "23514"));
cek("peserta tidak bisa mengubah status unggahan", (await sisip(U1, "update public.unggahan set status = 'disetujui' where user_id = $1", U1)).n === 0);
cek("instruktur mengubah status unggahan", (await sisip(IN, "update public.unggahan set status = 'disetujui'")).n === 1);
cek("unggahan yang disetujui tidak bisa dihapus peserta", (await sisip(U1, "delete from public.unggahan where user_id = $1", U1)).n === 0);

await db.query("insert into storage.objects (bucket_id, name, owner) select 'tugas', $1, $2", [U2 + "/milik-u2.png", U2]);
cek("bucket 'tugas' privat dan dibuat", (await q("select public from storage.buckets where id = 'tugas'")).rows[0]?.public === false);
cek("peserta mengunggah ke folder sendiri", !(await sisip(U1, "insert into storage.objects (bucket_id, name, owner) values ('tugas', $1, $2)", U1 + "/bab-03/a.png", U1)).error);
cek("peserta tidak bisa mengunggah ke folder orang lain", ditolak(await sisip(U1, "insert into storage.objects (bucket_id, name, owner) values ('tugas', $1, $2)", U2 + "/bab-03/b.png", U1), RLS));
cek("peserta hanya melihat berkas sendiri", (await sisip(U1, "select * from storage.objects")).rows.length === 1);
cek("instruktur melihat semua berkas", (await sisip(IN, "select * from storage.objects")).rows.length === 2);

cek("tampilan rekap: peserta hanya melihat dirinya", (await sisip(U1, "select distinct user_id from public.rekap_progres")).rows.length === 1);

console.log("\n== Tahap B: migrasi 0003 (banyak mata kuliah) pada data yang sudah ada ==");
if (!(await jalankan("0003_matakuliah.sql berjalan", migrasi("0003_matakuliah.sql")))) process.exit(1);
await jalankan("0003 aman dijalankan ulang", migrasi("0003_matakuliah.sql"));

for (const t of ["progres", "percobaan", "aktivitas", "laporan", "unggahan"]) {
  const r = await q(`select distinct matakuliah_id from public.${t}`);
  cek(`data lama di ${t} dipindah ke 'algoritma-python'`, r.rows.length === 1 && r.rows[0].matakuliah_id === "algoritma-python", JSON.stringify(r.rows));
}
cek("dua mata kuliah awal terdaftar", (await q("select count(*)::int as n from public.matakuliah")).rows[0].n === 2);
cek("pbo-java awalnya belum aktif, algoritma-python aktif", (await q("select id from public.matakuliah where aktif order by id")).rows.map((r) => r.id).join() === "algoritma-python");

cek("bab 4 di mata kuliah lain boleh ada (kunci mencakup mata kuliah)", !(await sisip(U1, "insert into public.progres (user_id, matakuliah_id, bab, status) values ($1, 'pbo-java', 4, 'sedang')", U1)).error);
cek("bab yang sama di mata kuliah yang sama ditolak", ditolak(await sisip(U1, "insert into public.progres (user_id, matakuliah_id, bab) values ($1, 'algoritma-python', 4)", U1), "23505"));
cek("mata kuliah yang tidak terdaftar ditolak", ditolak(await sisip(U1, "insert into public.progres (user_id, matakuliah_id, bab) values ($1, 'tidak-ada', 1)", U1), "23503"));
cek("mata kuliah wajib diisi", ditolak(await sisip(U1, "insert into public.progres (user_id, bab) values ($1, 7)", U1), "23502"));
cek("laporan bab sama di mata kuliah lain boleh", !(await sisip(U1, "insert into public.laporan (user_id, matakuliah_id, bab) values ($1, 'pbo-java', 4)", U1)).error);
cek("laporan kembar di mata kuliah yang sama ditolak", ditolak(await sisip(U1, "insert into public.laporan (user_id, matakuliah_id, bab) values ($1, 'pbo-java', 4)", U1), "23505"));

cek("peserta membaca daftar mata kuliah", (await sisip(U1, "select * from public.matakuliah")).rows.length === 2);
cek("peserta tidak bisa menambah mata kuliah", ditolak(await sisip(U1, "insert into public.matakuliah (id, nama) values ('curang', 'Curang')"), RLS));
cek("peserta tidak bisa mengaktifkan mata kuliah", (await sisip(U1, "update public.matakuliah set aktif = true where id = 'pbo-java'")).n === 0);
cek("instruktur menambah mata kuliah", !(await sisip(IN, "insert into public.matakuliah (id, nama, jenis, bahasa, aktif) values ('jaringan-komputer', 'Jaringan Komputer', 'teks', null, true)")).error);
cek("format id mata kuliah dijaga", ditolak(await sisip(IN, "insert into public.matakuliah (id, nama) values ('Bad ID', 'Salah')"), "23514"));
cek("instruktur mengaktifkan pbo-java", (await sisip(IN, "update public.matakuliah set aktif = true where id = 'pbo-java'")).n === 1);
cek("pengunjung (anon) ditolak membaca matakuliah", ditolak(await sebagai("anon", null, () => q("select * from public.matakuliah")), RLS));
cek("pengunjung (anon) ditolak membaca rekap_progres", ditolak(await sebagai("anon", null, () => q("select * from public.rekap_progres")), RLS));

await sisip(U2, "insert into public.progres (user_id, matakuliah_id, bab, status) values ($1, 'algoritma-python', 1, 'selesai')", U2);
const rekapU1 = await sisip(U1, "select * from public.rekap_progres");
cek("rekap memuat nama mata kuliah", rekapU1.rows.length >= 1 && rekapU1.rows.every((r) => typeof r.matakuliah === "string" && r.matakuliah.length > 0));
cek("rekap: peserta hanya melihat dirinya", rekapU1.rows.every((r) => r.user_id === U1));
cek("rekap: instruktur melihat dua peserta", (await sisip(IN, "select distinct user_id from public.rekap_progres")).rows.length === 2);
cek("peserta 2 tidak melihat progres pbo-java peserta 1", (await sisip(U2, "select * from public.progres where matakuliah_id = 'pbo-java'")).rows.length === 0);

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
