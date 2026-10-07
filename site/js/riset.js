// Logika murni untuk bagian "Riset": ringkasan kohort dan ekspor data anonim untuk penelitian.
// Hanya peserta yang menyatakan setuju (riset_setuju = true, punya kode_riset) yang ikut dihitung dan diekspor.
// Ekspor tidak memuat nama, NIM, kelas, atau tanggal kalender (hanya hari ke-n sejak awal data); identitas diganti kode_riset.
// Diuji dengan tools/uji_riset.mjs.
import { waktuBaris, HARI_MS } from "./kehadiran.js";
import { kelompokGalat } from "./galat.js";

export const layak = (p) => p.riset_setuju === true && !!p.kode_riset;
export function statusPersetujuan(peserta) {
  return { setuju: peserta.filter((p) => p.riset_setuju === true).length, tidak: peserta.filter((p) => p.riset_setuju === false).length, belum: peserta.filter((p) => p.riset_setuju !== true && p.riset_setuju !== false).length };
}

const median = (a) => {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const persen = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const JEDA_KEMBALI_MS = 6 * 3600000;
const AMBANG_TERSANGKUT = 3;

/** Mengelompokkan baris percobaan peserta yang layak per (peserta, bab), terurut waktu. */
function kelompokPerBab(peserta, percobaan) {
  const ok = new Set(peserta.filter(layak).map((p) => p.id));
  const peta = new Map();
  for (const r of percobaan) {
    if (!ok.has(r.user_id)) continue;
    const t = waktuBaris(r);
    if (!Number.isFinite(t)) continue;
    const k = r.user_id + "|" + r.bab;
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k).push(Object.assign({}, r, { _t: t }));
  }
  for (const a of peta.values()) a.sort((x, y) => x._t - y._t || (x.id || 0) - (y.id || 0));
  return peta;
}

/** Ringkasan kohort untuk tab Riset. */
export function ringkasKohort({ peserta, percobaan, progres = [] }) {
  const peta = kelompokPerBab(peserta, percobaan);
  const st = statusPersetujuan(peserta);
  const pesertaAda = new Set();
  let nBaris = 0;
  const galat = new Map();
  const jenisGalat = new Map();
  let kirimGagal = 0;
  let nGalatTotal = 0;
  const perBab = new Map();
  const tersangkut = { n: 0, petunjuk: 0, hapus: 0, kembali: 0 };

  for (const [k, rows] of peta) {
    const [uid, babTeks] = k.split("|");
    const bab = Number(babTeks);
    pesertaAda.add(uid);
    nBaris += rows.length;
    for (const r of rows) {
      if (r.jenis === "jalankan" && (r.hasil === "galat" || r.hasil === "timeout" || r.galat_jenis)) {
        const jenis = r.hasil === "timeout" ? "Timeout" : r.galat_jenis || "GalatLain";
        const g = kelompokGalat(jenis);
        galat.set(g, (galat.get(g) || 0) + 1);
        jenisGalat.set(jenis, (jenisGalat.get(jenis) || 0) + 1);
        nGalatTotal++;
      }
      if (r.jenis !== "jalankan" && !r.lulus && !(r.pola && r.pola.jenis === "konsep")) kirimGagal++;
    }
    const kirim = rows.filter((r) => r.jenis !== "jalankan");
    const iLulus = kirim.findIndex((r) => r.lulus);
    if (!perBab.has(bab)) perBab.set(bab, { sampai: [], belum: 0 });
    const d = perBab.get(bab);
    if (iLulus >= 0) d.sampai.push(iLulus + 1);
    else if (kirim.length) d.belum++;
    // Tersangkut = butuh tiga kali Kirim atau lebih untuk lulus pertama (atau belum lulus setelah tiga kali Kirim).
    const upaya = iLulus >= 0 ? iLulus + 1 : kirim.length;
    if (upaya >= AMBANG_TERSANGKUT) {
      tersangkut.n++;
      if (rows.some((r) => (r.petunjuk || 0) > 0)) tersangkut.petunjuk++;
      if (rows.some((r) => r.pola && r.pola.rasio_hapus >= 0.3)) tersangkut.hapus++;
      if (rows.some((r, i) => i > 0 && r._t - rows[i - 1]._t > JEDA_KEMBALI_MS)) tersangkut.kembali++;
    }
  }
  const ok = new Set(peserta.filter(layak).map((p) => p.id));
  const selesai = progres.filter((r) => ok.has(r.user_id) && r.status === "selesai" && (r.jalur === "langsung" || r.jalur === "bantuan"));
  return {
    nSetuju: st.setuju,
    nTidak: st.tidak,
    nBelum: st.belum,
    nPeserta: pesertaAda.size,
    nBaris,
    galat: [...galat.entries()].map(([nama, n]) => ({ nama, n, persen: persen(n, nGalatTotal) })).sort((a, b) => b.n - a.n),
    galatJenis: [...jenisGalat.entries()].map(([nama, n]) => ({ nama, n, persen: persen(n, nGalatTotal) })).sort((a, b) => b.n - a.n).slice(0, 8),
    nGalat: nGalatTotal,
    kirimGagal,
    perBab: [...perBab.entries()].map(([bab, d]) => ({ bab, median: median(d.sampai), lulus: d.sampai.length, belum: d.belum })).sort((a, b) => a.bab - b.bab),
    lulusLangsung: selesai.length ? persen(selesai.filter((r) => r.jalur === "langsung").length, selesai.length) : null,
    nSelesai: selesai.length,
    tersangkut: { n: tersangkut.n, petunjuk: persen(tersangkut.petunjuk, tersangkut.n), hapus: persen(tersangkut.hapus, tersangkut.n), kembali: persen(tersangkut.kembali, tersangkut.n) },
  };
}

