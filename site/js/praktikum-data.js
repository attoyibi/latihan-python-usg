// Data praktikum: definisi (berkas JSON situs), pekerjaan peserta yang disimpan di browser lebih dulu, dan penyusulannya ke
// Supabase (praktikum_berkas, praktikum_tahap, praktikum_versi, praktikum_laporan; migrasi 0008).
//
// Aturan keselamatan: praktikum TIDAK PERNAH mengganggu bagian situs yang lain.
//   * Antrean sendiri (bukan antrean sinkron.js), jadi gagal kirim di sini tidak menahan progres bab.
//   * Bila tabel belum ada (migrasi 0008 belum dijalankan), kirim dihentikan diam-diam dan pekerjaan tetap aman di browser.
//   * Mata kuliah tanpa folder praktikum/ tidak menghasilkan apa pun (daftar kosong).
import * as Auth from "./auth.js";
import { gabungkan, laporanKosong } from "./laporan.js";
import { barisBerkas, barisTahap } from "./praktikum.js";

const JEDA_MS = 2500;
const ULANG_MS = 30000;
const BATCH_VERSI = 5;

// ---------- definisi ----------
const cacheDef = new Map();
async function ambilJson(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}
/**
 * Daftar praktikum lengkap (dengan tahap) untuk satu mata kuliah. Hanya mata kuliah bertanda "praktikum": true di matakuliah.json
 * yang dicari; yang lain langsung kosong tanpa permintaan jaringan.
 */
export function muatDaftar(mk, ada = true) {
  if (!ada) return Promise.resolve([]);
  if (!cacheDef.has(mk)) {
    cacheDef.set(
      mk,
      (async () => {
        let index = [];
        try {
          index = await ambilJson("data/kuliah/" + mk + "/praktikum/index.json");
        } catch (e) {
          return [];
        }
        const hasil = [];
        for (const p of Array.isArray(index) ? index : []) {
          try {
            const j = await ambilJson("data/kuliah/" + mk + "/praktikum/" + p.berkas);
            if (j && Array.isArray(j.tahap) && j.tahap.length) hasil.push(j);
          } catch (e) {}
        }
        return hasil;
      })()
    );
  }
  return cacheDef.get(mk);
}

// ---------- keadaan lokal ----------
export const kunciKerja = (mk, pid) => "pk:" + mk + ":" + pid;
export const kerjaKosong = () => ({ berkas: {}, tahap: {}, laporan: null, riwayat: [], v: 1 });

export function bacaKerja(store, mk, pid) {
  const x = store.get(kunciKerja(mk, pid), null);
  return Object.assign(kerjaKosong(), x && typeof x === "object" ? x : {});
}
export function simpanKerja(store, mk, pid, kerja) {
  store.set(kunciKerja(mk, pid), kerja);
}
/** Peta tahap_id -> baris status dari keadaan lokal. */
export const petaTahapLokal = (kerja) => new Map(Object.entries(kerja.tahap || {}).map(([id, r]) => [id, Object.assign({ tahap_id: id }, r)]));

// ---------- penggabungan dengan server ----------
const peringkat = { belum: 0, sedang: 1, dilewati: 2, lulus: 3 };
const lebihBaru = (a, b) => String(a || "") > String(b || "");

/** Berkas: untuk tiap nama, yang waktunya lebih baru menang. Berkas yang dihapus di lokal (nisan) tidak dihidupkan lagi. */
export function gabungBerkas(lokal, baris, hapus = []) {
  const hasil = Object.assign({}, lokal);
  const nisan = new Set(hapus);
  for (const r of baris || []) {
    if (nisan.has(r.nama)) continue;
    const ada = hasil[r.nama];
    if (!ada || lebihBaru(r.diperbarui_pada, ada.t)) hasil[r.nama] = { isi: r.isi, asal: r.asal || "milik", t: r.diperbarui_pada };
  }
  return hasil;
}
/** Status tahap: yang lebih jauh (lulus > dilewati > sedang > belum) dipertahankan; jumlah kirim diambil yang terbesar. */
export function gabungTahap(lokal, baris) {
  const hasil = Object.assign({}, lokal);
  for (const r of baris || []) {
    const ada = hasil[r.tahap_id];
    const dariServer = { status: r.status, jalur: r.jalur, jumlah_kirim: r.jumlah_kirim, pertama_dibuka: r.pertama_dibuka, lulus_pada: r.lulus_pada, pakai_contoh: r.pakai_contoh, centang: r.centang || {} };
    if (!ada) hasil[r.tahap_id] = dariServer;
    else
      hasil[r.tahap_id] = Object.assign({}, peringkat[dariServer.status] > peringkat[ada.status] ? dariServer : ada, {
        jumlah_kirim: Math.max(ada.jumlah_kirim || 0, dariServer.jumlah_kirim || 0),
        centang: Object.assign({}, dariServer.centang, ada.centang),
        pertama_dibuka: ada.pertama_dibuka || dariServer.pertama_dibuka,
        lulus_pada: ada.lulus_pada || dariServer.lulus_pada,
      });
  }
  return hasil;
}
export const gabungLaporan = (lokal, baris) => (baris ? Object.assign(laporanKosong(), gabungkan(lokal || null, baris)) : lokal);

// ---------- antrean ke server ----------
let uid = null;
let antre = { berkas: {}, hapus: {}, tahap: {}, laporan: {}, versi: [] };
let timer = null;
let berjalan = false;
let tabelAda = true;
export const tabelPraktikumAda = () => tabelAda;

