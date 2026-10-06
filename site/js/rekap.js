// Logika murni untuk dashboard instruktur: menyusun rekap peserta x bab, menyaring, dan membuat CSV.
// Tidak menyentuh DOM atau jaringan, jadi bisa diuji dengan node (tools/uji_rekap.mjs).

// Kode status satu sel (peserta di satu bab).
export const SEL = { SELESAI_LANGSUNG: "selesai-langsung", SELESAI_BANTUAN: "selesai-bantuan", SEDANG: "sedang", BELUM: "belum", UNGGAH: "unggah" };

export const SEL_TEKS = {
  "selesai-langsung": "Selesai, tanpa petunjuk",
  "selesai-bantuan": "Selesai, memakai petunjuk",
  sedang: "Sedang dikerjakan",
  belum: "Belum dibuka",
  unggah: "Tugas unggah (belum dilacak)",
};

export function kodeSel(bab, baris) {
  if (bab.jenis === "unggah") return SEL.UNGGAH;
  if (!baris) return SEL.BELUM;
  if (baris.status === "selesai") return baris.jalur === "bantuan" ? SEL.SELESAI_BANTUAN : SEL.SELESAI_LANGSUNG;
  if (baris.status === "sedang") return SEL.SEDANG;
  return SEL.BELUM;
}

// Peserta yang kirim jawabannya sekian kali tetapi belum lulus dianggap tersangkut.
export const AMBANG_TERSANGKUT = 5;

/**
 * @param {{peserta: object[], progres: object[], materi: object[]}} data
 * peserta: baris profiles (id, nama, nim, kelas, prodi, angkatan, rombel)
 * progres: baris tabel progres untuk SATU mata kuliah
 * materi: daftar bab dari materi.json
 */
export function susunRekap({ peserta, progres, materi, tempel = [] }) {
  // Jumlah percobaan tempel yang diblokir per peserta (baris aktivitas jenis tempel_diblokir; detail.jumlah = banyaknya).
  const tempelUser = new Map();
  for (const t of tempel) tempelUser.set(t.user_id, (tempelUser.get(t.user_id) || 0) + ((t.detail && Number(t.detail.jumlah)) || 1));
  const perUser = new Map();
  for (const r of progres) {
    if (!perUser.has(r.user_id)) perUser.set(r.user_id, new Map());
    perUser.get(r.user_id).set(Number(r.bab), r);
  }
  const babKode = materi.filter((m) => m.jenis !== "unggah");
  const baris = peserta.map((p) => {
    const mp = perUser.get(p.id) || new Map();
    const sel = {};
    let selesai = 0;
    let sedang = 0;
    let terakhir = null;
    const tersangkut = [];
    for (const m of materi) {
      const r = mp.get(m.bab) || null;
      const k = kodeSel(m, r);
      sel[m.bab] = { kode: k, kirim: r ? r.jumlah_kirim || 0 : 0, jalankan: r ? r.jumlah_jalankan || 0 : 0 };
      if (k === SEL.SELESAI_LANGSUNG || k === SEL.SELESAI_BANTUAN) selesai++;
      if (k === SEL.SEDANG) {
        sedang++;
        if (r.jumlah_kirim >= AMBANG_TERSANGKUT) tersangkut.push({ bab: m.bab, kirim: r.jumlah_kirim });
      }
      const t = r && (r.diperbarui_pada || r.lulus_pada || r.pertama_dibuka);
      if (t && (!terakhir || t > terakhir)) terakhir = t;
    }
    return { peserta: p, sel, selesai, sedang, terakhir, tersangkut, tempel: tempelUser.get(p.id) || 0 };
  });

  const perBab = materi.map((m) => {
    if (m.jenis === "unggah") return { bab: m.bab, judul: m.judul, unggah: true };
    let selesai = 0;
    let sedang = 0;
    let belum = 0;
    let langsung = 0;
    let bantuan = 0;
    let totalKirim = 0;
    let adaKirim = 0;
    for (const b of baris) {
      const c = b.sel[m.bab];
      if (c.kode === SEL.SELESAI_LANGSUNG) {
        selesai++;
        langsung++;
      } else if (c.kode === SEL.SELESAI_BANTUAN) {
        selesai++;
        bantuan++;
      } else if (c.kode === SEL.SEDANG) sedang++;
      else belum++;
      if (c.kirim > 0) {
        totalKirim += c.kirim;
        adaKirim++;
      }
    }
    const n = baris.length;
    return {
      bab: m.bab,
      judul: m.judul,
      selesai,
      sedang,
      belum,
      langsung,
      bantuan,
      persenSelesai: n ? Math.round((selesai / n) * 100) : 0,
      persenLangsung: selesai ? Math.round((langsung / selesai) * 100) : null,
      rataKirim: adaKirim ? Math.round((totalKirim / adaKirim) * 10) / 10 : null,
    };
  });

  const totalBabKode = babKode.length;
  const belumMulai = baris.filter((b) => b.selesai === 0 && b.sedang === 0).length;
  const rataSelesai = baris.length ? Math.round((baris.reduce((a, b) => a + b.selesai, 0) / baris.length) * 10) / 10 : 0;
  return { baris, perBab, ringkasan: { jumlahPeserta: baris.length, totalBabKode, belumMulai, rataSelesai, tersangkut: baris.filter((b) => b.tersangkut.length).length, adaTempel: baris.filter((b) => b.tempel > 0).length } };
}

