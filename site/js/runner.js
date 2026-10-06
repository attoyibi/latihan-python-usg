import { runJava } from "./javarunner.js";
import { buatPemantau } from "./penjalan.js";

const TIMEOUT_MS = 5000;

// Python (Pyodide) di Web Worker. Pemantau menangani gagal muat, batas waktu muat, dan mulai ulang (lihat penjalan.js).
const py = buatPemantau({ nama: "python", urlWorker: "js/pyworker.js", maksMuatMs: 120000 });

export const pythonSiap = () => py.siap();
export const pythonGagal = () => py.gagal();
export const pythonMulaiPada = () => py.mulaiPada();
export const ulangiPython = () => py.ulangi();
export const start = () => py.mulai();

// Mendaftar untuk perubahan status; cb(siap, gagal). Mengembalikan fungsi untuk berhenti mendengarkan.
export const onReadyChange = (cb) => py.langgan(cb);

// Bahasa yang sudah punya penjalan: Python (Pyodide) dan Java (CheerpJ + ECJ, lihat javarunner.js).
export const supports = (lang) => lang === "python" || lang === "java";

// Menjalankan kode. echo=true menampilkan teks prompt dan masukan di keluaran (mode coba bebas).
export async function run(code, inputs, echo, lang = "python") {
  if (!supports(lang)) {
    return { timeout: false, stdout: "", error: "Penjalan kode untuk bahasa " + lang + " belum tersedia." };
  }
  if (lang === "java") return runJava(code, inputs);
  try {
    await py.tunggu();
  } catch (e) {
    return { timeout: false, stdout: "", error: e.message + " Tekan Coba lagi di atas editor." };
  }
  return py.jalankan({ code, inputs, echo }, TIMEOUT_MS, (m) => ({ timeout: false, stdout: m.stdout, error: m.error }));
}
