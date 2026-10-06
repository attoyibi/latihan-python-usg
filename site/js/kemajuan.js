// Indikator menunggu: peserta harus tahu berapa lama lagi harus menunggu, terutama saat Java dimuat pertama kali.
// Lama muat diperkirakan dari muat sebelumnya di perangkat yang sama (disimpan di browser), dengan nilai awal bila belum pernah.
import { h } from "./dom.js";

const KUNCI = (nama) => "latihan:lama-muat:" + nama;

export function perkiraanMs(nama, awalMs) {
  try {
    const x = Number(localStorage.getItem(KUNCI(nama)));
    if (x > 1000 && x < 300000) return x;
  } catch (e) {}
  return awalMs;
}

// Rata-rata bergerak supaya satu muat yang lambat tidak merusak perkiraan berikutnya.
export function catatLama(nama, ms) {
  try {
    const lama = Number(localStorage.getItem(KUNCI(nama)));
    localStorage.setItem(KUNCI(nama), String(Math.round(lama > 0 ? lama * 0.5 + ms * 0.5 : ms)));
  } catch (e) {}
}

// Teks sisa waktu yang jujur: bila perkiraan sudah terlewati, jangan berpura-pura tahu.
export function teksSisa(sisaDetik) {
  if (sisaDetik > 1) return "sisa sekitar " + Math.ceil(sisaDetik) + " detik";
  if (sisaDetik > 0) return "kurang dari 1 detik lagi";
  return "sedikit lagi, mohon tunggu";
}

/**
 * Spanduk "Menyiapkan <label>" dengan bilah kemajuan dan hitung mundur, tampil selama penjalan belum siap.
 * @param {{nama:string,label:string,awalMs:number,langgan:(cb:(siap:boolean)=>void)=>(()=>void),mulaiPada:()=>number,siap:()=>boolean}} o
 */
export function spandukSiap(o) {
  const isi = h("i");
  const teks = h("span", { class: "siap-teks" });
  const bar = h("div", { class: "pbar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Kemajuan menyiapkan " + o.label }, isi);
  const el = h("div", { class: "siap-banner", role: "status" }, teks, bar);
  let timer = null;
  let terpasang = false;

  const gambar = () => {
    const est = perkiraanMs(o.nama, o.awalMs);
    const lewat = Date.now() - o.mulaiPada();
    const frac = Math.min(0.95, Math.max(0.03, lewat / est));
    isi.style.width = Math.round(frac * 100) + "%";
    bar.setAttribute("aria-valuenow", String(Math.round(frac * 100)));
    teks.textContent = "Menyiapkan " + o.label + ", " + teksSisa((est - lewat) / 1000) + ". Kamu bisa membaca soal dulu.";
    el.classList.toggle("lama", lewat > est);
  };
  const atur = (siap) => {
    clearInterval(timer);
    if (siap) {
      isi.style.width = "100%";
      bar.setAttribute("aria-valuenow", "100");
      teks.textContent = o.label + " siap dipakai.";
      el.classList.add("siap");
      el.classList.remove("lama");
      setTimeout(() => {
        if (o.siap()) el.hidden = true;
      }, 1800);
    } else {
      el.hidden = false;
      el.classList.remove("siap");
      gambar();
      timer = setInterval(gambar, 250);
    }
  };
  const off = o.langgan((siap) => {
    // Elemen sudah dibuang dari halaman (pindah bab): berhenti mendengarkan.
    if (terpasang && !el.isConnected) {
      off();
      clearInterval(timer);
      return;
    }
    atur(siap);
  });
  atur(o.siap());
  queueMicrotask(() => (terpasang = true));
  return el;
}

/**
 * Indikator selama kode berjalan: hitung mundur menuju batas waktu. Mengembalikan fungsi untuk menghentikan.
 * `tulis(teks)` menerima teks status tiap 200 ms.
 */
export function hitungBatas(batasDetik, tulis) {
  const mulai = Date.now();
  const tik = () => {
    const lewat = (Date.now() - mulai) / 1000;
    tulis("Menjalankan program, " + Math.min(batasDetik, Math.floor(lewat)) + " dari batas " + batasDetik + " detik");
  };
  tik();
  const t = setInterval(tik, 200);
  return () => clearInterval(t);
}

/** Bilah kemajuan sederhana: `perbarui(pecahan, teks)`. */
export function barKemajuan() {
  const isi = h("i");
  const teks = h("p", { class: "muted" });
  const bar = h("div", { class: "pbar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" }, isi);
  const el = h("div", { class: "kemajuan-uji" }, teks, bar);
  el.perbarui = (frac, t) => {
    isi.style.width = Math.round(Math.min(1, Math.max(0, frac)) * 100) + "%";
    bar.setAttribute("aria-valuenow", String(Math.round(frac * 100)));
    teks.textContent = t;
  };
  return el;
}
