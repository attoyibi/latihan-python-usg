// Mengelompokkan galat saat peserta menjalankan kode (Python dan Java) menjadi jenis yang bisa dihitung.
// Hanya jenis dan satu baris pesan singkat yang disimpan; keluaran program peserta tidak disimpan.
// Logika murni (tanpa DOM), diuji dengan tools/uji_galat.mjs.

const PANJANG_PESAN = 200;
const rapikan = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, PANJANG_PESAN);

const pythonJenis = (teks) => {
  // Traceback Python berakhir dengan "NamaGalat: pesan", jadi yang terakhir yang dipakai.
  let ketemu = null;
  for (const m of teks.matchAll(/^\s*([A-Za-z_][\w.]*(?:Error|Exception|Warning|Interrupt|Exit))\b:?\s*(.*)$/gm)) ketemu = m;
  if (!ketemu) return null;
  return { jenis: ketemu[1].split(".").pop(), pesan: rapikan(ketemu[2]) };
};

const javaKompilasi = (teks) => {
  const baris = teks.split("\n").filter((x) => x.trim());
  const pertama = (baris.find((x) => /ERROR|error/.test(x) && !/^Galat kompilasi/.test(x)) || baris[1] || baris[0] || "").trim();
  const t = teks.toLowerCase();
  let jenis = "GalatKompilasi";
  if (/cannot be resolved|cannot find symbol|is undefined for the type|undefined for the type/.test(t)) jenis = "CannotResolve";
  else if (/type mismatch|incompatible types|cannot convert/.test(t)) jenis = "TypeMismatch";
  else if (/might not have been initialized/.test(t)) jenis = "NotInitialized";
  else if (/unhandled exception|unreported exception|must be caught/.test(t)) jenis = "UncaughtException";
  else if (/syntax error|expected|unexpected|unresolved compilation|missing|insert "/.test(t)) jenis = "SyntaxError";
  return { jenis, pesan: rapikan(pertama.replace(/^\d+\.\s*ERROR in .*? \(at line (\d+)\)/i, "baris $1")) };
};

/**
 * @param {string} bahasa "python" atau "java"
 * @param {string|null|undefined} error teks galat dari penjalan (r.error)
 * @returns {{jenis:string, pesan:string}|null} null bila tidak ada galat
 */
export function klasifikasiGalat(bahasa, error) {
  const teks = String(error || "");
  if (!teks.trim()) return null;
  if (bahasa === "java") {
    if (/^Galat kompilasi/.test(teks)) return javaKompilasi(teks);
    const m = /Exception in thread "[^"]*"\s+([\w.$]+)(?::\s*(.*))?/.exec(teks);
    if (m) return { jenis: m[1].split(".").pop(), pesan: rapikan(m[2] || "") };
    const n = /([A-Za-z_][\w.$]*(?:Error|Exception))\b/.exec(teks);
    if (n) return { jenis: n[1].split(".").pop(), pesan: rapikan(teks.slice(n.index + n[1].length).replace(/^:\s*/, "")) };
    return { jenis: "GalatLain", pesan: rapikan(teks) };
  }
  const p = pythonJenis(teks);
  return p || { jenis: "GalatLain", pesan: rapikan(teks) };
}

/** Mengelompokkan jenis galat menjadi kelompok untuk ringkasan riset. */
export function kelompokGalat(jenis) {
  const j = String(jenis || "");
  if (j === "Timeout") return "Berjalan terlalu lama";
  if (/^(SyntaxError|IndentationError|TabError)$/.test(j) || j === "GalatKompilasi") return "Sintaks";
  if (/^(NameError|UnboundLocalError|CannotResolve|AttributeError|ModuleNotFoundError|ImportError)$/.test(j)) return "Nama tidak dikenal";
  if (/^(TypeError|ValueError|TypeMismatch|NotInitialized|NumberFormatException|ClassCastException)$/.test(j)) return "Tipe dan nilai";
  if (/^(ZeroDivisionError|ArithmeticException)$/.test(j)) return "Pembagian nol";
  if (/^(IndexError|KeyError|ArrayIndexOutOfBoundsException|StringIndexOutOfBoundsException|NullPointerException|NoSuchElementException|InputMismatchException|EOFError|UncaughtException)$/.test(j)) return "Akses data";
  return "Lainnya";
}
