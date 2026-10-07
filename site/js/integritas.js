// Analisis sinyal keaslian pengerjaan untuk dashboard instruktur. Logika murni (tanpa DOM dan jaringan), diuji
// dengan tools/uji_integritas.mjs.
//
// PENTING: keluarannya adalah SINYAL dengan alasan yang bisa dibaca, bukan skor dan bukan bukti. Tiap sinyal punya
// penjelasan batasnya sendiri. Gunakan untuk memilih siapa yang perlu ditanya langsung (diminta menjelaskan atau
// mengubah satu baris kodenya), bukan untuk menyimpulkan kecurangan.

export const TINGKAT = { tinggi: 3, sedang: 2, rendah: 1 };

export const JENIS = {
  "perangkat-bersama": "Perangkat dipakai banyak akun",
  "perangkat-banyak": "Memakai beberapa perangkat",
  "perangkat-selalu-baru": "Selalu perangkat baru",
  kecepatan: "Mengetik terlalu cepat",
  "potongan-besar": "Potongan kode besar muncul sekaligus",
  "lurus-tanpa-koreksi": "Ditulis lurus tanpa koreksi",
  "ritme-berubah": "Cara mengetik berubah dari kebiasaannya",
  tempel: "Mencoba menempel kode",
  "urutan-salah-sama": "Percobaan salah yang identik",
  "kemiripan-khas": "Ciri penulisan khas yang sama",
  "kirim-serentak": "Lulus pada waktu hampir sama",
};

