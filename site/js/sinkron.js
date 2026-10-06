// Menyimpan progres peserta ke Supabase (tabel progres dan percobaan) supaya instruktur bisa melihatnya
// dan peserta tidak kehilangan progres saat berganti perangkat. Progres tetap ditulis lebih dulu ke
// browser; modul ini menyusulkannya ke server tanpa pernah menghalangi peserta mengerjakan soal.
//
//   tandai(mataKuliah, ringkasan)  ringkasan satu bab berubah (dikirim setelah jeda singkat)
//   catat(mataKuliah, bab, data)   satu kali "Kirim jawaban" (riwayat percobaan beserta kodenya)
//   aktivitas(mataKuliah, bab, jenis, detail)  jejak kecil (mis. percobaan tempel yang diblokir), digabung per jenis dan bab
//   ambilProgres(mataKuliah)       progres milik peserta di server (untuk digabung saat masuk)
//
// Bila pengiriman gagal (offline, server sibuk), data disimpan di antrean browser dan dicoba lagi.
import * as Auth from "./auth.js";

const JEDA_MS = 2500;
const ULANG_MS = 30000;
const MAKS_KODE = 20000;

let uidAntrean = null;
let progres = new Map(); // "mk|bab" -> baris progres
let percobaan = []; // baris percobaan menunggu kirim
let jejak = []; // baris aktivitas menunggu kirim
let timer = null;
let berjalan = false;
let status = "diam"; // diam | menyimpan | tersimpan | gagal
const pendengar = [];

export const aktif = () => Auth.enabled() && !!Auth.getUserId() && !!Auth.getProfile() && !!Auth.getClient();
export const statusSinkron = () => status;
export function onStatus(cb) {
  pendengar.push(cb);
  cb(status);
}
function setStatus(s) {
  status = s;
  pendengar.forEach((cb) => cb(s));
}

const kunciAntrean = (uid) => "latihan:" + uid + ":antrean-sinkron";

// Antrean dipisah per akun supaya komputer bersama tidak mengirim data orang lain.
function pakaiAkun() {
  const uid = Auth.getUserId();
  if (uid === uidAntrean) return;
  uidAntrean = uid;
  progres = new Map();
  percobaan = [];
  jejak = [];
  try {
    const x = JSON.parse(localStorage.getItem(kunciAntrean(uid)) || "null");
    if (x) {
      progres = new Map(x.progres || []);
      percobaan = x.percobaan || [];
      jejak = x.jejak || [];
    }
  } catch (e) {}
}

function simpanAntrean() {
  try {
    localStorage.setItem(kunciAntrean(uidAntrean), JSON.stringify({ progres: [...progres.entries()], percobaan, jejak }));
  } catch (e) {}
}

function jadwalkan(ms) {
  clearTimeout(timer);
  timer = setTimeout(kirimSekarang, ms);
}

export function tandai(mataKuliah, ringkasan) {
  if (!aktif()) return;
  pakaiAkun();
  progres.set(mataKuliah + "|" + ringkasan.bab, Object.assign({ matakuliah_id: mataKuliah }, ringkasan));
  simpanAntrean();
  jadwalkan(JEDA_MS);
}

export function catat(mataKuliah, bab, data) {
  if (!aktif()) return;
  pakaiAkun();
  const kode = typeof data.kode === "string" ? data.kode.slice(0, MAKS_KODE) : null;
  percobaan.push({ matakuliah_id: mataKuliah, bab, jenis: "kirim", lulus: !!data.lulus, kasus_lulus: data.kasus_lulus, kasus_total: data.kasus_total, kasus_gagal: data.kasus_gagal || [], kode, pola: data.pola || null, rekaman: data.rekaman || null, dibuat_pada: new Date().toISOString() });
  simpanAntrean();
  jadwalkan(0);
}

