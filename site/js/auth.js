// Masuk dan data awal peserta lewat Supabase.
// Bila SUPABASE_URL dan SUPABASE_ANON_KEY di config.js kosong, situs berjalan "mode lokal":
// tanpa akun, progres hanya di browser.

const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

const cfg = () => window.APP_CONFIG || {};

let client = null;
let session = null;
let profile = null;
let lastUid = null;
const listeners = [];

// `cfg().client` hanya untuk pengujian (klien tiruan). Pemakaian biasa cukup URL dan kunci anon.
export const enabled = () => !!(cfg().client || (cfg().SUPABASE_URL && cfg().SUPABASE_ANON_KEY));
export const getSession = () => session;
export const getProfile = () => profile;
export const getUserId = () => (session && session.user ? session.user.id : null);
export const getEmail = () => (session && session.user ? session.user.email : null);
export const onChange = (cb) => listeners.push(cb);
const emit = () => listeners.forEach((cb) => cb());

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Pustaka Supabase gagal dimuat. Periksa koneksi internet."));
    document.head.append(s);
  });
}

// Mengubah galat teknis menjadi kalimat yang bisa dipahami peserta.
export function friendly(error) {
  const msg = String((error && error.message) || error || "");
  const code = error && error.code;
  if (code === "23505") return "NIM ini sudah dipakai akun lain. Periksa lagi, atau hubungi dosen.";
  if (code === "23514") return "Isian belum sesuai aturan. Periksa panjang nama, NIM, dan kelas.";
  if (code === "42P01" || /relation .* does not exist/i.test(msg)) return "Database belum disiapkan. Hubungi dosen.";
  if (/rate limit|too many|over_email_send_rate_limit/i.test(msg)) return "Terlalu banyak permintaan email. Tunggu beberapa menit, lalu coba lagi.";
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg)) return "Kode salah atau sudah kedaluwarsa. Minta kode baru.";
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(msg)) return "Alamat email tidak valid.";
  if (/failed to fetch|network|load failed/i.test(msg)) return "Tidak bisa terhubung ke server. Periksa koneksi internet.";
  return "Terjadi masalah: " + msg;
}

async function fetchProfile() {
  const uid = getUserId();
  if (!uid) {
    profile = null;
    return;
  }
  const { data, error } = await client.from("profiles").select("nama,nim,kelas,peran").eq("id", uid).maybeSingle();
  if (error) throw error;
  profile = data || null;
}

export async function init() {
  if (!enabled()) return;
  const c = cfg();
  if (c.client) {
    client = c.client;
  } else {
    await loadScript(SUPABASE_JS);
    // Alur "implicit" dipilih supaya tautan di email bisa dibuka di peramban lain (mis. aplikasi email di ponsel).
    client = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    });
  }
  const { data } = await client.auth.getSession();
  session = data.session;
  lastUid = getUserId();
  await fetchProfile();
  client.auth.onAuthStateChange((event, s) => {
    // Jangan memanggil API Supabase langsung di dalam callback ini (bisa menggantung); tunda dengan setTimeout.
    setTimeout(async () => {
      const uid = s && s.user ? s.user.id : null;
      session = s;
      if (uid === lastUid) return;
      lastUid = uid;
      try {
        await fetchProfile();
      } catch (e) {
        profile = null;
      }
      emit();
    }, 0);
  });
}

export async function sendCode(email) {
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error(friendly(error));
}

export async function verifyCode(email, code) {
  const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.replace(/\s+/g, ""), type: "email" });
  if (error) throw new Error(friendly(error));
}

export async function saveProfile(p) {
  const uid = getUserId();
  if (!uid) throw new Error("Sesi berakhir. Masuk lagi.");
  const row = { id: uid, nama: p.nama.trim(), nim: p.nim.trim(), kelas: p.kelas.trim() };
  const { data, error } = await client.from("profiles").upsert(row).select("nama,nim,kelas,peran").single();
  if (error) throw new Error(friendly(error));
  profile = data;
  return data;
}

export async function signOut() {
  await client.auth.signOut();
}

export async function reloadProfile() {
  await fetchProfile();
}

// Validasi sisi klien (sama dengan batasan di database).
export function validateProfile(p) {
  const nama = (p.nama || "").trim();
  const nim = (p.nim || "").trim();
  const kelas = (p.kelas || "").trim();
  const e = {};
  if (nama.length < 2) e.nama = "Tulis nama lengkap (minimal 2 huruf).";
  else if (nama.length > 100) e.nama = "Nama terlalu panjang (maksimal 100 karakter).";
  if (nim.length < 3) e.nim = "NIM minimal 3 karakter.";
  else if (nim.length > 30) e.nim = "NIM terlalu panjang (maksimal 30 karakter).";
  else if (!/^[A-Za-z0-9.\-/]+$/.test(nim)) e.nim = "NIM hanya boleh huruf, angka, titik, strip, atau garis miring.";
  if (kelas.length < 1) e.kelas = "Isi kelas, misalnya SI-1A.";
  else if (kelas.length > 30) e.kelas = "Kelas terlalu panjang (maksimal 30 karakter).";
  return e;
}
