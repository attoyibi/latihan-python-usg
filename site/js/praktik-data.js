// Data praktik per bab: definisi (berkas JSON situs), pekerjaan peserta yang disimpan di browser lebih dulu, dan
// penyusulannya ke Supabase (praktikum_berkas, praktikum_tahap, praktikum_versi; migrasi 0008).
//
// Aturan keselamatan: praktik TIDAK PERNAH mengganggu bagian situs yang lain.
//   * Antrean sendiri (bukan antrean sinkron.js), jadi gagal kirim di sini tidak menahan progres bab.
//   * Bila tabel belum ada (migrasi 0008 belum dijalankan), kirim dihentikan diam-diam dan pekerjaan tetap aman di browser.
//   * Mata kuliah tanpa tanda "praktik": true di matakuliah.json tidak mengambil apa pun (tanpa permintaan jaringan).
import * as Auth from "./auth.js";
import { TAHAP, idPraktik, gabungKeadaan, keadaanKosong, statusDari, periksaDef, barisBerkas, barisTahap } from "./praktik.js";

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
/** Nomor bab yang punya praktik (Set). Kosong bila mata kuliah tidak bertanda praktik atau indeksnya tidak ada. */
export function muatIndeks(mk, ada = true) {
  if (!ada) return Promise.resolve(new Set());
  if (!cacheIdx.has(mk)) {
    cacheIdx.set(
      mk,
      ambilJson("data/kuliah/" + mk + "/praktik/index.json").then(
        (j) => new Set((Array.isArray(j.bab) ? j.bab : []).filter((n) => Number.isInteger(n))),
        () => new Set()
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
export const kunciLokal = (mk, bab) => "pk2:" + mk + ":" + bab;
export function bacaLokal(store, mk, bab) {
  const x = store.get(kunciLokal(mk, bab), null);
  return Object.assign(keadaanKosong(), x && typeof x === "object" && !Array.isArray(x) ? x : {});
}
export const simpanLokal = (store, mk, bab, s) => store.set(kunciLokal(mk, bab), s);
export const statusLokal = (store, mk, bab) => statusDari(bacaLokal(store, mk, bab));

// ---------- antrean ke server ----------
let uid = null;
let antre = { berkas: {}, tahap: {}, versi: [] };
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
  antre = { berkas: {}, tahap: {}, versi: [] };
  try {
    const x = JSON.parse(localStorage.getItem(kunciAntrean(u)) || "null");
    if (x) antre = Object.assign(antre, { berkas: x.berkas || {}, tahap: x.tahap || {}, versi: x.versi || [] });
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

/** Menyusulkan pekerjaan satu bab ke server: berkas (isi), status, dan bila diminta satu versi (hasil Periksa). */
export function sinkronkan(mk, bab, def, s, versi = null) {
  if (!aktif() || !tabelAda) return;
  pakaiAkun();
  const pid = idPraktik(bab);
  if (typeof s.isi === "string") antre.berkas[mk + "|" + pid] = barisBerkas(mk, pid, def.berkas, { isi: s.isi, asal: "milik" });
  antre.tahap[mk + "|" + pid] = barisTahap(mk, pid, TAHAP, s);
  if (versi) {
    antre.versi.push({ matakuliah_id: mk, praktikum_id: pid, tahap_id: TAHAP, berkas: { [def.berkas]: s.isi }, hasil: versi.hasil, lulus: !!versi.lulus, dibuat_pada: new Date().toISOString() });
    if (antre.versi.length > 40) antre.versi.splice(0, antre.versi.length - 40);
  }
  simpanAntrean();
  jadwalkan(versi ? 0 : JEDA_MS);
}

// Galat data tidak akan berhasil walau diulang: dibuang supaya tidak menyumbat. Tabel belum ada: berhenti mencoba.
const galatPermanen = (e) => !!e && typeof e.code === "string" && (e.code.startsWith("22") || e.code === "23514" || e.code === "23502" || e.code === "23503");
export const tabelBelumAda = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(String(e.message || "")));

export async function kirimSekarang() {
  if (berjalan || !aktif() || !tabelAda) return;
  pakaiAkun();
  const adaIsi = () => Object.keys(antre.berkas).length || Object.keys(antre.tahap).length || antre.versi.length;
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
/** Menggabungkan pekerjaan satu bab di server ke lokal (sekali per bab per muat halaman). true bila ada yang berubah. */
export async function susulPraktik(store, mk, bab) {
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
    const lokal = bacaLokal(store, mk, bab);
    const gab = gabungKeadaan(lokal, (b.data || [])[0] || null, (t.data || []).find((r) => r.tahap_id === TAHAP) || null);
    if (JSON.stringify(gab) === JSON.stringify(lokal)) return false;
    simpanLokal(store, mk, bab, gab);
    return true;
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
      if (!m || r.tahap_id !== TAHAP) continue;
      const bab = Number(m[1]);
      const lokal = bacaLokal(store, mk, bab);
      const gab = gabungKeadaan(lokal, null, r);
      if (JSON.stringify(gab) !== JSON.stringify(lokal)) {
        simpanLokal(store, mk, bab, gab);
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

