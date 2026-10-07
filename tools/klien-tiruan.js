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
  // ?tanpa0007=1: meniru database yang belum menjalankan migrasi 0007 (kolom hasil, galat, dan persetujuan riset belum ada).
  const TANPA_0007 = /[?&]tanpa0007=1/.test(location.search);
  const TERBUKA = /[?&]terbuka=1/.test(location.search);
  // ?tanpakonfirmasi=1: meniru Supabase dengan "Confirm email" dimatikan (pendaftaran langsung masuk, tanpa email). Menyertakan terbuka=1.
  const TANPA_KONFIRMASI = /[?&]tanpakonfirmasi=1/.test(location.search);

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

  // Laporan contoh (tab "Laporan" dashboard): satu ditulis wajar, satu isinya hampir tidak diketik, satu masih pendek.
  if (!db.seed5) {
    db.seed5 = true;
    const bagian = (n) => "Kalimat jawaban peserta yang ditulis sendiri dengan susah payah. ".repeat(n).trim();
    db.laporan = db.laporan || [];
    const lap = (id, n, bab, jawaban, ketikan, tempel, durasi) => db.laporan.push({ id: "lap-" + id, user_id: "u-seed" + n, matakuliah_id: "algoritma-python", bab, jawaban, jumlah_ketikan: ketikan, percobaan_tempel: tempel, durasi_menulis_detik: durasi, kode_verifikasi: "DEMO" + String(id).padStart(4, "0"), status: "draf", dikumpulkan_pada: "2026-10-06T09:00:00Z", dibuat_pada: "2026-10-05T09:00:00Z", diperbarui_pada: "2026-10-06T09:00:00Z" });
    lap(1, 2, 4, { tujuan: bagian(1), konsep: bagian(2), langkah: bagian(2), kendala: bagian(1), kesimpulan: bagian(1) }, { tujuan: 66, konsep: 130, langkah: 128, kendala: 64, kesimpulan: 60 }, 0, 780);
    lap(2, 5, 5, { tujuan: bagian(1), konsep: bagian(2), langkah: bagian(2), kendala: bagian(1), kesimpulan: bagian(1) }, { tujuan: 4, konsep: 6, langkah: 3 }, 6, 40);
    lap(3, 7, 6, { tujuan: "Belajar list." }, { tujuan: 13 }, 0, 25);
    save();
  }

  // Data contoh kehadiran (tab "Kehadiran" dashboard): jadwal empat kelas, pengerjaan, dan sesi belajar selama tiga pekan.
  // Coba dengan ?sekarang=2026-10-06T01:47:00Z (Selasa 08:47 WIB) agar hasilnya sama dengan rancangan di dokumentasi.
  if (!db.seed6) {
    db.seed6 = true;
    const kelasSeed = ["SI-2024-A", "SI-2024-B", "SI-2025-A", "SI-2025-B"];
    const jam = [["01:00", "03:00"], ["06:00", "08:00"], ["03:00", "05:00"], ["02:00", "04:00"]]; // UTC (WIB dikurangi 7 jam)
    const pertama = ["2026-09-16", "2026-09-17", "2026-09-15", "2026-09-18"];
    db.jadwal_kelas = [];
    kelasSeed.forEach((kelas, k) => {
      for (let n = 1; n <= 8; n++) {
        const geser = (n - 1) * 7 * 86400000;
        const mulai = Date.parse(pertama[k] + "T" + jam[k][0] + ":00Z") + geser;
        const selesai = Date.parse(pertama[k] + "T" + jam[k][1] + ":00Z") + geser;
        const libur = (kelas === "SI-2024-B" && n === 4) || (kelas === "SI-2025-B" && n === 3);
        const dipindah = kelas === "SI-2025-A" && n === 5;
        db.jadwal_kelas.push({ matakuliah_id: "algoritma-python", kelas, pertemuan: n, mulai: new Date(mulai + (dipindah ? 86400000 : 0)).toISOString(), selesai: new Date(selesai + (dipindah ? 86400000 : 0)).toISOString(), libur, dipindah, catatan: null });
      }
    });
    db.jadwal_riwayat = [
      { id: 1, matakuliah_id: "algoritma-python", kelas: "SI-2024-B", oleh: "u-dosen_kampus_ac_id", ringkasan: "P4 ditandai libur", dibuat_pada: "2026-10-05T09:20:00Z" },
      { id: 2, matakuliah_id: "algoritma-python", kelas: "SI-2025-A", oleh: "u-dosen_kampus_ac_id", ringkasan: "P5 dipindah dari Sel 13 Okt ke Rab 14 Okt", dibuat_pada: "2026-10-03T02:00:00Z" },
    ];
    db.koreksi_kehadiran = [];
    let acak = 12345;
    const rnd = () => ((acak = (acak * 1103515245 + 12345) % 2147483648) / 2147483648);
    const kelasHari = [3, 4, 2, 5]; // Rab, Kam, Sel, Jum (hari dalam minggu, 0 = Minggu)
    db.percobaan = db.percobaan || [];
    db.sesi_belajar = [];
    let pid = 2000;
    const wib = (tgl, jamWib) => Date.parse(tgl + "T00:00:00Z") + (jamWib - 7) * 3600000;
    for (let i = 1; i <= 26; i++) {
      const uid = "u-seed" + i;
      const q = [0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3][(i * 3) % 9];
      const k = (i - 1) % 4;
      for (let d = 0; d < 23; d++) {
        const tgl = new Date(Date.parse("2026-09-14T00:00:00Z") + d * 86400000);
        const tglStr = tgl.toISOString().slice(0, 10);
        const dow = tgl.getUTCDay();
        const dekat = [1, 2, 3].some((x) => (dow + x) % 7 === kelasHari[k]);
        const p = dekat ? q * 0.75 : q * 0.18;
        const aktif = rnd() < p;
        const baca = !aktif && rnd() < 0.12;
        if (!aktif && !baca) continue;
        const mulaiMs = wib(tglStr, rnd() < 0.6 ? 19 + rnd() * 3 : 8 + rnd() * 4);
        const bab = 1 + Math.floor(d / 4);
        const dur = (12 + Math.floor(rnd() * 55)) * 60000;
        if (mulaiMs >= Date.parse("2026-09-24T00:00:00Z")) {
          db.sesi_belajar.push({ id: "ses-" + i + "-" + d, user_id: uid, matakuliah_id: "algoritma-python", mulai: new Date(mulaiMs).toISOString(), terakhir: new Date(mulaiMs + dur).toISOString(), aktif_detik: Math.round((dur / 1000) * (0.55 + rnd() * 0.35)), denyut: Math.round(dur / 30000), bab_dibuka: [bab] });
        }
        if (aktif) {
          const kali = 1 + Math.floor(rnd() * 3);
          for (let x = 0; x < kali; x++) {
            const t = mulaiMs + (x + 1) * 4 * 60000;
            const lulus = rnd() < 0.55 || x === kali - 1;
            const skew = rnd() < 0.05 ? -3 * 86400000 : 0; // sebagian kecil jam perangkat menyimpang
            db.percobaan.push({ id: ++pid, user_id: uid, matakuliah_id: "algoritma-python", bab, jenis: "kirim", lulus, kasus_lulus: lulus ? 7 : 3, kasus_total: 7, kasus_gagal: [], kode: "# latihan " + i + "-" + d + "-" + x, pola: null, rekaman: null, dibuat_pada: new Date(t + skew).toISOString(), diterima_pada: new Date(t + 3000).toISOString() });
          }
        }
      }
      // sesi di dalam jam kuliah pada pertemuan yang sudah lewat (hanya setelah pencatatan sesi berjalan)
      db.jadwal_kelas.filter((j) => j.kelas === kelasSeed[k] && !j.libur && Date.parse(j.mulai) >= Date.parse("2026-09-24T00:00:00Z") && Date.parse(j.selesai) < Date.parse("2026-10-06T01:47:00Z")).forEach((j) => {
        if (rnd() < q * 0.85) {
          const mulai = Date.parse(j.mulai) + Math.floor(rnd() * 20) * 60000;
          const dur = (20 + Math.floor(rnd() * 70)) * 60000;
          db.sesi_belajar.push({ id: "kls-" + i + "-" + j.pertemuan, user_id: uid, matakuliah_id: "algoritma-python", mulai: new Date(mulai).toISOString(), terakhir: new Date(mulai + dur).toISOString(), aktif_detik: Math.round((dur / 1000) * 0.7), denyut: Math.round(dur / 30000), bab_dibuka: [j.pertemuan] });
        }
      });
    }
    save();
  }

  // Data contoh Jejak peserta dan Riset: riwayat Jalankan dan Kirim lengkap dengan hasil, galat, dan rekaman menulis,
  // serta persetujuan penelitian sebagian peserta.
  if (!db.seed7) {
    db.seed7 = true;
    let acak = 987654;
    const rnd = () => ((acak = (acak * 1103515245 + 12345) % 2147483648) / 2147483648);
    const PROGRAM = {
      1: ['nama = input()', 'print("Halo, " + nama)'],
      4: ["jumlah = int(input())", "if jumlah >= 100:", "    diskon = 0.12", "elif jumlah >= 50:", "    diskon = 0.08", "else:", "    diskon = 0", "print(jumlah * diskon)"],
      5: ["total = 0", "for i in range(1, 6):", "    total += i", "print(total)"],
    };
    const GALAT = [["SyntaxError", "expected ':'"], ["NameError", "name 'jumlh' is not defined"], ["IndentationError", "expected an indented block"], ["TypeError", "can only concatenate str"]];
    db.percobaan = db.percobaan || [];
    let pid = 6000;
    for (let i = 1; i <= 26; i++) {
      const uid = "u-seed" + i;
      const q = [0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3][(i * 3) % 9];
      if (i % 9 === 0) continue; // sebagian peserta belum pernah mengerjakan apa pun
      const babs = [1, 4, 5].slice(0, 1 + Math.round(q * 2.2));
      let waktu = Date.parse("2026-09-29T12:00:00Z") + (i % 6) * 86400000 + Math.floor(rnd() * 8) * 3600000;
      for (const bab of babs) {
        const baris = PROGRAM[bab];
        let kode = "";
        let dasar = ""; // kode saat Kirim terakhir (awal rantai rekaman)
        let ops = []; // peristiwa sejak Kirim terakhir
        let jalan = 0;
        let hint = 0;
        let babLulus = false;
        for (let langkah = 0; langkah <= baris.length + 3 && !babLulus; langkah++) {
          const tambah = langkah < baris.length ? baris[langkah] + "\n" : "";
          if (tambah) {
            const salah = rnd() < (1 - q) * 0.6 && langkah > 0;
            const teks = salah ? tambah.replace(/[a-z]/, "x") : tambah;
            ops.push(["e", 2000 + Math.floor(rnd() * 20000), kode.length, 0, teks, teks.length, 3000 + Math.floor(rnd() * 15000)]);
            kode += teks;
            if (salah && rnd() < 0.8) {
              ops.push(["e", 4000, kode.length - teks.length, teks.length, tambah, tambah.length, 2000]);
              kode = kode.slice(0, kode.length - teks.length) + tambah;
            }
          }
          if (rnd() < 0.25 && hint < 3) hint++;
          waktu += (2 + Math.floor(rnd() * 25)) * 60000;
          const kirim = langkah >= baris.length - 1 && rnd() < 0.7;
          const salahKode = rnd() < (1 - q) * 0.5;
          const polaDasar = { cps: Math.round((1.5 + rnd() * 3) * 10) / 10, cps_puncak: Math.round((4 + rnd() * 3) * 10) / 10, rasio_hapus: Math.round(rnd() * (0.15 + (1 - q) * 0.4) * 100) / 100, linier: Math.round((0.4 + q * 0.5 - rnd() * 0.2) * 100) / 100, lompat: Math.floor(rnd() * (3 + (1 - q) * 8)), panjang_akhir: kode.length };
          if (!kirim) {
            jalan++;
            ops.push(["j", 500]);
            const g = salahKode ? GALAT[Math.floor(rnd() * GALAT.length)] : null;
            const rek = JSON.stringify({ awal: dasar, e: ops }).length < 20000 ? { awal: dasar, e: ops.slice() } : null;
            db.percobaan.push({ id: ++pid, user_id: uid, matakuliah_id: "algoritma-python", bab, jenis: "jalankan", lulus: null, kasus_lulus: null, kasus_total: null, kasus_gagal: null, kode, hasil: g ? "galat" : "jalan", galat_jenis: g ? g[0] : null, galat_pesan: g ? g[1] : null, cocok_contoh: g ? null : rnd() < q, petunjuk: hint, pola: Object.assign({ jalankan: jalan }, polaDasar), rekaman: rek, dibuat_pada: new Date(waktu).toISOString(), diterima_pada: new Date(waktu + 2000).toISOString() });
          } else {
            const lulus = !salahKode && langkah >= baris.length - 1;
            babLulus = lulus;
            const total = 7;
            const benar = lulus ? total : 2 + Math.floor(rnd() * 4);
            db.percobaan.push({ id: ++pid, user_id: uid, matakuliah_id: "algoritma-python", bab, jenis: "kirim", lulus, kasus_lulus: benar, kasus_total: total, kasus_gagal: lulus ? [] : [total], kode, hasil: lulus ? "lulus" : "gagal", galat_jenis: null, galat_pesan: null, cocok_contoh: null, petunjuk: hint, pola: Object.assign({ jalankan: jalan }, polaDasar), rekaman: { awal: dasar, e: ops.slice() }, dibuat_pada: new Date(waktu).toISOString(), diterima_pada: new Date(waktu + 2000).toISOString() });
            dasar = kode;
            ops = [];
            jalan = 0;
          }
        }
        waktu += 3600000;
      }
    }
    // persetujuan penelitian: sebagian setuju, sebagian menolak, sebagian belum menjawab
    for (let i = 1; i <= 26; i++) {
      const p = db.profiles["u-seed" + i];
      if (!p) continue;
      if (i % 3 !== 0 && i % 7 !== 0) {
        p.riset_setuju = true;
        p.kode_riset = "R-" + (0x1000a000 + i * 7919).toString(16).slice(-8);
        p.riset_setuju_pada = "2026-09-30T02:00:00Z";
      } else if (i % 7 === 0) {
        p.riset_setuju = false;
        p.riset_setuju_pada = "2026-09-30T02:00:00Z";
      } else p.riset_setuju = null;
    }
    db.riset_ekspor_log = [];
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
  const TABEL_DATA = { progres: ["user_id", "matakuliah_id", "bab"], laporan: ["user_id", "matakuliah_id", "bab"], percobaan: null };
  const kunci = (nama, r) => TABEL_DATA[nama].map((k) => r[k]).join("|");
  const bisaBaca = (nama, r) => {
    if (nama === "perangkat_bersama" || nama === "penilaian_laporan" || ["jadwal_kelas", "jadwal_riwayat", "koreksi_kehadiran", "riset_ekspor_log"].includes(nama)) return instruktur();
    return instruktur() || (nama === "profiles" ? r.id === uidSaya() : r.user_id === uidSaya());
  };

  const query = (nama) => {
    const q = { f: {}, op: "select", rows: null, urut: [], dari: null, sampai: null, opsi: {} };
    const chain = {
      select(kolom) {
        q.kolom = kolom || "*";
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
      gt(k, v) {
        (q.gt = q.gt || []).push([k, v]);
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
      update(vals) {
        q.op = "update";
        q.vals = vals;
        return chain;
      },
      then(res) {
        return run().then(res);
      },
    };
    async function run() {
      if (!db.session) return { data: null, error: { code: "42501", message: "permission denied" } };
      if (TANPA_0007) {
        const kolomHilang = (c) => ({ data: null, error: { code: "42703", message: "column " + c + " does not exist" } });
        if (nama === "profiles" && ((q.op === "select" && /riset/.test(q.kolom || "")) || (q.op === "update" && "riset_setuju" in (q.vals || {})))) return kolomHilang("profiles.riset_setuju");
        if (nama === "percobaan" && q.op === "select" && /hasil|galat|petunjuk|cocok/.test(q.kolom || "")) return kolomHilang("percobaan.hasil");
        if (nama === "percobaan" && q.op === "insert" && (Array.isArray(q.rows) ? q.rows : [q.rows]).some((r) => "hasil" in r)) return { data: null, error: { code: "PGRST204", message: "Could not find the 'hasil' column of 'percobaan' in the schema cache" } };
      }
      if (nama === "profiles" && q.op === "update") {
        const sasaran = Object.values(db.profiles).filter((p) => Object.keys(q.f).every((k) => String(p[k]) === String(q.f[k])) && (p.id === uidSaya() || instruktur()));
        for (const p of sasaran) {
          const lama = p.riset_setuju;
          Object.assign(p, q.vals);
          if (!instruktur()) p.kode_riset = p.kode_riset || null;
          if (q.vals.riset_setuju !== undefined && q.vals.riset_setuju !== lama) p.riset_setuju_pada = new Date().toISOString();
          if (p.riset_setuju === true && !p.kode_riset) p.kode_riset = "R-" + Math.random().toString(16).slice(2, 10).padEnd(8, "0");
        }
        save();
        return { data: null, error: null };
      }
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
      if (nama === "penilaian_laporan" && q.op !== "select") {
        if (!instruktur()) return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
        db.penilaian_laporan = db.penilaian_laporan || [];
        for (const r of Array.isArray(q.rows) ? q.rows : [q.rows]) {
          const ada = db.penilaian_laporan.findIndex((x) => x.laporan_id === r.laporan_id);
          if (ada >= 0) db.penilaian_laporan[ada] = Object.assign({}, db.penilaian_laporan[ada], r);
          else db.penilaian_laporan.push(r);
        }
        save();
        return { data: null, error: null };
      }
      if (nama === "sesi_belajar" && q.op !== "select") return { data: null, error: { code: "42501", message: "permission denied for table sesi_belajar" } };
      if (["jadwal_kelas", "jadwal_riwayat", "koreksi_kehadiran", "riset_ekspor_log"].includes(nama) && q.op !== "select") {
        if (!instruktur()) return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
        const tabel = (db[nama] = db[nama] || []);
        const kunciTabel = { jadwal_kelas: ["matakuliah_id", "kelas", "pertemuan"], koreksi_kehadiran: ["matakuliah_id", "user_id", "pertemuan"] }[nama];
        if (q.op === "delete") {
          db[nama] = tabel.filter((r) => !(Object.keys(q.f).every((k) => String(r[k]) === String(q.f[k])) && (q.gt || []).every(([k, v]) => Number(r[k]) > Number(v))));
          save();
          return { data: null, error: null };
        }
        for (const r of Array.isArray(q.rows) ? q.rows : [q.rows]) {
          if (nama === "jadwal_kelas" && !(Date.parse(r.selesai) > Date.parse(r.mulai))) return { data: null, error: { code: "23514", message: "check constraint jadwal_kelas" } };
          if (nama === "koreksi_kehadiran" && !["hadir", "tidak"].includes(r.status)) return { data: null, error: { code: "23514", message: "check constraint koreksi" } };
          if (kunciTabel) {
            const i = tabel.findIndex((x) => kunciTabel.every((k) => String(x[k]) === String(r[k])));
            if (i >= 0) tabel[i] = Object.assign({}, tabel[i], r);
            else tabel.push(Object.assign({}, r));
          } else tabel.push(Object.assign({ id: tabel.length + 1, dibuat_pada: new Date().toISOString() }, r));
        }
        save();
        return { data: null, error: null };
      }
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
          if (nama === "progres" || nama === "laporan") {
            const k = kunci(nama, r);
            const ada = tabelData.findIndex((x) => kunci(nama, x) === k);
            const baru = Object.assign({ jumlah_jalankan: 0, jumlah_kirim: 0, diperbarui_pada: new Date().toISOString() }, ada >= 0 ? tabelData[ada] : {}, r, { diperbarui_pada: new Date().toISOString() });
            if (ada >= 0) tabelData[ada] = baru;
            else tabelData.push(baru);
          } else {
            tabelData.push(Object.assign({ id: tabelData.length + 1 }, r, nama === "percobaan" ? { diterima_pada: new Date().toISOString() } : {}));
          }
        }
        save();
        return { data: null, error: null };
      }
      let baris = nama === "profiles" ? Object.values(db.profiles) : db[nama] || [];
      baris = baris.filter((r) => bisaBaca(nama, r) && Object.keys(q.f).every((k) => String(r[k]) === String(q.f[k])) && (q.gt || []).every(([k, v]) => Number(r[k]) > Number(v)));
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
    PENDAFTARAN: TERBUKA || TANPA_KONFIRMASI ? "buka" : "tutup",
    // ?muatmaks=4000 memperpendek batas waktu muat penjalan (untuk menguji gagal muat bersama /__gagal/... di server uji).
    MUAT_MAKS_MS: Number((/[?&]muatmaks=(\d+)/.exec(location.search) || [])[1]) || 0,
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
          if (!TERBUKA && !TANPA_KONFIRMASI) return { data: { user: null, session: null }, error: { message: "Signups not allowed for this instance", code: "signup_disabled" } };
          const b = batasEmail(email);
          if (b) return { data: {}, error: b };
          if (db.users[email] && !TANPA_KONFIRMASI) return { data: { user: { id: db.users[email].id, identities: [] }, session: null }, error: null };
          if (password.length < 6) return { data: {}, error: { message: "Password should be at least 6 characters.", code: "weak_password" } };
          if (TANPA_KONFIRMASI) {
            if (db.users[email]) return { data: { user: null, session: null }, error: { message: "User already registered", code: "user_already_exists" } };
            db.users[email] = { id: idDari(email), password, confirmed: true, meta: {} };
            setSession(mkSession(email), "SIGNED_IN");
            return { data: { user: db.session.user, session: db.session }, error: null };
          }
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
        if (nama === "catat_denyut") {
          if (!db.session) return { data: null, error: { code: "42501", message: "harus masuk dulu" } };
          const uid = uidSaya();
          if (!db.profiles[uid]) return { data: null, error: null };
          db.sesi_belajar = db.sesi_belajar || [];
          const tambah = Math.min(Math.max(Number(args.p_tambah) || 0, 0), 120);
          const skrg = Date.now();
          const ada = db.sesi_belajar.find((x) => x.id === args.p_sesi);
          if (!ada) {
            db.sesi_belajar.push({ id: args.p_sesi, user_id: uid, matakuliah_id: args.p_matakuliah, mulai: new Date(skrg).toISOString(), terakhir: new Date(skrg).toISOString(), aktif_detik: Math.min(tambah, 90), denyut: 1, bab_dibuka: args.p_bab ? [args.p_bab] : [] });
          } else if (ada.user_id === uid) {
            const lewat = Math.max(0, Math.round((skrg - Date.parse(ada.terakhir)) / 1000));
            ada.aktif_detik = Math.min(86400, ada.aktif_detik + Math.min(tambah, lewat + 5));
            ada.terakhir = new Date(skrg).toISOString();
            ada.denyut++;
            if (args.p_bab && !ada.bab_dibuka.includes(args.p_bab)) ada.bab_dibuka.push(args.p_bab);
          }
          save();
          return { data: null, error: null };
        }
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
