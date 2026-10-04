// Masuk dengan email dan kata sandi lewat Supabase, plus data awal peserta.
// Peserta wajib masuk. Bila SUPABASE_URL dan SUPABASE_ANON_KEY di config.js kosong, situs menampilkan
// layar pemasangan, kecuali MODE_LOKAL: true (tanpa akun, progres hanya di browser; untuk uji tampilan).

const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

export const MIN_SANDI = 8;

const cfg = () => window.APP_CONFIG || {};

let client = null;
let session = null;
let profile = null;
let lastUid = null;
const listeners = [];

// `cfg().client` hanya untuk pengujian (klien tiruan). Pemakaian biasa cukup URL dan kunci anon.
export const enabled = () => !!(cfg().client || (cfg().SUPABASE_URL && cfg().SUPABASE_ANON_KEY));
// Mode lokal (tanpa akun) hanya menyala bila diminta eksplisit lewat MODE_LOKAL: true di config.js.
export const localMode = () => !enabled() && cfg().MODE_LOKAL === true;
// Belum tersambung ke Supabase dan bukan mode lokal: pengunjung tidak boleh membuka bab.
export const needsSetup = () => !enabled() && !localMode();
// Pendaftaran mandiri: "tutup" (bawaan, fitur Daftar disembunyikan) atau "buka". Pada kelas tertutup, dosen mendaftarkan peserta
// lebih dulu (tools/impor_peserta.mjs) dan peserta hanya masuk.
export const pendaftaranTerbuka = () => (cfg().PENDAFTARAN || "tutup") === "buka";
export const getSession = () => session;
export const getProfile = () => profile;
export const getUserId = () => (session && session.user ? session.user.id : null);
export const getEmail = () => (session && session.user ? session.user.email : null);
// Akun yang didaftarkan dosen membawa tanda ganti_sandi: peserta wajib membuat kata sandi baru saat pertama masuk.
export const perluGantiSandi = () => !!(session && session.user && session.user.user_metadata && session.user.user_metadata.ganti_sandi);
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
  const semua = msg + " " + (code || "");
  if (/invalid login credentials|invalid_credentials/i.test(semua)) return "Email atau kata sandi salah.";
  if (/email not confirmed|email_not_confirmed/i.test(semua)) return "Email belum dikonfirmasi. Buka email konfirmasi yang dikirim saat mendaftar, atau minta kirim ulang.";
  if (/user already registered|user_already_exists/i.test(semua)) return "Email ini sudah terdaftar. Silakan masuk.";
  if (/signups? (are )?(not allowed|disabled)|signup_disabled/i.test(semua)) return "Pendaftaran mandiri ditutup. Pakai email yang didaftarkan dosen, atau hubungi dosen.";
  if (/weak_password|password should be at least|password is too weak|should contain at least/i.test(semua)) return "Kata sandi terlalu lemah. Pakai minimal " + MIN_SANDI + " karakter dengan campuran huruf dan angka.";
  if (/same_password|different from the old password/i.test(semua)) return "Kata sandi baru harus berbeda dari yang lama.";
  if (code === "23505") return "NIM ini sudah dipakai akun lain. Periksa lagi, atau hubungi dosen.";
  if (code === "23514") return "Isian belum sesuai aturan. Periksa panjang nama, NIM, dan kelas.";
  if (code === "42P01" || /relation .* does not exist/i.test(msg)) return "Database belum disiapkan. Hubungi dosen.";
  // Batas permintaan per alamat IP (mis. banyak peserta di satu Wi-Fi kampus).
  if (/over_request_rate_limit|request rate limit reached/i.test(semua)) return "Terlalu banyak orang mencoba masuk dari jaringan yang sama pada saat ini. Tunggu beberapa menit lalu coba lagi, atau pakai data seluler.";
  // Jeda per alamat email: "you can only request this after 43 seconds"
  const detik = /after (\d+) seconds?/i.exec(msg);
  if (detik) return "Tunggu " + detik[1] + " detik sebelum meminta lagi.";
  // Batas pengiriman email untuk seluruh proyek sudah tercapai.
  if (/rate limit|too many|over_email_send_rate_limit/i.test(msg)) return "Batas pengiriman email sedang tercapai, jadi email belum bisa dikirim. Coba lagi sekitar satu jam lagi, atau hubungi dosen.";
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
    // Alur "implicit" dipilih supaya tautan di email (konfirmasi, atur ulang kata sandi) bisa dibuka di
    // peramban lain, mis. aplikasi email di ponsel.
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

