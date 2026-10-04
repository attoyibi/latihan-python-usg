#!/usr/bin/env node
// Menguji tools/impor_peserta.mjs terhadap server Supabase TIRUAN (admin API + PostgREST) di komputer ini.
// Ini menguji logika skrip (berkas CSV, ulang aman, galat, keamanan kunci), BUKAN Supabase sungguhan.
// Jalankan:  node tools/uji_impor.mjs
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const skrip = join(dirname(fileURLToPath(import.meta.url)), "impor_peserta.mjs");
const dir = mkdtempSync(join(tmpdir(), "impor-"));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role) => b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ iss: "supabase", role }) + ".tanda-tangan-palsu";
const KUNCI = jwt("service_role");
const ANON = jwt("anon");

// ------------------------------------------------------------ server tiruan
const users = []; // {id,email}
const profiles = new Map(); // id -> {id,nama,nim,kelas,peran}
let permintaan = [];
const server = createServer((req, res) => {
  const bagian = [];
  req.on("data", (c) => bagian.push(c));
  req.on("end", () => {
    const jalur = req.url;
    permintaan.push(req.method + " " + jalur.split("?")[0]);
    const kirim = (kode, obj) => {
      res.writeHead(kode, { "Content-Type": "application/json" });
      res.end(obj === undefined ? "" : JSON.stringify(obj));
    };
    if (req.headers.authorization !== "Bearer " + KUNCI || req.headers.apikey !== KUNCI) return kirim(401, { msg: "Invalid API key" });
    const badan = bagian.length ? JSON.parse(Buffer.concat(bagian).toString()) : null;
    if (req.method === "GET" && jalur.startsWith("/auth/v1/admin/users")) {
      const q = new URL(jalur, "http://x").searchParams;
      const hal = Number(q.get("page") || 1);
      const per = Number(q.get("per_page") || 50);
      return kirim(200, { users: users.slice((hal - 1) * per, hal * per), aud: "authenticated" });
    }
    if (req.method === "POST" && jalur === "/auth/v1/admin/users") {
      if (!badan.email || badan.email_confirm !== true) return kirim(400, { msg: "email dan email_confirm wajib" });
      if (users.some((u) => u.email === badan.email)) return kirim(422, { error_code: "email_exists", msg: "A user with this email address has already been registered" });
      const u = { id: "00000000-0000-0000-0000-" + String(users.length + 1).padStart(12, "0"), email: badan.email };
      users.push(u);
      return kirim(200, u);
    }
    if (req.method === "POST" && jalur.startsWith("/rest/v1/profiles")) {
      if (req.headers.prefer !== "resolution=merge-duplicates,return=minimal") return kirim(400, { message: "Prefer salah" });
      for (const p of profiles.values()) if (p.nim === badan.nim && p.id !== badan.id) return kirim(409, { code: "23505", message: 'duplicate key value violates unique constraint "profiles_nim_key"' });
      profiles.set(badan.id, Object.assign({ peran: "peserta" }, profiles.get(badan.id), badan));
      return kirim(201);
    }
    kirim(404, { message: "tidak ada" });
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const URL_TIRUAN = "http://127.0.0.1:" + server.address().port;

function jalan(args, env) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [skrip, ...args], { env: { PATH: process.env.PATH, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (kode) => resolve({ kode, out }));
  });
}
const csv = (nama, isi) => {
  const f = join(dir, nama);
  writeFileSync(f, isi, "utf8");
  return f;
};

let n = 0;
let gagal = 0;
function cek(nama, kondisi, detail = "") {
  n++;
  if (!kondisi) gagal++;
  console.log((kondisi ? "OK    " : "GAGAL ") + nama + (!kondisi && detail ? "  -> " + detail : ""));
}
const ENV = { SUPABASE_URL: URL_TIRUAN, SUPABASE_SERVICE_ROLE_KEY: KUNCI };
const BAIK = "nama,nim,kelas,email\nSiti Aminah,2024110012,SI-1A,Siti@Kampus.ac.id\nBudi Santoso,2024110099,SI-1A,budi@kampus.ac.id\nRina Wulandari,2024110105,SI-1B,rina@kampus.ac.id\n";

// 1 simulasi
let r = await jalan([csv("a.csv", BAIK), "--jeda=0"], {});
cek("simulasi memeriksa berkas tanpa kunci dan tanpa mengirim apa pun", r.kode === 0 && permintaan.length === 0 && /3 peserta/.test(r.out), r.out);

// 2 berkas bermasalah
r = await jalan([csv("b.csv", "nama,nim,kelas,email\nA,12,,salah\nBudi,2024,SI-1A,x@y.id\nBudi Dua,2024,SI-1A,x@y.id\n"), "--jalankan", "--jeda=0"], ENV);
cek("berkas bermasalah ditolak sebelum menghubungi server", r.kode === 1 && permintaan.length === 0, r.out);
cek("galat menyebut nomor baris", /baris 2:/.test(r.out) && /baris 4:.*email sama dengan baris 3/.test(r.out) && /NIM sama dengan baris 3/.test(r.out), r.out);

// 3 kolom wajib
r = await jalan([csv("c.csv", "nama,nim,email\nA B,123,a@b.id\n"), "--jeda=0"], {});
cek("kolom kelas yang hilang dilaporkan", r.kode === 1 && /'kelas' tidak ada/.test(r.out), r.out);

// 4 kunci publik ditolak
permintaan = [];
r = await jalan([csv("d.csv", BAIK), "--jalankan", "--jeda=0"], { SUPABASE_URL: URL_TIRUAN, SUPABASE_SERVICE_ROLE_KEY: ANON });
cek("kunci anon ditolak, tanpa menghubungi server", r.kode === 1 && permintaan.length === 0 && /bukan kunci anon|role|anon/.test(r.out), r.out);
r = await jalan([csv("d2.csv", BAIK), "--jalankan", "--jeda=0"], { SUPABASE_URL: URL_TIRUAN, SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_abc" });
cek("kunci publishable ditolak", r.kode === 1 && permintaan.length === 0, r.out);
r = await jalan([csv("d3.csv", BAIK), "--jalankan", "--jeda=0"], { SUPABASE_URL: "http://contoh.com", SUPABASE_SERVICE_ROLE_KEY: KUNCI });
cek("URL http non-lokal ditolak", r.kode === 1 && permintaan.length === 0, r.out);

// 5 kunci salah di sisi server
r = await jalan([csv("e.csv", BAIK), "--jalankan", "--jeda=0"], { SUPABASE_URL: URL_TIRUAN, SUPABASE_SERVICE_ROLE_KEY: jwt("service_role") + "x" });
cek("kunci yang ditolak server dijelaskan", r.kode === 1 && /ditolak/i.test(r.out), r.out);

// 6 mendaftarkan
permintaan = [];
r = await jalan([csv("f.csv", BAIK), "--jalankan", "--jeda=0"], ENV);
cek("pendaftaran berhasil", r.kode === 0 && /Akun baru dibuat\s+: 3/.test(r.out) && /Profil tersimpan\s+: 3 dari 3/.test(r.out), r.out);
cek("tiga akun dan tiga profil ada di server", users.length === 3 && profiles.size === 3);
cek("email dinormalkan ke huruf kecil", users[0].email === "siti@kampus.ac.id");
cek("profil berisi nama, NIM, kelas", [...profiles.values()].some((p) => p.nama === "Siti Aminah" && p.nim === "2024110012" && p.kelas === "SI-1A"));
cek("kunci tidak muncul di keluaran", !r.out.includes(KUNCI));

// 7 ulang aman
permintaan = [];
r = await jalan([csv("g.csv", BAIK.replace("SI-1B", "SI-1C")), "--jalankan", "--jeda=0"], ENV);
cek("menjalankan ulang tidak membuat akun ganda", r.kode === 0 && /Akun baru dibuat\s+: 0/.test(r.out) && /Akun sudah ada\s+: 3/.test(r.out) && users.length === 3, r.out);
cek("menjalankan ulang memperbarui profil", [...profiles.values()].find((p) => p.nim === "2024110105").kelas === "SI-1C");
cek("tidak ada panggilan pembuatan akun saat diulang", !permintaan.includes("POST /auth/v1/admin/users"));

// 8 peran tidak diubah
const idSiti = users[0].id;
profiles.get(idSiti).peran = "instruktur";
r = await jalan([csv("h.csv", BAIK), "--jalankan", "--jeda=0"], ENV);
cek("peran instruktur yang sudah ada tidak diubah oleh impor", r.kode === 0 && profiles.get(idSiti).peran === "instruktur");

// 9 NIM bentrok dengan profil lain
profiles.set("id-lain", { id: "id-lain", nama: "Orang Lain", nim: "2024110777", kelas: "X", peran: "peserta" });
r = await jalan([csv("i.csv", BAIK + "Dewi Sartika,2024110777,SI-1A,dewi@kampus.ac.id\nAndi Wijaya,2024110888,SI-1A,andi@kampus.ac.id\n"), "--jalankan", "--jeda=0"], ENV);
cek("NIM yang bentrok dilaporkan per baris, dan exit 1", r.kode === 1 && /dewi@kampus.ac.id.*NIM 2024110777 sudah dipakai/.test(r.out), r.out);
cek("peserta lain tetap terdaftar meski satu baris gagal", users.some((u) => u.email === "andi@kampus.ac.id") && [...profiles.values()].some((p) => p.nim === "2024110888"));

// 10 format Excel: titik koma, BOM, nama bertanda kutip berkoma
r = await jalan([csv("j.csv", "﻿nim;kelas;email;nama\r\n2024110301;SI-2A;lia@kampus.ac.id;\"Lia, S.Kom\"\r\n"), "--jalankan", "--jeda=0"], ENV);
cek("CSV titik koma + BOM + nama berkoma terbaca", r.kode === 0 && [...profiles.values()].some((p) => p.nim === "2024110301" && p.nama === "Lia, S.Kom" && p.kelas === "SI-2A"), r.out);

server.close();
rmSync(dir, { recursive: true, force: true });
console.log(gagal ? `\n${gagal} dari ${n} uji GAGAL.` : `\nSemua ${n} uji lulus.`);
process.exit(gagal ? 1 : 0);
