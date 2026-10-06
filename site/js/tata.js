// Tata letak halaman bab yang bisa diatur peserta: lebar video lawan soal (geser), sembunyikan video,
// tinggi editor (tarik), dan mode fokus. Pilihan diingat di browser lewat `store` milik app.js.
import { h } from "./dom.js";

export const BATAS = { vpct: [20, 70], tinggi: [200, 900] };
const AWAL = { vpct: 38, video: true, tinggi: 380 };

const jepit = (x, [a, b]) => Math.min(b, Math.max(a, x));

// Penyimpanan pilihan tata letak (satu set untuk semua bab).
export function baru(store) {
  let s = Object.assign({}, AWAL, store.get("tata", {}));
  s.vpct = jepit(Number(s.vpct) || AWAL.vpct, BATAS.vpct);
  s.tinggi = jepit(Number(s.tinggi) || AWAL.tinggi, BATAS.tinggi);
  const simpan = () => store.set("tata", s);
  return {
    get: (k) => s[k],
    set(k, v) {
      s[k] = v;
      simpan();
    },
    resetUkuran() {
      s.vpct = AWAL.vpct;
      s.tinggi = AWAL.tinggi;
      simpan();
    },
  };
}

export const setTinggi = (px) => document.documentElement.style.setProperty("--tinggi-editor", px + "px");

// Menyeret dengan mouse, jari, atau pena; `saat(e)` dipanggil tiap gerakan, `selesai()` saat dilepas.
function seret(elemen, mulai, saat, selesai) {
  elemen.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    elemen.setPointerCapture(e.pointerId);
    elemen.classList.add("menyeret");
    document.body.classList.add("menyeret");
    const konteks = mulai(e);
    const gerak = (ev) => saat(ev, konteks);
    const lepas = () => {
      elemen.removeEventListener("pointermove", gerak);
      elemen.removeEventListener("pointerup", lepas);
      elemen.removeEventListener("pointercancel", lepas);
      elemen.classList.remove("menyeret");
      document.body.classList.remove("menyeret");
      selesai();
    };
    elemen.addEventListener("pointermove", gerak);
    elemen.addEventListener("pointerup", lepas);
    elemen.addEventListener("pointercancel", lepas);
  });
}

// Pegangan di bawah editor untuk mengubah tingginya. `ambilEditor()` mengembalikan instance CodeMirror.
export function gripTinggi(tata, ambilEditor) {
  const grip = h("div", { class: "grip-v", role: "separator", "aria-orientation": "horizontal", tabindex: "0", "aria-label": "Ubah tinggi editor (tarik, atau pakai tombol panah atas dan bawah)", title: "Tarik untuk mengubah tinggi editor. Klik dua kali untuk mengembalikan." }, h("span", { "aria-hidden": "true" }));
  const terapkan = (px) => {
    px = Math.round(jepit(px, BATAS.tinggi));
    setTinggi(px);
    tata.set("tinggi", px);
    const ed = ambilEditor();
    if (ed) ed.refresh();
    grip.setAttribute("aria-valuenow", String(px));
  };
  grip.setAttribute("aria-valuemin", String(BATAS.tinggi[0]));
  grip.setAttribute("aria-valuemax", String(BATAS.tinggi[1]));
  grip.setAttribute("aria-valuenow", String(tata.get("tinggi")));
  seret(
    grip,
    (e) => ({ y: e.clientY, t: tata.get("tinggi") }),
    (e, k) => terapkan(k.t + (e.clientY - k.y)),
    () => {}
  );
  grip.addEventListener("keydown", (e) => {
    const langkah = e.shiftKey ? 80 : 30;
    if (e.key === "ArrowDown") terapkan(tata.get("tinggi") + langkah);
    else if (e.key === "ArrowUp") terapkan(tata.get("tinggi") - langkah);
    else return;
    e.preventDefault();
  });
  grip.addEventListener("dblclick", () => terapkan(AWAL.tinggi));
  return grip;
}

let penangkapEsc = null;

/**
 * Memasang tata letak pada `.cols` (video | pegangan | soal) dan mengembalikan bilah alat.
 * @param cols     elemen .cols dengan anak [kartu video, kartu soal]
 * @param vc       kartu video; boleh punya metode hentikan() dan lanjut() untuk menghentikan pemutaran
 * @param opsi     { punyaVideo, punyaEditor, ambilEditor }
 */
