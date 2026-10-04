#!/usr/bin/env node
// Mendaftarkan peserta dari berkas CSV ke proyek Supabase: membuat akun (email sudah terverifikasi) dengan
// KATA SANDI AWAL, dan mengisi profilnya (nama, NIM, kelas). Peserta masuk dengan email dan kata sandi awal itu,
// lalu diminta membuat kata sandi baru pada masuk pertama. Peserta tidak perlu mendaftar.
//
// Pemakaian:
//   node tools/impor_peserta.mjs peserta.csv               simulasi: hanya memeriksa berkas, tidak mengirim apa pun
//   node tools/impor_peserta.mjs peserta.csv --jalankan    benar-benar mendaftarkan
//
// Opsi:
//   --sandi=jalur.csv   tempat menyimpan daftar kata sandi awal (bawaan: sandi-awal-<tanggal-jam>.csv di folder ini)
//   --reset-sandi       juga mengatur ulang kata sandi peserta yang SUDAH punya akun (dan mewajibkan menggantinya lagi).
//                       Tanpa opsi ini, akun yang sudah ada tidak disentuh kata sandinya.
//   --jeda=100          jeda antar pembuatan akun, dalam milidetik
//
// Format CSV (baris pertama = judul kolom; pemisah koma atau titik koma; urutan kolom bebas):
//   nama,nim,kelas,email            kolom opsional tambahan: sandi (kata sandi awal buatan Anda sendiri)
//   Siti Aminah,2024110012,SI-1A,siti@kampus.ac.id
// Bila kolom sandi kosong atau tidak ada, skrip membuat kata sandi acak untuk tiap peserta.
//
// Untuk --jalankan, atur dua variabel lingkungan di komputer Anda (JANGAN di repositori):
//   SUPABASE_URL                 mis. https://abcdxyz.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    kunci RAHASIA dari Project Settings > API (service_role atau sb_secret_...)
//
// Keamanan: kunci itu melewati semua aturan keamanan. Skrip hanya berjalan di komputer Anda, tidak mencetak kunci
// maupun kata sandi ke layar (kata sandi hanya ke berkas), dan menolak kunci publik. Berkas kata sandi berisi
// rahasia: bagikan ke peserta lewat jalur aman lalu hapus. Aman dijalankan ulang; peran yang sudah ada tidak diubah.

import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";

const argv = process.argv.slice(2);
const jalankan = argv.includes("--jalankan");
const resetSandi = argv.includes("--reset-sandi");
const berkas = argv.find((a) => !a.startsWith("--"));
const opsi = (nama) => {
  const a = argv.find((x) => x.startsWith(nama + "="));
  return a ? a.slice(nama.length + 1) : null;
};
const JEDA_MS = opsi("--jeda") !== null ? Number(opsi("--jeda")) : 100;

function gagal(pesan) {
  console.error("GAGAL: " + pesan);
  process.exit(1);
}

if (!berkas) gagal("Sebutkan berkas CSV. Contoh: node tools/impor_peserta.mjs peserta.csv");

const MIN_SANDI = 8;
const sandiSah = (s) => typeof s === "string" && s.length >= MIN_SANDI && /[A-Za-z]/.test(s) && /[0-9]/.test(s);

// Kata sandi acak yang mudah dibaca (tanpa huruf yang mirip seperti l, I, O, 0) dan memuat huruf serta angka.
function buatSandi() {
  const huruf = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const angka = "23456789";
  const semua = huruf + angka;
  for (;;) {
    let s = "";
    for (let i = 0; i < 12; i++) s += semua[randomInt(semua.length)];
    if (/[A-Za-z]/.test(s) && /[0-9]/.test(s)) return s;
  }
}

