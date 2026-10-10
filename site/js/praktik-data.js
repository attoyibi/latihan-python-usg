// Data praktik per bab: definisi (berkas JSON situs), pekerjaan peserta yang disimpan di browser lebih dulu, dan
// penyusulannya ke Supabase (praktikum_berkas, praktikum_tahap, praktikum_versi; migrasi 0008).
//
// Aturan keselamatan: praktik TIDAK PERNAH mengganggu bagian situs yang lain.
//   * Antrean sendiri (bukan antrean sinkron.js), jadi gagal kirim di sini tidak menahan progres bab.
//   * Bila tabel belum ada (migrasi 0008 belum dijalankan), kirim dihentikan diam-diam dan pekerjaan tetap aman di browser.
//   * Mata kuliah tanpa tanda "praktik": true di matakuliah.json tidak mengambil apa pun (tanpa permintaan jaringan).
import * as Auth from "./auth.js";
import { TAHAP, TAHAP_B, tahapBagian, idPraktik, gabungKeadaan, keadaanKosong, statusDari, statusGabungan, periksaDef, barisBerkas, barisTahap } from "./praktik.js";

const JEDA_MS = 2500;
const ULANG_MS = 30000;
const BATCH_VERSI = 5;

// ---------- definisi ----------
const cacheIdx = new Map();
const cacheDef = new Map();
async function ambilJson(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}
/**
 * Nomor bab yang punya praktik (Set). Kosong bila mata kuliah tidak bertanda praktik atau indeksnya tidak ada.
 * Properti tambahan denganB (Set) berisi bab yang punya Bagian B (kembangkan), dari kolom "bagianB" di index.json.
 */
export function muatIndeks(mk, ada = true) {
  if (!ada) return Promise.resolve(Object.assign(new Set(), { denganB: new Set() }));
  if (!cacheIdx.has(mk)) {
    cacheIdx.set(
      mk,
      ambilJson("data/kuliah/" + mk + "/praktik/index.json").then(
        (j) => {
          const ok = (a) => (Array.isArray(a) ? a : []).filter((n) => Number.isInteger(n));
          const s = new Set(ok(j.bab));
          s.denganB = new Set(ok(j.bagianB).filter((n) => s.has(n)));
          return s;
        },
        () => Object.assign(new Set(), { denganB: new Set() })
      )
    );
  }
  return cacheIdx.get(mk);
}
/** Definisi praktik satu bab, atau null bila tidak ada atau bentuknya salah. */
export function muatPraktik(mk, bab) {
  const k = mk + "|" + bab;
  if (!cacheDef.has(k)) {
    cacheDef.set(
      k,
      ambilJson("data/kuliah/" + mk + "/praktik/bab-" + String(bab).padStart(2, "0") + ".json").then(
        (d) => (periksaDef(d).length ? null : d),
        () => null
      )
    );
  }
  return cacheDef.get(k);
}

// ---------- keadaan lokal ----------
// Bagian A disimpan di "pk2:<mata kuliah>:<bab>", Bagian B di "pk2b:<mata kuliah>:<bab>".
export const kunciLokal = (mk, bab, bagian = "A") => (bagian === "B" ? "pk2b:" : "pk2:") + mk + ":" + bab;
export function bacaLokal(store, mk, bab, bagian = "A") {
  const x = store.get(kunciLokal(mk, bab, bagian), null);
  return Object.assign(keadaanKosong(), x && typeof x === "object" && !Array.isArray(x) ? x : {});
}
export const simpanLokal = (store, mk, bab, s, bagian = "A") => store.set(kunciLokal(mk, bab, bagian), s);
/** Status satu bab (gabungan A dan B bila bab itu punya Bagian B). */
export const statusLokal = (store, mk, bab, adaB = false) => statusGabungan(adaB, statusDari(bacaLokal(store, mk, bab)), adaB ? statusDari(bacaLokal(store, mk, bab, "B")) : "belum");

// ---------- antrean ke server ----------
let uid = null;
let antre = { berkas: {}, tahap: {}, versi: [], laporan: {} };
let timer = null;
let berjalan = false;
let tabelAda = true;
export const tabelPraktikumAda = () => tabelAda;