// Jejak aktivitas. Kejadian beruntun dengan jenis dan bab sama digabung menjadi satu baris berisi jumlahnya,
// supaya tidak membanjiri tabel. Isi yang dicoba ditempel TIDAK pernah dicatat, hanya jumlahnya.
export function aktivitas(mataKuliah, bab, jenis, detail = {}) {
  if (!aktif()) return;
  pakaiAkun();
  const ada = jejak.find((j) => j.matakuliah_id === mataKuliah && j.bab === bab && j.jenis === jenis && JSON.stringify(j.detail && j.detail.lokasi) === JSON.stringify(detail.lokasi));
  if (ada) ada.detail.jumlah = (ada.detail.jumlah || 1) + 1;
  else jejak.push({ matakuliah_id: mataKuliah, bab, jenis, detail: Object.assign({ jumlah: 1 }, detail), dibuat_pada: new Date().toISOString() });
  simpanAntrean();
  jadwalkan(JEDA_MS * 2);
}

// Galat data (aturan CHECK, tipe) tidak akan berhasil walau diulang; buang batch itu supaya tidak
// menyumbat antrean selamanya. Galat lain (jaringan, izin sementara) dicoba lagi.
const galatPermanen = (e) => !!e && typeof e.code === "string" && (e.code.startsWith("22") || e.code === "23514" || e.code === "23502");

export async function kirimSekarang() {
  if (berjalan || !aktif()) return;
  pakaiAkun();
  if (!progres.size && !percobaan.length && !jejak.length) return;
  berjalan = true;
  setStatus("menyimpan");
  const client = Auth.getClient();
  const uid = Auth.getUserId();
  try {
    if (progres.size) {
      const kirim = [...progres.entries()];
      const { error } = await client.from("progres").upsert(
        kirim.map(([, r]) => Object.assign({ user_id: uid }, r)),
        { onConflict: "user_id,matakuliah_id,bab" }
      );
      if (error && !galatPermanen(error)) throw error;
      for (const [k, v] of kirim) if (progres.get(k) === v) progres.delete(k);
    }
    if (percobaan.length) {
      const n = percobaan.length;
      const { error } = await client.from("percobaan").insert(percobaan.slice(0, n).map((r) => Object.assign({ user_id: uid }, r)));
      if (error && !galatPermanen(error)) throw error;
      percobaan = percobaan.slice(n);
    }
    if (jejak.length) {
      const n = jejak.length;
      const { error } = await client.from("aktivitas").insert(jejak.slice(0, n).map((r) => Object.assign({ user_id: uid }, r)));
      if (error && !galatPermanen(error)) throw error;
      jejak = jejak.slice(n);
    }
    simpanAntrean();
    setStatus("tersimpan");
    if (progres.size || percobaan.length || jejak.length) jadwalkan(JEDA_MS);
  } catch (e) {
    setStatus("gagal");
    jadwalkan(ULANG_MS);
  } finally {
    berjalan = false;
  }
}

// Mencatat perangkat (ID acak browser) yang dipakai akun ini masuk, sekali per muat halaman per akun.
// Gagal tidak mengganggu apa pun; dicoba lagi pada muat halaman berikutnya.
let perangkatDilapor = null;
export async function laporPerangkat(deviceId, agen) {
  if (!aktif()) return false;
  const uid = Auth.getUserId();
  if (perangkatDilapor === uid + "|" + deviceId) return true;
  try {
    const { error } = await Auth.getClient().rpc("catat_perangkat", { p_device: deviceId, p_agen: agen || null });
    if (error) return false;
    perangkatDilapor = uid + "|" + deviceId;
    return true;
  } catch (e) {
    return false;
  }
}

// Progres peserta di server untuk satu mata kuliah: daftar baris progres, atau null bila gagal dibaca.
export async function ambilProgres(mataKuliah) {
  if (!aktif()) return null;
  const { data, error } = await Auth.getClient().from("progres").select("*").eq("user_id", Auth.getUserId()).eq("matakuliah_id", mataKuliah);
  if (error) return null;
  return data || [];
}

// Kirim sisa antrean saat peserta menutup atau menyembunyikan halaman, dan saat koneksi pulih.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => jadwalkan(0));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") kirimSekarang();
  });
}