// ---------------------------------------------------------------- CSV
function parseCsv(teks) {
  teks = teks.replace(/^﻿/, "");
  const baris1 = teks.split(/\r?\n/, 1)[0] || "";
  const delim = (baris1.match(/;/g) || []).length > (baris1.match(/,/g) || []).length ? ";" : ",";
  const hasil = [];
  let cur = [];
  let f = "";
  let q = false;
  let no = 1;
  let mulai = 1;
  const tutupBaris = () => {
    cur.push(f);
    f = "";
    if (cur.some((c) => c.trim() !== "")) hasil.push({ no: mulai, sel: cur });
    cur = [];
  };
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (q) {
      if (c === '"') {
        if (teks[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else {
        if (c === "\n") no++;
        f += c;
      }
    } else if (c === '"') q = true;
    else if (c === delim) {
      cur.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && teks[i + 1] === "\n") i++;
      tutupBaris();
      no++;
      mulai = no;
    } else f += c;
  }
  if (f !== "" || cur.length) tutupBaris();
  return hasil;
}

function validasi(baris) {
  const [judul, ...isi] = baris;
  const kolom = judul.sel.map((x) => x.trim().toLowerCase());
  for (const k of ["nama", "nim", "kelas", "email"]) if (!kolom.includes(k)) gagal(`Kolom '${k}' tidak ada di baris pertama. Kolom yang dibutuhkan: nama, nim, kelas, email.`);
  const idx = Object.fromEntries(kolom.map((k, i) => [k, i]));
  const ok = [];
  const galat = [];
  const emailDilihat = new Map();
  const nimDilihat = new Map();
  for (const r of isi) {
    const nama = (r.sel[idx.nama] || "").trim();
    const nim = (r.sel[idx.nim] || "").trim();
    const kelas = (r.sel[idx.kelas] || "").trim();
    const email = (r.sel[idx.email] || "").trim().toLowerCase();
    const sandi = idx.sandi !== undefined ? (r.sel[idx.sandi] || "").trim() : "";
    const e = [];
    if (nama.length < 2 || nama.length > 100) e.push("nama harus 2 sampai 100 karakter");
    if (nim.length < 3 || nim.length > 30 || !/^[A-Za-z0-9.\-/]+$/.test(nim)) e.push("NIM harus 3 sampai 30 karakter (huruf, angka, titik, strip, garis miring)");
    if (kelas.length < 1 || kelas.length > 30) e.push("kelas harus 1 sampai 30 karakter");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.push("email tidak valid");
    if (sandi && !sandiSah(sandi)) e.push(`sandi minimal ${MIN_SANDI} karakter dan memuat huruf serta angka`);
    if (email && emailDilihat.has(email)) e.push(`email sama dengan baris ${emailDilihat.get(email)}`);
    if (nim && nimDilihat.has(nim)) e.push(`NIM sama dengan baris ${nimDilihat.get(nim)}`);
    if (email) emailDilihat.set(email, r.no);
    if (nim) nimDilihat.set(nim, r.no);
    if (e.length) galat.push(`baris ${r.no}: ${e.join("; ")}`);
    else ok.push({ no: r.no, nama, nim, kelas, email, sandi });
  }
  return { ok, galat };
}

// ---------------------------------------------------------------- baca dan periksa berkas
let teks;
try {
  teks = readFileSync(berkas, "utf8");
} catch (e) {
  gagal(`Berkas '${berkas}' tidak bisa dibaca.`);
}
const baris = parseCsv(teks);
if (baris.length < 2) gagal("Berkas kosong atau hanya berisi judul kolom.");
const { ok: peserta, galat } = validasi(baris);
if (galat.length) {
  console.error(`Ditemukan ${galat.length} masalah di berkas. Tidak ada yang dikirim.`);
  for (const g of galat) console.error(" - " + g);
  process.exit(1);
}
console.log(`Berkas valid: ${peserta.length} peserta.`);

if (!jalankan) {
  console.log("Ini hanya simulasi: tidak ada yang dikirim ke Supabase.");
  console.log("Tambahkan --jalankan untuk mendaftarkan mereka (butuh SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(0);
}

// ---------------------------------------------------------------- periksa kunci
const url0 = (process.env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url0 || !key) gagal("Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sebagai variabel lingkungan di komputer Anda.");
let u;
try {
  u = new URL(url0);
} catch (e) {
  gagal("SUPABASE_URL bukan alamat yang valid.");
}
const lokalHost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
if (u.protocol !== "https:" && !(u.protocol === "http:" && lokalHost)) gagal("SUPABASE_URL harus diawali https://.");
const url = u.origin;

if (/^sb_publishable_/.test(key)) gagal("Itu kunci PUBLIK (publishable). Skrip ini butuh kunci rahasia (service_role atau sb_secret_...).");
if (!/^sb_secret_/.test(key)) {
  const p = key.split(".");
  if (p.length !== 3) gagal("SUPABASE_SERVICE_ROLE_KEY bukan kunci Supabase yang dikenali.");
  let pl;
  try {
    pl = JSON.parse(Buffer.from(p[1], "base64url").toString("utf8"));
  } catch (e) {
    gagal("SUPABASE_SERVICE_ROLE_KEY rusak atau bukan kunci Supabase.");
  }
  if (pl.role !== "service_role") gagal(`Kunci ini berperan '${pl.role}'. Skrip ini butuh kunci service_role (rahasia), bukan kunci anon.`);
}

// ---------------------------------------------------------------- panggilan ke Supabase
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(metode, jalur, badan, tambahan) {
  let r;
  try {
    r = await fetch(url + jalur, {
      method: metode,
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...(tambahan || {}) },
      body: badan ? JSON.stringify(badan) : undefined,
    });
  } catch (e) {
    gagal("Tidak bisa terhubung ke " + url + ". Periksa SUPABASE_URL dan koneksi internet.");
  }
  const t = await r.text();
  let j = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch (e) {}
  return { ok: r.ok, status: r.status, json: j };
}

async function daftarPengguna() {
  const peta = new Map();
  for (let hal = 1; hal < 200; hal++) {
    const r = await api("GET", `/auth/v1/admin/users?page=${hal}&per_page=1000`);
    if (r.status === 401 || r.status === 403) gagal(`Kunci ditolak oleh Supabase (HTTP ${r.status}). Pastikan itu kunci service_role dari proyek yang sama dengan SUPABASE_URL.`);
    if (!r.ok) gagal(`Tidak bisa membaca daftar pengguna (HTTP ${r.status}).`);
    const users = (r.json && r.json.users) || [];
    for (const x of users) if (x.email) peta.set(String(x.email).toLowerCase(), x.id);
    if (users.length < 1000) break;
  }
  return peta;
}

// ---------------------------------------------------------------- berkas kata sandi awal
const stempel = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
const berkasSandi = opsi("--sandi") || `sandi-awal-${stempel}.csv`;
if (existsSync(berkasSandi)) gagal(`Berkas '${berkasSandi}' sudah ada. Pindahkan atau hapus dulu, atau pilih nama lain dengan --sandi=...`);
const csvSel = (s) => (/[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
writeFileSync(berkasSandi, "nama,nim,kelas,email,kata_sandi_awal\n", { encoding: "utf8", mode: 0o600 });
let barisSandi = 0;
const catatSandi = (p, sandi) => {
  appendFileSync(berkasSandi, [p.nama, p.nim, p.kelas, p.email, sandi].map(csvSel).join(",") + "\n", "utf8");
  barisSandi++;
};

console.log("Membaca daftar pengguna yang sudah ada");
const peta = await daftarPengguna();

const hitung = { dibuat: 0, sudahAda: 0, direset: 0, profil: 0 };
const gagalBaris = [];
for (const p of peserta) {
  let id = peta.get(p.email);
  const meta = { nama: p.nama, nim: p.nim, ganti_sandi: true };
  if (id) {
    hitung.sudahAda++;
    if (resetSandi) {
      const sandi = p.sandi || buatSandi();
      const r = await api("PUT", `/auth/v1/admin/users/${id}`, { password: sandi, user_metadata: meta });
      if (r.ok) {
        catatSandi(p, sandi);
        hitung.direset++;
      } else gagalBaris.push(`baris ${p.no} (${p.email}): kata sandi tidak bisa diatur ulang: ${(r.json && (r.json.msg || r.json.message)) || "HTTP " + r.status}`);
      if (JEDA_MS) await sleep(JEDA_MS);
    }
  } else {
    const sandi = p.sandi || buatSandi();
    const r = await api("POST", "/auth/v1/admin/users", { email: p.email, password: sandi, email_confirm: true, user_metadata: meta });
    if (r.ok && r.json && r.json.id) {
      id = r.json.id;
      peta.set(p.email, id);
      catatSandi(p, sandi); // dicatat segera supaya tidak hilang bila proses terhenti
      hitung.dibuat++;
    } else {
      const pesan = (r.json && (r.json.msg || r.json.message || r.json.error_description)) || "HTTP " + r.status;
      gagalBaris.push(`baris ${p.no} (${p.email}): akun tidak bisa dibuat: ${pesan}`);
      if (JEDA_MS) await sleep(JEDA_MS);
      continue;
    }
    if (JEDA_MS) await sleep(JEDA_MS);
  }
  const pr = await api("POST", "/rest/v1/profiles?on_conflict=id", { id, nama: p.nama, nim: p.nim, kelas: p.kelas }, { Prefer: "resolution=merge-duplicates,return=minimal" });
  if (pr.ok) hitung.profil++;
  else {
    const dup = pr.json && (pr.json.code === "23505" || /duplicate key/i.test(pr.json.message || ""));
    const sebab = dup ? `NIM ${p.nim} sudah dipakai profil lain` : (pr.json && (pr.json.message || pr.json.msg)) || "HTTP " + pr.status;
    gagalBaris.push(`baris ${p.no} (${p.email}): profil tidak tersimpan: ${sebab} (akunnya sudah ada; perbaiki lalu jalankan ulang, aman)`);
  }
}

if (barisSandi === 0) unlinkSync(berkasSandi);

console.log("");
console.log(`Akun baru dibuat      : ${hitung.dibuat}`);
console.log(`Akun sudah ada        : ${hitung.sudahAda}`);
if (resetSandi) console.log(`Kata sandi diatur ulang: ${hitung.direset}`);
console.log(`Profil tersimpan      : ${hitung.profil} dari ${peserta.length}`);
if (barisSandi > 0) {
  console.log(`\nKata sandi awal ${barisSandi} peserta disimpan di: ${berkasSandi}`);
  console.log("Berkas itu berisi RAHASIA. Bagikan kata sandi ke tiap peserta lewat jalur aman, lalu hapus berkasnya.");
  console.log("Peserta diminta membuat kata sandi baru saat pertama masuk.");
}
if (gagalBaris.length) {
  console.error(`\n${gagalBaris.length} baris bermasalah:`);
  for (const g of gagalBaris) console.error(" - " + g);
  process.exit(1);
}
console.log("\nSelesai.");
