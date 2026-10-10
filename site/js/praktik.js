// Logika murni praktik per bab: status, penggabungan pekerjaan lokal dengan server, ringkasan hasil uji, dan baris untuk
// database. Tidak menyentuh DOM atau jaringan; diuji dengan tools/uji_praktik.mjs.
//
// Satu praktik = satu bab = satu berkas. Disimpan di tabel praktikum_* (migrasi 0008): praktikum_id "bab-06", tahap_id "p01".
// Definisi praktik (kerangka, kasus uji, petunjuk) ada di berkas JSON situs (site/data/kuliah/<mata kuliah>/praktik/bab-NN.json).

export const TAHAP = "p01";
export const idPraktik = (bab) => "bab-" + String(bab).padStart(2, "0");
export const POLA_NAMA = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}$/;
export const STATUS = { belum: "Belum dikerjakan", sedang: "Sedang dikerjakan", lulus: "Lulus" };
const URUTAN = { belum: 0, sedang: 1, lulus: 2 };

/** Status dari baris praktikum_tahap (atau keadaan lokal): belum, sedang, atau lulus. */
export const statusDari = (baris) => (baris && URUTAN[baris.status] !== undefined ? baris.status : "belum");
export const lebihJauh = (a, b) => (URUTAN[statusDari({ status: a })] >= URUTAN[statusDari({ status: b })] ? a : b);

/** Keadaan lokal kosong untuk satu praktik. */
export const keadaanKosong = () => ({ isi: null, t: null, status: "belum", jumlah_kirim: 0, pertama_dibuka: null, lulus_pada: null, riwayat: [] });

const lebihBaru = (a, b) => String(a || "") > String(b || "");
const paling = (a, b, awal) => (a && b ? ((awal ? a < b : a > b) ? a : b) : a || b || null);

/**
 * Menggabungkan keadaan lokal dengan data server (baris praktikum_berkas dan praktikum_tahap untuk praktik ini).
 * Isi: yang waktunya lebih baru menang. Status: yang lebih jauh (lulus > sedang > belum). Jumlah kirim: terbesar.
 */
export function gabungKeadaan(lokal, berkas, tahap) {
  const hasil = Object.assign(keadaanKosong(), lokal || {});
  if (berkas && (hasil.isi === null || lebihBaru(berkas.diperbarui_pada, hasil.t))) {
    hasil.isi = berkas.isi;
    hasil.t = berkas.diperbarui_pada;
  }
  if (tahap) {
    hasil.status = lebihJauh(hasil.status, statusDari(tahap));
    hasil.jumlah_kirim = Math.max(hasil.jumlah_kirim || 0, tahap.jumlah_kirim || 0);
    hasil.pertama_dibuka = paling(hasil.pertama_dibuka, tahap.pertama_dibuka, true);
    hasil.lulus_pada = paling(hasil.lulus_pada, tahap.lulus_pada, true);
  }
  return hasil;
}

/** Mengolah hasil penguji (kasus) menjadi ringkasan. Rincian kasus tersembunyi yang gagal disembunyikan. */
export function ringkasHasil(kasus) {
  const benar = kasus.filter((k) => k.lulus).length;
  return {
    lulus: kasus.length > 0 && benar === kasus.length,
    benar,
    total: kasus.length,
    tampil: kasus.map((k) => ({ nama: k.tersembunyi ? "Kasus tersembunyi" : k.nama, lulus: k.lulus, pesan: k.tersembunyi && !k.lulus ? "Belum lulus (rincian disembunyikan)." : k.pesan || "", tersembunyi: !!k.tersembunyi })),
  };
}
/** Hasil yang disimpan di riwayat versi: tanpa keluaran panjang, dan tanpa rincian kasus tersembunyi. */
export const hasilUntukRiwayat = (ringkas) => ({ benar: ringkas.benar, total: ringkas.total, kasus: ringkas.tampil.map((k) => ({ nama: k.nama, lulus: k.lulus, pesan: String(k.pesan || "").slice(0, 300) })) });

/** Kerangka yang belum diubah sama sekali (masih memuat tanda ____). */
export const masihKerangka = (def, isi) => isi === def.awal || /____/.test(isi);

