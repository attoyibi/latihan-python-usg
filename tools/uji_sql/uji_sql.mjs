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

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