const kunciAntrean = (u) => "latihan:" + u + ":antrean-praktikum";
export const aktif = () => Auth.enabled() && !!Auth.getUserId() && !!Auth.getProfile() && !!Auth.getClient();
function pakaiAkun() {
  const u = Auth.getUserId();
  if (u === uid) return;
  uid = u;
  antre = { berkas: {}, hapus: {}, tahap: {}, laporan: {}, versi: [] };
  try {
    const x = JSON.parse(localStorage.getItem(kunciAntrean(u)) || "null");
    if (x) antre = Object.assign(antre, x);
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
const kb = (mk, pid, extra) => [mk, pid, extra].join("|");

export function antreBerkas(mk, pid, nama, b) {
  if (!aktif() || !tabelAda) return;
  pakaiAkun();
  delete antre.hapus[kb(mk, pid, nama)];
  antre.berkas[kb(mk, pid, nama)] = barisBerkas(mk, pid, nama, b);
  simpanAntrean();
  jadwalkan(JEDA_MS);
}
export function antreHapusBerkas(mk, pid, nama) {
  if (!aktif() || !tabelAda) return;
  pakaiAkun();
  delete antre.berkas[kb(mk, pid, nama)];
  antre.hapus[kb(mk, pid, nama)] = { matakuliah_id: mk, praktikum_id: pid, nama };
  simpanAntrean();
  jadwalkan(JEDA_MS);
}
export function antreTahap(mk, pid, tid, r) {
  if (!aktif() || !tabelAda) return;
  pakaiAkun();
  antre.tahap[kb(mk, pid, tid)] = barisTahap(mk, pid, tid, r);
  simpanAntrean();
  jadwalkan(JEDA_MS);
}
export function antreLaporan(mk, pid, baris) {
  if (!aktif() || !tabelAda) return;
  pakaiAkun();
  antre.laporan[kb(mk, pid, "")] = Object.assign({ matakuliah_id: mk, praktikum_id: pid }, baris);
  simpanAntrean();
  jadwalkan(JEDA_MS);
}
/** Satu versi (setiap Kirim): salinan semua berkas beserta hasil ujinya. */
export function antreVersi(mk, pid, tid, berkasIsi, hasil, lulus) {
  if (!aktif() || !tabelAda) return;
  pakaiAkun();
  antre.versi.push({ matakuliah_id: mk, praktikum_id: pid, tahap_id: tid, berkas: berkasIsi, hasil, lulus: !!lulus, dibuat_pada: new Date().toISOString() });
  if (antre.versi.length > 40) antre.versi.splice(0, antre.versi.length - 40);
  simpanAntrean();
  jadwalkan(0);
}

// Galat data tidak akan berhasil walau diulang: dibuang supaya tidak menyumbat. Tabel belum ada: berhenti mencoba.
const galatPermanen = (e) => !!e && typeof e.code === "string" && (e.code.startsWith("22") || e.code === "23514" || e.code === "23502" || e.code === "23503");
export const tabelBelumAda = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(String(e.message || "")));

export async function kirimSekarang() {
  if (berjalan || !aktif() || !tabelAda) return;
  pakaiAkun();
  const adaIsi = () => Object.keys(antre.berkas).length || Object.keys(antre.hapus).length || Object.keys(antre.tahap).length || Object.keys(antre.laporan).length || antre.versi.length;
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
    for (const [k, r] of Object.entries(antre.hapus)) {
      const { error } = await klien.from("praktikum_berkas").delete().eq("user_id", u).eq("matakuliah_id", r.matakuliah_id).eq("praktikum_id", r.praktikum_id).eq("nama", r.nama);
      periksa(error);
      delete antre.hapus[k];
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
    const lap = Object.entries(antre.laporan);
    if (lap.length) {
      const { error } = await klien.from("praktikum_laporan").upsert(lap.map(([, r]) => dengan(r)), { onConflict: "user_id,matakuliah_id,praktikum_id" });
      periksa(error);
      for (const [k, v] of lap) if (antre.laporan[k] === v) delete antre.laporan[k];
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
/** Pekerjaan peserta di server untuk satu praktikum, atau null bila belum bisa dibaca (offline, tabel belum ada). */
export async function ambilServer(mk, pid) {
  if (!aktif() || !tabelAda) return null;
  const klien = Auth.getClient();
  const u = Auth.getUserId();
  const baca = (t) => klien.from(t).select("*").eq("user_id", u).eq("matakuliah_id", mk).eq("praktikum_id", pid);
  try {
    const [b, t, l] = await Promise.all([baca("praktikum_berkas"), baca("praktikum_tahap"), baca("praktikum_laporan")]);
    for (const r of [b, t, l]) {
      if (r.error) {
        if (tabelBelumAda(r.error)) tabelAda = false;
        return null;
      }
    }
    return { berkas: b.data || [], tahap: t.data || [], laporan: (l.data || [])[0] || null };
  } catch (e) {
    return null;
  }
}
/** Riwayat versi satu tahap (terbaru lebih dulu, paling banyak 20). Kosong bila belum bisa dibaca. */
export async function ambilVersi(mk, pid, tid) {
  if (!aktif() || !tabelAda) return [];
  try {
    const { data, error } = await Auth.getClient().from("praktikum_versi").select("*").eq("user_id", Auth.getUserId()).eq("matakuliah_id", mk).eq("praktikum_id", pid).eq("tahap_id", tid).order("id");
    if (error) return [];
    return (data || []).slice().sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 20);
  } catch (e) {
    return [];
  }
}

// Kirim sisa antrean saat halaman disembunyikan atau koneksi pulih.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => jadwalkan(0));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") kirimSekarang();
  });
}
