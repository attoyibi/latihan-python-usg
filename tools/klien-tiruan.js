// KLIEN TIRUAN untuk menguji alur masuk dengan email dan kata sandi (bukan Supabase sungguhan).
// Dipakai oleh tools/server_uji.py yang menggantikan site/config.js dengan berkas ini.
//
// Mode TERTUTUP (bawaan; meniru kelas yang pesertanya didaftarkan dosen). Akun contoh:
//   siti@kampus.ac.id   kata sandi awal "Sandi-Awal-1" (wajib diganti saat pertama masuk; kelas SI-2024-A)
//   budi@kampus.ac.id   kata sandi "Rahasia-Budi1"      (profil terisi dengan kelas LAMA "SI-1A": diminta memilih kelas baru)
//   lupa@kampus.ac.id   kata sandi "Rahasia-Lupa1"      (tanpa profil; untuk mencoba "Lupa kata sandi")
//   kedaluwarsa@kampus.ac.id  tautan atur ulang kata sandinya dianggap kedaluwarsa
//   dosen@kampus.ac.id  kata sandi "Dosen-Uji123" (INSTRUKTUR: membuka Dashboard instruktur; ada 26 peserta contoh dengan progres)
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
    db.profiles[idDari("siti@kampus.ac.id")] = { id: idDari("siti@kampus.ac.id"), nama: "Siti Aminah", nim: "2024110012", kelas: "SI-2024-A", peran: "peserta" };
    db.profiles[idDari("budi@kampus.ac.id")] = { id: idDari("budi@kampus.ac.id"), nama: "Budi Santoso", nim: "2024110099", kelas: "SI-1A", peran: "peserta" };
    save();
  }

  // Data contoh integritas (tab "Sinyal integritas" di dashboard instruktur): perangkat, pola menulis, dan kode.
  if (!db.seed4) {
    db.seed4 = true;
    const hex = (n) => "dev-" + String(n).padStart(2, "0").repeat(12);
    const ses = (n, dev, agen, masuk) => ({ user_id: "u-seed" + n, device_id: hex(dev), pertama_dilihat: "2026-10-01T07:00:00Z", terakhir_dilihat: "2026-10-05T09:00:00Z", jumlah_masuk: masuk, agen });
    db.sesi_perangkat = [];
    for (let n = 1; n <= 26; n++) db.sesi_perangkat.push(ses(n, 10 + n, n % 3 ? "Chrome di Windows" : "Safari di iOS (ponsel)", 4 + (n % 5)));
    // seed4 ikut memakai perangkat seed3; tiga akun satu browser; laboratorium (empat akun)
    db.sesi_perangkat.push(ses(4, 13, "Chrome di Windows", 3));
    db.sesi_perangkat.push(ses(10, 40, "Firefox di Linux", 2), ses(11, 40, "Firefox di Linux", 1), ses(12, 40, "Firefox di Linux", 2));
    db.sesi_perangkat.push(ses(20, 50, "Chrome di Windows", 3), ses(21, 50, "Chrome di Windows", 3), ses(22, 50, "Chrome di Windows", 3), ses(23, 50, "Chrome di Windows", 3));
    db.perangkat_bersama = [];
    const kodeLurus = ["jumlah_boks = int(input())", "harga_satuan = int(input())", "total_kotor = jumlah_boks * harga_satuan", "if jumlah_boks >= 100:", "    potongan = 0.12", "elif jumlah_boks >= 50:", "    potongan = 0.08", "else:", "    potongan = 0.0", "total_bayar = total_kotor - (total_kotor * potongan)", 'print(f"Total tagihan: Rp{total_bayar:,.0f}")', ""].join("\n");
    const kodeSalah = ["jumlah_boks = int(input())", "harga_satuan = int(input())", "total_kotor = jumlah_boks * harga_satuan", "potongan = 0.12", "total_bayar = total_kotor - (total_kotor * potongan)", 'print(f"Total tagihan: Rp{total_bayar:,.0f}")', ""].join("\n");
    const pola = (o) => Object.assign({ kejadian: 320, ketuk: 210, diketik: 230, dihapus: 28, rasio_hapus: 0.12, besar_maks: 3, jumlah_besar: 0, linier: 0.62, lompat: 5, cps: 2.8, cps_puncak: 4.1, cv_ketuk: 0.85, jeda_pertama_s: 25, jeda_median_s: 6, aktif_s: 80, rentang_s: 260, undo: 1, jalankan: 3, jalankan_ke_kirim_s: 12, panjang_akhir: 300 }, o);
    db.percobaan = db.percobaan || [];
    let pid = 1000;
    const baris = (n, bab, lulus, kode, p, waktu) => ({ id: ++pid, user_id: "u-seed" + n, matakuliah_id: "algoritma-python", bab, jenis: "kirim", lulus, kasus_lulus: lulus ? 7 : 3, kasus_total: 7, kasus_gagal: lulus ? [] : [3, 4], kode, pola: p, rekaman: null, dibuat_pada: waktu });
    const waktu = (menit) => new Date(Date.UTC(2026, 9, 5, 7, 0, 0) + menit * 60000).toISOString();
    // peserta biasa, dengan kebiasaan mengetik sendiri-sendiri
    [2, 5, 7, 8, 9, 13].forEach((n) => [1, 2, 4].forEach((bab, i) => db.percobaan.push(baris(n, bab, true, kodeLurus, pola({ cps: 2.5 + (n % 3) * 0.4 }), waktu(n * 30 + i * 7)))));
    // seed5: satu bab ditulis lurus sekali jalan dengan ritme rata; rekamannya bisa diputar ulang
    const ketikan = kodeLurus.split("").map((c, i) => ["e", i === 0 ? 4000 : 70, i, 0, c, 1, 0]);
    const lurus = baris(5, 5, true, kodeLurus, pola({ linier: 1, rasio_hapus: 0, dihapus: 0, jalankan: 0, cv_ketuk: 0.12, cps: 14, cps_puncak: 13.5, lompat: 0, undo: 0, panjang_akhir: kodeLurus.length }), waktu(300));
    lurus.rekaman = { awal: "", e: ketikan.concat([["j", 500]]) };
    db.percobaan.push(lurus);
    db.percobaan.push(baris(7, 6, true, kodeLurus, pola({ besar_maks: 140, jumlah_besar: 1 }), waktu(310)));
    // seed8 dan seed9: percobaan salah yang persis sama; seed13 hanya mirip
    db.percobaan.push(baris(8, 4, false, kodeSalah, pola({}), waktu(320)), baris(9, 4, false, kodeSalah, pola({}), waktu(330)), baris(13, 4, false, kodeSalah.replace("0.12", "0.1"), pola({}), waktu(340)));
    // seed10 dan seed11 (satu browser, tiga akun) lulus berdekatan di tiga bab
    [1, 2, 4].forEach((bab, i) => [10, 11].forEach((n, k) => db.percobaan.push(baris(n, bab, true, kodeLurus, pola({}), waktu(400 + i * 40 + k)))));
    db.aktivitas = db.aktivitas || [];
    db.aktivitas.push({ id: 5001, user_id: "u-seed8", matakuliah_id: "algoritma-python", bab: 4, jenis: "tempel_diblokir", detail: { jumlah: 6, lokasi: "latihan" } });
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

  // Meniru PostgREST + aturan keamanan (RLS) secukupnya: peserta hanya melihat dan menulis datanya sendiri,
  // instruktur membaca semuanya. Tabel: profiles, progres, percobaan.
  const uidSaya = () => (db.session ? db.session.user.id : null);
  const instruktur = () => {
    const p = db.profiles[uidSaya()];
    return !!p && p.peran === "instruktur";
  };
  const TABEL_DATA = { progres: ["user_id", "matakuliah_id", "bab"], percobaan: null };
  const kunci = (nama, r) => TABEL_DATA[nama].map((k) => r[k]).join("|");
  const bisaBaca = (nama, r) => {
    if (nama === "perangkat_bersama") return instruktur();
    return instruktur() || (nama === "profiles" ? r.id === uidSaya() : r.user_id === uidSaya());
  };

  const query = (nama) => {
    const q = { f: {}, op: "select", rows: null, urut: [], dari: null, sampai: null, opsi: {} };
    const chain = {
      select() {
        return chain;
      },
      eq(k, v) {
        q.f[k] = v;
        return chain;
      },
      order(k) {
        q.urut.push(k);
        return chain;
      },
      range(a, b) {
        q.dari = a;
        q.sampai = b;
        return chain;
      },
      maybeSingle: async () => {
        const r = await run();
        return { data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: r.error };
      },
      single: async () => {
        const r = await run();
        return { data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: r.error };
      },
      upsert(rows, opsi) {
        q.op = "upsert";
        q.rows = rows;
        q.opsi = opsi || {};
        return chain;
      },
      insert(rows) {
        q.op = "insert";
        q.rows = rows;
        return chain;
      },
      delete() {
        q.op = "delete";
        return chain;
      },
      then(res) {
        return run().then(res);
      },
    };
    async function run() {
      if (!db.session) return { data: null, error: { code: "42501", message: "permission denied" } };
      if (nama === "profiles") {
        if (q.op === "upsert") {
          const row = q.rows;
          const dup = Object.values(db.profiles).find((p) => p.nim === row.nim && p.id !== row.id);
          if (dup) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          const old = db.profiles[row.id];
          db.profiles[row.id] = Object.assign({ peran: "peserta" }, old, row);
          save();
          return { data: db.profiles[row.id], error: null };
        }
      }
      if (nama === "sesi_perangkat" && q.op !== "select") return { data: null, error: { code: "42501", message: "permission denied for table sesi_perangkat" } };
      if (nama === "perangkat_bersama" && q.op !== "select") {
        if (!instruktur()) return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
        db.perangkat_bersama = db.perangkat_bersama || [];
        if (q.op === "delete") db.perangkat_bersama = db.perangkat_bersama.filter((r) => !Object.keys(q.f).every((k) => String(r[k]) === String(q.f[k])));
        else for (const r of Array.isArray(q.rows) ? q.rows : [q.rows]) if (!db.perangkat_bersama.some((x) => x.device_id === r.device_id)) db.perangkat_bersama.push(Object.assign({ dibuat_pada: new Date().toISOString() }, r));
        save();
        return { data: null, error: null };
      }
      if (q.op === "upsert" || q.op === "insert") {
        const daftar = Array.isArray(q.rows) ? q.rows : [q.rows];
        if (daftar.some((r) => r.user_id !== uidSaya())) return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
        const tabelData = (db[nama] = db[nama] || []);
        for (const r of daftar) {
          if (nama === "progres") {
            const k = kunci("progres", r);
            const ada = tabelData.findIndex((x) => kunci("progres", x) === k);
            const baru = Object.assign({ jumlah_jalankan: 0, jumlah_kirim: 0, diperbarui_pada: new Date().toISOString() }, ada >= 0 ? tabelData[ada] : {}, r, { diperbarui_pada: new Date().toISOString() });
            if (ada >= 0) tabelData[ada] = baru;
            else tabelData.push(baru);
          } else {
            tabelData.push(Object.assign({ id: tabelData.length + 1 }, r));
          }
        }
        save();
        return { data: null, error: null };
      }
      let baris = nama === "profiles" ? Object.values(db.profiles) : db[nama] || [];
      baris = baris.filter((r) => bisaBaca(nama, r) && Object.keys(q.f).every((k) => String(r[k]) === String(q.f[k])));
      for (const k of q.urut.slice().reverse()) baris = baris.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0));
      if (q.dari !== null) baris = baris.slice(q.dari, q.sampai + 1);
      return { data: baris.map((r) => Object.assign({}, r)), error: null };
    }
    return chain;
  };

  // Data contoh untuk mencoba dashboard instruktur: akun dosen dan 26 peserta dengan progres beragam.
  // Aturan jalur: "langsung" = lulus tanpa petunjuk, "bantuan" = memakai petunjuk.
  if (!db.seed3) {
    db.seed3 = true;
    db.users["dosen@kampus.ac.id"] = { id: idDari("dosen@kampus.ac.id"), password: "Dosen-Uji123", confirmed: true, meta: { nama: "Dosen Uji" } };
    db.profiles[idDari("dosen@kampus.ac.id")] = { id: idDari("dosen@kampus.ac.id"), nama: "Dosen Uji", nim: "DOSEN001", kelas: "SI-2024-A", peran: "instruktur" };
    const nama = ["Ahmad Fauzi", "Bella Putri", "Candra Wijaya", "Dewi Lestari", "Eko Prasetyo", "Fitri Handayani", "Gilang Ramadhan", "Hana Safira", "Indra Gunawan", "Jihan Aulia", "Kevin Pratama", "Lutfi Hakim", "Maya Sari", "Nanda Putra", "Oktavia Rahma", "Putra Mahendra", "Qonita Zahra", "Rizky Maulana", "Salsabila Nur", "Teguh Santoso", "Ulfa Maharani", "Vino Aditya", "Wulan Dari", "Yusuf Hidayat", "Zahra Amelia", "Zainal Arifin"];
    const kelas = ["SI-2024-A", "SI-2024-B", "SI-2025-A", "SI-2025-B"];
    const babKode = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    db.progres = db.progres || [];
    nama.forEach((n, i) => {
      const id = "u-seed" + (i + 1);
      db.profiles[id] = { id, nama: n, nim: "20241100" + String(i + 1).padStart(2, "0"), kelas: kelas[i % 4], peran: "peserta" };
      const [, a, r] = /SI-(\d{4})-([A-Z])/.exec(kelas[i % 4]);
      db.profiles[id].prodi = "SI";
      db.profiles[id].angkatan = Number(a);
      db.profiles[id].rombel = r;
      const maju = i % 7 === 0 ? 0 : 2 + ((i * 5) % 11); // sebagian belum mulai
      babKode.slice(0, maju).forEach((bab, k) => {
        const selesai = k < maju - 1 || i % 3 !== 0;
        const sulit = bab === 8 || bab === 12;
        const kirim = selesai ? 1 + ((i + bab) % 3) + (sulit ? 2 : 0) : 5 + (i % 4);
        db.progres.push({ user_id: id, matakuliah_id: "algoritma-python", bab, status: selesai ? "selesai" : "sedang", jumlah_jalankan: kirim * 3, jumlah_kirim: kirim, pertama_dibuka: "2026-10-01T08:00:00Z", lulus_pada: selesai ? "2026-10-02T09:00:00Z" : null, jalur: selesai ? ((i + bab) % 4 === 0 || sulit ? "bantuan" : "langsung") : null, diperbarui_pada: "2026-10-0" + (1 + ((i + bab) % 5)) + "T10:" + String((i * 7) % 60).padStart(2, "0") + ":00Z" });
      });
    });
    save();
  }

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
      rpc: async (nama, args) => {
        if (nama !== "catat_perangkat") return { data: null, error: { code: "42883", message: "function does not exist" } };
        if (!db.session) return { data: null, error: { code: "42501", message: "harus masuk dulu" } };
        const uid = uidSaya();
        if (!db.profiles[uid]) return { data: null, error: null };
        if (!args.p_device || args.p_device.length < 8) return { data: null, error: { code: "23514", message: "check constraint" } };
        db.sesi_perangkat = db.sesi_perangkat || [];
        const ada = db.sesi_perangkat.find((x) => x.user_id === uid && x.device_id === args.p_device);
        if (ada) {
          ada.terakhir_dilihat = new Date().toISOString();
          ada.jumlah_masuk++;
        } else db.sesi_perangkat.push({ user_id: uid, device_id: args.p_device, pertama_dilihat: new Date().toISOString(), terakhir_dilihat: new Date().toISOString(), jumlah_masuk: 1, agen: args.p_agen });
        save();
        return { data: null, error: null };
      },
      from: (nama) => query(nama),
    },
  };

  if (db.pending) document.addEventListener("DOMContentLoaded", tampilkanKotakEmail);
})();