/** Pemeriksaan bentuk definisi praktik. Mengembalikan daftar masalah (kosong bila sah). */
export function periksaDef(def) {
  const m = [];
  if (!def || typeof def !== "object") return ["bukan objek"];
  for (const k of ["bab", "judul", "tujuan", "berkas", "awal", "kasus"]) if (!def[k]) m.push("kolom " + k + " tidak ada");
  if (def.berkas && !POLA_NAMA.test(def.berkas)) m.push("nama berkas tidak sah");
  if (!Array.isArray(def.langkah)) m.push("langkah harus daftar");
  if (!Array.isArray(def.kasus) || !def.kasus.length) m.push("kasus kosong");
  return m;
}

// ---------- baris untuk database ----------
export const barisBerkas = (mk, pid, nama, b) => ({ matakuliah_id: mk, praktikum_id: pid, nama, isi: b.isi, asal: b.asal || "milik" });
export const barisTahap = (mk, pid, tid, r) => ({ matakuliah_id: mk, praktikum_id: pid, tahap_id: tid, status: r.status, jalur: r.jalur || "web", jumlah_kirim: r.jumlah_kirim || 0, pertama_dibuka: r.pertama_dibuka || null, lulus_pada: r.lulus_pada || null, pakai_contoh: !!r.pakai_contoh, centang: r.centang || {} });

// ---------- rekap untuk dashboard instruktur ----------
export const KODE_SEL = { lulus: "lulus", sedang: "sedang", belum: "belum" };
/**
 * Peserta x bab dari baris praktikum_tahap (praktikum_id bab-NN, tahap_id p01).
 * @returns {{baris:object[], perBab:object[], mulai:number, selesai:number}}
 */
export function rekapPraktik({ peserta, tahap = [], babs }) {
  const poPeserta = new Map();
  for (const r of tahap) {
    const m = /^bab-(\d{2})$/.exec(r.praktikum_id || "");
    if (!m || r.tahap_id !== TAHAP) continue;
    if (!poPeserta.has(r.user_id)) poPeserta.set(r.user_id, new Map());
    poPeserta.get(r.user_id).set(Number(m[1]), r);
  }
  const baris = peserta.map((p) => {
    const t = poPeserta.get(p.id) || new Map();
    const sel = {};
    let lulus = 0;
    let sedang = 0;
    let kirim = 0;
    let terakhir = "";
    for (const b of babs) {
      const r = t.get(b);
      sel[b] = { kode: statusDari(r), kirim: r ? r.jumlah_kirim || 0 : 0 };
      if (r) {
        kirim += r.jumlah_kirim || 0;
        if (String(r.diperbarui_pada || "") > terakhir) terakhir = r.diperbarui_pada;
      }
      if (sel[b].kode === "lulus") lulus++;
      else if (sel[b].kode === "sedang") sedang++;
    }
    return { peserta: p, sel, lulus, sedang, kirim, mulai: t.size > 0, selesai: babs.length > 0 && lulus === babs.length, terakhir };
  });
  const perBab = babs.map((b) => {
    let lulus = 0;
    let sedang = 0;
    let kirim = 0;
    let pernah = 0;
    for (const x of baris) {
      const s = x.sel[b];
      if (s.kode === "lulus") lulus++;
      if (s.kode === "sedang") sedang++;
      if (s.kirim > 0) {
        kirim += s.kirim;
        pernah++;
      }
    }
    return { bab: b, lulus, sedang, kirimRata: pernah ? Math.round((kirim / pernah) * 10) / 10 : 0 };
  });
  return { baris, perBab, mulai: baris.filter((x) => x.mulai).length, selesai: baris.filter((x) => x.selesai).length };
}

// Awalan = + - @ dianggap rumus oleh Excel; beri apostrof supaya nama atau isian peserta tetap teks.
const kutip = (s) => {
  const t = String(s === null || s === undefined ? "" : s);
  return '"' + (/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replace(/"/g, '""') + '"';
};
export function csvPraktik(rekap, babs) {
  const kepala = ["NIM", "Nama", "Kelas", ...babs.map((b) => "Praktik bab " + b), "Lulus", "Kirim", "Aktivitas terakhir"];
  const baris = [kepala.map(kutip).join(",")];
  for (const x of rekap.baris) baris.push([x.peserta.nim, x.peserta.nama, x.peserta.kelas, ...babs.map((b) => KODE_SEL[x.sel[b].kode]), x.lulus, x.kirim, x.terakhir].map(kutip).join(","));
  return baris.join("\r\n") + "\r\n";
}