const kunciAntrean = (u) => "latihan:" + u + ":antrean-praktik";
export const aktif = () => Auth.enabled() && !!Auth.getUserId() && !!Auth.getProfile() && !!Auth.getClient();
function pakaiAkun() {
  const u = Auth.getUserId();
  if (u === uid) return;
  uid = u;
  antre = { berkas: {}, tahap: {}, versi: [], laporan: {} };
  try {
    const x = JSON.parse(localStorage.getItem(kunciAntrean(u)) || "null");
    if (x) antre = Object.assign(antre, { berkas: x.berkas || {}, tahap: x.tahap || {}, versi: x.versi || [], laporan: x.laporan || {} });
  } catch (e) {}
}
const simpanAntrean = () => {
  try {
    localStorage.setItem(kunciAntrean(uid), JSON.stringify(antre));
  } catch (e) {}
};
const jadwalkan = (ms) => {
  clearTimeout(timer);
  timer = setTimeout(kirimSekarang, ms);
};

/**
 * Menyusulkan pekerjaan satu bagian praktik ke server: berkas (isi), status, dan bila diminta satu versi (hasil Periksa).
 * @param {"A"|"B"} bagian  @param {{berkas:string}} defBagian definisi bagian itu (Bagian A: definisi praktiknya sendiri)
 */
export function sinkronkan(mk, bab, bagian, defBagian, s, versi = null) {
  if (!aktif() || !tabelAda) return;
  pakaiAkun();
  const pid = idPraktik(bab);
  const tid = tahapBagian(bagian);
  if (typeof s.isi === "string") antre.berkas[[mk, pid, defBagian.berkas].join("|")] = barisBerkas(mk, pid, defBagian.berkas, { isi: s.isi, asal: "milik" });
  antre.tahap[[mk, pid, tid].join("|")] = barisTahap(mk, pid, tid, s);
  if (versi) {
    antre.versi.push({ matakuliah_id: mk, praktikum_id: pid, tahap_id: tid, berkas: { [defBagian.berkas]: s.isi }, hasil: versi.hasil, lulus: !!versi.lulus, dibuat_pada: new Date().toISOString() });
    if (antre.versi.length > 40) antre.versi.splice(0, antre.versi.length - 40);
  }
  simpanAntrean();
  jadwalkan(versi ? 0 : JEDA_MS);
}

/** Form akhir (laporan akhir) disimpan di praktikum_laporan dengan praktikum_id "akhir". baris: kolom tabel tanpa user_id. */
export function antreLaporanAkhir(mk, baris) {
  if (!aktif() || !tabelAda) return;
  pakaiAkun();
  antre.laporan[mk] = Object.assign({ matakuliah_id: mk, praktikum_id: "akhir" }, baris);
  simpanAntrean();
  jadwalkan(JEDA_MS);
}

// Galat data tidak akan berhasil walau diulang: dibuang supaya tidak menyumbat. Tabel belum ada: berhenti mencoba.
const galatPermanen = (e) => !!e && typeof e.code === "string" && (e.code.startsWith("22") || e.code === "23514" || e.code === "23502" || e.code === "23503");
export const tabelBelumAda = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(String(e.message || "")));

export async function kirimSekarang() {
  if (berjalan || !aktif() || !tabelAda) return;
  pakaiAkun();
  const adaIsi = () => Object.keys(antre.berkas).length || Object.keys(antre.tahap).length || antre.versi.length || Object.keys(antre.laporan).length;
  if (!adaIsi()) return;
  berjalan = true;
  const klien = Auth.getClient();
  const u = Auth.getUserId();
  const dengan = (r) => Object.assign({ user_id: u }, r);
  const periksa = (error) => {
    if (!error) return;
    if (tabelBelumAda(error)) {
      tabelAda = false;
      throw Object.assign(new Error("tabel praktikum belum ada"), { berhenti: true });
    }
    if (!galatPermanen(error)) throw error;
  };
  try {
    const berkas = Object.entries(antre.berkas);
    if (berkas.length) {
      const { error } = await klien.from("praktikum_berkas").upsert(berkas.map(([, r]) => dengan(r)), { onConflict: "user_id,matakuliah_id,praktikum_id,nama" });
      periksa(error);
      for (const [k, v] of berkas) if (antre.berkas[k] === v) delete antre.berkas[k];
    }
    const tahap = Object.entries(antre.tahap);
    if (tahap.length) {
      const { error } = await klien.from("praktikum_tahap").upsert(tahap.map(([, r]) => dengan(r)), { onConflict: "user_id,matakuliah_id,praktikum_id,tahap_id" });
      periksa(error);
      for (const [k, v] of tahap) if (antre.tahap[k] === v) delete antre.tahap[k];
    }
    const lap = Object.entries(antre.laporan);
    if (lap.length) {
      const { error } = await klien.from("praktikum_laporan").upsert(lap.map(([, r]) => dengan(r)), { onConflict: "user_id,matakuliah_id,praktikum_id" });
      periksa(error);
      for (const [k, v] of lap) if (antre.laporan[k] === v) delete antre.laporan[k];
    }
    while (antre.versi.length) {
      const bagian = antre.versi.slice(0, BATCH_VERSI);
      const { error } = await klien.from("praktikum_versi").insert(bagian.map(dengan));
      periksa(error);
      antre.versi = antre.versi.slice(bagian.length);
      simpanAntrean();
    }
    simpanAntrean();
    if (adaIsi()) jadwalkan(JEDA_MS);
  } catch (e) {
    if (!e.berhenti) jadwalkan(ULANG_MS);
  } finally {
    berjalan = false;
  }
}

