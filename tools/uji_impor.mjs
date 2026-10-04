#!/usr/bin/env node
// Menguji tools/impor_peserta.mjs terhadap server Supabase TIRUAN (admin API + PostgREST) di komputer ini.
// Ini menguji logika skrip (berkas CSV, kata sandi awal, ulang aman, galat, keamanan kunci), BUKAN Supabase sungguhan.
// Jalankan:  node tools/uji_impor.mjs
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const users = []; // {id,email,password,meta}
const profiles = new Map(); // id -> {id,nama,nim,kelas,peran}
let permintaan = [];
const server = createServer((req, res) => {
  const bagian = [];
  req.on("data", (c) => bagian.push(c));
  req.on("end", () => {
    const jalur = req.url;
    permintaan.push(req.method + " " + jalur.split("?")[0].replace(/[0-9a-f-]{36}$/, ":id"));
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
      return kirim(200, { users: users.slice((hal - 1) * per, hal * per).map((u) => ({ id: u.id, email: u.email })), aud: "authenticated" });
    }
    if (req.method === "POST" && jalur === "/auth/v1/admin/users") {
      if (!badan.email || badan.email_confirm !== true) return kirim(400, { msg: "email dan email_confirm wajib" });
      if (typeof badan.password !== "string" || badan.password.length < 8) return kirim(422, { error_code: "weak_password", msg: "Password should be at least 8 characters" });
      if (users.some((u) => u.email === badan.email)) return kirim(422, { error_code: "email_exists", msg: "A user with this email address has already been registered" });
      const u = { id: "00000000-0000-0000-0000-" + String(users.length + 1).padStart(12, "0"), email: badan.email, password: badan.password, meta: badan.user_metadata || {} };
      users.push(u);
      return kirim(200, { id: u.id, email: u.email });
    }
    if (req.method === "PUT" && jalur.startsWith("/auth/v1/admin/users/")) {
      const id = jalur.split("/").pop();
      const u = users.find((x) => x.id === id);
      if (!u) return kirim(404, { msg: "User not found" });
      if (badan.password) u.password = badan.password;
      if (badan.user_metadata) u.meta = badan.user_metadata;
      return kirim(200, { id: u.id, email: u.email });
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
const tulis = (nama, isi) => {
  const f = join(dir, nama);
  writeFileSync(f, isi, "utf8");
  return f;
};
const baca = (f) => readFileSync(f, "utf8").trim().split("\n").slice(1).filter(Boolean).map((l) => l.split(","));

let n = 0;
let gagal = 0;
function cek(nama, kondisi, detail = "") {
  n++;
  if (!kondisi) gagal++;
  console.log((kondisi ? "OK    " : "GAGAL ") + nama + (!kondisi && detail ? "  -> " + detail : ""));
}
const ENV = { SUPABASE_URL: URL_TIRUAN, SUPABASE_SERVICE_ROLE_KEY: KUNCI };
const BAIK = "nama,nim,kelas,email\nSiti Aminah,2024110012,SI-2024-A,Siti@Kampus.ac.id\nBudi Santoso,2024110099,SI-2024-A,budi@kampus.ac.id\nRina Wulandari,2024110105,SI-2024-B,rina@kampus.ac.id\n";
const sandiF = (nama) => join(dir, nama);

// 1 simulasi
let r = await jalan([tulis("a.csv", BAIK), "--jeda=0", "--sandi=" + sandiF("a-sandi.csv")], {});
cek("simulasi memeriksa berkas tanpa kunci dan tanpa mengirim apa pun", r.kode === 0 && permintaan.length === 0 && /3 peserta/.test(r.out), r.out);
cek("simulasi tidak membuat berkas kata sandi", !existsSync(sandiF("a-sandi.csv")));

// 2 berkas bermasalah
r = await jalan([tulis("b.csv", "nama,nim,kelas,email\nA,12,,salah\nBudi,2024,SI-2024-A,x@y.id\nBudi Dua,2024,SI-2024-A,x@y.id\n"), "--jalankan", "--jeda=0", "--sandi=" + sandiF("b-sandi.csv")], ENV);
cek("berkas bermasalah ditolak sebelum menghubungi server", r.kode === 1 && permintaan.length === 0, r.out);
cek("galat menyebut nomor baris", /baris 2:/.test(r.out) && /baris 4:.*email sama dengan baris 3/.test(r.out) && /NIM sama dengan baris 3/.test(r.out), r.out);
cek("berkas bermasalah tidak membuat berkas kata sandi", !existsSync(sandiF("b-sandi.csv")));

// 3 kolom wajib dan sandi buatan sendiri yang lemah
r = await jalan([tulis("c.csv", "nama,nim,email\nA B,123,a@b.id\n"), "--jeda=0"], {});
cek("kolom kelas yang hilang dilaporkan", r.kode === 1 && /'kelas' tidak ada/.test(r.out), r.out);
r = await jalan([tulis("c2.csv", "nama,nim,kelas,email,sandi\nAndi Wijaya,2024110888,SI-2024-A,andi@kampus.ac.id,pendek\nCici Lestari,2024110889,SI-2024-A,cici@kampus.ac.id,hurufsajaa\n"), "--jeda=0"], {});
cek("kolom sandi yang terlalu lemah ditolak", r.kode === 1 && /baris 2:.*sandi minimal 8/.test(r.out) && /baris 3:.*sandi minimal 8/.test(r.out), r.out);

// 3b format kelas lama ditolak dengan petunjuk
r = await jalan([tulis("c3.csv", "nama,nim,kelas,email\nAndi Wijaya,2024110888,SI-1A,andi@kampus.ac.id\nCici Lestari,2024110889,SI-2024-E1,cici@kampus.ac.id\n"), "--jeda=0"], {});
cek("kelas berformat lama atau salah ditolak dengan petunjuk format", r.kode === 1 && /baris 2:.*PRODI-ANGKATAN-HURUF/.test(r.out) && /baris 3:.*PRODI-ANGKATAN-HURUF/.test(r.out) && /SI-2024-A/.test(r.out), r.out);

// 4 kunci publik ditolak
permintaan = [];
r = await jalan([tulis("d.csv", BAIK), "--jalankan", "--jeda=0", "--sandi=" + sandiF("d-sandi.csv")], { SUPABASE_URL: URL_TIRUAN, SUPABASE_SERVICE_ROLE_KEY: ANON });
cek("kunci anon ditolak, tanpa menghubungi server", r.kode === 1 && permintaan.length === 0 && /anon/.test(r.out), r.out);
r = await jalan([tulis("d2.csv", BAIK), "--jalankan", "--jeda=0", "--sandi=" + sandiF("d2-sandi.csv")], { SUPABASE_URL: URL_TIRUAN, SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_abc" });
cek("kunci publishable ditolak", r.kode === 1 && permintaan.length === 0, r.out);
r = await jalan([tulis("d3.csv", BAIK), "--jalankan", "--jeda=0", "--sandi=" + sandiF("d3-sandi.csv")], { SUPABASE_URL: "http://contoh.com", SUPABASE_SERVICE_ROLE_KEY: KUNCI });
cek("URL http non-lokal ditolak", r.kode === 1 && permintaan.length === 0, r.out);

// 5 kunci salah di sisi server
r = await jalan([tulis("e.csv", BAIK), "--jalankan", "--jeda=0", "--sandi=" + sandiF("e-sandi.csv")], { SUPABASE_URL: URL_TIRUAN, SUPABASE_SERVICE_ROLE_KEY: jwt("service_role") + "x" });
cek("kunci yang ditolak server dijelaskan", r.kode === 1 && /ditolak/i.test(r.out), r.out);

// 6 mendaftarkan, dengan kata sandi awal acak
permintaan = [];
const SANDI1 = sandiF("sandi1.csv");
r = await jalan([tulis("f.csv", BAIK), "--jalankan", "--jeda=0", "--sandi=" + SANDI1], ENV);
cek("pendaftaran berhasil", r.kode === 0 && /Akun baru dibuat\s+: 3/.test(r.out) && /Profil tersimpan\s+: 3 dari 3/.test(r.out), r.out);
cek("tiga akun dan tiga profil ada di server", users.length === 3 && profiles.size === 3);
cek("email dinormalkan ke huruf kecil", users[0].email === "siti@kampus.ac.id");
cek("profil berisi nama, NIM, kelas", [...profiles.values()].some((p) => p.nama === "Siti Aminah" && p.nim === "2024110012" && p.kelas === "SI-2024-A"));
cek("tiap akun bertanda wajib ganti kata sandi", users.every((u) => u.meta.ganti_sandi === true));
cek("kata sandi awal acak: 12 karakter, memuat huruf dan angka, berbeda-beda", users.every((u) => u.password.length === 12 && /[A-Za-z]/.test(u.password) && /[0-9]/.test(u.password)) && new Set(users.map((u) => u.password)).size === 3);
const baris1 = baca(SANDI1);
cek("berkas kata sandi berisi tiga baris yang cocok dengan server", baris1.length === 3 && baris1.every(([, , , email, sandi]) => users.find((u) => u.email === email).password === sandi), JSON.stringify(baris1));
cek("kata sandi TIDAK dicetak ke layar", users.every((u) => !r.out.includes(u.password)));
cek("kunci tidak muncul di keluaran", !r.out.includes(KUNCI));
cek("keluaran menyebut lokasi berkas kata sandi", r.out.includes(SANDI1));
const sandiAwal = users.map((u) => u.password);

// 7 ulang aman
permintaan = [];
const SANDI2 = sandiF("sandi2.csv");
r = await jalan([tulis("g.csv", BAIK.replace("SI-2024-B", "SI-2024-C")), "--jalankan", "--jeda=0", "--sandi=" + SANDI2], ENV);
cek("menjalankan ulang tidak membuat akun ganda", r.kode === 0 && /Akun baru dibuat\s+: 0/.test(r.out) && /Akun sudah ada\s+: 3/.test(r.out) && users.length === 3, r.out);
cek("menjalankan ulang TIDAK mengubah kata sandi yang ada", users.every((u, i) => u.password === sandiAwal[i]));
cek("menjalankan ulang tidak menulis berkas kata sandi baru", !existsSync(SANDI2));
cek("menjalankan ulang memperbarui profil", [...profiles.values()].find((p) => p.nim === "2024110105").kelas === "SI-2024-C");
cek("tidak ada panggilan pembuatan akun atau ubah sandi saat diulang", !permintaan.includes("POST /auth/v1/admin/users") && !permintaan.some((x) => x.startsWith("PUT ")));

// 8 peran tidak diubah
const idSiti = users[0].id;
profiles.get(idSiti).peran = "instruktur";
r = await jalan([tulis("h.csv", BAIK), "--jalankan", "--jeda=0", "--sandi=" + sandiF("h-sandi.csv")], ENV);
cek("peran instruktur yang sudah ada tidak diubah oleh impor", r.kode === 0 && profiles.get(idSiti).peran === "instruktur");

// 9 reset sandi
const SANDI3 = sandiF("sandi3.csv");
users[1].meta.ganti_sandi = false;
r = await jalan([tulis("i.csv", BAIK), "--jalankan", "--reset-sandi", "--jeda=0", "--sandi=" + SANDI3], ENV);
cek("--reset-sandi mengatur ulang kata sandi akun yang sudah ada", r.kode === 0 && /diatur ulang\s*: 3/.test(r.out) && users.every((u, i) => u.password !== sandiAwal[i]), r.out);
cek("--reset-sandi mewajibkan ganti kata sandi lagi", users.every((u) => u.meta.ganti_sandi === true));
cek("berkas kata sandi hasil reset cocok dengan server", baca(SANDI3).length === 3 && baca(SANDI3).every(([, , , email, sandi]) => users.find((u) => u.email === email).password === sandi));
cek("tidak menimpa berkas kata sandi yang sudah ada", (await jalan([tulis("i2.csv", BAIK), "--jalankan", "--reset-sandi", "--jeda=0", "--sandi=" + SANDI3], ENV)).kode === 1);

// 10 NIM bentrok dengan profil lain
profiles.set("id-lain", { id: "id-lain", nama: "Orang Lain", nim: "2024110777", kelas: "X", peran: "peserta" });
r = await jalan([tulis("j.csv", BAIK + "Dewi Sartika,2024110777,SI-2024-A,dewi@kampus.ac.id\nAndi Wijaya,2024110888,SI-2024-A,andi@kampus.ac.id\n"), "--jalankan", "--jeda=0", "--sandi=" + sandiF("sandi4.csv")], ENV);
cek("NIM yang bentrok dilaporkan per baris, dan exit 1", r.kode === 1 && /dewi@kampus.ac.id.*NIM 2024110777 sudah dipakai/.test(r.out), r.out);
cek("peserta lain tetap terdaftar meski satu baris gagal", users.some((u) => u.email === "andi@kampus.ac.id") && [...profiles.values()].some((p) => p.nim === "2024110888"));

// 11 format Excel dan kata sandi buatan sendiri
const SANDI5 = sandiF("sandi5.csv");
r = await jalan([tulis("k.csv", "﻿nim;kelas;email;nama;sandi\r\n2024110301;si-2025-a;lia@kampus.ac.id;\"Lia, S.Kom\";Awal-Lia-2026\r\n"), "--jalankan", "--jeda=0", "--sandi=" + SANDI5], ENV);
cek("CSV titik koma + BOM + nama berkoma terbaca", r.kode === 0 && [...profiles.values()].some((p) => p.nim === "2024110301" && p.nama === "Lia, S.Kom" && p.kelas === "SI-2025-A"), r.out);
cek("kelas huruf kecil dinormalkan menjadi huruf besar", [...profiles.values()].some((p) => p.nim === "2024110301" && p.kelas === "SI-2025-A"));
cek("kata sandi buatan sendiri dari kolom sandi dipakai", users.find((u) => u.email === "lia@kampus.ac.id").password === "Awal-Lia-2026");

server.close();
rmSync(dir, { recursive: true, force: true });
console.log(gagal ? `\n${gagal} dari ${n} uji GAGAL.` : `\nSemua ${n} uji lulus.`);
process.exit(gagal ? 1 : 0);
