// KLIEN TIRUAN untuk menguji alur masuk lewat tautan email (bukan Supabase sungguhan).
// Dipakai oleh tools/server_uji.py yang menggantikan site/config.js dengan berkas ini.
//
// Cara kerja: saat peserta meminta tautan masuk, kotak "Email tiruan" muncul di pojok kanan bawah.
// Tombol di dalamnya meniru klik tautan di email: sesi disimpan lalu halaman dimuat ulang ke alamat
// dasar tanpa #, persis seperti kembali dari tautan Supabase asli.
//   * email berisi kata "kedaluwarsa" -> tautannya dianggap kedaluwarsa/sudah dipakai
//   * email berisi kata "limit"       -> pengiriman ditolak (batas pengiriman email)
(function () {
  const KEY = "fake_db";
  const db = JSON.parse(localStorage.getItem(KEY) || '{"session":null,"profiles":{},"pending":null}');
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const listeners = [];
  const mkSession = (email) => ({ user: { id: "u-" + email.replace(/\W/g, "_"), email } });
  const setSession = (s, ev) => {
    db.session = s;
    save();
    listeners.forEach((l) => l(ev, s));
  };

  function klikTautan() {
    const email = db.pending;
    if (!email) return;
    db.pending = null;
    if (email.indexOf("kedaluwarsa") >= 0) {
      save();
      location.href = location.pathname + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
      location.reload();
      return;
    }
    db.session = mkSession(email);
    save();
    location.href = location.pathname + location.search;
    location.reload();
  }

  function tampilkanKotakEmail() {
    if (document.getElementById("kotak-email-tiruan")) return;
    const b = document.createElement("div");
    b.id = "kotak-email-tiruan";
    b.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:99;max-width:280px;padding:12px;border:2px dashed #b86e00;border-radius:10px;background:#fff8e6;color:#3d2a00;font:13px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.2)";
    b.innerHTML = "<strong>Email tiruan</strong><br>Tautan masuk dikirim ke <b></b>.<br><small>(hanya di server uji)</small><br>";
    b.querySelector("b").textContent = db.pending;
    const tombol = document.createElement("button");
    tombol.textContent = "Klik tautan di email";
    tombol.style.cssText = "margin-top:8px;padding:6px 10px;cursor:pointer";
    tombol.onclick = klikTautan;
    b.append(tombol);
    document.addEventListener("DOMContentLoaded", () => document.body.append(b));
    if (document.body) document.body.append(b);
  }

  window.__fake = { db, setSession, klikTautan };

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
    client: {
      auth: {
        getSession: async () => ({ data: { session: db.session } }),
        onAuthStateChange: (cb) => {
          listeners.push(cb);
          return { data: { subscription: {} } };
        },
        signInWithOtp: async ({ email }) => {
          if (email.indexOf("limit") >= 0) return { error: { message: "email rate limit exceeded" } };
          db.pending = email;
          save();
          tampilkanKotakEmail();
          return { error: null };
        },
        signOut: async () => {
          setSession(null, "SIGNED_OUT");
          return { error: null };
        },
      },
      from: () => query(),
    },
  };

  if (db.pending) tampilkanKotakEmail();
})();