// ---------- membaca dari server ----------
const sudahDisusul = new Set();
/**
 * Menggabungkan pekerjaan satu bab di server ke lokal (sekali per bab per muat halaman). true bila ada yang berubah.
 * @param {object} def definisi praktik (nama berkas Bagian A dan, bila ada, Bagian B)
 */
export async function susulPraktik(store, mk, bab, def) {
  if (!aktif() || !tabelAda) return false;
  const id = [Auth.getUserId(), mk, bab].join("|");
  if (sudahDisusul.has(id)) return false;
  sudahDisusul.add(id);
  const klien = Auth.getClient();
  const u = Auth.getUserId();
  const pid = idPraktik(bab);
  const baca = (t) => klien.from(t).select("*").eq("user_id", u).eq("matakuliah_id", mk).eq("praktikum_id", pid);
  try {
    const [b, t] = await Promise.all([baca("praktikum_berkas"), baca("praktikum_tahap")]);
    for (const r of [b, t]) {
      if (r.error) {
        if (tabelBelumAda(r.error)) tabelAda = false;
        sudahDisusul.delete(id);
        return false;
      }
    }
    let berubah = false;
    const bagian = [["A", def && def.berkas], ...(def && def.bagianB ? [["B", def.bagianB.berkas]] : [])];
    for (const [nama, berkas] of bagian) {
      const lokal = bacaLokal(store, mk, bab, nama);
      const gab = gabungKeadaan(lokal, (b.data || []).find((r) => r.nama === berkas) || null, (t.data || []).find((r) => r.tahap_id === tahapBagian(nama)) || null);
      if (JSON.stringify(gab) !== JSON.stringify(lokal)) {
        simpanLokal(store, mk, bab, gab, nama);
        berubah = true;
      }
    }
    return berubah;
  } catch (e) {
    sudahDisusul.delete(id);
    return false;
  }
}
let statusKuliahDisusul = null;
/** Status praktik semua bab di satu mata kuliah (satu permintaan), digabung ke lokal untuk tanda di daftar bab. */
export async function susulStatusKuliah(store, mk) {
  if (!aktif() || !tabelAda) return false;
  const id = Auth.getUserId() + "|" + mk;
  if (statusKuliahDisusul === id) return false;
  statusKuliahDisusul = id;
  try {
    const { data, error } = await Auth.getClient().from("praktikum_tahap").select("praktikum_id,tahap_id,status,jumlah_kirim,pertama_dibuka,lulus_pada").eq("user_id", Auth.getUserId()).eq("matakuliah_id", mk);
    if (error) {
      if (tabelBelumAda(error)) tabelAda = false;
      statusKuliahDisusul = null;
      return false;
    }
    let berubah = false;
    for (const r of data || []) {
      const m = /^bab-(\d{2})$/.exec(r.praktikum_id || "");
      if (!m || (r.tahap_id !== TAHAP && r.tahap_id !== TAHAP_B)) continue;
      const bab = Number(m[1]);
      const bagian = r.tahap_id === TAHAP_B ? "B" : "A";
      const lokal = bacaLokal(store, mk, bab, bagian);
      const gab = gabungKeadaan(lokal, null, r);
      if (JSON.stringify(gab) !== JSON.stringify(lokal)) {
        simpanLokal(store, mk, bab, gab, bagian);
        berubah = true;
      }
    }
    return berubah;
  } catch (e) {
    statusKuliahDisusul = null;
    return false;
  }
}

// Kirim sisa antrean saat halaman disembunyikan atau koneksi pulih.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => jadwalkan(0));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") kirimSekarang();
  });
}