// ---------- validasi sisi klien ----------

export function validasiEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim()) ? "" : "Tulis alamat email yang benar.";
}

// ulang: bila diberikan (bukan undefined), harus sama dengan sandi.
export function validasiSandi(sandi, ulang) {
  if (!sandi || sandi.length < MIN_SANDI) return "Kata sandi minimal " + MIN_SANDI + " karakter.";
  if (!/[A-Za-z]/.test(sandi) || !/[0-9]/.test(sandi)) return "Kata sandi harus memuat huruf dan angka.";
  if (ulang !== undefined && sandi !== ulang) return "Kata sandi dan pengulangannya belum sama.";
  return "";
}

// ---------- tindakan ----------

const balik = () => location.origin + location.pathname;

export async function signIn(email, sandi) {
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password: sandi });
  if (error) throw new Error(friendly(error));
}

// Mengembalikan { perluKonfirmasi }. true = email konfirmasi dikirim dan peserta harus mengklik tautannya.
export async function signUp(email, sandi) {
  const { data, error } = await client.auth.signUp({ email: email.trim(), password: sandi, options: { emailRedirectTo: balik() } });
  if (error) throw new Error(friendly(error));
  // Supabase menjawab "berhasil" untuk email yang sudah terdaftar (tanpa identitas) demi privasi.
  if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error("Email ini sudah terdaftar. Silakan masuk, atau pakai \"Lupa kata sandi\" bila perlu.");
  }
  return { perluKonfirmasi: !(data && data.session) };
}

export async function resendConfirmation(email) {
  const { error } = await client.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: balik() } });
  if (error) throw new Error(friendly(error));
}

// Meminta email atur ulang kata sandi. Jawabannya sengaja sama untuk email terdaftar maupun tidak.
export async function resetPassword(email) {
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: balik() });
  if (error) throw new Error(friendly(error));
}

// Mengganti kata sandi akun yang sedang masuk. Bila akun bertanda ganti_sandi, tanda itu dicabut.
export async function updatePassword(sandi) {
  const attrs = { password: sandi };
  if (perluGantiSandi()) attrs.data = { ganti_sandi: false };
  const { data, error } = await client.auth.updateUser(attrs);
  if (error) throw new Error(friendly(error));
  if (data && data.user && session) session = Object.assign({}, session, { user: data.user });
}

// Galat yang dibawa tautan email (mis. kedaluwarsa atau sudah dipakai). Panggil SEBELUM init(),
// karena pustaka Supabase menghapus bagian setelah # dari alamat.
export function galatDariUrl() {
  const h = location.hash || "";
  if (!/(^#|&)(error|error_code)=/.test(h)) return null;
  const p = new URLSearchParams(h.replace(/^#/, ""));
  const teks = (p.get("error_code") || "") + " " + (p.get("error_description") || "") + " " + (p.get("error") || "");
  if (/expired|otp_expired/i.test(teks)) return "Tautan di email sudah kedaluwarsa atau sudah dipakai. Minta tautan baru (Lupa kata sandi) atau masuk dengan kata sandimu.";
  return "Tautan di email tidak valid. Minta tautan baru.";
}

// Benar bila alamat saat ini adalah hasil klik tautan email (membawa token).
export const dariTautanEmail = () => /(^#|&)access_token=/.test(location.hash || "");
// Jenis tautan email: "recovery" (atur ulang kata sandi), "signup" (konfirmasi), dan lainnya.
export function jenisTautan() {
  const m = /(^#|&)type=([a-z_]+)/.exec(location.hash || "");
  return m ? m[2] : null;
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

// Validasi data diri (sama dengan batasan di database).
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