// ---------- ekspor anonim ----------
export const KOLOM_EKSPOR = [
  { id: "kode_riset", label: "kode_riset", deskripsi: "Kode acak peserta (bukan nama atau NIM). Sama di semua ekspor untuk peserta yang sama." },
  { id: "matakuliah", label: "matakuliah", deskripsi: "Mata kuliah (id)." },
  { id: "bab", label: "bab", deskripsi: "Nomor bab." },
  { id: "urutan_di_bab", label: "urutan_di_bab", deskripsi: "Urutan baris ini di bab itu untuk peserta itu (Jalankan dan Kirim bersama), mulai dari 1." },
  { id: "jenis", label: "jenis", deskripsi: "jalankan (tombol Jalankan), kirim (Kirim jawaban kode), atau periksa (Periksa jawaban tantangan konsep)." },
  { id: "hari_ke", label: "hari_ke", deskripsi: "Hari ke-n sejak baris paling awal di data ini (tanggal kalender sengaja dihilangkan)." },
  { id: "detik_sejak_mulai_bab", label: "detik_sejak_mulai_bab", deskripsi: "Detik sejak baris pertama peserta itu di bab itu." },
  { id: "hasil", label: "hasil", deskripsi: "jalan, galat, timeout (untuk jalankan); lulus atau gagal (untuk kirim dan periksa)." },
  { id: "galat_jenis", label: "galat_jenis", deskripsi: "Jenis galat saat menjalankan (mis. SyntaxError, NameError). Keluaran program tidak disimpan." },
  { id: "galat_kelompok", label: "galat_kelompok", deskripsi: "Pengelompokan jenis galat: Sintaks, Nama tidak dikenal, Tipe dan nilai, Pembagian nol, Akses data, Berjalan terlalu lama, Lainnya." },
  { id: "kasus_lulus", label: "kasus_lulus", deskripsi: "Jumlah kasus uji (atau butir konsep) yang benar pada baris kirim atau periksa." },
  { id: "kasus_total", label: "kasus_total", deskripsi: "Jumlah kasus uji atau butir konsep." },
  { id: "cocok_contoh", label: "cocok_contoh", deskripsi: "Untuk jalankan: 1 bila keluaran cocok dengan contoh, 0 bila tidak, kosong bila tidak dibandingkan." },
  { id: "petunjuk", label: "petunjuk", deskripsi: "Berapa petunjuk (0 sampai 3) sudah dibuka pada saat baris ini." },
  { id: "cps", label: "cps", deskripsi: "Kecepatan mengetik rata-rata (huruf per detik) sejak Kirim sebelumnya." },
  { id: "cps_puncak", label: "cps_puncak", deskripsi: "Kecepatan mengetik puncak dalam jendela 10 detik." },
  { id: "rasio_hapus", label: "rasio_hapus", deskripsi: "Perbandingan huruf yang dihapus dengan yang diketik (0 sampai 1)." },
  { id: "linier", label: "linier", deskripsi: "Bagian sisipan yang ada di ujung kode (0 sampai 1); tinggi berarti menulis lurus dari atas ke bawah." },
  { id: "lompat", label: "lompat", deskripsi: "Berapa kali kembali ke bagian kode yang lebih atas dari yang terakhir diedit." },
  { id: "jalankan_dalam_segmen", label: "jalankan_dalam_segmen", deskripsi: "Jumlah tombol Jalankan ditekan sejak Kirim sebelumnya." },
];
const KOLOM_OPSI = {
  angkatan: { id: "angkatan", label: "angkatan", deskripsi: "Angkatan peserta (tanpa kelas dan nama)." },
  kode: { id: "kode", label: "kode", deskripsi: "Kode lengkap yang dijalankan atau dikirim (teks apa adanya; bisa memuat identitas bila peserta menuliskannya)." },
  rekaman: { id: "rekaman", label: "rekaman", deskripsi: "Rekaman cara menulis (JSON) untuk diputar ulang." },
};

