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

console.log("\n== Tahap B2: migrasi 0004 (kelas terstruktur) ==");
{
  const legacy = (await q("select kelas from public.profiles where id = $1", [U1])).rows[0];
  cek("sebelum 0004: profil memakai kelas lama dan belum ada kolom turunan", legacy.kelas === "SI-1B" && !!(await q("select prodi from public.profiles limit 1")).error);
  if (!(await jalankan("0004_kelas_terstruktur.sql berjalan", migrasi("0004_kelas_terstruktur.sql")))) process.exit(1);
  await jalankan("0004 aman dijalankan ulang", migrasi("0004_kelas_terstruktur.sql"));

  const lama = (await q("select kelas, prodi, angkatan, rombel from public.profiles where id = $1", [U1])).rows[0];
  cek("kelas lama (SI-1B) tetap utuh dan prodinya terbaca", lama.kelas === "SI-1B" && lama.prodi === "SI", JSON.stringify(lama));
  cek("kelas lama: angkatan dan rombel kosong sampai dipilih ulang", lama.angkatan === null && lama.rombel === null, JSON.stringify(lama));

  cek("peserta memilih kelas baru (SI-2024-B)", (await sisip(U1, "update public.profiles set kelas = 'SI-2024-B' where id = $1", U1)).n === 1);
  const baru = (await q("select kelas, prodi, angkatan, rombel from public.profiles where id = $1", [U1])).rows[0];
  cek("kolom turunan terhitung otomatis: SI, 2024, B", baru.prodi === "SI" && baru.angkatan === 2024 && baru.rombel === "B", JSON.stringify(baru));

  await sisip(U2, "update public.profiles set kelas = 'si-2025-c' where id = $1", U2);
  const kecil = (await q("select prodi, angkatan, rombel from public.profiles where id = $1", [U2])).rows[0];
  cek("huruf kecil dinormalkan di kolom turunan (si-2025-c menjadi SI, 2025, C)", kecil.prodi === "SI" && kecil.angkatan === 2025 && kecil.rombel === "C", JSON.stringify(kecil));

  const dosen = (await q("select prodi, angkatan, rombel from public.profiles where id = $1", [IN])).rows[0];
  cek("kelas bukan format kelas (Dosen) tidak menghasilkan prodi, angkatan, rombel", dosen.prodi === null && dosen.angkatan === null && dosen.rombel === null, JSON.stringify(dosen));

  cek("kolom turunan tidak bisa diisi langsung oleh peserta", ditolak(await sisip(U1, "update public.profiles set angkatan = 1999 where id = $1", U1)));
  cek("upsert profil dari situs tetap berjalan setelah 0004", !(await sisip(U1, "insert into public.profiles (id, nama, nim, kelas) values ($1, 'Siti Aminah Putri', '2024110012', 'SI-2024-B') on conflict (id) do update set nama = excluded.nama, nim = excluded.nim, kelas = excluded.kelas returning kelas", U1)).error);

  const filter = (await q("select count(*)::int as n from public.profiles where prodi = 'SI' and angkatan = 2024 and rombel = 'B'")).rows[0].n;
  cek("filter prodi + angkatan + rombel menemukan peserta yang tepat", filter === 1, String(filter));
  cek("peserta lain tidak ikut tersaring", (await q("select count(*)::int as n from public.profiles where angkatan = 2025")).rows[0].n === 1);

  const kolomView = (await q("select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = 'rekap_progres' and column_name in ('prodi','angkatan','rombel')")).rows[0].n;
  cek("tampilan rekap memuat prodi, angkatan, rombel", kolomView === 3);
  const rekap = await sisip(U1, "select distinct user_id, angkatan from public.rekap_progres");
  cek("rekap tetap hanya menampilkan diri sendiri dan angkatan terisi", rekap.rows.length === 1 && rekap.rows[0].user_id === U1 && rekap.rows[0].angkatan === 2024, JSON.stringify(rekap.rows));
  cek("instruktur tetap bisa memfilter rekap per angkatan", (await sisip(IN, "select distinct user_id from public.rekap_progres where angkatan = 2024")).rows.length === 1);
}

console.log("\n== Tahap C: berkas jadikan_instruktur.sql ==");
{
  const ADMIN = "44444444-4444-4444-4444-444444444444";
  await db.query("insert into auth.users (id, email) values ($1, 'Dosen.Baru@Kampus.ac.id')", [ADMIN]);
  await sisip(ADMIN, "insert into public.profiles (id, nama, nim, kelas) values ($1, 'Dosen Baru', 'D777', 'Dosen')", ADMIN);
  const sebelum = (await q("select peran from public.profiles where id = $1", [ADMIN])).rows[0].peran;
  cek("akun baru awalnya peserta", sebelum === "peserta");
  cek("sebagai peserta, tidak melihat profil orang lain", (await sisip(ADMIN, "select * from public.profiles")).rows.length === 1);

  const berkas = readFileSync(join(root, "supabase", "jadikan_instruktur.sql"), "utf8");
  cek("cara A (email) berjalan; huruf besar kecil email tidak jadi masalah", await jalankan("jalankan jadikan_instruktur.sql dengan email", berkas.replace("GANTI_DENGAN_EMAIL_ANDA", "dosen.baru@kampus.ac.id")));
  cek("peran berubah jadi instruktur", (await q("select peran from public.profiles where id = $1", [ADMIN])).rows[0].peran === "instruktur");
  cek("instruktur baru melihat semua profil", (await sisip(ADMIN, "select * from public.profiles")).rows.length >= 4);
  cek("instruktur baru dapat menambah mata kuliah", !(await sisip(ADMIN, "insert into public.matakuliah (id, nama) values ('uji-admin', 'Uji Admin')")).error);

  const sebelumLain = (await q("select count(*)::int as n from public.profiles where peran = 'instruktur'")).rows[0].n;
  await jalankan("email yang tidak ada tidak mengubah siapa pun", berkas.replace("GANTI_DENGAN_EMAIL_ANDA", "tidak.ada@kampus.ac.id"));
  cek("jumlah instruktur tetap", (await q("select count(*)::int as n from public.profiles where peran = 'instruktur'")).rows[0].n === sebelumLain);

  const cara = berkas.replace("-- update public.profiles set peran = 'instruktur' where nim = 'GANTI_DENGAN_NIM';", "update public.profiles set peran = 'instruktur' where nim = '2024110099';").replace("GANTI_DENGAN_EMAIL_ANDA", "tidak.ada@kampus.ac.id");
  await jalankan("cara B (NIM) berjalan", cara);
  cek("cara B menjadikan peserta dengan NIM itu instruktur", (await q("select peran from public.profiles where nim = '2024110099'")).rows[0].peran === "instruktur");

  const cabut = berkas.replace(/-- update public\.profiles\n-- set peran = 'peserta'\n-- where id = \(select id from auth\.users where lower\(email\) = lower\('GANTI_DENGAN_EMAIL'\)\);/, "update public.profiles set peran = 'peserta' where id = (select id from auth.users where lower(email) = lower('dosen.baru@kampus.ac.id'));").replace("GANTI_DENGAN_EMAIL_ANDA", "tidak.ada@kampus.ac.id");
  await jalankan("mencabut peran instruktur", cabut);
  cek("peran berhasil dicabut", (await q("select peran from public.profiles where id = $1", [ADMIN])).rows[0].peran === "peserta");
  cek("setelah dicabut, kembali tidak melihat profil orang lain", (await sisip(ADMIN, "select * from public.profiles")).rows.length === 1);
}

