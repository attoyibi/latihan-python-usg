// Dialog pemutar ulang cara peserta menulis kode: tombol putar, kecepatan 1x sampai 64x, penggeser waktu, dan penanda saat
// tombol Jalankan ditekan. Jeda panjang dipersingkat. Dipakai oleh bagian Jejak peserta (rekaman dari tabel percobaan).
import { h } from "./dom.js";
import { susunUlang } from "./rekam.js";

/**
 * @param {{judul:string, info?:string, rekaman?:object|null, kode?:string, catatan?:string, tambahan?:Node[]}} o
 * rekaman: {awal, e} dari rekam.js (boleh hasil gabungRekaman). Bila kosong, yang ditampilkan hanya kode.
 * @returns {HTMLDialogElement}
 */
export function bukaPutar({ judul, info = "", rekaman = null, kode = "", catatan = "", tambahan = [] }) {
  const dlg = h("dialog", { class: "putar", "aria-label": "Putar ulang cara mengetik" });
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  const tutup = h("button", { type: "button", class: "btn btn-sm", onclick: () => dlg.close() }, "Tutup");
  const layar = h("pre", { class: "putar-kode", "aria-live": "off" });
  const kepala = [h("h3", {}, judul), info ? h("p", { class: "muted" }, info) : null, ...tambahan];

  if (!rekaman || !rekaman.e) {
    layar.textContent = kode || "";
    dlg.append(...kepala, h("p", { class: "muted" }, "Rekaman cara mengetik tidak tersedia untuk baris ini (terlalu besar, atau dicatat sebelum fitur ini ada)." + (kode ? " Berikut kode yang tercatat." : "")), layar, h("div", { class: "actions" }, tutup));
    dlg.showModal();
    return dlg;
  }
  const langkah = susunUlang(rekaman);
  let i = 0;
  let jalan = null;
  let kecepatan = 4;
  const slider = h("input", { type: "range", min: "0", max: String(Math.max(0, langkah.length - 1)), value: "0", "aria-label": "Posisi putar ulang" });
  const jam = h("span", { class: "muted" });
  const tombol = h("button", { type: "button", class: "btn btn-primary btn-sm" }, "Putar");
  const selCepat = h("select", { "aria-label": "Kecepatan" }, [1, 4, 16, 64].map((k) => h("option", { value: String(k), selected: k === kecepatan ? "" : false }, k + "x")));
  const gambar = () => {
    layar.textContent = langkah[i].teks;
    layar.classList.toggle("jalankan", langkah[i].jalankan);
    slider.value = String(i);
    jam.textContent = (langkah[i].t / 1000).toFixed(1) + " dari " + (langkah[langkah.length - 1].t / 1000).toFixed(1) + " detik" + (langkah[i].jalankan ? "  (tombol Jalankan ditekan)" : "");
  };
  const henti = () => {
    clearTimeout(jalan);
    jalan = null;
    tombol.textContent = "Putar";
  };
  const maju = () => {
    if (i >= langkah.length - 1) return henti();
    const jeda = Math.min(langkah[i + 1].t - langkah[i].t, 2500);
    i++;
    jalan = setTimeout(() => {
      gambar();
      maju();
    }, Math.max(15, jeda / kecepatan));
  };
  tombol.addEventListener("click", () => {
    if (jalan) return henti();
    if (i >= langkah.length - 1) i = 0;
    tombol.textContent = "Jeda";
    gambar();
    maju();
  });
  selCepat.addEventListener("change", () => (kecepatan = Number(selCepat.value)));
  slider.addEventListener("input", () => {
    henti();
    i = Number(slider.value);
    gambar();
  });
  dlg.addEventListener("close", henti);
  dlg.append(...kepala, h("div", { class: "filters" }, tombol, selCepat, slider, jam), layar, h("p", { class: "muted" }, catatan || "Jeda panjang dipersingkat saat diputar. Perhatikan apakah kode ditulis lurus dari atas ke bawah, atau kembali memperbaiki dan menjalankan di tengah jalan."), h("div", { class: "actions" }, tutup));
  dlg.showModal();
  gambar();
  return dlg;
}
