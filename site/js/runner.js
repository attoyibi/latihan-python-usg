import { runJava } from "./javarunner.js";
import { catatLama } from "./kemajuan.js";

const TIMEOUT_MS = 5000;

let worker = null;
let readyPromise = null;
let seq = 0;
const pendengar = [];
let isReady = false;
let mulaiPada = Date.now();

export const pythonSiap = () => isReady;
export const pythonMulaiPada = () => mulaiPada;

// Mendaftar untuk perubahan status siap; mengembalikan fungsi untuk berhenti mendengarkan.
export function onReadyChange(cb) {
  pendengar.push(cb);
  cb(isReady);
  return () => {
    const i = pendengar.indexOf(cb);
    if (i >= 0) pendengar.splice(i, 1);
  };
}

function spawn() {
  isReady = false;
  mulaiPada = Date.now();
  pendengar.slice().forEach((cb) => cb(false));
  worker = new Worker("js/pyworker.js");
  const w = worker;
  readyPromise = new Promise((resolve) => {
    const h = (e) => {
      if (e.data && e.data.type === "ready") {
        w.removeEventListener("message", h);
        isReady = true;
        catatLama("python", Date.now() - mulaiPada);
        pendengar.slice().forEach((cb) => cb(true));
        resolve();
      }
    };
    w.addEventListener("message", h);
  });
}

export function start() {
  if (!worker) spawn();
}

// Bahasa yang sudah punya penjalan: Python (Pyodide) dan Java (CheerpJ + ECJ, lihat javarunner.js).
export const supports = (lang) => lang === "python" || lang === "java";

// Menjalankan kode. echo=true menampilkan teks prompt dan masukan di keluaran (mode coba bebas).
export async function run(code, inputs, echo, lang = "python") {
  if (!supports(lang)) {
    return { timeout: false, stdout: "", error: "Penjalan kode untuk bahasa " + lang + " belum tersedia." };
  }
  if (lang === "java") return runJava(code, inputs);
  start();
  await readyPromise;
  const w = worker;
  const id = ++seq;
  return new Promise((resolve) => {
    let timer = null;
    const h = (e) => {
      const m = e.data;
      if (!m || m.id !== id) return;
      if (m.type === "started") {
        timer = setTimeout(() => {
          w.removeEventListener("message", h);
          w.terminate();
          spawn();
          resolve({ timeout: true, stdout: "", error: null });
        }, TIMEOUT_MS);
      } else if (m.type === "done") {
        clearTimeout(timer);
        w.removeEventListener("message", h);
        resolve({ timeout: false, stdout: m.stdout, error: m.error });
      }
    };
    w.addEventListener("message", h);
    w.postMessage({ id, code, inputs, echo });
  });
}