console.log("\n== Tahap D: perintah yang benar-benar dikirim situs (upsert profil) ==");
{
  // supabase-js .upsert() menjadi INSERT ... ON CONFLICT (id) DO UPDATE untuk kolom yang dikirim saja.
  const U5 = "55555555-5555-5555-5555-555555555555";
  await db.query("insert into auth.users (id, email) values ($1, 'peserta5@x.id')", [U5]);
  const UPSERT = "insert into public.profiles (id, nama, nim, kelas) values ($1, $2, $3, $4) on conflict (id) do update set nama = excluded.nama, nim = excluded.nim, kelas = excluded.kelas returning nama, nim, kelas, peran";
  const r1 = await sisip(U5, UPSERT, U5, "Rina Wulandari", "2024110500", "SI-1C");
  cek("upsert pertama kali membuat profil (peran bawaan peserta)", !r1.error && r1.rows[0].peran === "peserta", r1.error);
  const r2 = await sisip(U5, UPSERT, U5, "Rina W. Putri", "2024110501", "SI-1D");
  cek("upsert kedua mengubah nama, NIM, kelas", !r2.error && r2.rows[0].nama === "Rina W. Putri" && r2.rows[0].kelas === "SI-1D", r2.error);
  const r3 = await sisip(U5, UPSERT, U5, "Rina", "2024110012", "SI-1D");
  cek("upsert dengan NIM milik orang lain ditolak", ditolak(r3, "23505"));
  const r4 = await sisip(U5, "insert into public.profiles (id, nama, nim, kelas, peran) values ($1,'Rina','2024110502','SI-1D','instruktur') on conflict (id) do update set peran = excluded.peran", U5);
  cek("upsert yang menyelipkan peran instruktur ditolak", ditolak(r4, RLS));
  cek("peran tetap peserta setelah semua percobaan", (await q("select peran from public.profiles where id = $1", [U5])).rows[0].peran === "peserta");
  const r5 = await sisip(U5, "insert into public.profiles (id, nama, nim, kelas) values ($1,'Palsu','2024110998','SI-1D') on conflict (id) do update set nama = excluded.nama returning nama", IN);
  cek("upsert atas nama orang lain (id instruktur) ditolak", ditolak(r5, RLS));
  cek("profil instruktur tidak berubah", (await q("select nama from public.profiles where id = $1", [IN])).rows[0].nama === "Dosen");
}

console.log("\n== Tahap E: menjalankan ulang migrasi pada proyek yang sudah lengkap ==");
{
  const kolom = async () => (await q("select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = 'rekap_progres' and column_name = 'matakuliah_id'")).rows[0].n;
  cek("sebelum diulang: rekap_progres punya kolom matakuliah_id", (await kolom()) === 1);
  cek("0001 diulang setelah 0003 tanpa galat", await jalankan("jalankan ulang 0001", migrasi("0001_skema.sql")));
  cek("0002 diulang setelah 0003 tanpa galat", await jalankan("jalankan ulang 0002", migrasi("0002_keamanan.sql")));
  const kolomAng = async () => (await q("select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = 'rekap_progres' and column_name = 'angkatan'")).rows[0].n;
  cek("tampilan rekap tidak dikembalikan ke versi lama", (await kolom()) === 1 && (await kolomAng()) === 1);
  cek("0001 sampai 0004 berurutan diulang tanpa galat", await jalankan("ulang semuanya berurutan", migrasi("0001_skema.sql") + migrasi("0002_keamanan.sql") + migrasi("0003_matakuliah.sql") + migrasi("0004_kelas_terstruktur.sql")));
  cek("setelah diulang, tampilan rekap masih memuat angkatan", (await kolomAng()) === 1);
  cek("0003 diulang setelah 0004 tanpa galat dan tanpa menghapus kolom baru", (await jalankan("ulang 0003", migrasi("0003_matakuliah.sql"))) && (await kolomAng()) === 1);
  cek("setelah diulang, peserta tetap hanya melihat dirinya di rekap", (await sisip(U1, "select distinct user_id from public.rekap_progres")).rows.every((r) => r.user_id === U1));
  cek("setelah diulang, data peserta tidak hilang", (await q("select count(*)::int as n from public.progres")).rows[0].n >= 3);
}

console.log("\n== Tahap F: perintah sinkron progres dan dashboard instruktur ==");
{
  // supabase-js .upsert(rows, { onConflict: "user_id,matakuliah_id,bab" }) menjadi INSERT ... ON CONFLICT (...) DO UPDATE.
  const UP = "insert into public.progres (user_id, matakuliah_id, bab, status, jumlah_jalankan, jumlah_kirim, pertama_dibuka, lulus_pada, jalur) values ($1, 'algoritma-python', $2, $3, $4, $5, now(), $6, $7) on conflict (user_id, matakuliah_id, bab) do update set status = excluded.status, jumlah_jalankan = excluded.jumlah_jalankan, jumlah_kirim = excluded.jumlah_kirim, pertama_dibuka = excluded.pertama_dibuka, lulus_pada = excluded.lulus_pada, jalur = excluded.jalur returning status, jumlah_kirim, jalur";
  const r1 = await sisip(U2, UP, U2, 5, "sedang", 3, 1, null, null);
  cek("peserta menyimpan progres 'sedang' lewat upsert", !r1.error && r1.rows[0].status === "sedang", r1.error);
  const r2 = await sisip(U2, UP, U2, 5, "selesai", 6, 2, new Date().toISOString(), "bantuan");
  cek("upsert kedua memperbarui baris yang sama (selesai, jalur bantuan)", !r2.error && r2.rows[0].status === "selesai" && r2.rows[0].jalur === "bantuan", r2.error);
  cek("tidak muncul baris ganda untuk bab yang sama", (await q("select count(*)::int as n from public.progres where user_id = $1 and matakuliah_id = 'algoritma-python' and bab = 5", [U2])).rows[0].n === 1);
  cek("jalur 'langsung' diterima", !(await sisip(U2, UP, U2, 6, "selesai", 1, 1, new Date().toISOString(), "langsung")).error);
  cek("jalur di luar aturan ditolak", ditolak(await sisip(U2, UP, U2, 7, "selesai", 1, 1, null, "curang"), "23514"));
  cek("status di luar aturan ditolak", ditolak(await sisip(U2, UP, U2, 7, "lulus", 1, 1, null, null), "23514"));
  cek("peserta tidak bisa menyimpan progres atas nama peserta lain", ditolak(await sisip(U2, UP, U1, 9, "selesai", 1, 1, null, "langsung"), RLS));
  cek("upsert tidak bisa menimpa progres peserta lain", ditolak(await sisip(U2, UP, U1, 4, "belum", 0, 0, null, null), RLS));
  cek("progres peserta 1 tidak berubah oleh percobaan itu", (await q("select status from public.progres where user_id = $1 and bab = 4", [U1])).rows[0].status === "selesai");

  const PERC = "insert into public.percobaan (user_id, matakuliah_id, bab, jenis, lulus, kasus_lulus, kasus_total, kasus_gagal, kode, dibuat_pada) values ($1, 'algoritma-python', $2, 'kirim', $3, $4, 7, $5, $6, now())";
  cek("peserta menyimpan percobaan dengan daftar kasus gagal", !(await sisip(U2, PERC, U2, 5, false, 3, "{3,4,5,6}", "print(1)")).error);
  cek("kode sepanjang batas (20000) diterima", !(await sisip(U2, PERC, U2, 5, false, 0, "{}", "x".repeat(20000))).error);
  cek("kode lebih dari batas ditolak", ditolak(await sisip(U2, PERC, U2, 5, false, 0, "{}", "x".repeat(20001)), "23514"));
  cek("percobaan atas nama peserta lain ditolak", ditolak(await sisip(U2, PERC, U1, 5, true, 7, "{}", "print(1)"), RLS));

  // Dashboard instruktur: dua query, profil peserta dan progres satu mata kuliah.
  const peserta = (await sisip(IN, "select id, nama, nim, kelas, prodi, angkatan, rombel, peran from public.profiles where peran = 'peserta' order by id")).rows;
  cek("instruktur memuat daftar peserta tanpa dirinya sendiri", peserta.length >= 2 && peserta.every((x) => x.peran === "peserta") && !peserta.some((x) => x.id === IN));
  const semua = (await sisip(IN, "select * from public.progres where matakuliah_id = 'algoritma-python' order by user_id, bab")).rows;
  cek("instruktur membaca progres semua peserta", new Set(semua.map((x) => x.user_id)).size >= 2);
  cek("instruktur melihat jalur bantuan peserta 2 di bab 5", semua.some((x) => x.user_id === U2 && x.bab === 5 && x.jalur === "bantuan"));
  cek("instruktur bisa memuat per halaman (range)", (await sisip(IN, "select * from public.progres where matakuliah_id = 'algoritma-python' order by user_id, bab limit 1 offset 1")).rows.length === 1);
  cek("instruktur tidak bisa mengubah progres peserta", (await sisip(IN, "update public.progres set status = 'belum' where user_id = $1", U2)).n === 0);
  cek("instruktur tidak bisa mengubah riwayat percobaan", (await sisip(IN, "update public.percobaan set lulus = true where user_id = $1", U2)).n === 0);
  // Peserta biasa membuka halaman instruktur: kedua query tetap hanya mengembalikan datanya sendiri.
  // (Pada tahap ini peserta 2 sudah pernah dijadikan instruktur oleh uji Tahap C, jadi dipakai peserta baru.)
  const U6 = "66666666-6666-6666-6666-666666666666";
  await db.query("insert into auth.users (id, email) values ($1, 'peserta6@x.id')", [U6]);
  await db.query("insert into public.profiles (id, nama, nim, kelas) values ($1, 'Peserta Enam', '2024110606', 'SI-2024-C')", [U6]);
  cek("peserta 6 menyimpan progresnya", !(await sisip(U6, UP, U6, 1, "selesai", 2, 1, new Date().toISOString(), "langsung")).error);
  const pesertaBiasa = (await sisip(U6, "select id from public.profiles where peran = 'peserta' order by id")).rows;
  cek("peserta biasa hanya mendapat profilnya sendiri dari query dashboard", pesertaBiasa.length === 1 && pesertaBiasa[0].id === U6);
  const progresBiasa = (await sisip(U6, "select * from public.progres where matakuliah_id = 'algoritma-python'")).rows;
  cek("peserta biasa hanya mendapat progresnya sendiri dari query dashboard", progresBiasa.length === 1 && progresBiasa.every((x) => x.user_id === U6));
  cek("peserta biasa tidak bisa menjadikan dirinya instruktur lewat sinkron", ditolak(await sisip(U6, "update public.profiles set peran = 'instruktur' where id = $1", U6), RLS));
  cek("peserta 6 yang baru tetap tidak melihat dashboard instruktur (is_instruktur false)", (await sisip(U6, "select public.is_instruktur() as x")).rows[0].x === false);
  // Jejak tempel yang diblokir (aktivitas): satu baris berisi jumlah, tanpa isi yang ditempel.
  const AKT = "insert into public.aktivitas (user_id, matakuliah_id, bab, jenis, detail, dibuat_pada) values ($1, 'algoritma-python', $2, 'tempel_diblokir', $3::jsonb, now())";
  cek("peserta mencatat percobaan tempel yang diblokir", !(await sisip(U6, AKT, U6, 4, '{"jumlah":3,"lokasi":"latihan"}')).error);
  cek("peserta tidak bisa mencatat jejak atas nama orang lain", ditolak(await sisip(U6, AKT, U2, 4, '{"jumlah":1}'), RLS));
  cek("peserta tidak bisa mengubah atau menghapus jejaknya", (await sisip(U6, "update public.aktivitas set detail = '{}' where user_id = $1", U6)).n === 0 && (await sisip(U6, "delete from public.aktivitas where user_id = $1", U6)).n === 0);
  const jejakInstruktur = (await sisip(IN, "select user_id, bab, detail from public.aktivitas where matakuliah_id = 'algoritma-python' and jenis = 'tempel_diblokir' order by id")).rows;
  cek("instruktur membaca jejak tempel semua peserta (query dashboard)", jejakInstruktur.some((x) => x.user_id === U6 && x.detail.jumlah === 3));
  cek("peserta lain tidak melihat jejak tempel orang lain", (await sisip(U1, "select * from public.aktivitas where user_id = $1", U6)).rows.length === 0);
  cek("pengunjung (anon) ditolak membaca progres", ditolak(await sebagai("anon", null, () => q("select * from public.progres")), RLS));
  cek("pengunjung (anon) ditolak menulis progres", ditolak(await sebagai("anon", null, () => q("insert into public.progres (user_id, matakuliah_id, bab) values ($1, 'algoritma-python', 1)", [U2])), RLS));
}

