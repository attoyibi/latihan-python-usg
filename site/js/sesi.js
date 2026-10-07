// Mencatat sesi belajar peserta: kapan situs dibuka, berapa lama benar-benar aktif, dan bab apa yang dibuka.
// Dipakai dashboard instruktur untuk kehadiran dan keaktifan. Yang dicatat HANYA waktu dan bab, tanpa isi apa pun.
//
// Aktif berarti tab terlihat DAN ada gerakan (ketuk, ketik, gulir, gerak kursor) dalam IDLE_MS terakhir.
// Menonton video tanpa menyentuh halaman lama-lama tidak terhitung aktif (video YouTube tidak bisa dipantau dari situs).
// Pengiriman gagal tidak pernah mengganggu peserta: waktu yang belum terkirim disimpan dan dicoba lagi di denyut berikutnya.
// Akun instruktur tidak dicatat (supaya uji coba soal tidak mengotori data).
import * as Auth from "./auth.js";

import { Pencatat } from "./pencatat.js";

// ---------- pemasangan di browser ----------
let pencatat = null;
let uidAktif = null;
let timer = null;

const uuid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const h = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return h(8) + "-" + h(4) + "-4" + h(3) + "-8" + h(3) + "-" + h(12);
};

const dicatat = () => !!Auth.getUserId() && !!Auth.getProfile() && Auth.getProfile().peran !== "instruktur" && !!Auth.getClient();

async function kirimServer({ sesi, mk, bab, tambah }) {
  const { error } = await Auth.getClient().rpc("catat_denyut", { p_sesi: sesi, p_matakuliah: mk, p_bab: bab, p_tambah: tambah });
  return !error;
}

function pasang() {
  const uid = Auth.getUserId();
  if (pencatat && uidAktif === uid) return pencatat;
  uidAktif = uid;
  const kunci = "latihan:" + uid + ":sesi";
  pencatat = new Pencatat({
    kirim: kirimServer,
    idBaru: uuid,
    simpan: {
      ambil: () => {
        try {
          return JSON.parse(sessionStorage.getItem(kunci) || "null");
        } catch (e) {
          return null;
        }
      },
      tulis: (v) => {
        try {
          if (v === null) sessionStorage.removeItem(kunci);
          else sessionStorage.setItem(kunci, JSON.stringify(v));
        } catch (e) {}
      },
    },
  });
  if (typeof document !== "undefined") {
    const gerak = () => pencatat && pencatat.ketuk();
    for (const e of ["pointerdown", "keydown", "scroll", "touchstart", "wheel"]) document.addEventListener(e, gerak, { passive: true, capture: true });
    let lastMove = 0;
    document.addEventListener("pointermove", () => {
      const t = Date.now();
      if (t - lastMove > 2000) {
        lastMove = t;
        gerak();
      }
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!pencatat) return;
      pencatat.tik(document.visibilityState === "visible");
      if (document.visibilityState === "hidden") pencatat.denyut(true);
    });
    window.addEventListener("pagehide", () => pencatat && pencatat.denyut(true));
  }
  timer = setInterval(() => {
    if (!pencatat) return;
    if (!dicatat()) return;
    pencatat.tik(typeof document === "undefined" ? true : document.visibilityState === "visible");
    pencatat.denyut();
  }, 5000);
  return pencatat;
}

/** Dipanggil saat peserta membuka satu bab (atau halaman mata kuliah dengan bab null). Aman dipanggil berulang. */
export function catatKonteks(mataKuliah, bab) {
  try {
    if (!dicatat() || !mataKuliah) return;
    const p = pasang();
    p.konteks(mataKuliah, Number.isInteger(bab) ? bab : null);
    p.denyut(true);
  } catch (e) {}
}
/** Dipanggil saat keluar: kirim sisa waktu lalu lupakan sesi (akun berikutnya di perangkat ini mulai bersih). */
export async function akhiriSesi() {
  try {
    if (pencatat) {
      await pencatat.denyut(true);
      pencatat.reset();
    }
    pencatat = null;
    uidAktif = null;
    if (timer) clearInterval(timer);
    timer = null;
  } catch (e) {}
}
