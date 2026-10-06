// Menonaktifkan salin (copy), potong (cut), dan tempel (paste) di halaman latihan supaya peserta mengetik
// sendiri; mengetik membuat belajar lebih melekat. Setiap percobaan tempel dicatat jumlahnya (tanpa isi)
// agar instruktur bisa melihat polanya.
//
// Ini hambatan, bukan kunci mutlak: peserta masih bisa mengetik ulang apa yang ia lihat, dan perangkat
// lain tidak bisa dikendalikan dari halaman web. Akun instruktur dikecualikan supaya bisa menguji soal.
import { h } from "./dom.js";

const PESAN = "Salin dan tempel dinonaktifkan di latihan ini. Ketik sendiri supaya benar-benar paham.";
const TEMPEL = new Set(["insertFromPaste", "insertFromDrop", "insertFromYank", "insertFromPasteAsQuotation"]);
let toast = null;
let tutup = null;

export function tampilkanPesan(teks = PESAN) {
  if (!toast) {
    toast = h("div", { class: "toast", role: "status", "aria-live": "polite" });
    document.body.append(toast);
  }
  toast.textContent = teks;
  toast.classList.add("tampil");
  clearTimeout(tutup);
  tutup = setTimeout(() => toast.classList.remove("tampil"), 3500);
}

/**
 * @param {HTMLElement} akar     bagian halaman yang dijaga (editor, kolom isian, atau seluruh kartu soal)
 * @param {{lokasi:string, saatTempel?:(lokasi:string)=>void, kecualikan?:()=>boolean}} opsi
 *   saatTempel dipanggil tiap percobaan tempel (untuk dicatat); kecualikan() true = tidak menjaga (instruktur)
 * @returns {()=>void} fungsi untuk melepas penjagaan
 */
export function blokirSalinTempel(akar, opsi = {}) {
  const { lokasi = "halaman", saatTempel = () => {}, kecualikan = () => false } = opsi;
  const hentikan = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const ditempel = () => {
    saatTempel(lokasi);
    tampilkanPesan();
  };
  const pasang = (nama, fn, opsiEvent = true) => {
    akar.addEventListener(nama, fn, opsiEvent);
    return () => akar.removeEventListener(nama, fn, opsiEvent);
  };

  const lepas = [
    pasang("paste", (e) => {
      if (kecualikan()) return;
      hentikan(e);
      ditempel();
    }),
    pasang("drop", (e) => {
      if (kecualikan()) return;
      hentikan(e);
      ditempel();
    }),
    pasang("dragover", (e) => {
      if (!kecualikan()) e.preventDefault();
    }),
    pasang("copy", (e) => {
      if (kecualikan()) return;
      hentikan(e);
      tampilkanPesan();
    }),
    pasang("cut", (e) => {
      if (kecualikan()) return;
      hentikan(e);
      tampilkanPesan();
    }),
    // Jalur tempel yang tidak lewat peristiwa paste: papan ketik layar, dikte, menu konteks ponsel.
    pasang("beforeinput", (e) => {
      if (kecualikan() || !TEMPEL.has(e.inputType)) return;
      hentikan(e);
      ditempel();
    }),
    pasang("keydown", (e) => {
      if (kecualikan()) return;
      const k = String(e.key || "").toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const tempel = (ctrl && k === "v") || (e.shiftKey && k === "insert");
      const salin = (ctrl && (k === "c" || k === "x")) || (ctrl && k === "insert") || (e.shiftKey && k === "delete");
      // Ctrl+C tanpa teks terpilih (mis. menyalin lewat papan kunci) tidak perlu pesan; cukup dicegah.
      if (tempel) {
        hentikan(e);
        ditempel();
      } else if (salin && String(window.getSelection && window.getSelection()).length) {
        hentikan(e);
        tampilkanPesan();
      }
    }),
  ];
  return () => lepas.forEach((f) => f());
}

/** Penjaga tambahan untuk CodeMirror 5: membatalkan perubahan yang asalnya tempel atau seret-lepas. */
export function blokirDiCodeMirror(editor, opsi = {}) {
  const { saatTempel = () => {}, kecualikan = () => false, lokasi = "editor" } = opsi;
  editor.on("beforeChange", (cm, ubah) => {
    if (kecualikan()) return;
    if (ubah.origin === "paste" || ubah.origin === "drop") {
      ubah.cancel();
      saatTempel(lokasi);
      tampilkanPesan();
    }
  });
}