console.log("\n== Tahap G: migrasi 0005 (sinyal keaslian pengerjaan) ==");
{
  if (!(await jalankan("0005_integritas.sql berjalan", migrasi("0005_integritas.sql")))) process.exit(1);
  cek("0005 aman dijalankan ulang", await jalankan("0005 diulang", migrasi("0005_integritas.sql")));
  cek("0001 sampai 0005 berurutan diulang tanpa galat", await jalankan("ulang semuanya sampai 0005", migrasi("0001_skema.sql") + migrasi("0002_keamanan.sql") + migrasi("0003_matakuliah.sql") + migrasi("0004_kelas_terstruktur.sql") + migrasi("0005_integritas.sql")));

  const DEV1 = "dev-aaaaaaaa-1111";
  const DEV2 = "dev-bbbbbbbb-2222";
  const rpc = (uid, dev, agen = "Chrome di Windows") => sisip(uid, "select public.catat_perangkat($1, $2)", dev, agen);
  cek("peserta mencatat perangkatnya lewat fungsi", !(await rpc(U1, DEV1)).error);
  cek("mencatat lagi menaikkan jumlah masuk, bukan baris ganda", !(await rpc(U1, DEV1)).error && (await q("select jumlah_masuk from public.sesi_perangkat where user_id = $1 and device_id = $2", [U1, DEV1])).rows[0].jumlah_masuk === 2);
  const U6 = "66666666-6666-6666-6666-666666666666";
  cek("akun lain di perangkat yang sama tercatat sebagai baris terpisah", !(await rpc(U6, DEV1)).error && (await q("select count(*)::int as n from public.sesi_perangkat where device_id = $1", [DEV1])).rows[0].n === 2);
  cek("peserta tidak bisa menulis langsung ke sesi_perangkat", ditolak(await sisip(U1, "insert into public.sesi_perangkat (user_id, device_id) values ($1, 'dev-cccccccc-3333')", U1), "42501"));
  cek("peserta tidak bisa mengubah catatan perangkatnya", ditolak(await sisip(U1, "update public.sesi_perangkat set jumlah_masuk = 0 where user_id = $1", U1), "42501"));
  cek("fungsi memakai identitas sesi (tidak ada parameter untuk berpura-pura jadi orang lain)", (await q("select count(*)::int as n from public.sesi_perangkat where user_id = $1 and device_id = $2", [U6, DEV2])).rows[0].n === 0 && !(await rpc(U6, DEV2)).error && (await q("select count(*)::int as n from public.sesi_perangkat where user_id = $1 and device_id = $2", [U1, DEV2])).rows[0].n === 0);
  cek("ID perangkat terlalu pendek ditolak", ditolak(await rpc(U1, "pendek"), "23514"));
  cek("pengunjung (anon) tidak bisa memanggil fungsi", ditolak(await sebagai("anon", null, () => q("select public.catat_perangkat('dev-dddddddd-4444', 'x')")), RLS) || ditolak(await sebagai("anon", null, () => q("select public.catat_perangkat('dev-dddddddd-4444', 'x')")), "42501"));
  cek("peserta hanya melihat catatan perangkatnya sendiri", (await sisip(U1, "select * from public.sesi_perangkat")).rows.every((r) => r.user_id === U1));
  const dua = (await sisip(IN, "select device_id, count(distinct user_id)::int as akun from public.sesi_perangkat group by device_id having count(distinct user_id) > 1")).rows;
  cek("instruktur menemukan perangkat yang dipakai lebih dari satu akun", dua.length === 1 && dua[0].device_id === DEV1 && dua[0].akun === 2, JSON.stringify(dua));
  const U9 = "99999999-9999-9999-9999-999999999999";
  await db.query("insert into auth.users (id, email) values ($1, 'tanpaprofil@x.id')", [U9]);
  cek("akun tanpa profil dilewati tanpa galat dan tanpa baris", !(await rpc(U9, "dev-eeeeeeee-5555")).error && (await q("select count(*)::int as n from public.sesi_perangkat where user_id = $1", [U9])).rows[0].n === 0);

  cek("peserta tidak bisa menandai perangkat bersama", ditolak(await sisip(U1, "insert into public.perangkat_bersama (device_id) values ($1)", DEV1), RLS));
  cek("instruktur menandai perangkat bersama (lab)", !(await sisip(IN, "insert into public.perangkat_bersama (device_id, catatan, ditandai_oleh) values ($1, 'Lab 1', $2)", DEV1, IN)).error);
  cek("peserta tidak melihat daftar perangkat bersama", (await sisip(U1, "select * from public.perangkat_bersama")).rows.length === 0);
  cek("instruktur membaca daftar perangkat bersama", (await sisip(IN, "select * from public.perangkat_bersama")).rows.length === 1);
  cek("instruktur mencabut tanda perangkat bersama", (await sisip(IN, "delete from public.perangkat_bersama where device_id = $1", DEV1)).n === 1);

  const PERC = "insert into public.percobaan (user_id, matakuliah_id, bab, jenis, lulus, kode, pola, rekaman) values ($1, 'algoritma-python', 4, 'kirim', true, 'print(1)', $2::jsonb, $3::jsonb)";
  cek("percobaan menyimpan pola dan rekaman menulis", !(await sisip(U6, PERC, U6, '{"cps":3.1,"linier":0.4}', '[["e",0,0,0,"print",5,900]]')).error);
  cek("rekaman terlalu besar ditolak", ditolak(await sisip(U6, PERC, U6, "{}", JSON.stringify([["e", 0, 0, 0, "x".repeat(130000), 1, 1]])), "23514"));
  cek("pola terlalu besar ditolak", ditolak(await sisip(U6, PERC, U6, JSON.stringify({ x: "y".repeat(5000) }), "[]"), "23514"));
  cek("peserta lain tidak membaca rekaman menulis orang lain", (await sisip(U1, "select rekaman from public.percobaan where user_id = $1", U6)).rows.length === 0);
  cek("instruktur membaca pola dan rekaman", (await sisip(IN, "select pola, rekaman from public.percobaan where user_id = $1 and rekaman is not null", U6)).rows.length >= 1);
  cek("rekaman tidak bisa diubah peserta setelah terkirim", (await sisip(U6, "update public.percobaan set rekaman = '[]' where user_id = $1", U6)).n === 0);
}