/**
 * @param {{peserta:object[], percobaan:object[], opsi?:{angkatan?:boolean, kode?:boolean, rekaman?:boolean}}} d
 * @returns {{kolom:{id:string,label:string,deskripsi:string}[], baris:any[][], nPeserta:number, nBaris:number}}
 */
export function bangunEkspor({ peserta, percobaan, opsi = {} }) {
  const kodeDari = new Map(peserta.filter(layak).map((p) => [p.id, p]));
  const peta = kelompokPerBab(peserta, percobaan);
  const semua = [...peta.values()].flat();
  const awal = semua.length ? Math.min(...semua.map((r) => r._t)) : 0;
  const kolom = KOLOM_EKSPOR.slice();
  if (opsi.angkatan) kolom.splice(2, 0, KOLOM_OPSI.angkatan);
  if (opsi.kode) kolom.push(KOLOM_OPSI.kode);
  if (opsi.rekaman) kolom.push(KOLOM_OPSI.rekaman);
  const baris = [];
  const urutKunci = [...peta.keys()].sort((a, b) => {
    const pa = kodeDari.get(a.split("|")[0]).kode_riset;
    const pb = kodeDari.get(b.split("|")[0]).kode_riset;
    return pa < pb ? -1 : pa > pb ? 1 : Number(a.split("|")[1]) - Number(b.split("|")[1]);
  });
  const nilai = (v) => (v === null || v === undefined ? "" : v);
  for (const k of urutKunci) {
    const rows = peta.get(k);
    const p = kodeDari.get(k.split("|")[0]);
    const mulaiBab = rows[0]._t;
    rows.forEach((r, i) => {
      const o = r.pola || {};
      const konsep = o.jenis === "konsep";
      const jenis = r.jenis === "jalankan" ? "jalankan" : konsep ? "periksa" : "kirim";
      let hasil = r.hasil || "";
      if (!hasil) hasil = r.jenis === "jalankan" ? (r.galat_jenis ? "galat" : "jalan") : r.lulus ? "lulus" : "gagal";
      const gj = r.hasil === "timeout" ? "Timeout" : r.galat_jenis || "";
      const baru = [
        p.kode_riset,
        r.matakuliah_id || "",
        ...(opsi.angkatan ? [nilai(p.angkatan)] : []),
        Number(r.bab),
        i + 1,
        jenis,
        Math.floor((r._t - awal) / HARI_MS),
        Math.round((r._t - mulaiBab) / 1000),
        hasil,
        gj,
        gj ? kelompokGalat(gj) : "",
        jenis === "jalankan" ? "" : nilai(r.kasus_lulus),
        jenis === "jalankan" ? "" : nilai(r.kasus_total),
        r.cocok_contoh === true ? 1 : r.cocok_contoh === false ? 0 : "",
        nilai(r.petunjuk),
        nilai(o.cps),
        nilai(o.cps_puncak),
        nilai(o.rasio_hapus),
        nilai(o.linier),
        nilai(o.lompat),
        nilai(o.jalankan),
      ];
      if (opsi.kode) baru.push(nilai(r.kode));
      if (opsi.rekaman) baru.push(r.rekaman ? JSON.stringify(r.rekaman) : "");
      baris.push(baru);
    });
  }
  return { kolom, baris, nPeserta: new Set([...peta.keys()].map((k) => k.split("|")[0])).size, nBaris: baris.length };
}

const kutip = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  const aman = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? "'" + s : s;
  return /[",\n\r]/.test(aman) ? '"' + aman.replace(/"/g, '""') + '"' : aman;
};
export function csvEkspor(e) {
  return [e.kolom.map((k) => kutip(k.label)).join(","), ...e.baris.map((b) => b.map(kutip).join(","))].join("\r\n") + "\r\n";
}
export function jsonEkspor(e) {
  return JSON.stringify(e.baris.map((b) => Object.fromEntries(e.kolom.map((k, i) => [k.id, b[i] === "" ? null : b[i]]))), null, 1);
}
/** Kamus data (teks) yang menjelaskan tiap kolom, untuk dikutip di bagian metode paper. */
export function kamusData(e, { mataKuliah = "", dibuat = "" } = {}) {
  const t = ["KAMUS DATA: perilaku belajar memrogram di situs latihan", mataKuliah ? "Mata kuliah: " + mataKuliah : "", dibuat ? "Dibuat: " + dibuat : "", "Peserta: hanya yang menyatakan setuju (" + e.nPeserta + " peserta, " + e.nBaris + " baris). Identitas diganti kode_riset; nama, NIM, kelas, dan tanggal kalender tidak disertakan.", "Satu baris = satu kali tombol Jalankan, Kirim jawaban, atau Periksa jawaban.", "", "Kolom:"].filter((x) => x !== "" || true);
  for (const k of e.kolom) t.push("- " + k.label + ": " + k.deskripsi);
  t.push("", "Catatan: waktu memakai jam server bila ada, jika tidak jam perangkat peserta. Keluaran program peserta tidak disimpan.");
  return t.join("\n") + "\n";
}