const sebut = (daftar, maks = 4) => (daftar.length <= maks ? daftar.join(", ") : daftar.slice(0, maks).join(", ") + " dan " + (daftar.length - maks) + " lainnya");
const median = (a) => {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Menyamakan kode untuk dibandingkan: tanpa spasi di ujung baris, tanpa baris kosong dan komentar-satu-baris. */
export function normalisasi(kode) {
  return String(kode || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "")
    .join("\n");
}

const KATA_KUNCI = new Set("and as assert break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None abstract boolean byte case catch char const default do double enum extends final float goto implements instanceof int interface long native new package private protected public short static strictfp super switch synchronized this throw throws transient void volatile var record".split(" "));

/**
 * Ciri khas penulisan: nama (pengenal) dan komentar yang dipakai. Tulisan di dalam tanda kutip dan angka diabaikan
 * karena ditentukan soal. Hasilnya himpunan teks; yang jarang dipakai peserta lain yang bermakna.
 */
export function ciriKhas(kode) {
  const k = String(kode || "").replace(/\r/g, "");
  const ciri = new Set();
  // komentar (Python "#", Java "//" dan "/* */") diambil dulu karena isinya sendiri adalah ciri
  for (const m of k.matchAll(/\/\*([\s\S]*?)\*\//g)) ciri.add("k:" + m[1].trim().toLowerCase().replace(/\s+/g, " "));
  const tanpaBlok = k.replace(/\/\*[\s\S]*?\*\//g, " ");
  const kodeSaja = [];
  for (const baris of tanpaBlok.split("\n")) {
    const mm = /(^|[^"'\\])(#|\/\/)(.*)$/.exec(baris);
    if (mm) {
      const teks = mm[3].trim().toLowerCase().replace(/\s+/g, " ");
      if (teks) ciri.add("k:" + teks);
      kodeSaja.push(baris.slice(0, mm.index + mm[1].length));
    } else kodeSaja.push(baris);
  }
  const tanpaTulisan = kodeSaja.join("\n").replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  for (const m of tanpaTulisan.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) if (!KATA_KUNCI.has(m[0]) && m[0].length > 2) ciri.add("n:" + m[0]);
  return ciri;
}

const ts = (x) => (x ? new Date(x).getTime() : NaN);

/**
 * @param {object} d
 * @param {object[]} d.peserta   baris profiles (id, nama, nim, kelas)
 * @param {object[]} d.sesi      baris sesi_perangkat
 * @param {object[]} d.bersama   baris perangkat_bersama (device_id)
 * @param {object[]} d.percobaan baris percobaan jenis kirim: id, user_id, bab, lulus, kode, pola, dibuat_pada
 * @param {object[]} d.tempel    baris aktivitas tempel_diblokir: user_id, detail
 */
export function analisis({ peserta, sesi = [], bersama = [], percobaan = [], tempel = [] }) {
  const orang = new Map(peserta.map((p) => [p.id, p]));
  const nama = (id) => (orang.get(id) ? orang.get(id).nama : "akun tak dikenal");
  const sinyal = new Map(peserta.map((p) => [p.id, []]));
  const tambah = (id, s) => {
    if (sinyal.has(id)) sinyal.get(id).push(s);
  };
  const lab = new Set(bersama.map((b) => b.device_id));

  // ---- Perangkat ----
  const perDevice = new Map();
  for (const s of sesi) {
    if (!orang.has(s.user_id)) continue;
    if (!perDevice.has(s.device_id)) perDevice.set(s.device_id, []);
    perDevice.get(s.device_id).push(s);
  }
  const perangkat = [...perDevice.entries()]
    .map(([id, baris]) => ({ device_id: id, agen: (baris.find((b) => b.agen) || {}).agen || "", bersama: lab.has(id), akun: baris.map((b) => ({ user_id: b.user_id, jumlah_masuk: b.jumlah_masuk, terakhir: b.terakhir_dilihat, pertama: b.pertama_dilihat })) }))
    .sort((a, b) => b.akun.length - a.akun.length);

  for (const dev of perangkat) {
    if (dev.akun.length < 2 || dev.bersama) continue;
    for (const a of dev.akun) {
      const lain = dev.akun.filter((x) => x.user_id !== a.user_id).map((x) => nama(x.user_id));
      tambah(a.user_id, {
        kode: "perangkat-bersama",
        tingkat: dev.akun.length >= 3 ? "tinggi" : "sedang",
        judul: JENIS["perangkat-bersama"],
        alasan: "Browser ini (" + (dev.agen || "jenis tidak diketahui") + ", ID " + dev.device_id.slice(4, 10) + ") juga dipakai masuk oleh " + sebut(lain) + ". Bisa wajar bila itu komputer laboratorium atau perangkat keluarga; tandai sebagai perangkat bersama bila begitu.",
        device_id: dev.device_id,
        lain: dev.akun.filter((x) => x.user_id !== a.user_id).map((x) => x.user_id),
      });
    }
  }
  const perAkun = new Map();
  for (const dev of perangkat) for (const a of dev.akun) (perAkun.get(a.user_id) || perAkun.set(a.user_id, []).get(a.user_id)).push({ dev, a });
  for (const [uid, daftar] of perAkun) {
    const pribadi = daftar.filter((x) => !x.dev.bersama);
    if (pribadi.length >= 2)
      tambah(uid, { kode: "perangkat-banyak", tingkat: "rendah", judul: JENIS["perangkat-banyak"], alasan: "Masuk dari " + pribadi.length + " perangkat berbeda (" + sebut(pribadi.map((x) => x.dev.agen || "tidak diketahui")) + "). Ponsel dan laptop sekaligus itu wajar; yang perlu dilihat adalah bila perangkat baru muncul tepat sebelum bab yang lulus cepat." });
    const terbaru = Math.max(...pribadi.map((x) => ts(x.a.terakhir)).filter((x) => !isNaN(x)), 0);
    const baru = pribadi.filter((x) => x.a.jumlah_masuk === 1 && terbaru - ts(x.a.pertama) <= 14 * 86400000);
    if (baru.length >= 4) tambah(uid, { kode: "perangkat-selalu-baru", tingkat: "sedang", judul: JENIS["perangkat-selalu-baru"], alasan: "Dalam dua minggu terakhir muncul " + baru.length + " perangkat yang masing-masing hanya sekali dipakai masuk. Ini terjadi bila peserta selalu memakai jendela penyamaran atau menghapus data browser, atau akunnya dipakai dari banyak tempat." });
  }

  // ---- Pola menulis ----
  const kirim = percobaan.filter((p) => p.jenis === undefined || p.jenis === "kirim");
  const perUser = new Map();
  for (const p of kirim) (perUser.get(p.user_id) || perUser.set(p.user_id, []).get(p.user_id)).push(p);
  for (const [uid, daftar] of perUser) {
    for (const p of daftar) {
      const o = p.pola;
      if (!o || !p.lulus) continue;
      if (o.cps_puncak > 9) tambah(uid, { kode: "kecepatan", tingkat: "sedang", judul: JENIS.kecepatan, bab: p.bab, percobaan_id: p.id, alasan: "Bab " + p.bab + ": dalam 10 detik terketik hingga " + o.cps_puncak + " huruf per detik. Pengetik cepat bisa mencapai 6 sampai 8; di atas 9 untuk kode (yang butuh berpikir) jarang terjadi, dan lazim bila mengetik ulang dari layar lain." });
      if (o.besar_maks >= 40) tambah(uid, { kode: "potongan-besar", tingkat: "sedang", judul: JENIS["potongan-besar"], bab: p.bab, percobaan_id: p.id, alasan: "Bab " + p.bab + ": satu perubahan memasukkan " + o.besar_maks + " karakter sekaligus tanpa lewat menempel (yang diblokir). Bisa dari pengisian otomatis browser, dikte, atau ekstensi." });
      const lurus = o.linier >= 0.97 && o.rasio_hapus < 0.03 && o.jalankan === 0 && (o.panjang_akhir || 0) >= 120;
      if (lurus) {
        const rata = (o.cv_ketuk !== null && o.cv_ketuk < 0.35) || o.cps_puncak > 7;
        tambah(uid, { kode: "lurus-tanpa-koreksi", tingkat: rata ? "tinggi" : "sedang", judul: JENIS["lurus-tanpa-koreksi"], bab: p.bab, percobaan_id: p.id, alasan: "Bab " + p.bab + ": kode " + o.panjang_akhir + " karakter ditulis dari atas ke bawah" + (o.dihapus ? "" : " tanpa satu pun penghapusan") + ", tidak pernah dijalankan sebelum dikirim, langsung lulus" + (rata ? ", dengan ritme ketikan yang sangat rata." : ". Kebiasaan menulis lurus saja belum berarti apa-apa; lihat rekamannya.") });
      }
    }
    // Bandingkan peserta dengan dirinya sendiri: kecepatan mengetik sebuah bab lawan bab-bab lainnya.
    const dgnPola = daftar.filter((p) => p.pola && p.pola.cps > 0 && p.pola.ketuk >= 40);
    for (const p of dgnPola) {
      if (!p.lulus) continue;
      const lain = dgnPola.filter((x) => x !== p && x.bab !== p.bab).map((x) => Math.log(x.pola.cps));
      if (lain.length < 3) continue;
      const med = median(lain);
      const mad = Math.max(0.15, median(lain.map((x) => Math.abs(x - med))));
      const z = (0.6745 * (Math.log(p.pola.cps) - med)) / mad;
      if (Math.abs(z) > 3.5)
        tambah(uid, { kode: "ritme-berubah", tingkat: "sedang", judul: JENIS["ritme-berubah"], bab: p.bab, percobaan_id: p.id, alasan: "Bab " + p.bab + ": kecepatan mengetik " + p.pola.cps + " huruf per detik, padahal di bab lain biasanya sekitar " + (Math.exp(med)).toFixed(1) + ". Perubahan sebesar ini bisa berarti orang lain yang mengetik, tetapi juga kelelahan, soal yang dihafal, atau perangkat berbeda." });
    }
  }

  // ---- Percobaan menempel yang diblokir ----
  const jumlahTempel = new Map();
  for (const t of tempel) jumlahTempel.set(t.user_id, (jumlahTempel.get(t.user_id) || 0) + ((t.detail && Number(t.detail.jumlah)) || 1));
  for (const [uid, n] of jumlahTempel)
    tambah(uid, { kode: "tempel", tingkat: n >= 5 ? "sedang" : "rendah", judul: JENIS.tempel, alasan: n + " kali mencoba menempel (diblokir). Bisa kebiasaan menekan Ctrl+V tanpa maksud buruk; makin sering makin patut ditanya." });

  // ---- Kemiripan antar peserta ----
  const pasangan = [];
  const perBab = new Map();
  // Jawaban tantangan konsep (pola.jenis konsep) tidak dibandingkan: pilihannya terbatas sehingga jawaban yang sama itu wajar.
  for (const p of kirim) if (p.kode && !(p.pola && p.pola.jenis === "konsep")) (perBab.get(p.bab) || perBab.set(p.bab, []).get(p.bab)).push(p);
  for (const [bab, daftar] of perBab) {
    const totalPeserta = new Set(daftar.map((x) => x.user_id)).size;
    // (a) percobaan SALAH yang persis sama. Kode awal yang belum diubah dan kesalahan umum dipakai banyak orang, jadi
    // hanya kelompok kecil (2 sampai 3 orang) yang dianggap janggal.
    const kelompok = new Map();
    for (const p of daftar) {
      if (p.lulus) continue;
      const n = normalisasi(p.kode);
      if (n.length < 60) continue;
      (kelompok.get(n) || kelompok.set(n, new Map()).get(n)).set(p.user_id, p);
    }
    for (const [, anggota] of kelompok) {
      if (anggota.size < 2 || anggota.size > 3 || anggota.size > Math.max(2, totalPeserta * 0.25)) continue;
      const ids = [...anggota.keys()];
      for (const uid of ids) {
        const lain = ids.filter((x) => x !== uid);
        tambah(uid, { kode: "urutan-salah-sama", tingkat: "tinggi", judul: JENIS["urutan-salah-sama"], bab, percobaan_id: anggota.get(uid).id, lain, alasan: "Bab " + bab + ": ada percobaan SALAH yang sama persis (huruf demi huruf) dengan milik " + sebut(lain.map(nama)) + ". Dua orang yang mengerjakan sendiri-sendiri hampir tidak pernah salah dengan cara yang persis sama." });
      }
      pasangan.push({ jenis: "urutan-salah-sama", bab, ids });
    }
    // (b) ciri khas penulisan pada kode yang lulus: nama dan komentar yang jarang dipakai orang lain tetapi sama.
    const akhir = new Map();
    for (const p of daftar) if (p.lulus) akhir.set(p.user_id, p); // percobaan lulus terakhir menimpa
    if (akhir.size < 10) continue;
    const ciri = new Map([...akhir.entries()].map(([u, p]) => [u, ciriKhas(p.kode)]));
    const df = new Map();
    for (const set of ciri.values()) for (const c of set) df.set(c, (df.get(c) || 0) + 1);
    const jarang = new Map([...ciri.entries()].map(([u, set]) => [u, new Set([...set].filter((c) => df.get(c) <= 3))]));
    const indeks = new Map();
    for (const [u, set] of jarang) for (const c of set) (indeks.get(c) || indeks.set(c, []).get(c)).push(u);
    const kandidat = new Map();
    for (const users of indeks.values()) {
      if (users.length < 2) continue;
      for (let i = 0; i < users.length; i++) for (let j = i + 1; j < users.length; j++) {
        const kunci = users[i] < users[j] ? users[i] + "|" + users[j] : users[j] + "|" + users[i];
        kandidat.set(kunci, (kandidat.get(kunci) || 0) + 1);
      }
    }
    for (const [kunci, bersamaJml] of kandidat) {
      if (bersamaJml < 3) continue;
      const [a, b] = kunci.split("|");
      const A = jarang.get(a);
      const B = jarang.get(b);
      const gabung = new Set([...A, ...B]).size;
      if (bersamaJml / gabung < 0.6) continue;
      for (const [uid, lain] of [[a, b], [b, a]])
        tambah(uid, { kode: "kemiripan-khas", tingkat: "sedang", judul: JENIS["kemiripan-khas"], bab, lain: [lain], alasan: "Bab " + bab + ": kode lulus memakai " + bersamaJml + " nama atau komentar langka yang sama persis dengan milik " + nama(lain) + " (nama yang hanya dipakai segelintir peserta). Soal kecil punya jawaban yang mirip secara wajar, tetapi nama dan komentar bebas biasanya berbeda antar orang." });
      pasangan.push({ jenis: "kemiripan-khas", bab, ids: [a, b], bersama: bersamaJml });
    }
  }

  // ---- Lulus pada waktu hampir bersamaan (di banyak bab) ----
  const lulus = kirim.filter((p) => p.lulus && !isNaN(ts(p.dibuat_pada))).map((p) => ({ t: ts(p.dibuat_pada), u: p.user_id, bab: p.bab })).sort((a, b) => a.t - b.t);
  const serentak = new Map();
  for (let i = 0; i < lulus.length; i++) {
    for (let j = i + 1; j < lulus.length && lulus[j].t - lulus[i].t <= 90000; j++) {
      if (lulus[i].u === lulus[j].u) continue;
      const [a, b] = lulus[i].u < lulus[j].u ? [lulus[i].u, lulus[j].u] : [lulus[j].u, lulus[i].u];
      const k = a + "|" + b;
      (serentak.get(k) || serentak.set(k, new Set()).get(k)).add(Math.min(lulus[i].bab, lulus[j].bab) + "-" + Math.max(lulus[i].bab, lulus[j].bab));
    }
  }
  for (const [k, babs] of serentak) {
    if (babs.size < 3) continue;
    const [a, b] = k.split("|");
    for (const [uid, lain] of [[a, b], [b, a]])
      tambah(uid, { kode: "kirim-serentak", tingkat: "sedang", judul: JENIS["kirim-serentak"], lain: [lain], alasan: "Lulus dalam selang 90 detik dari " + nama(lain) + " pada " + babs.size + " pasangan bab berbeda. Teman yang belajar bersama bisa begitu; akun yang dipegang satu orang juga." });
    pasangan.push({ jenis: "kirim-serentak", ids: [a, b], jumlah: babs.size });
  }

  // ---- Ringkasan ----
  const urut = (x) => Math.max(0, ...x.map((s) => TINGKAT[s.tingkat]));
  const hasil = peserta.map((p) => {
    const s = sinyal.get(p.id).sort((a, b) => TINGKAT[b.tingkat] - TINGKAT[a.tingkat]);
    return { peserta: p, sinyal: s, tinggi: s.filter((x) => x.tingkat === "tinggi").length, sedang: s.filter((x) => x.tingkat === "sedang").length, rendah: s.filter((x) => x.tingkat === "rendah").length, puncak: urut(s) };
  });
  return {
    hasil,
    perangkat,
    pasangan,
    ringkasan: {
      bersinyalTinggi: hasil.filter((h) => h.puncak === 3).length,
      bersinyalSedang: hasil.filter((h) => h.puncak === 2).length,
      bersinyalRendah: hasil.filter((h) => h.puncak === 1).length,
      perangkatBersama: perangkat.filter((d) => d.akun.length >= 2 && !d.bersama).length,
      pasangan: pasangan.length,
    },
  };
}

/** CSV daftar sinyal: satu baris per sinyal. */
export function csvSinyal(hasil) {
  const kutip = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    const aman = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return /[",\n\r]/.test(aman) ? '"' + aman.replace(/"/g, '""') + '"' : aman;
  };
  const baris = [["NIM", "Nama", "Kelas", "Tingkat", "Jenis", "Bab", "Alasan"].map(kutip).join(",")];
  for (const h of hasil) for (const s of h.sinyal) baris.push([h.peserta.nim, h.peserta.nama, h.peserta.kelas, s.tingkat, s.judul, s.bab || "", s.alasan].map(kutip).join(","));
  return baris.join("\r\n") + "\r\n";
}