export function pasang(cols, vc, tata, opsi) {
  const { punyaVideo, punyaEditor, ambilEditor } = opsi;
  setTinggi(tata.get("tinggi"));
  cols.style.setProperty("--vpct", tata.get("vpct") + "%");

  // Pegangan lebar video | soal
  const grip = h("div", { class: "grip-h", role: "separator", "aria-orientation": "vertical", tabindex: "0", "aria-label": "Ubah lebar video dan soal (geser, atau pakai tombol panah kiri dan kanan)", title: "Geser untuk mengubah lebar. Klik dua kali untuk mengembalikan." }, h("span", { "aria-hidden": "true" }));
  const lebar = (p) => {
    p = Math.round(jepit(p, BATAS.vpct) * 10) / 10;
    cols.style.setProperty("--vpct", p + "%");
    tata.set("vpct", p);
    grip.setAttribute("aria-valuenow", String(Math.round(p)));
  };
  grip.setAttribute("aria-valuemin", String(BATAS.vpct[0]));
  grip.setAttribute("aria-valuemax", String(BATAS.vpct[1]));
  grip.setAttribute("aria-valuenow", String(Math.round(tata.get("vpct"))));
  seret(
    grip,
    () => cols.getBoundingClientRect(),
    (e, r) => lebar(((e.clientX - r.left) / r.width) * 100),
    () => {
      const ed = ambilEditor && ambilEditor();
      if (ed) ed.refresh();
    }
  );
  grip.addEventListener("keydown", (e) => {
    const langkah = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") lebar(tata.get("vpct") - langkah);
    else if (e.key === "ArrowRight") lebar(tata.get("vpct") + langkah);
    else if (e.key === "Home") lebar(BATAS.vpct[0]);
    else if (e.key === "End") lebar(BATAS.vpct[1]);
    else return;
    e.preventDefault();
    const ed = ambilEditor && ambilEditor();
    if (ed) ed.refresh();
  });
  grip.addEventListener("dblclick", () => lebar(AWAL.vpct));
  vc.after(grip);

  let fokus = false;
  const bar = h("div", { class: "tata-bar", role: "toolbar", "aria-label": "Atur tampilan halaman" });
  const tombolVideo = h("button", { type: "button", class: "btn btn-sm btn-ghost", "aria-pressed": "false" });
  const tombolReset = h("button", { type: "button", class: "btn btn-sm btn-ghost" }, "Kembalikan ukuran");
  const tombolFokus = h("button", { type: "button", class: "btn btn-sm", "aria-pressed": "false", title: "Soal di kiri, editor besar di kanan, tanpa video dan menu (tekan Esc untuk keluar)" }, "Mode fokus");

  const sinkron = () => {
    const tampil = punyaVideo && tata.get("video") && !fokus;
    cols.classList.toggle("tanpa-video", !tampil);
    if (vc.hentikan && vc.lanjut) tampil ? vc.lanjut() : vc.hentikan();
    tombolVideo.textContent = tata.get("video") ? "Sembunyikan video" : "Tampilkan video";
    tombolVideo.setAttribute("aria-pressed", String(!tata.get("video")));
    const ed = ambilEditor && ambilEditor();
    if (ed) setTimeout(() => ed.refresh(), 0);
  };
  const aturFokus = (nyala) => {
    fokus = nyala;
    document.body.classList.toggle("fokus", nyala);
    tombolFokus.textContent = nyala ? "Keluar mode fokus" : "Mode fokus";
    tombolFokus.setAttribute("aria-pressed", String(nyala));
    tombolVideo.hidden = nyala; // di mode fokus video memang disembunyikan; tombolnya tidak relevan
    tombolReset.hidden = nyala;
    sinkron();
    window.scrollTo(0, 0);
  };

  tombolVideo.addEventListener("click", () => {
    tata.set("video", !tata.get("video"));
    sinkron();
  });
  tombolReset.addEventListener("click", () => {
    tata.resetUkuran();
    lebar(AWAL.vpct);
    setTinggi(AWAL.tinggi);
    const ed = ambilEditor && ambilEditor();
    if (ed) ed.refresh();
  });
  tombolFokus.addEventListener("click", () => aturFokus(!fokus));

  if (punyaVideo) bar.append(tombolVideo);
  bar.append(tombolReset);
  if (punyaEditor) bar.append(tombolFokus);

  if (penangkapEsc) document.removeEventListener("keydown", penangkapEsc);
  penangkapEsc = (e) => {
    if (e.key === "Escape" && fokus) aturFokus(false);
  };
  document.addEventListener("keydown", penangkapEsc);

  sinkron();
  return bar;
}

// Dipanggil saat pindah halaman: mode fokus tidak ikut terbawa ke halaman lain.
export function bersihkan() {
  document.body.classList.remove("fokus");
  document.body.classList.remove("menyeret");
  if (penangkapEsc) document.removeEventListener("keydown", penangkapEsc);
  penangkapEsc = null;
}