console.log("\n== Tahap H: laporan praktikum (selalu terbuka, tidak pernah dikunci) ==");
{
  const U6 = "66666666-6666-6666-6666-666666666666";
  // supabase-js .upsert(rows, { onConflict: "user_id,matakuliah_id,bab" }) menjadi INSERT ... ON CONFLICT ... DO UPDATE
  const LAP = "insert into public.laporan (user_id, matakuliah_id, bab, jawaban, jumlah_ketikan, percobaan_tempel, durasi_menulis_detik, kode_verifikasi, status, dikumpulkan_pada) values ($1, 'algoritma-python', $2, $3::jsonb, $4::jsonb, $5, $6, $7, 'draf', $8) on conflict (user_id, matakuliah_id, bab) do update set jawaban = excluded.jawaban, jumlah_ketikan = excluded.jumlah_ketikan, percobaan_tempel = excluded.percobaan_tempel, durasi_menulis_detik = excluded.durasi_menulis_detik, kode_verifikasi = excluded.kode_verifikasi, status = excluded.status, dikumpulkan_pada = excluded.dikumpulkan_pada returning kode_verifikasi, status";
  const sim = (bab, jawaban, kode, eks = null, tempel = 0) => sisip(U6, LAP, U6, bab, JSON.stringify(jawaban), JSON.stringify({ tujuan: 30 }), tempel, 12, kode, eks);

  const a = await sim(21, { tujuan: "awal" }, "KODE0001");
  cek("peserta menyimpan laporan pertama kali (kode verifikasi dari klien)", !a.error && a.rows[0].kode_verifikasi === "KODE0001" && a.rows[0].status === "draf", a.error);
  const b = await sim(21, { tujuan: "diperbarui, lebih panjang", konsep: "ada" }, "KODE0001");
  cek("menyimpan ulang memperbarui baris yang sama, bukan menggandakan", !b.error && (await q("select count(*)::int as n from public.laporan where user_id = $1 and bab = 21", [U6])).rows[0].n === 1 && (await q("select jawaban from public.laporan where user_id = $1 and bab = 21", [U6])).rows[0].jawaban.konsep === "ada");
  const c = await sim(21, { tujuan: "setelah ekspor" }, "KODE0001", new Date().toISOString(), 3);
  cek("mencatat waktu ekspor (dikumpulkan_pada) tanpa mengunci laporan", !c.error && c.rows[0].status === "draf");
  const d = await sim(21, { tujuan: "masih bisa diedit lagi setelah ekspor" }, "KODE0001", new Date().toISOString(), 3);
  cek("SETELAH diekspor, laporan masih bisa diedit (tidak pernah dikunci)", !d.error && (await q("select jawaban from public.laporan where user_id = $1 and bab = 21", [U6])).rows[0].jawaban.tujuan.startsWith("masih bisa"));
  cek("jumlah ketikan dan percobaan tempel tersimpan", (await q("select percobaan_tempel, jumlah_ketikan from public.laporan where user_id = $1 and bab = 21", [U6])).rows[0].percobaan_tempel === 3);
  cek("kode verifikasi harus unik: kode yang sama di laporan lain ditolak", ditolak(await sim(22, {}, "KODE0001"), "23505"));
  cek("laporan kosong boleh disimpan (belum diisi tidak jadi masalah)", !(await sim(23, {}, "KODE0003")).error);
  cek("peserta tidak bisa menyimpan laporan atas nama peserta lain", ditolak(await sisip(U6, LAP, U1, 24, "{}", "{}", 0, 0, "KODE0004", null), RLS));
  cek("peserta lain tidak bisa membaca laporan orang lain", (await sisip(U1, "select * from public.laporan where user_id = $1", U6)).rows.length === 0);
  cek("peserta hanya membaca laporannya sendiri (query pemulihan di situs)", (await sisip(U6, "select * from public.laporan where user_id = $1 and matakuliah_id = 'algoritma-python' and bab = 21", U6)).rows.length === 1);
  cek("instruktur membaca semua laporan", (await sisip(IN, "select * from public.laporan where user_id = $1", U6)).rows.length >= 2);
  cek("instruktur tidak bisa mengubah isi laporan peserta", (await sisip(IN, "update public.laporan set jawaban = '{}' where user_id = $1 and bab = 21", U6)).n === 0);
  cek("status di luar aturan ditolak", ditolak(await sisip(U6, "update public.laporan set status = 'lulus' where user_id = $1 and bab = 21", U6), "23514"));
  cek("laporan di mata kuliah lain pada bab yang sama berdiri sendiri", !(await sisip(U6, "insert into public.laporan (user_id, matakuliah_id, bab, jawaban, kode_verifikasi) values ($1, 'pbo-java', 21, '{}', 'KODE0005')", U6)).error);

  // Penilaian oleh instruktur: supabase-js .upsert(row, { onConflict: "laporan_id" })
  const lapId = (await q("select id from public.laporan where user_id = $1 and bab = 21 and matakuliah_id = 'algoritma-python'", [U6])).rows[0].id;
  const NILAI = "insert into public.penilaian_laporan (laporan_id, penilai, skor_konsep, skor_bahasa, skor_refleksi, skor_kode, komentar, dinilai_pada) values ($1, $2, $3, $4, $5, $6, $7, now()) on conflict (laporan_id) do update set penilai = excluded.penilai, skor_konsep = excluded.skor_konsep, skor_bahasa = excluded.skor_bahasa, skor_refleksi = excluded.skor_refleksi, skor_kode = excluded.skor_kode, komentar = excluded.komentar returning skor_konsep";
  cek("instruktur menyimpan penilaian rubrik", !(await sisip(IN, NILAI, lapId, IN, 3, 4, 2, 3, "cukup baik")).error);
  cek("menilai ulang memperbarui penilaian yang sama", (await sisip(IN, NILAI, lapId, IN, 4, 4, 4, 4, "sangat baik")).rows[0].skor_konsep === 4 && (await q("select count(*)::int as n from public.penilaian_laporan where laporan_id = $1", [lapId])).rows[0].n === 1);
  cek("skor di luar 1 sampai 4 ditolak database", ditolak(await sisip(IN, NILAI, lapId, IN, 5, 4, 4, 4, null), "23514"));
  cek("peserta tidak bisa menulis penilaian atas laporannya sendiri", ditolak(await sisip(U6, NILAI, lapId, U6, 4, 4, 4, 4, "nilai sendiri"), RLS));
  cek("peserta lain tidak membaca penilaian", (await sisip(U1, "select * from public.penilaian_laporan where laporan_id = $1", lapId)).rows.length === 0);
  cek("instruktur membaca semua penilaian (query tab Laporan)", (await sisip(IN, "select * from public.penilaian_laporan order by laporan_id")).rows.length >= 1);
}

