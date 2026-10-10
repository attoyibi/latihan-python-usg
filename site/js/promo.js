// Promo silang ke situs utama pembuat (muchson.web.id): maskot kurir mengantar pesan, lalu kotak berisi satu kalimat hook.
// Hanya muncul di halaman bab, kadang-kadang, saat peserta sedang diam, dan hilang sendiri. Aturan ada di promo-logika.js,
// isi promo ada di promo-data.js. Tanpa database dan tanpa pelacakan.
import { PROMO, PEMBUAT } from "./promo-data.js";
import { ATURAN, tundaAwal, jedaBerikut, pilihPromo, undi } from "./promo-logika.js";

const KUNCI_MATI = "promo:mati";
const KUNCI_SESI = "promo:sesi";

const aman = (f, kalau) => {
  try {
    return f();
  } catch (e) {
    return kalau;
  }
};

const MASKOT = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<g class="mk-badan">
<line x1="32" y1="6" x2="32" y2="14" stroke="#075e5c" stroke-width="3" stroke-linecap="round"/>
<circle class="mk-antena" cx="32" cy="5" r="3.2" fill="#3fd68f"/>
<rect x="12" y="14" width="40" height="30" rx="13" fill="#0b7f7c"/>
<rect x="17" y="20" width="30" height="17" rx="8" fill="#e3f3f2"/>
<circle class="mk-mata" cx="26" cy="28" r="3.2" fill="#0b1b1c"/>
<circle class="mk-mata" cx="38" cy="28" r="3.2" fill="#0b1b1c"/>
<path d="M27 34c2.5 2.2 7.5 2.2 10 0" fill="none" stroke="#0b1b1c" stroke-width="2" stroke-linecap="round"/>
<rect x="19" y="44" width="26" height="12" rx="6" fill="#075e5c"/>
</g>
<g class="mk-amplop">
<rect x="40" y="38" width="20" height="14" rx="2.5" fill="#fff" stroke="#0b7f7c" stroke-width="2"/>
<path class="mk-tutup" d="M41 40l9 7 9-7" fill="none" stroke="#0b7f7c" stroke-width="2" stroke-linejoin="round"/>
<circle cx="57" cy="39" r="3.4" fill="#3fd68f"/>
</g>
</svg>`;

let kontainer = null;
let timerTutup = 0;
let sisaMs = 0;
let mulaiMs = 0;
let status = { halamanBab: false, mati: false, jumlah: 0, sedangTampil: false, menunggu: 0, diamMs: 0 };
let sudahId = [];
let aktivitasTerakhir = Date.now();
let berjalan = false;
let lewati = () => false;

function muatSesi() {
  const s = aman(() => JSON.parse(sessionStorage.getItem(KUNCI_SESI) || "null"), null);
  if (s && typeof s.jumlah === "number" && Array.isArray(s.sudah)) {
    status.jumlah = s.jumlah;
    sudahId = s.sudah;
    status.menunggu = typeof s.menunggu === "number" ? s.menunggu : tundaAwal();
  } else status.menunggu = tundaAwal();
}
const simpanSesi = () => aman(() => sessionStorage.setItem(KUNCI_SESI, JSON.stringify({ jumlah: status.jumlah, sudah: sudahId, menunggu: status.menunggu })));

const adaDialog = () => !!document.querySelector("dialog[open], [role=dialog], .modal, .overlay");

function bangun(p) {
  const k = document.createElement("div");
  k.id = "promo";
  k.className = "promo";
  k.setAttribute("role", "status");
  k.setAttribute("aria-live", "polite");
  k.innerHTML = `<div class="promo-maskot">${MASKOT}</div>
