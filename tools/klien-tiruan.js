// KLIEN TIRUAN untuk uji alur masuk dan data awal (bukan Supabase sungguhan).
(function () {
  const KEY = "fake_db";
  const db = JSON.parse(localStorage.getItem(KEY) || '{"session":null,"profiles":{},"codes":{}}');
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const listeners = [];
  const mkSession = (email) => ({ user: { id: "u-" + email.replace(/\W/g, "_"), email } });
  const setSession = (s, ev) => { db.session = s; save(); listeners.forEach((l) => l(ev, s)); };
  window.__fake = { db, setSession };
  const query = (table) => {
    const q = { _f: {}, _op: "select", _row: null };
    const chain = {
      select() { return chain; },
      eq(k, v) { q._f[k] = v; return chain; },
      maybeSingle: async () => ({ data: db.profiles[q._f.id] || null, error: null }),
      single: async () => run(),
      upsert(row) { q._op = "upsert"; q._row = row; return chain; },
      then(res) { return run().then(res); },
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
        onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: {} } }; },
        signInWithOtp: async ({ email }) => {
          if (email.indexOf("limit") >= 0) return { error: { message: "email rate limit exceeded" } };
          db.codes[email] = "123456"; save(); return { error: null };
        },
        verifyOtp: async ({ email, token }) => {
          if (db.codes[email] !== token) return { error: { message: "Token has expired or is invalid" } };
          setSession(mkSession(email), "SIGNED_IN"); return { error: null };
        },
        signOut: async () => { setSession(null, "SIGNED_OUT"); return { error: null }; },
      },
      from: (t) => query(t),
    },
  };
})();
