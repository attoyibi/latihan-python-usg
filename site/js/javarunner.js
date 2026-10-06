// Antarmuka penjalan Java untuk halaman. Bentuk run() sama dengan penjalan Python di runner.js.
import { buatPemantau } from "./penjalan.js";

export const BATAS_JAVA_DETIK = 8;

// Java (CheerpJ + ECJ) di Web Worker. Pemuatan pertama lambat dan berat; pemantau menangani gagal muat dan mulai ulang.
const jv = buatPemantau({ nama: "java", urlWorker: "js/javaworker.js", pesanInit: { type: "init" }, maksMuatMs: 180000 });

export const javaSiap = () => jv.siap();
export const javaGagal = () => jv.gagal();
export const javaMulaiPada = () => jv.mulaiPada();
export const ulangiJava = () => jv.ulangi();
export const startJava = () => jv.mulai();

// Mendaftar untuk perubahan status; cb(siap, gagal). Mengembalikan fungsi untuk berhenti mendengarkan.
export const onJavaReadyChange = (cb) => jv.langgan(cb);

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
  try {
    await jv.tunggu();
  } catch (e) {
    return { timeout: false, stdout: "", error: e.message + " Tekan Coba lagi di atas editor." };
  }
  const masukan = inputs.length ? inputs.join("\n") + "\n" : "";
  return jv.jalankan({ type: "run", code, inputs: [masukan] }, BATAS_JAVA_DETIK * 1000, (m) => uraikan(m.hasil || "GALAT_JALAN\nTidak ada hasil dari penjalan."));
}
