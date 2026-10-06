// Antarmuka penjalan Java untuk halaman. Bentuk run() sama dengan penjalan Python di runner.js.
import { catatLama } from "./kemajuan.js";

export const BATAS_JAVA_DETIK = 8;
const TIMEOUT_MS = BATAS_JAVA_DETIK * 1000;

let worker = null;
let siap = false;
let siapPromise = null;
let seq = 0;

const pendengar = [];
let mulaiPada = Date.now();

export const javaSiap = () => siap;
export const javaMulaiPada = () => mulaiPada;

// Mendaftar untuk perubahan status siap; mengembalikan fungsi untuk berhenti mendengarkan.
export function onJavaReadyChange(cb) {
  pendengar.push(cb);
  cb(siap);
  return () => {
    const i = pendengar.indexOf(cb);
    if (i >= 0) pendengar.splice(i, 1);
  };
}

function spawn() {
  siap = false;
  mulaiPada = Date.now();
  pendengar.slice().forEach((cb) => cb(false));
  worker = new Worker("js/javaworker.js");
  const w = worker;
  siapPromise = new Promise((resolve, reject) => {
    const h = (e) => {
      if (!e.data) return;
      if (e.data.type === "ready") {
        w.removeEventListener("message", h);
        siap = true;
        catatLama("java", Date.now() - mulaiPada);
        pendengar.slice().forEach((cb) => cb(true));
        resolve();
      } else if (e.data.type === "fatal") {
        w.removeEventListener("message", h);
        reject(new Error(e.data.error));
      }
    };
    w.addEventListener("message", h);
  });
  siapPromise.catch(() => {});
  w.postMessage({ type: "init" });
}

export function startJava() {
  if (!worker) spawn();
}

// Mengubah hasil mentah dari JavaRun. Kasus dipisah form feed; tiap kasus: baris status lalu keluaran.
function uraikan(kasus) {
  const i = kasus.indexOf("\n");
  const status = i < 0 ? kasus : kasus.slice(0, i);
  const isi = i < 0 ? "" : kasus.slice(i + 1);
  if (status === "GALAT_KOMPILASI") return { timeout: false, stdout: "", error: "Galat kompilasi:\n" + isi.trimEnd() };
  if (status === "GALAT_JALAN") {
    const k = isi.indexOf('Exception in thread "main"');
    return { timeout: false, stdout: k < 0 ? isi : isi.slice(0, k), error: k < 0 ? isi.trimEnd() : isi.slice(k).trimEnd() };
  }
  return { timeout: false, stdout: isi, error: null };
}

// inputs: daftar baris masukan. echo diabaikan (Scanner tidak menampilkan masukan).
export async function runJava(code, inputs) {
  startJava();
  try {
    await siapPromise;
  } catch (e) {
    worker = null;
    return { timeout: false, stdout: "", error: "Penjalan Java gagal dimuat: " + e.message };
  }
  const w = worker;
  const id = ++seq;
  const masukan = inputs.length ? inputs.join("\n") + "\n" : "";
  return new Promise((resolve) => {
    let timer = null;
    const h = (e) => {
      const m = e.data;
      if (!m || m.id !== id) return;
      if (m.type === "started") {
        timer = setTimeout(() => {
          w.removeEventListener("message", h);
          w.terminate();
          worker = null;
          startJava(); // mulai ulang di latar belakang untuk run berikutnya
          resolve({ timeout: true, stdout: "", error: null });
        }, TIMEOUT_MS);
      } else if (m.type === "done") {
        clearTimeout(timer);
        w.removeEventListener("message", h);
        resolve(uraikan(m.hasil || "GALAT_JALAN\nTidak ada hasil dari penjalan."));
      }
    };
    w.addEventListener("message", h);
    w.postMessage({ type: "run", id, code, inputs: [masukan] });
  });
}