/** Saring peserta: prodi, angkatan (angka), rombel (huruf), kata kunci (nama atau NIM). Nilai kosong = semua. */
export function saringPeserta(peserta, { prodi = "", angkatan = "", rombel = "", cari = "" } = {}) {
  const q = String(cari).trim().toLowerCase();
  return peserta.filter((p) => {
    if (prodi && (p.prodi || "") !== prodi) return false;
    if (angkatan && String(p.angkatan || "") !== String(angkatan)) return false;
    if (rombel && (p.rombel || "") !== rombel) return false;
    if (q && !((p.nama || "").toLowerCase().includes(q) || (p.nim || "").toLowerCase().includes(q))) return false;
    return true;
  });
}

/** Pilihan unik untuk menu saringan, diambil dari data peserta yang ada. */
export function pilihanSaringan(peserta) {
  const uniq = (f) => [...new Set(peserta.map(f).filter((x) => x !== null && x !== undefined && x !== ""))];
  return {
    prodi: uniq((p) => p.prodi).sort(),
    angkatan: uniq((p) => p.angkatan).sort((a, b) => a - b),
    rombel: uniq((p) => p.rombel).sort(),
  };
}

const kutip = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Awalan = + - @ dianggap rumus oleh Excel; beri apostrof supaya tetap teks (nama atau isian peserta).
  const aman = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(aman) ? '"' + aman.replace(/"/g, '""') + '"' : aman;
};

/** CSV rekap: NIM, nama, kelas, status tiap bab, jumlah kirim tiap bab, total selesai. */
export function buatCsv(rekap, materi) {
  const kepala = ["NIM", "Nama", "Kelas"];
  for (const m of materi) kepala.push("Bab " + m.bab);
  for (const m of materi) if (m.jenis !== "unggah") kepala.push("Kirim bab " + m.bab);
  kepala.push("Bab selesai", "Bab sedang", "Tempel diblokir", "Aktivitas terakhir");
  const baris = [kepala.map(kutip).join(",")];
  for (const b of rekap.baris) {
    const r = [b.peserta.nim, b.peserta.nama, b.peserta.kelas];
    for (const m of materi) r.push(b.sel[m.bab].kode);
    for (const m of materi) if (m.jenis !== "unggah") r.push(b.sel[m.bab].kirim);
    r.push(b.selesai, b.sedang, b.tempel, b.terakhir || "");
    baris.push(r.map(kutip).join(","));
  }
  return baris.join("\r\n") + "\r\n";
}

/** Mengambil semua baris sebuah query PostgREST yang dibatasi 1000 baris per permintaan. */
export async function ambilSemua(bangun, ukuran = 1000) {
  const hasil = [];
  for (let dari = 0; ; dari += ukuran) {
    const { data, error } = await bangun().range(dari, dari + ukuran - 1);
    if (error) throw error;
    hasil.push(...(data || []));
    if (!data || data.length < ukuran) break;
  }
  return hasil;
}