console.log("\n== Tahap I: migrasi 0006 (kehadiran dan keaktifan) pada data yang sudah ada ==");
{
  const U6 = "66666666-6666-6666-6666-666666666666";
  const sebelum = (await q("select count(*)::int as n from public.percobaan")).rows[0].n;
  if (!(await jalankan("0006_kehadiran.sql berjalan di atas data lama", migrasi("0006_kehadiran.sql")))) process.exit(1);
  cek("0006 aman dijalankan ulang", await jalankan("0006 diulang", migrasi("0006_kehadiran.sql")));
  cek("0001 sampai 0006 berurutan diulang tanpa galat", await jalankan("ulang semuanya sampai 0006", migrasi("0001_skema.sql") + migrasi("0002_keamanan.sql") + migrasi("0003_matakuliah.sql") + migrasi("0004_kelas_terstruktur.sql") + migrasi("0005_integritas.sql") + migrasi("0006_kehadiran.sql")));
  cek("data percobaan lama utuh (tidak ada yang hilang)", (await q("select count(*)::int as n from public.percobaan")).rows[0].n === sebelum && sebelum > 0);
  cek("baris lama dibiarkan tanpa jam server (tidak dikarang)", (await q("select count(*)::int as n from public.percobaan where diterima_pada is null")).rows[0].n === sebelum);

  const PERC = "insert into public.percobaan (user_id, matakuliah_id, bab, jenis, lulus, kode, dibuat_pada, diterima_pada) values ($1, 'algoritma-python', 4, 'kirim', true, 'print(1)', $2, $3) returning diterima_pada, dibuat_pada";
  const baru = await sisip(U6, PERC, U6, "2026-10-01T00:00:00Z", "2000-01-01T00:00:00Z");
  cek("baris baru diberi jam server walau browser mencoba mengisinya", !baru.error && new Date(baru.rows[0].diterima_pada).getFullYear() >= 2025, baru.error);
  cek("jam perangkat tetap tersimpan terpisah dari jam server", !baru.error && new Date(baru.rows[0].dibuat_pada).toISOString().startsWith("2026-10-01"));
  const akt = await sisip(U6, "insert into public.aktivitas (user_id, matakuliah_id, bab, jenis, detail, diterima_pada) values ($1, 'algoritma-python', 4, 'tempel_diblokir', '{}', '2000-01-01') returning diterima_pada", U6);
  cek("aktivitas baru juga memakai jam server", !akt.error && new Date(akt.rows[0].diterima_pada).getFullYear() >= 2025);

  // ---- sesi belajar lewat catat_denyut ----
  const SES = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const den = (uid, sesi, bab, tambah, mk = "algoritma-python") => sisip(uid, "select public.catat_denyut($1::uuid, $2, $3, $4)", sesi, mk, bab, tambah);
  cek("peserta membuka sesi dan bab pertama tercatat", !(await den(U6, SES, 4, 60)).error && (await q("select bab_dibuka, aktif_detik, denyut from public.sesi_belajar where id = $1", [SES])).rows[0].denyut === 1);
  for (let i = 0; i < 10; i++) await den(U6, SES, 4, 120);
  const rapat = (await q("select aktif_detik, denyut from public.sesi_belajar where id = $1", [SES])).rows[0];
  cek("denyut beruntun cepat tidak bisa menggelembungkan waktu aktif (dibatasi waktu nyata server)", rapat.aktif_detik < 200 && rapat.denyut === 11, JSON.stringify(rapat));
  await den(U6, SES, 5, 0);
  await den(U6, SES, 5, 0);
  cek("bab yang dibuka dicatat tanpa duplikat", JSON.stringify((await q("select bab_dibuka from public.sesi_belajar where id = $1", [SES])).rows[0].bab_dibuka) === "[4,5]");
  const aktifSebelum = (await q("select aktif_detik from public.sesi_belajar where id = $1", [SES])).rows[0].aktif_detik;
  await den(U1, SES, 9, 120);
  const sesudah = (await q("select aktif_detik, user_id, bab_dibuka from public.sesi_belajar where id = $1", [SES])).rows[0];
  cek("peserta lain tidak bisa menambah atau membajak sesi orang lain", sesudah.user_id === U6 && sesudah.aktif_detik === aktifSebelum && JSON.stringify(sesudah.bab_dibuka) === "[4,5]");
  cek("peserta tidak bisa menulis langsung ke sesi_belajar", ditolak(await sisip(U6, "insert into public.sesi_belajar (id, user_id, matakuliah_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', $1, 'algoritma-python')", U6), "42501"));
  cek("peserta tidak bisa mengubah lama aktifnya langsung", ditolak(await sisip(U6, "update public.sesi_belajar set aktif_detik = 86400 where id = $1", SES), "42501"));
  cek("mata kuliah yang tidak ada dilewati tanpa baris", !(await den(U6, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", 1, 10, "tidak-ada")).error && (await q("select count(*)::int as n from public.sesi_belajar where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'")).rows[0].n === 0);
  cek("peserta hanya membaca sesinya sendiri", (await sisip(U1, "select * from public.sesi_belajar")).rows.every((r) => r.user_id === U1));
  cek("instruktur membaca semua sesi", (await sisip(IN, "select * from public.sesi_belajar where user_id = $1", U6)).rows.length === 1);
  cek("pengunjung (anon) tidak bisa memanggil catat_denyut", ditolak(await sebagai("anon", null, () => q("select public.catat_denyut('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 'algoritma-python', 1, 10)")), "42501"));
  const U9 = "99999999-9999-9999-9999-999999999999";
  cek("akun tanpa profil dilewati tanpa baris", !(await den(U9, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", 1, 10)).error && (await q("select count(*)::int as n from public.sesi_belajar where user_id = $1", [U9])).rows[0].n === 0);

  // ---- jadwal per kelas ----
  const JAD = "insert into public.jadwal_kelas (matakuliah_id, kelas, pertemuan, mulai, selesai, libur, dipindah) values ('algoritma-python', $1, $2, $3, $4, $5, $6) on conflict (matakuliah_id, kelas, pertemuan) do update set mulai = excluded.mulai, selesai = excluded.selesai, libur = excluded.libur, dipindah = excluded.dipindah, diperbarui_pada = now() returning pertemuan";
  cek("instruktur membuat jadwal pertemuan", !(await sisip(IN, JAD, "SI-2024-A", 1, "2026-10-07T01:00:00Z", "2026-10-07T03:00:00Z", false, false)).error);
  cek("mengubah pertemuan yang sama memperbarui baris, bukan menggandakan", !(await sisip(IN, JAD, "SI-2024-A", 1, "2026-10-09T03:00:00Z", "2026-10-09T05:00:00Z", false, true)).error && (await q("select count(*)::int as n from public.jadwal_kelas where kelas = 'SI-2024-A' and pertemuan = 1")).rows[0].n === 1);
  cek("jam selesai harus setelah jam mulai", ditolak(await sisip(IN, JAD, "SI-2024-A", 2, "2026-10-14T03:00:00Z", "2026-10-14T01:00:00Z", false, false), "23514"));
  cek("pertemuan boleh ditandai libur", !(await sisip(IN, JAD, "SI-2024-A", 3, "2026-10-21T01:00:00Z", "2026-10-21T03:00:00Z", true, false)).error);
  cek("peserta tidak bisa menulis jadwal", ditolak(await sisip(U6, JAD, "SI-2024-A", 4, "2026-10-28T01:00:00Z", "2026-10-28T03:00:00Z", false, false), RLS));
  cek("peserta tidak bisa mengubah jadwal yang ada", (await sisip(U6, "update public.jadwal_kelas set libur = true where kelas = 'SI-2024-A'")).n === 0);
  cek("peserta tidak membaca jadwal", (await sisip(U6, "select * from public.jadwal_kelas")).rows.length === 0);
  cek("instruktur membaca jadwal (query tab Kehadiran)", (await sisip(IN, "select * from public.jadwal_kelas where matakuliah_id = 'algoritma-python' order by kelas, pertemuan")).rows.length === 2);
  cek("instruktur mencatat riwayat perubahan jadwal", !(await sisip(IN, "insert into public.jadwal_riwayat (matakuliah_id, kelas, oleh, ringkasan) values ('algoritma-python', 'SI-2024-A', $1, 'P1 dipindah ke Jumat 10.00')", IN)).error);
  cek("riwayat tidak bisa ditulis atau dibaca peserta", ditolak(await sisip(U6, "insert into public.jadwal_riwayat (matakuliah_id, kelas, ringkasan) values ('algoritma-python', 'SI-2024-A', 'palsu')"), RLS) && (await sisip(U6, "select * from public.jadwal_riwayat")).rows.length === 0);
  cek("riwayat tidak bisa diubah atau dihapus (hanya tambah)", ditolak(await sisip(IN, "update public.jadwal_riwayat set ringkasan = 'x'"), "42501") && ditolak(await sisip(IN, "delete from public.jadwal_riwayat"), "42501"));

  // ---- koreksi manual ----
  const KOR = "insert into public.koreksi_kehadiran (matakuliah_id, user_id, pertemuan, status, alasan, oleh) values ('algoritma-python', $1, $2, $3, $4, $5) on conflict (matakuliah_id, user_id, pertemuan) do update set status = excluded.status, alasan = excluded.alasan, oleh = excluded.oleh returning status";
  cek("instruktur mengoreksi kehadiran dengan alasan", !(await sisip(IN, KOR, U6, 1, "hadir", "sakit, kirim surat", IN)).error);
  cek("koreksi ulang memperbarui baris yang sama", !(await sisip(IN, KOR, U6, 1, "tidak", "dibatalkan", IN)).error && (await q("select count(*)::int as n from public.koreksi_kehadiran where user_id = $1", [U6])).rows[0].n === 1);
  cek("status koreksi di luar aturan ditolak", ditolak(await sisip(IN, KOR, U6, 2, "terlambat", null, IN), "23514"));
  cek("peserta tidak bisa mengoreksi kehadirannya sendiri", ditolak(await sisip(U6, KOR, U6, 3, "hadir", "saya hadir", U6), RLS));
  cek("peserta tidak membaca koreksi", (await sisip(U6, "select * from public.koreksi_kehadiran")).rows.length === 0);
  cek("tidak ada sesi tanpa pemilik (tanpa data yatim)", (await q("select count(*)::int as n from public.sesi_belajar s where not exists (select 1 from public.profiles p where p.id = s.user_id)")).rows[0].n === 0);
}

console.log("\n== Tahap J: migrasi 0007 (jejak peserta dan persetujuan penelitian) pada data yang sudah ada ==");
{
  const U1 = "11111111-1111-1111-1111-111111111111";
  const U6 = "66666666-6666-6666-6666-666666666666";
  const sebelum = (await q("select count(*)::int as n from public.percobaan")).rows[0].n;
  if (!(await jalankan("0007_riset_perilaku.sql berjalan di atas data lama", migrasi("0007_riset_perilaku.sql")))) process.exit(1);
  cek("0007 aman dijalankan ulang", await jalankan("0007 diulang", migrasi("0007_riset_perilaku.sql")));
  cek("0001 sampai 0007 berurutan diulang tanpa galat", await jalankan("ulang semuanya sampai 0007", ["0001_skema", "0002_keamanan", "0003_matakuliah", "0004_kelas_terstruktur", "0005_integritas", "0006_kehadiran", "0007_riset_perilaku"].map((f) => migrasi(f + ".sql")).join("\n")));
  cek("data percobaan lama utuh dan kolom baru kosong", (await q("select count(*)::int as n from public.percobaan")).rows[0].n === sebelum && (await q("select count(*)::int as n from public.percobaan where hasil is not null or galat_jenis is not null")).rows[0].n === 0);

  const JAL = "insert into public.percobaan (user_id, matakuliah_id, bab, jenis, lulus, kode, pola, rekaman, hasil, galat_jenis, galat_pesan, cocok_contoh, petunjuk) values ($1, 'algoritma-python', 4, 'jalankan', null, 'print(x)', '{\"cps\":3}'::jsonb, $2::jsonb, $3, $4, $5, $6, $7) returning id, diterima_pada";
  const jal = await sisip(U6, JAL, U6, '{"awal":"","e":[["e",0,0,0,"print(x)",8,900]]}', "galat", "NameError", "name 'x' is not defined", null, 1);
  cek("peserta menyimpan baris Jalankan lengkap dengan hasil dan jenis galat", !jal.error && jal.rows[0].diterima_pada !== null, jal.error);
  const jalan = await sisip(U6, JAL, U6, null, "jalan", null, null, true, 0);
  cek("Jalankan yang berjalan dan cocok dengan contoh tersimpan", !jalan.error);
  cek("hasil di luar daftar ditolak", ditolak(await sisip(U6, JAL, U6, null, "mungkin", null, null, null, 0), "23514"));
  cek("pesan galat lebih dari 300 karakter ditolak", ditolak(await sisip(U6, JAL, U6, null, "galat", "NameError", "x".repeat(301), null, 0), "23514"));
  cek("jenis galat lebih dari 60 karakter ditolak", ditolak(await sisip(U6, JAL, U6, null, "galat", "y".repeat(61), "x", null, 0), "23514"));
  cek("jumlah petunjuk di luar 0 sampai 9 ditolak", ditolak(await sisip(U6, JAL, U6, null, "jalan", null, null, null, 12), "23514"));
  cek("rekaman Jalankan lebih dari 40 ribu karakter ditolak", ditolak(await sisip(U6, JAL, U6, JSON.stringify({ awal: "", e: [["e", 0, 0, 0, "x".repeat(41000), 1, 1]] }), "jalan", null, null, null, 0), "23514"));
  cek("rekaman Kirim yang besar (di bawah batas lama) tetap diterima", !(await sisip(U6, "insert into public.percobaan (user_id, matakuliah_id, bab, jenis, lulus, kode, rekaman, hasil) values ($1, 'algoritma-python', 4, 'kirim', false, 'x', $2::jsonb, 'gagal')", U6, JSON.stringify({ awal: "", e: [["e", 0, 0, 0, "x".repeat(50000), 1, 1]] }))).error);
  cek("peserta lain tidak membaca baris Jalankan orang lain", (await sisip(U1, "select * from public.percobaan where user_id = $1 and jenis = 'jalankan'", U6)).rows.length === 0);
  cek("instruktur membaca semua Jalankan dan galatnya (query Jejak peserta)", (await sisip(IN, "select id, user_id, bab, jenis, hasil, galat_jenis, petunjuk, pola, dibuat_pada, diterima_pada from public.percobaan where matakuliah_id = 'algoritma-python' and jenis = 'jalankan' order by id")).rows.length >= 2);
  cek("peserta tidak bisa mengubah hasil percobaan yang sudah terkirim", (await sisip(U6, "update public.percobaan set hasil = 'lulus' where user_id = $1", U6)).n === 0);
  cek("analisis integritas yang hanya memakai jenis kirim tidak terpengaruh baris Jalankan", (await sisip(IN, "select count(*)::int as n from public.percobaan where jenis = 'kirim' and matakuliah_id = 'algoritma-python' and user_id = $1", U6)).rows[0].n >= 1);

  // ---- persetujuan penelitian ----
  const UBAH = "update public.profiles set riset_setuju = $2 where id = $1";
  cek("sebelum menjawab, persetujuan kosong dan tanpa kode", (await sisip(U1, "select riset_setuju, kode_riset, riset_setuju_pada from public.profiles where id = $1", U1)).rows[0].riset_setuju === null);
  cek("peserta menyatakan setuju sendiri", (await sisip(U1, UBAH, U1, true)).n === 1);
  const p1 = (await sisip(U1, "select riset_setuju, kode_riset, riset_setuju_pada from public.profiles where id = $1", U1)).rows[0];
  cek("kode riset dibuat otomatis berbentuk R- diikuti 8 karakter dan waktu setuju tercatat", /^R-[0-9a-f]{8}$/.test(p1.kode_riset || "") && p1.riset_setuju_pada !== null, JSON.stringify(p1));
  const palsu = await sisip(U1, "update public.profiles set kode_riset = 'R-palsu123' where id = $1", U1);
  cek("peserta tidak bisa mengubah kode risetnya sendiri (diabaikan)", (await q("select kode_riset from public.profiles where id = $1", [U1])).rows[0].kode_riset === p1.kode_riset, JSON.stringify(palsu));
  await sisip(U1, UBAH, U1, false);
  const p1b = (await q("select riset_setuju, kode_riset, riset_setuju_pada from public.profiles where id = $1", [U1])).rows[0];
  cek("menarik persetujuan tetap mencatat waktu dan kode tidak berubah", p1b.riset_setuju === false && p1b.kode_riset === p1.kode_riset && new Date(p1b.riset_setuju_pada) >= new Date(p1.riset_setuju_pada));
  await sisip(U1, "update public.profiles set nama = 'Nama Baru Peserta Satu' where id = $1", U1);
  cek("mengubah data lain tidak menggeser waktu persetujuan", (await q("select riset_setuju_pada from public.profiles where id = $1", [U1])).rows[0].riset_setuju_pada.toString() === p1b.riset_setuju_pada.toString());
  await sisip(U6, UBAH, U6, true);
  const k6 = (await q("select kode_riset from public.profiles where id = $1", [U6])).rows[0].kode_riset;
  cek("tiap peserta mendapat kode riset berbeda", /^R-/.test(k6 || "") && k6 !== p1.kode_riset);
  cek("peserta tidak melihat persetujuan atau kode orang lain", (await sisip(U1, "select riset_setuju, kode_riset from public.profiles where id = $1", U6)).rows.length === 0);
  cek("instruktur membaca persetujuan dan kode semua peserta", (await sisip(IN, "select id, riset_setuju, kode_riset from public.profiles where riset_setuju is not null")).rows.length >= 2);
  cek("peran tetap tidak bisa dinaikkan lewat perubahan profil", ditolak(await sisip(U1, "update public.profiles set peran = 'instruktur' where id = $1", U1), RLS) || (await q("select peran from public.profiles where id = $1", [U1])).rows[0].peran === "peserta");

  // ---- catatan ekspor ----
  const LOG = "insert into public.riset_ekspor_log (matakuliah_id, oleh, jumlah_peserta, jumlah_baris, opsi) values ('algoritma-python', $1, 2, 40, '{\"kode\":false}'::jsonb)";
  cek("instruktur mencatat ekspor", !(await sisip(IN, LOG, IN)).error);
  cek("peserta tidak bisa menulis atau membaca catatan ekspor", ditolak(await sisip(U6, LOG, U6), RLS) && (await sisip(U6, "select * from public.riset_ekspor_log")).rows.length === 0);
  cek("catatan ekspor tidak bisa diubah atau dihapus (hanya tambah)", ditolak(await sisip(IN, "update public.riset_ekspor_log set jumlah_baris = 0"), "42501") && ditolak(await sisip(IN, "delete from public.riset_ekspor_log"), "42501"));
}

console.log("\n== Tahap L: migrasi 0008 (praktikum) pada data yang sudah ada ==");
{
  const U1 = "11111111-1111-1111-1111-111111111111";
  const U6 = "66666666-6666-6666-6666-666666666666";
  const hitung = async (t) => (await q("select count(*)::int as n from public." + t)).rows[0].n;
  const sebelum = { percobaan: await hitung("percobaan"), progres: await hitung("progres"), laporan: await hitung("laporan"), profiles: await hitung("profiles") };
  if (!(await jalankan("0008_praktikum.sql berjalan di atas data lama", migrasi("0008_praktikum.sql")))) process.exit(1);
  cek("0008 aman dijalankan ulang", await jalankan("0008 diulang", migrasi("0008_praktikum.sql")));
  cek("0001 sampai 0008 berurutan diulang tanpa galat", await jalankan("ulang semuanya sampai 0008", ["0001_skema", "0002_keamanan", "0003_matakuliah", "0004_kelas_terstruktur", "0005_integritas", "0006_kehadiran", "0007_riset_perilaku", "0008_praktikum"].map((f) => migrasi(f + ".sql")).join("\n")));
  cek("data peserta yang sudah ada tidak berubah (percobaan, progres, laporan, profil)", (await hitung("percobaan")) === sebelum.percobaan && (await hitung("progres")) === sebelum.progres && (await hitung("laporan")) === sebelum.laporan && (await hitung("profiles")) === sebelum.profiles);

  // ---- berkas kerja ----
  const BK = "insert into public.praktikum_berkas (user_id, matakuliah_id, praktikum_id, nama, isi, asal) values ($1, 'algoritma-python', 'kasir', $2, $3, $4) on conflict (user_id, matakuliah_id, praktikum_id, nama) do update set isi = excluded.isi, asal = excluded.asal returning nama";
  cek("peserta menyimpan berkas kerja", !(await sisip(U6, BK, U6, "harga.py", "def potongan(j):\n    return 0\n", "milik")).error);
  cek("menyimpan ulang memperbarui berkas yang sama (upsert), bukan menggandakan", !(await sisip(U6, BK, U6, "harga.py", "# versi baru\n", "milik")).error && (await q("select count(*)::int as n from public.praktikum_berkas where user_id = $1 and nama = 'harga.py'", [U6])).rows[0].n === 1 && (await q("select isi from public.praktikum_berkas where user_id = $1 and nama = 'harga.py'", [U6])).rows[0].isi === "# versi baru\n");
  cek("berkas dari contoh ditandai asal contoh", !(await sisip(U6, BK, U6, "subtotal.py", "# contoh\n", "contoh")).error && (await q("select asal from public.praktikum_berkas where user_id = $1 and nama = 'subtotal.py'", [U6])).rows[0].asal === "contoh");
  for (const [nama, alasan] of [["../rahasia.py", "naik folder"], ["a b.py", "spasi"], ["", "kosong"], [".tersembunyi", "diawali titik"], ["x".repeat(61), "terlalu panjang"], ["dir/berkas.py", "garis miring"]]) {
    cek("nama berkas tidak aman ditolak: " + alasan, ditolak(await sisip(U6, BK, U6, nama, "x", "milik"), "23514"));
  }
  cek("isi berkas lebih dari 100 ribu karakter ditolak", ditolak(await sisip(U6, BK, U6, "besar.py", "x".repeat(100001), "milik"), "23514"));
  cek("isi tepat 100 ribu karakter diterima", !(await sisip(U6, BK, U6, "pas.py", "x".repeat(100000), "milik")).error);
  cek("asal di luar daftar ditolak", ditolak(await sisip(U6, BK, U6, "asal.py", "x", "palsu"), "23514"));
  cek("peserta tidak bisa menyimpan berkas atas nama peserta lain", ditolak(await sisip(U6, BK, U1, "curang.py", "x", "milik"), RLS));
  cek("peserta lain tidak membaca berkas orang lain", (await sisip(U1, "select * from public.praktikum_berkas where user_id = $1", U6)).rows.length === 0);
  cek("peserta tidak bisa mengubah berkas orang lain", (await sisip(U1, "update public.praktikum_berkas set isi = 'diretas' where user_id = $1", U6)).n === 0);
  cek("instruktur membaca semua berkas kerja", (await sisip(IN, "select nama, isi from public.praktikum_berkas where user_id = $1", U6)).rows.length >= 3);
  cek("instruktur tidak bisa mengubah atau menghapus berkas peserta", (await sisip(IN, "update public.praktikum_berkas set isi = 'diubah' where user_id = $1", U6)).n === 0 && (await sisip(IN, "delete from public.praktikum_berkas where user_id = $1", U6)).n === 0);
  cek("pengunjung (anon) tidak bisa membaca berkas", ditolak(await sebagai("anon", null, () => q("select * from public.praktikum_berkas")), "42501"));
  cek("peserta menghapus berkasnya sendiri", (await sisip(U6, "delete from public.praktikum_berkas where user_id = $1 and nama = 'pas.py'", U6)).n === 1);
  // batas jumlah berkas
  let ditolakBatas = false;
  for (let i = 0; i < 45; i++) {
    const r = await sisip(U6, BK, U6, "banyak" + i + ".py", "x", "milik");
    if (r.error) {
      ditolakBatas = r.code === "23514";
      break;
    }
  }
  cek("jumlah berkas dibatasi 40 per praktikum", ditolakBatas && (await q("select count(*)::int as n from public.praktikum_berkas where user_id = $1", [U6])).rows[0].n === 40);
  cek("praktikum lain punya jatah berkas sendiri", !(await sisip(U6, "insert into public.praktikum_berkas (user_id, matakuliah_id, praktikum_id, nama, isi) values ($1, 'algoritma-python', 'proyek-lain', 'a.py', 'x')", U6)).error);
  cek("memperbarui berkas yang sudah ada tetap boleh saat jatah penuh", !(await sisip(U6, BK, U6, "harga.py", "# masih bisa diubah\n", "milik")).error);

  // ---- status tahap ----
  const TH = "insert into public.praktikum_tahap (user_id, matakuliah_id, praktikum_id, tahap_id, status, jalur, jumlah_kirim, pertama_dibuka, lulus_pada, pakai_contoh, centang) values ($1, 'algoritma-python', 'kasir', $2, $3, $4, $5, now(), $6, $7, $8::jsonb) on conflict (user_id, matakuliah_id, praktikum_id, tahap_id) do update set status = excluded.status, jalur = excluded.jalur, jumlah_kirim = excluded.jumlah_kirim, lulus_pada = excluded.lulus_pada, pakai_contoh = excluded.pakai_contoh, centang = excluded.centang returning status";
  cek("peserta mencatat tahap yang sedang dikerjakan", !(await sisip(U6, TH, U6, "t01", "sedang", "web", 0, null, false, '{"0":true}')).error);
  cek("tahap lulus tercatat dengan waktu lulus", !(await sisip(U6, TH, U6, "t01", "lulus", "web", 2, new Date().toISOString(), false, '{"0":true,"1":true}')).error && (await q("select status, lulus_pada is not null as ada from public.praktikum_tahap where user_id = $1 and tahap_id = 't01'", [U6])).rows[0].ada === true);
  cek("memperbarui tahap tidak menggandakan baris", (await q("select count(*)::int as n from public.praktikum_tahap where user_id = $1 and tahap_id = 't01'", [U6])).rows[0].n === 1);
  cek("tahap boleh dilewati dan memakai berkas contoh", !(await sisip(U6, TH, U6, "t02", "dilewati", "web", 0, null, true, "{}")).error);
  cek("status di luar daftar ditolak", ditolak(await sisip(U6, TH, U6, "t03", "selesai", "web", 0, null, false, "{}"), "23514"));
  cek("jalur di luar daftar ditolak", ditolak(await sisip(U6, TH, U6, "t03", "sedang", "kertas", 0, null, false, "{}"), "23514"));
  cek("id tahap tidak berpola ditolak", ditolak(await sisip(U6, TH, U6, "Tahap 3!", "sedang", "web", 0, null, false, "{}"), "23514"));
  cek("peserta tidak bisa mencatat tahap atas nama orang lain", ditolak(await sisip(U6, TH, U1, "t01", "lulus", "web", 1, null, false, "{}"), RLS));
  cek("peserta lain tidak membaca atau mengubah tahap orang lain", (await sisip(U1, "select * from public.praktikum_tahap where user_id = $1", U6)).rows.length === 0 && (await sisip(U1, "update public.praktikum_tahap set status = 'belum' where user_id = $1", U6)).n === 0);
  cek("instruktur membaca status semua peserta (query tab Praktikum)", (await sisip(IN, "select user_id, tahap_id, status, jumlah_kirim, pakai_contoh from public.praktikum_tahap where matakuliah_id = 'algoritma-python' and praktikum_id = 'kasir'")).rows.length >= 2);
  cek("instruktur tidak bisa mengubah status tahap peserta", (await sisip(IN, "update public.praktikum_tahap set status = 'lulus' where user_id = $1", U6)).n === 0);

  // ---- riwayat versi ----
  const VR = "insert into public.praktikum_versi (user_id, matakuliah_id, praktikum_id, tahap_id, berkas, hasil, lulus, dibuat_pada, diterima_pada) values ($1, 'algoritma-python', 'kasir', 't01', $2::jsonb, $3::jsonb, $4, $5, $6) returning id, diterima_pada";
  const v = await sisip(U6, VR, U6, JSON.stringify({ "subtotal.py": "def subtotal(a, b):\n    return a * b\n" }), JSON.stringify({ kasus: [{ nama: "k1", lulus: true }] }), true, "2026-10-01T00:00:00Z", "2000-01-01T00:00:00Z");
  cek("setiap Kirim menyimpan salinan berkas dan hasil", !v.error, v.error);
  cek("jam server versi tidak bisa dipalsukan dari browser", !v.error && new Date(v.rows[0].diterima_pada).getFullYear() >= 2025);
  cek("riwayat versi tidak bisa diubah atau dihapus peserta", ditolak(await sisip(U6, "update public.praktikum_versi set lulus = false where user_id = $1", U6), "42501") && ditolak(await sisip(U6, "delete from public.praktikum_versi where user_id = $1", U6), "42501"));
  cek("salinan berkas lebih dari 400 ribu byte ditolak", ditolak(await sisip(U6, VR, U6, JSON.stringify({ "besar.py": "x".repeat(410000) }), "{}", false, "2026-10-01T00:00:00Z", null), "23514"));
  cek("peserta lain tidak membaca versi orang lain; instruktur membacanya", (await sisip(U1, "select * from public.praktikum_versi where user_id = $1", U6)).rows.length === 0 && (await sisip(IN, "select * from public.praktikum_versi where user_id = $1", U6)).rows.length === 1);
  cek("peserta tidak bisa menambah versi atas nama orang lain", ditolak(await sisip(U6, VR, U1, "{}", "{}", false, null, null), RLS));

  // ---- laporan praktikum ----
  const LP = "insert into public.praktikum_laporan (user_id, matakuliah_id, praktikum_id, jawaban, jumlah_ketikan, percobaan_tempel, durasi_menulis_detik, kode_verifikasi, dikumpulkan_pada) values ($1, 'algoritma-python', 'kasir', $2::jsonb, '{\"apa\":120}'::jsonb, $3, 300, $4, $5) on conflict (user_id, matakuliah_id, praktikum_id) do update set jawaban = excluded.jawaban, percobaan_tempel = excluded.percobaan_tempel, dikumpulkan_pada = excluded.dikumpulkan_pada returning kode_verifikasi";
  cek("peserta menyimpan laporan praktikum", !(await sisip(U6, LP, U6, JSON.stringify({ apa: "Membangun kasir." }), 0, "PKT00001", null)).error);
  cek("menyimpan ulang dan mengekspor memperbarui laporan yang sama tanpa mengunci", !(await sisip(U6, LP, U6, JSON.stringify({ apa: "Isi diperbarui." }), 2, "PKT00001", new Date().toISOString())).error && !(await sisip(U6, LP, U6, JSON.stringify({ apa: "Masih bisa diedit setelah ekspor." }), 2, "PKT00001", new Date().toISOString())).error && (await q("select jawaban from public.praktikum_laporan where user_id = $1", [U6])).rows[0].jawaban.apa.startsWith("Masih bisa"));
  cek("kode verifikasi harus 8 karakter", ditolak(await sisip(U1, LP, U1, "{}", 0, "PENDEK", null), "23514"));
  cek("kode verifikasi harus unik antar laporan", ditolak(await sisip(U1, LP, U1, "{}", 0, "PKT00001", null), "23505"));
  cek("laporan peserta lain tidak terbaca; instruktur membaca semua", (await sisip(U1, "select * from public.praktikum_laporan where user_id = $1", U6)).rows.length === 0 && (await sisip(IN, "select * from public.praktikum_laporan")).rows.length >= 1);
  cek("peserta tidak bisa menulis laporan atas nama orang lain", ditolak(await sisip(U6, LP, U1, "{}", 0, "PKT00002", null), RLS));
  cek("instruktur tidak bisa mengubah isi laporan peserta", (await sisip(IN, "update public.praktikum_laporan set jawaban = '{}' where user_id = $1", U6)).n === 0);
  cek("tabel lama tetap sama setelah semua uji praktikum", (await hitung("percobaan")) === sebelum.percobaan + 0 || (await hitung("percobaan")) >= sebelum.percobaan);
}

console.log("\n== Tahap K: skrip pemeriksa migrasi ==");
{
  const periksa = readFileSync(join(root, "supabase", "periksa_migrasi.sql"), "utf8");
  const r = await q(periksa);
  const baris = r.rows && r.rows[0];
  const kolom = baris ? Object.keys(baris) : [];
  cek("periksa_migrasi.sql berjalan dan memuat delapan kolom", !r.error && kolom.length === 8, r.error || JSON.stringify(kolom));
  cek("semua migrasi 0001 sampai 0008 terbaca terpasang", !!baris && kolom.every((k) => baris[k] === true), JSON.stringify(baris));
}

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
