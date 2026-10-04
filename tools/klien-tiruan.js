// KLIEN TIRUAN untuk menguji alur masuk dengan email dan kata sandi (bukan Supabase sungguhan).
// Dipakai oleh tools/server_uji.py yang menggantikan site/config.js dengan berkas ini.
//
// Mode TERTUTUP (bawaan; meniru kelas yang pesertanya didaftarkan dosen). Akun contoh:
//   siti@kampus.ac.id   kata sandi awal "Sandi-Awal-1" (wajib diganti saat pertama masuk; profil sudah terisi)
//   budi@kampus.ac.id   kata sandi "Rahasia-Budi1"      (profil sudah terisi, langsung masuk)
//   lupa@kampus.ac.id   kata sandi "Rahasia-Lupa1"      (tanpa profil; untuk mencoba "Lupa kata sandi")
//   kedaluwarsa@kampus.ac.id  tautan atur ulang kata sandinya dianggap kedaluwarsa
// Tambahkan ?terbuka=1 di alamat untuk mode pendaftaran mandiri: Daftar tersedia dan butuh konfirmasi email.
//
// Email tiruan: setiap kali situs "mengirim email" (konfirmasi daftar atau atur ulang kata sandi), kotak kuning
// "Email tiruan" muncul di pojok kanan bawah. Tombolnya meniru klik tautan di email.
//   * alamat email berisi kata "limit" -> pengiriman email ditolak (batas pengiriman)
(function () {
  const KEY = "fake_db";
  const db = JSON.parse(localStorage.getItem(KEY) || "null") || { session: null, users: null, profiles: {}, pending: null };
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const listeners = [];
  const idDari = (email) => "u-" + email.replace(/\W/g, "_");
  const mkSession = (email) => ({ user: { id: idDari(email), email, user_metadata: Object.assign({}, db.users[email].meta) } });
  const setSession = (s, ev) => {
    db.session = s;
    save();
    listeners.forEach((l) => l(ev, s));
  };
  const TERBUKA = /[?&]terbuka=1/.test(location.search);

  if (!db.users) {
    db.users = {
      "siti@kampus.ac.id": { id: idDari("siti@kampus.ac.id"), password: "Sandi-Awal-1", confirmed: true, meta: { nama: "Siti Aminah", ganti_sandi: true } },
      "budi@kampus.ac.id": { id: idDari("budi@kampus.ac.id"), password: "Rahasia-Budi1", confirmed: true, meta: { nama: "Budi Santoso" } },
      "lupa@kampus.ac.id": { id: idDari("lupa@kampus.ac.id"), password: "Rahasia-Lupa1", confirmed: true, meta: {} },
      "kedaluwarsa@kampus.ac.id": { id: idDari("kedaluwarsa@kampus.ac.id"), password: "Rahasia-Lama1", confirmed: true, meta: {} },
    };
    db.profiles[idDari("siti@kampus.ac.id")] = { id: idDari("siti@kampus.ac.id"), nama: "Siti Aminah", nim: "2024110012", kelas: "SI-1A", peran: "peserta" };
    db.profiles[idDari("budi@kampus.ac.id")] = { id: idDari("budi@kampus.ac.id"), nama: "Budi Santoso", nim: "2024110099", kelas: "SI-1A", peran: "peserta" };
    save();
  }

  function klikTautan() {
    const p = db.pending;
    if (!p) return;
    db.pending = null;
    const dasar = location.pathname + location.search;
    if (p.tipe === "pemulihan") {
      if (p.email.indexOf("kedaluwarsa") >= 0) {
        save();
        location.href = location.pathname + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
        location.reload();
        return;
      }
      db.session = mkSession(p.email);
      save();
      location.href = location.pathname + "#access_token=tiruan&token_type=bearer&type=recovery";
      location.reload();
      return;
    }
    // konfirmasi pendaftaran: akun aktif dan langsung masuk
    db.users[p.email].confirmed = true;
    db.session = mkSession(p.email);
    save();
    location.href = dasar;
    location.reload();
  }

  function tampilkanKotakEmail() {
    if (document.getElementById("kotak-email-tiruan")) return;
    const b = document.createElement("div");
    b.id = "kotak-email-tiruan";
    b.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:99;max-width:290px;padding:12px;border:2px dashed #b86e00;border-radius:10px;background:#fff8e6;color:#3d2a00;font:13px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.2)";
    const judul = db.pending.tipe === "pemulihan" ? "tautan atur ulang kata sandi" : "email konfirmasi pendaftaran";
    b.innerHTML = "<strong>Email tiruan</strong><br>Email berisi " + judul + " dikirim ke <b></b>.<br><small>(hanya di server uji)</small><br>";
    b.querySelector("b").textContent = db.pending.email;
    const tombol = document.createElement("button");
    tombol.textContent = "Klik tautan di email";
    tombol.style.cssText = "margin-top:8px;padding:6px 10px;cursor:pointer";
    tombol.onclick = klikTautan;
    b.append(tombol);
    document.body.append(b);
  }

  window.__fake = { db, setSession, klikTautan };

  const batasEmail = (email) => (email.indexOf("limit") >= 0 ? { message: "email rate limit exceeded", code: "over_email_send_rate_limit" } : null);

  const query = () => {
    const q = { _f: {}, _op: "select", _row: null };
    const chain = {
      select() {
        return chain;
      },
      eq(k, v) {
        q._f[k] = v;
        return chain;
      },
      maybeSingle: async () => ({ data: db.profiles[q._f.id] || null, error: null }),
      single: async () => run(),
      upsert(row) {
        q._op = "upsert";
        q._row = row;
        return chain;
      },
      then(res) {
        return run().then(res);
      },
    };
    async function run() {
      if (q._op === "upsert") {
        const dup = Object.values(db.profiles).find((p) => p.nim === q._row.nim && p.id !== q._row.id);
        if (dup) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        const old = db.profiles[q._row.id];
        db.profiles[q._row.id] = Object.assign({ peran: "peserta" }, old, q._row);
        save();
        return { data: db.profiles[q._row.id], error: null };
      }
      return { data: db.profiles[q._f.id] || null, error: null };
    }
    return chain;
  };

  window.APP_CONFIG = {
    PENDAFTARAN: TERBUKA ? "buka" : "tutup",
    client: {
      auth: {
        getSession: async () => ({ data: { session: db.session } }),
        onAuthStateChange: (cb) => {
          listeners.push(cb);
          return { data: { subscription: {} } };
        },
        signInWithPassword: async ({ email, password }) => {
          const u = db.users[email];
          if (!u || u.password !== password) return { data: {}, error: { message: "Invalid login credentials", code: "invalid_credentials" } };
          if (!u.confirmed) return { data: {}, error: { message: "Email not confirmed", code: "email_not_confirmed" } };
          setSession(mkSession(email), "SIGNED_IN");
          return { data: { session: db.session }, error: null };
        },
        signUp: async ({ email, password }) => {
          if (!TERBUKA) return { data: { user: null, session: null }, error: { message: "Signups not allowed for this instance", code: "signup_disabled" } };
          const b = batasEmail(email);
          if (b) return { data: {}, error: b };
          if (db.users[email]) return { data: { user: { id: db.users[email].id, identities: [] }, session: null }, error: null };
          if (password.length < 6) return { data: {}, error: { message: "Password should be at least 6 characters.", code: "weak_password" } };
          db.users[email] = { id: idDari(email), password, confirmed: false, meta: {} };
          db.pending = { tipe: "konfirmasi", email };
          save();
          tampilkanKotakEmail();
          return { data: { user: { id: idDari(email), identities: [{}] }, session: null }, error: null };
        },
        resend: async ({ email }) => {
          const b = batasEmail(email);
          if (b) return { error: b };
          if (db.users[email] && !db.users[email].confirmed) {
            db.pending = { tipe: "konfirmasi", email };
            save();
            tampilkanKotakEmail();
          }
          return { error: null };
        },
        resetPasswordForEmail: async (email) => {
          const b = batasEmail(email);
          if (b) return { error: b };
          // Supabase menjawab sukses untuk email yang tidak terdaftar juga (tanpa mengirim apa pun).
          if (db.users[email]) {
            db.pending = { tipe: "pemulihan", email };
            save();
            tampilkanKotakEmail();
          }
          return { error: null };
        },
        updateUser: async ({ password, data }) => {
          if (!db.session) return { error: { message: "Auth session missing!" } };
          const email = db.session.user.email;
          const u = db.users[email];
          if (password !== undefined) {
            if (password === u.password) return { error: { message: "New password should be different from the old password.", code: "same_password" } };
            if (password.length < 6) return { error: { message: "Password should be at least 6 characters.", code: "weak_password" } };
            u.password = password;
          }
          if (data) Object.assign(u.meta, data);
          db.session = mkSession(email);
          save();
          listeners.forEach((l) => l("USER_UPDATED", db.session));
          return { data: { user: db.session.user }, error: null };
        },
        signOut: async () => {
          setSession(null, "SIGNED_OUT");
          return { error: null };
        },
      },
      from: () => query(),
    },
  };

  if (db.pending) document.addEventListener("DOMContentLoaded", tampilkanKotakEmail);
})();
