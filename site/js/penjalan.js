// Pemantau satu Web Worker penjalan kode (Python atau Java): memuat, menandai siap, mendeteksi GAGAL, dan memulai
// ulang. Dipakai bersama oleh runner.js (Python) dan javarunner.js (Java).
//
// Cara gagal yang dikenali (semuanya berujung pesan yang bisa dibaca peserta dan tombol "Coba lagi"):
//  - skrip worker atau pustakanya tidak bisa diunduh (internet putus, diblokir)  -> peristiwa error pada worker
//  - memuat terlalu lama (koneksi sangat lambat)                                 -> batas waktu muat
//  - worker melaporkan galat saat menyiapkan                                      -> pesan "fatal"
//  - worker mati mendadak setelah siap (di ponsel biasanya memori penuh)         -> peristiwa error pada worker
// Bila seluruh halaman dimatikan browser karena memori, tidak ada yang bisa ditangkap; peserta cukup membuka ulang.
import { catatLama } from "./kemajuan.js";

const batasMuat = (bawaan) => {
  const x = typeof window !== "undefined" && window.APP_CONFIG ? Number(window.APP_CONFIG.MUAT_MAKS_MS) : 0;
  return x > 0 ? x : bawaan;
};

export const PESAN = {
  muat: "Berkas penjalan tidak bisa diunduh. Biasanya karena internet putus atau diblokir (pemblokir iklan, jaringan kampus).",
  lama: (detik) => "Memuat lebih dari " + detik + " detik, koneksi mungkin sangat lambat.",
  mati: "Penjalan berhenti mendadak. Di ponsel biasanya karena memori penuh.",
};

/**
 * @param {{nama:string, urlWorker:string, pesanInit?:object, maksMuatMs:number}} o
 */
export function buatPemantau(o) {
  let worker = null;
  let siap = false;
  let gagal = null; // { pesan }
  let mulaiPada = Date.now();
  let penunggu = []; // [{resolve, reject}] yang menunggu siap
  let timerMuat = null;
  let seq = 0;
  const pendengar = [];
  const tertunda = new Set(); // penyelesai pekerjaan yang sedang berjalan

  const beri = () => pendengar.slice().forEach((cb) => cb(siap, gagal));

  function tandaiGagal(pesan) {
    if (gagal) return;
    clearTimeout(timerMuat);
    gagal = { pesan };
    siap = false;
    if (worker) {
      worker.terminate();
      worker = null;
    }
    const m = penunggu;
    penunggu = [];
    m.forEach((p) => p.reject(new Error(pesan)));
    tertunda.forEach((selesai) => selesai({ timeout: false, stdout: "", error: pesan + " Tekan Coba lagi di atas editor." }));
    tertunda.clear();
    beri();
  }

  function spawn() {
    gagal = null;
    siap = false;
    mulaiPada = Date.now();
    const w = new Worker(o.urlWorker);
    worker = w;
    const maks = batasMuat(o.maksMuatMs);
    timerMuat = setTimeout(() => {
      if (worker === w && !siap) tandaiGagal(PESAN.lama(Math.round(maks / 1000)));
    }, maks);
    w.addEventListener("error", (e) => {
      if (worker !== w) return;
      if (e && e.preventDefault) e.preventDefault();
      tandaiGagal(siap ? PESAN.mati : PESAN.muat);
    });
    w.addEventListener("message", function h(e) {
      const m = e.data;
      if (!m || worker !== w) return;
      if (m.type === "ready") {
        w.removeEventListener("message", h);
        clearTimeout(timerMuat);
        siap = true;
        catatLama(o.nama, Date.now() - mulaiPada);
        const p = penunggu;
        penunggu = [];
        p.forEach((x) => x.resolve());
        beri();
      } else if (m.type === "fatal") {
        tandaiGagal("Gagal menyiapkan penjalan: " + String(m.error || "tidak diketahui"));
      }
    });
    if (o.pesanInit) w.postMessage(o.pesanInit);
    beri();
  }

  return {
    siap: () => siap,
    gagal: () => gagal,
    mulaiPada: () => mulaiPada,
    mulai() {
      if (!worker && !gagal) spawn();
    },
    // Coba lagi: buang worker lama dan mulai dari awal.
    ulangi() {
      clearTimeout(timerMuat);
      if (worker) {
        worker.terminate();
        worker = null;
      }
      spawn();
    },
    langgan(cb) {
      pendengar.push(cb);
      cb(siap, gagal);
      return () => {
        const i = pendengar.indexOf(cb);
        if (i >= 0) pendengar.splice(i, 1);
      };
    },
    // Resolve saat siap; reject (dengan pesan yang bisa dibaca) bila gagal.
    tunggu() {
      this.mulai();
      if (siap) return Promise.resolve();
      if (gagal) return Promise.reject(new Error(gagal.pesan));
      return new Promise((resolve, reject) => penunggu.push({ resolve, reject }));
    },
    /**
     * Mengirim satu pekerjaan dan menunggu hasilnya. Protokol worker: kirim {id, ...muatan}; balasan {type:"started", id}
     * lalu {type:"done", id, ...}. `batasMs` dihitung sejak "started"; lewat dari itu worker dimatikan dan dimulai ulang.
     * `urai(pesanDone)` mengubah balasan menjadi hasil akhir.
     */
    jalankan(muatan, batasMs, urai) {
      return new Promise((resolve) => {
        const w = worker;
        if (!w || !siap) return resolve({ timeout: false, stdout: "", error: "Penjalan belum siap." });
        const id = ++seq;
        let timer = null;
        const selesai = (hasil) => {
          clearTimeout(timer);
          w.removeEventListener("message", h);
          tertunda.delete(selesai);
          resolve(hasil);
        };
        const h = (e) => {
          const m = e.data;
          if (!m || m.id !== id) return;
          if (m.type === "started") {
            timer = setTimeout(() => {
              selesai({ timeout: true, stdout: "", error: null });
              if (worker === w) {
                w.terminate();
                worker = null;
                spawn(); // mulai ulang di latar belakang untuk pekerjaan berikutnya
              }
            }, batasMs);
          } else if (m.type === "done") selesai(urai(m));
        };
        tertunda.add(selesai);
        w.addEventListener("message", h);
        w.postMessage(Object.assign({ id }, muatan));
      });
    },
  };
}
