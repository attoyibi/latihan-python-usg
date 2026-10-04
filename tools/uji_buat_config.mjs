#!/usr/bin/env node
// Menguji tools/buat_config.mjs. Jalankan:  node tools/uji_buat_config.mjs
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const skrip = join(dirname(fileURLToPath(import.meta.url)), "buat_config.mjs");
const dir = mkdtempSync(join(tmpdir(), "buatcfg-"));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role) => b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ iss: "supabase", role }) + ".tanda-tangan-palsu";
const URL_OK = "https://abcdxyz.supabase.co";

let n = 0;
let gagal = 0;
function uji(nama, env, { kode, ada, berisi, tidakBerisi }) {
  const out = join(dir, "c" + ++n + ".js");
  const r = spawnSync(process.execPath, [skrip, "--keluaran", out], {
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
  });
  const semua = (r.stdout || "") + (r.stderr || "");
  const masalah = [];
  if (r.status !== kode) masalah.push(`kode keluar ${r.status}, harapan ${kode}`);
  if (existsSync(out) !== ada) masalah.push(`berkas keluaran ${existsSync(out) ? "ada" : "tidak ada"}, harapan ${ada ? "ada" : "tidak ada"}`);
  if (ada && berisi && !readFileSync(out, "utf8").includes(berisi)) masalah.push(`isi tidak memuat ${berisi}`);
  if (tidakBerisi && semua.includes(tidakBerisi)) masalah.push("pesan keluaran membocorkan kunci");
  console.log((masalah.length ? "GAGAL " : "OK    ") + nama + (masalah.length ? " -> " + masalah.join("; ") : ""));
  if (masalah.length) gagal++;
}

const anon = jwt("anon");
const servis = jwt("service_role");

uji("tanpa variabel: berkas tidak dibuat, keluar normal", {}, { kode: 0, ada: false });
uji("anon JWT + https: berkas dibuat", { SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: anon }, { kode: 0, ada: true, berisi: URL_OK });
uji("kunci publishable diterima", { SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: "sb_publishable_abc123" }, { kode: 0, ada: true, berisi: "sb_publishable_abc123" });
uji("service_role DITOLAK", { SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: servis }, { kode: 1, ada: false, tidakBerisi: servis });
uji("sb_secret_ DITOLAK", { SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: "sb_secret_rahasia123" }, { kode: 1, ada: false, tidakBerisi: "sb_secret_rahasia123" });
uji("hanya URL diisi ditolak", { SUPABASE_URL: URL_OK }, { kode: 1, ada: false });
uji("hanya kunci diisi ditolak", { SUPABASE_ANON_KEY: anon }, { kode: 1, ada: false });
uji("http non-lokal ditolak", { SUPABASE_URL: "http://abcdxyz.supabase.co", SUPABASE_ANON_KEY: anon }, { kode: 1, ada: false });
uji("http://localhost diterima", { SUPABASE_URL: "http://localhost:54321", SUPABASE_ANON_KEY: anon }, { kode: 0, ada: true, berisi: "http://localhost:54321" });
uji("URL dengan jalur ditolak", { SUPABASE_URL: URL_OK + "/rest/v1", SUPABASE_ANON_KEY: anon }, { kode: 1, ada: false });
uji("URL berisi suntikan skrip ditolak", { SUPABASE_URL: 'https://x.supabase.co"; alert(1);//', SUPABASE_ANON_KEY: anon }, { kode: 1, ada: false });
uji("kunci acak bukan JWT ditolak", { SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: "bukan-kunci" }, { kode: 1, ada: false });
uji("role selain anon ditolak", { SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: jwt("authenticated") }, { kode: 1, ada: false });
uji("MODE_LOKAL saja membuat berkas", { MODE_LOKAL: "true" }, { kode: 0, ada: true, berisi: '"MODE_LOKAL": true' });

rmSync(dir, { recursive: true, force: true });
console.log(gagal ? `\n${gagal} uji gagal.` : `\nSemua ${n} uji lulus.`);
process.exit(gagal ? 1 : 0);