<div class="promo-kotak">
<a class="promo-tautan" target="_blank" rel="noopener">
<small class="promo-kel"></small>
<span class="promo-hook"></span>
<span class="promo-ajak">Buka di situs ${PEMBUAT} &rarr;</span>
</a>
<button type="button" class="promo-tutup" aria-label="Tutup">&times;</button>
<button type="button" class="promo-mati">Jangan tampilkan lagi</button>
<i class="promo-waktu" aria-hidden="true"></i>
</div>`;
  const a = k.querySelector(".promo-tautan");
  a.href = p.url;
  k.querySelector(".promo-kel").textContent = p.kelompok + " · " + p.label;
  k.querySelector(".promo-hook").textContent = p.hook;
  a.addEventListener("click", () => setTimeout(() => tutup(), 150)); // tautan membuka tab baru sendiri; kotak ikut pergi
  k.querySelector(".promo-tutup").addEventListener("click", () => tutup());
  k.querySelector(".promo-mati").addEventListener("click", () => {
    status.mati = true;
    aman(() => localStorage.setItem(KUNCI_MATI, "1"));
    tutup();
  });
  const jeda = () => {
    if (!timerTutup) return;
    clearTimeout(timerTutup);
    timerTutup = 0;
    sisaMs = Math.max(1200, sisaMs - (Date.now() - mulaiMs));
    k.classList.add("jeda");
  };
  const lanjut = () => {
    if (timerTutup || !k.classList.contains("kotak")) return;
    k.classList.remove("jeda");
    jadwalTutup(sisaMs);
  };
  k.addEventListener("mouseenter", jeda);
  k.addEventListener("mouseleave", lanjut);
  k.addEventListener("focusin", jeda);
  k.addEventListener("focusout", lanjut);
  k.addEventListener("keydown", (e) => {
    if (e.key === "Escape") tutup();
  });
  return k;
}

function jadwalTutup(ms) {
  mulaiMs = Date.now();
  sisaMs = ms;
  clearTimeout(timerTutup);
  const w = kontainer && kontainer.querySelector(".promo-waktu");
  if (w) {
    w.style.animation = "none";
    void w.offsetWidth;
    w.style.animation = "";
    w.style.animationDuration = ms + "ms";
  }
  timerTutup = setTimeout(() => tutup(), ms);
}

// Dipakai uji dan pratinjau: memunculkan satu promo sekarang, tanpa menunggu aturan.
export function tampilkanSekarang() {
  tampilkan();
}

function tampilkan() {
  const p = pilihPromo(PROMO, sudahId);
  if (!p || kontainer) return;
  status.sedangTampil = true;
  status.jumlah++;
  sudahId.push(p.id);
  status.menunggu = jedaBerikut();
  simpanSesi();
  kontainer = bangun(p);
  document.body.appendChild(kontainer);
  // 1) maskot datang membawa amplop, 2) amplop dibuka, 3) kotak hook muncul dan hitungan tutup dimulai
  requestAnimationFrame(() => kontainer && kontainer.classList.add("datang"));
  setTimeout(() => kontainer && kontainer.classList.add("buka"), 900);
  setTimeout(() => {
    if (!kontainer) return;
    kontainer.classList.add("kotak");
    jadwalTutup(ATURAN.tampilMs);
  }, 1500);
}

function tutup() {
  clearTimeout(timerTutup);
  timerTutup = 0;
  const k = kontainer;
  if (!k) return;
  kontainer = null;
  k.classList.remove("jeda");
  k.classList.add("pergi");
  status.sedangTampil = false;
  setTimeout(() => k.remove(), 700);
}

function detik() {
  if (!berjalan) return;
  const terlihat = document.visibilityState === "visible";
  status.diamMs = Date.now() - aktivitasTerakhir;
  if (status.halamanBab && terlihat && !status.sedangTampil) {
    status.menunggu = Math.max(0, status.menunggu - ATURAN.periksaMs);
    simpanSesi();
  }
  if (undi({ ...status, terlihat, adaDialog: adaDialog() })) tampilkan();
}

// kosong() dipanggil dari app.js; `izinkan` mengembalikan false untuk peran yang tidak perlu melihat promo (mis. instruktur).
export function mulai(izinkan) {
  if (berjalan) return;
  if (typeof izinkan === "function") lewati = () => !izinkan();
  status.mati = aman(() => localStorage.getItem(KUNCI_MATI) === "1", false);
  if (status.mati) return;
  muatSesi();
  const catat = () => {
    aktivitasTerakhir = Date.now();
  };
  ["keydown", "input", "pointerdown", "wheel", "touchstart"].forEach((e) => window.addEventListener(e, catat, { passive: true, capture: true }));
  berjalan = true;
  setInterval(detik, ATURAN.periksaMs);
}

// Dipanggil tiap pindah halaman: promo hanya boleh muncul saat peserta ada di halaman bab.
export function halaman(adalahBab) {
  status.halamanBab = !!adalahBab && !lewati();
  if (!adalahBab && kontainer) tutup();
}
