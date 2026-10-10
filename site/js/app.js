import { start, run, supports, onReadyChange, pythonSiap, pythonGagal, pythonMulaiPada, ulangiPython } from "./runner.js";
import { startJava, javaSiap, javaGagal, javaMulaiPada, ulangiJava, onJavaReadyChange, BATAS_JAVA_DETIK } from "./javarunner.js";
import * as Kemajuan from "./kemajuan.js";
import * as Anticopas from "./anticopas.js";
import * as Rekam from "./rekam.js";
import { laporanCard } from "./laporan.js";
import * as Konsep from "./konsep.js";
import * as Sesi from "./sesi.js";
import { klasifikasiGalat } from "./galat.js";
import { idPerangkat, agenRingkas } from "./perangkat.js";
import { grade } from "./grader.js";
import * as Auth from "./auth.js";

import { $, h } from "./dom.js";
import * as Sinkron from "./sinkron.js";
import * as Tata from "./tata.js";
import { renderInstruktur } from "./instruktur.js";
import * as PraktikUI from "./praktik-ui.js";
import * as PraktikData from "./praktik-data.js";
import * as Kunci from "./kunci.js";
import * as LaporanAkhirUI from "./laporan-akhir-ui.js";
import * as Promo from "./promo.js";

// Penyimpanan di browser, dipisah per pengguna (supaya komputer bersama tidak bercampur).
// Progres ditulis ke sini lebih dulu, lalu disusulkan ke Supabase oleh sinkron.js.
let NS = "lokal";
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("latihan:" + NS + ":" + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("latihan:" + NS + ":" + key, JSON.stringify(value));
    } catch (e) {}
  },
};

let COURSES = [];
let COURSE = null;
let MATERI = [];
const COURSE_CACHE = {};
let current = 0;
let editor = null;
let TATA = null; // pilihan tata letak halaman bab (lihat tata.js)
let LANG = "python";
let PRAKTIK = new Set(); // nomor bab yang punya praktik di mata kuliah yang sedang dibuka (kosong bila tidak ada; fitur tidak muncul)

const LANG_LABEL = { python: "Python", java: "Java" };
const CM_MODE = { python: "python", java: "text/x-java" };
const STARTER_BEBAS = {
  python: '# Coba tulis kode Python di sini\nprint("Halo, Gresik")\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Halo, Gresik");\n    }\n}\n',
};

async function loadJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}

// Kunci penyimpanan dipisah per mata kuliah: done:<mata kuliah>:<bab>
const key = (k, n) => k + ":" + COURSE.id + ":" + n;
const isDoneIn = (cid, n) => !!store.get("done:" + cid + ":" + n, false);

function isDone(n) {
  return isDoneIn(COURSE.id, n);
}

// Tiga status, tanpa kunci: belum, sedang, selesai.
function statusOf(n) {
  if (isDone(n)) return "selesai";
  if (store.get(key("started", n), false) || store.get(key("tries", n), 0) > 0) return "sedang";
  return "belum";
}
const STATUS_TEXT = { belum: "Belum dikerjakan", sedang: "Sedang dikerjakan", selesai: "Selesai" };

// Lingkaran status = latihan (tidak berubah). Titik kecil di sudutnya = praktik, hanya ada di bab yang punya praktik.
function mark(n) {
  const st = statusOf(n);
  const ada = !!COURSE && PRAKTIK.has(n);
  const ps = ada ? PraktikUI.statusLokal(store, COURSE.id, n, !!(PRAKTIK.denganB && PRAKTIK.denganB.has(n))) : null;
  const label = "Latihan: " + STATUS_TEXT[st].toLowerCase() + (ada ? ". Praktik: " + PraktikUI.NAMA_STATUS[ps].toLowerCase() : "");
  return h("span", { class: "st " + (st === "belum" ? "" : st), role: "img", "aria-label": label, title: label }, ada ? PraktikUI.titikPraktik(ps) : null);
}

function markStarted(n) {
  if (!store.get(key("started", n), false) && !isDone(n)) {
    store.set(key("started", n), true);
    if (!store.get(key("pertama", n), null)) store.set(key("pertama", n), new Date().toISOString());
    renderSidebar();
    sinkronBab(n);
  }
}

// ---------- Sinkron progres ke Supabase ----------

const kunciDi = (cid, k, n) => k + ":" + cid + ":" + n;
const PERINGKAT = { belum: 0, sedang: 1, selesai: 2 };

// Ringkasan satu bab dari penyimpanan browser, dalam bentuk baris tabel progres.
function ringkasanBab(cid, n) {
  const selesai = !!store.get(kunciDi(cid, "done", n), false);
  const kirim = store.get(kunciDi(cid, "tries", n), 0);
  const jalankan = store.get(kunciDi(cid, "runs", n), 0);
  const mulai = store.get(kunciDi(cid, "started", n), false);
  return {
    bab: n,
    status: selesai ? "selesai" : mulai || kirim > 0 || jalankan > 0 ? "sedang" : "belum",
    jumlah_jalankan: jalankan,
    jumlah_kirim: kirim,
    pertama_dibuka: store.get(kunciDi(cid, "pertama", n), null),
    lulus_pada: selesai ? store.get(kunciDi(cid, "lulus", n), null) || new Date().toISOString() : null,
    jalur: selesai ? store.get(kunciDi(cid, "jalur", n), null) : null,
  };
}

function sinkronBab(n) {
  if (!COURSE) return;
  const r = ringkasanBab(COURSE.id, n);
  if (r.status !== "belum") Sinkron.tandai(COURSE.id, r);
}

let hidrasiUid = null;

// Saat masuk: gabungkan progres di server dengan yang ada di browser (ambil yang lebih maju), lalu kirim ke
// server apa pun yang hanya ada di browser (mis. pekerjaan sebelum sinkron ada).
async function hidrasi() {
  const uid = Auth.getUserId();
  if (!Sinkron.aktif() || hidrasiUid === uid) return;
  hidrasiUid = uid;
  Sinkron.laporPerangkat(idPerangkat(), agenRingkas()); // tanpa menunggu; gagal tidak mengganggu
  await Promise.all(
    COURSES.filter((c) => c.aktif).map(async (c) => {
      const kuliah = await loadCourse(c.id);
      const baris = kuliah ? await Sinkron.ambilProgres(c.id) : null;
      if (baris === null) {
        hidrasiUid = null; // gagal dibaca; coba lagi pada kunjungan berikutnya
        return;
      }
      const perBab = new Map(baris.map((r) => [Number(r.bab), r]));
      for (const m of kuliah.materi.filter((x) => x.jenis !== "unggah")) {
        const r = perBab.get(m.bab);
        if (r) {
          if (r.status === "selesai" && !store.get(kunciDi(c.id, "done", m.bab), false)) {
            store.set(kunciDi(c.id, "done", m.bab), true);
            if (r.lulus_pada) store.set(kunciDi(c.id, "lulus", m.bab), r.lulus_pada);
            if (r.jalur) store.set(kunciDi(c.id, "jalur", m.bab), r.jalur);
          }
          if (r.status !== "belum" && !store.get(kunciDi(c.id, "started", m.bab), false)) store.set(kunciDi(c.id, "started", m.bab), true);
          if (r.pertama_dibuka && !store.get(kunciDi(c.id, "pertama", m.bab), null)) store.set(kunciDi(c.id, "pertama", m.bab), r.pertama_dibuka);
          if ((r.jumlah_kirim || 0) > store.get(kunciDi(c.id, "tries", m.bab), 0)) store.set(kunciDi(c.id, "tries", m.bab), r.jumlah_kirim);
          if ((r.jumlah_jalankan || 0) > store.get(kunciDi(c.id, "runs", m.bab), 0)) store.set(kunciDi(c.id, "runs", m.bab), r.jumlah_jalankan);
        }
        const lokal = ringkasanBab(c.id, m.bab);
        const lebihMaju = !r || PERINGKAT[lokal.status] > PERINGKAT[r.status] || lokal.jumlah_kirim > (r.jumlah_kirim || 0) || lokal.jumlah_jalankan > (r.jumlah_jalankan || 0);
        if (lokal.status !== "belum" && lebihMaju) Sinkron.tandai(c.id, lokal);
      }
    })
  );
  if (COURSE) renderSidebar();
}

// ---------- Mata kuliah ----------

async function loadCourse(id) {
  if (COURSE_CACHE[id]) return COURSE_CACHE[id];
  const meta = COURSES.find((c) => c.id === id);
  if (!meta) return null;
  let materi = [];
  try {
    materi = await loadJson("data/kuliah/" + id + "/materi.json");
  } catch (e) {
    materi = [];
  }
  COURSE_CACHE[id] = Object.assign({}, meta, { materi });
  return COURSE_CACHE[id];
}

async function loadAllCourses() {
  await Promise.all(COURSES.map((c) => loadCourse(c.id)));
}

function useCourse(c, ingat) {
  COURSE = c;
  MATERI = c.materi;
  LANG = c.bahasa || "python";
  if (ingat) store.set("terakhir", c.id);
}

function lastCourseId() {
  const id = store.get("terakhir", null);
  const c = COURSES.find((x) => x.id === id && x.aktif);
  if (c) return c.id;
  const a = COURSES.find((x) => x.aktif) || COURSES[0];
  return a ? a.id : "";
}

const babHref = (n) => "#k/" + COURSE.id + "/bab-" + n;

function courseProgress(c) {
  const total = c.materi.length;
  const done = c.materi.filter((m) => isDoneIn(c.id, m.bab)).length;
  return { total, done };
}

function allProgress() {
  let done = 0;
  let total = 0;
  for (const c of Object.values(COURSE_CACHE)) {
    const p = courseProgress(c);
    done += p.done;
    total += p.total;
  }
  return { done, total };
}

function renderSidebar() {
  const ol = $("#babList");
  ol.replaceChildren();
  $("#courseBox").replaceChildren(
    h("small", {}, "Mata kuliah"),
    COURSE ? h("a", { class: "course-name", href: "#k/" + COURSE.id }, COURSE.nama) : null,
    h("a", { class: "course-switch", href: "#kuliah" }, "Ganti mata kuliah")
  );
  if (!COURSE) return;
  for (const m of MATERI) {
    const a = h(
      "a",
      { href: babHref(m.bab), class: m.bab === current ? "on" : "", "aria-current": m.bab === current ? "page" : false },
      mark(m.bab),
      h("span", { class: "no" }, String(m.bab)),
      h("span", {}, m.judul)
    );
    ol.append(h("li", {}, a));
  }
  const n = MATERI.filter((m) => isDone(m.bab)).length;
  $("#progressText").textContent = "Bab selesai " + n + " dari " + MATERI.length;
}

function videoCard(m) {
  if (!m.video || !m.video.length) return h("section", { class: "card" }, h("h3", {}, "Video"), h("div", { class: "placeholder" }, "Bab ini tidak memakai video. Ikuti petunjuk di buku dan tugas di samping."));
  const frame = h("div", { class: "video" });
  const tabs = h("div", { class: "vtabs", role: "group", "aria-label": "Pilih video" });
  const info = h("p", { class: "muted" });
  let aktifIdx = 0;
  function show(i) {
    aktifIdx = i;
    const v = m.video[i];
    frame.replaceChildren(
      h("iframe", {
        src: "https://www.youtube-nocookie.com/embed/" + v.id,
        title: v.judul,
        loading: "lazy",
        allow: "accelerometer; encrypted-media; picture-in-picture",
        allowfullscreen: "",
      })
    );
    info.replaceChildren(
      h("strong", {}, v.judul),
      document.createElement("br"),
      v.channel + " ",
      h("span", { class: "badge " + (v.sumber === "lain" ? "lain" : "") }, v.sumber === "lain" ? "Sumber lain" : "Playlist utama")
    );
    [...tabs.children].forEach((b, j) => b.classList.toggle("on", j === i));
  }
  m.video.forEach((v, i) => tabs.append(h("button", { type: "button", onclick: () => show(i) }, "Video " + (i + 1))));
  const card = h("section", { class: "card video-card", "aria-label": "Video bantuan" }, h("h3", {}, "Video bantuan"), frame, m.video.length > 1 ? tabs : null, info);
  show(0);
  // Video yang disembunyikan harus berhenti diputar (iframe dikosongkan), lalu dimuat lagi saat ditampilkan.
  card.hentikan = () => frame.replaceChildren();
  card.lanjut = () => {
    if (!frame.firstChild) show(aktifIdx);
  };
  return card;
}

function caseView(r, idx) {
  const t = r.test;
  const label = { pass: "Lulus", fail: "Belum cocok", error: "Error", timeout: "Terlalu lama" }[r.status];
  const sum = h("summary", {}, h("span", { class: "stt " + r.status }, label), t.hidden ? "Kasus tersembunyi " + (idx + 1) : "Kasus " + (idx + 1));
  const d = h("details", { class: "case" }, sum);
  if (!t.hidden) {
    d.append(
      h("div", { class: "muted" }, "Masukan"), h("pre", {}, t.input.join("\n")),
      h("div", { class: "muted" }, "Keluaran yang diharapkan"), h("pre", {}, t.expected),
      h("div", { class: "muted" }, "Keluaran programmu"), h("pre", {}, r.error ? r.error : r.status === "timeout" ? "Program berjalan terlalu lama dan dihentikan." : r.actual)
    );
    if (r.status !== "pass") d.open = true;
  } else if (r.status !== "pass") {
    d.append(h("p", { class: "muted" }, r.status === "timeout" ? "Program berjalan terlalu lama dan dihentikan." : r.error ? "Programmu error pada kasus ini." : "Keluaran belum cocok. Cek batas nilai dan urutan syaratmu."));
  }
  return d;
}

function normOut(t) {
  return String(t).replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
}

function normIn(t) {
  const a = String(t).replace(/\r/g, "").split("\n");
  while (a.length && a[a.length - 1] === "") a.pop();
  return a.join("\n");
}

// Kotak informasi yang bisa dilipat; pilihan lipat diingat (dipakai bersama oleh semua bab).
function kotakLipat(nama, kelas, judul, ...isi) {
  const d = h("details", { class: "lipat " + kelas }, h("summary", {}, judul), ...isi);
  if (!store.get("lipat:" + nama, false)) d.open = true;
  d.addEventListener("toggle", () => store.set("lipat:" + nama, !d.open));
  return d;
}

function contohBox(ch) {
  const t = ch.tests.find((x) => !x.hidden);
  if (!t) return null;
  return kotakLipat("contoh", "contoh", "Contoh", h("div", { class: "muted" }, "Masukan"), h("pre", {}, t.input.join("\n")), h("div", { class: "muted" }, "Keluaran yang diharapkan"), h("pre", {}, t.expected));
}

function rujukanBox(list) {
  if (!list || !list.length) return null;
  return kotakLipat("rujukan", "rujukan", "Belajar dari", h("ul", {}, list.map((t) => h("li", {}, t))));
}

// ---------- Tantangan konsep (tanpa kode) ----------

function konsepCard(m, ch) {
  if (!ch) return h("section", { class: "card soal" }, h("h3", {}, "Tantangan konsep"), h("p", { class: "muted" }, "Tantangan untuk bab ini belum disiapkan."));
  const butir = ch.butir;
  const mulai = Date.now();
  const draf = store.get(key("konsepDraf", m.bab), []);
  let timerDraf = null;
  const hasilBox = h("div", { "aria-live": "polite" });
  const periksa = h("button", { type: "button", class: "btn btn-primary" }, "Periksa jawaban");
  const kosongkan = h("button", { type: "button", class: "btn btn-ghost" }, "Kosongkan jawaban");
  // Khusus instruktur: mengisi semua butir dengan jawaban benar (dari berkas soal) lalu memeriksanya.
  const kunciBtn = Kunci.adalahInstruktur() ? h("button", { type: "button", class: "btn", title: "Khusus instruktur: isi jawaban benar lalu periksa" }, "Isi kunci (instruktur)") : null;
  const simpanDraf = () => {
    clearTimeout(timerDraf);
    timerDraf = setTimeout(() => store.set(key("konsepDraf", m.bab), items.map((x) => x.ambil())), 400);
  };
  const items = butir.map((b, i) =>
    Konsep.buatButir(b, i + 1, draf[i], () => {
      markStarted(m.bab);
      simpanDraf();
    })
  );

  // Petunjuk bertahap, sama seperti tantangan kode.
  const hintBox = h("div", {});
  let hintShown = store.get(key("hint", m.bab), 0);
  const hintBtn = h("button", { type: "button", class: "btn btn-sm" });
  const renderHints = () => {
    hintBox.replaceChildren();
    ch.petunjuk.slice(0, hintShown).forEach((p, i) => hintBox.append(h("div", { class: "hint" }, h("strong", {}, ["Petunjuk soal", "Baca di buku", "Tonton video"][i] + ": "), p.isi)));
    hintBtn.textContent = hintShown >= ch.petunjuk.length ? "Semua petunjuk sudah dibuka" : "Butuh petunjuk? (" + hintShown + " dari " + ch.petunjuk.length + ")";
    hintBtn.disabled = hintShown >= ch.petunjuk.length;
  };
  hintBtn.addEventListener("click", () => {
    hintShown++;
    store.set(key("hint", m.bab), hintShown);
    renderHints();
  });

  periksa.addEventListener("click", () => {
    markStarted(m.bab);
    const jawaban = items.map((x) => x.ambil());
    const nilai = Konsep.nilaiSemua(butir, jawaban);
    const tries = store.get(key("tries", m.bab), 0) + 1;
    store.set(key("tries", m.bab), tries);
    store.set(key("konsepDraf", m.bab), jawaban);
    const sudah = isDone(m.bab);
    const persen = Math.round(nilai.persen * 100);
    // Jawaban benar dan penjelasannya baru ditampilkan setelah lulus (atau bila sudah pernah lulus), supaya tidak sekadar disalin.
    items.forEach((x, i) => x.tandai(nilai.per[i], nilai.lulus || sudah));
    hasilBox.replaceChildren(h("div", { class: "verdict " + (nilai.lulus ? "pass" : "fail") }, nilai.lulus ? "Lulus. Skor " + persen + " persen (" + nilai.benar + " dari " + nilai.total + " bagian benar). Jawaban dan penjelasan ditampilkan di tiap soal." : "Belum lulus: skor " + persen + " persen (" + nilai.benar + " dari " + nilai.total + " bagian benar). Butuh " + Math.round(Konsep.AMBANG_LULUS * 100) + " persen. Perbaiki soal yang bertanda salah, lalu periksa lagi."));
    if (nilai.lulus && !sudah) {
      store.set(key("done", m.bab), true);
      store.set(key("lulus", m.bab), new Date().toISOString());
      store.set(key("jalur", m.bab), store.get(key("hint", m.bab), 0) > 0 ? "bantuan" : "langsung");
      renderSidebar();
      $("#statusLine").textContent = "Bab " + m.bab + " - " + STATUS_TEXT.selesai;
      const em = $("#statusLine").previousSibling;
      if (em) em.className = "st selesai";
    }
    store.set(key("kirimTerakhir", m.bab), { konsep: true, lulus: nilai.lulus, persen, kasus_lulus: nilai.benar, kasus_total: nilai.total, waktu: new Date().toISOString() });
    Sinkron.catat(COURSE.id, m.bab, { lulus: nilai.lulus, kasus_lulus: nilai.benar, kasus_total: nilai.total, kasus_gagal: nilai.butirSalah, hasil: nilai.lulus ? "lulus" : "gagal", petunjuk: hintShown, kode: JSON.stringify(jawaban), pola: { jenis: "konsep", butir: butir.length, durasi_s: Math.round((Date.now() - mulai) / 1000), petunjuk: hintShown, percobaan_ke: tries } });
    sinkronBab(m.bab);
  });
  if (kunciBtn)
    kunciBtn.addEventListener("click", async () => {
      store.set(key("konsepDraf", m.bab), butir.map(Konsep.jawabanBenar));
      await renderBab(m.bab);
      const tombol = [...document.querySelectorAll(".soal .btn-primary")].find((b) => b.textContent === "Periksa jawaban");
      if (tombol) tombol.click();
    });
  kosongkan.addEventListener("click", () => {
    if (!confirm("Semua jawabanmu di soal ini akan dikosongkan. Lanjutkan?")) return;
    store.set(key("konsepDraf", m.bab), []);
    renderBab(m.bab);
  });
  renderHints();

  const kartu = h(
    "section",
    { class: "card soal", "aria-label": "Tantangan konsep" },
    h("h3", {}, "Tantangan konsep: " + ch.judul),
    ch.soal.map((p) => h("p", {}, p)),
    rujukanBox(ch.rujukan),
    ...items.map((x) => x.el),
    h("div", { class: "actions" }, periksa, kosongkan, kunciBtn),
    hasilBox,
    h("div", { class: "actions" }, hintBtn),
    hintBox
  );
  Anticopas.blokirSalinTempel(kartu, {
    lokasi: "konsep",
    kecualikan: () => !!Auth.getProfile() && Auth.getProfile().peran === "instruktur",
    saatTempel: (lokasi) => Sinkron.aktivitas(COURSE.id, m.bab, "tempel_diblokir", { lokasi }),
  });
  return kartu;
}

function tugasCard(m, praktik) {
  const t = m.tugas;
  if (!t) return h("section", { class: "card" }, h("h3", {}, "Kumpulkan tugas"), h("div", { class: "placeholder" }, "Bab ini tidak memakai kode. Kamu akan mengumpulkan foto atau PDF flowchart dan pseudocode. Fitur unggah dibuat pada Tahap 7."));
  return h(
    "section",
    { class: "card soal", "aria-label": "Tugas rancangan" },
    h("h3", {}, (praktik ? "Tugas praktik: " : "Tugas: ") + t.judul),
    t.soal.map((p) => h("p", {}, p)),
    rujukanBox(t.rujukan),
    t.kriteria ? h("div", {}, h("strong", {}, "Yang dinilai:"), h("ul", {}, t.kriteria.map((k) => h("li", {}, k)))) : null,
    h("div", { class: "placeholder" }, praktik ? "Kerjakan di komputermu, lalu kumpulkan hasilnya (berkas dan tangkapan layar) lewat sistem pengumpulan kampus bersama PDF laporan di bawah. Laporan tetap bisa diekspor kapan saja." : "Fitur unggah foto atau PDF dibuat pada Tahap 7. Untuk sementara siapkan berkasnya.")
  );
}

// ---------- Penjalan: kesiapan dan batas waktu ----------

const penjalanSiap = () => (LANG === "java" ? javaSiap() : pythonSiap());
const penjalanGagal = () => (LANG === "java" ? javaGagal() : pythonGagal());
const mulaiPenjalan = () => (LANG === "java" ? startJava() : start());
const BATAS_DETIK = () => (LANG === "java" ? BATAS_JAVA_DETIK : 5);

// Menunggu sampai penjalan siap (dimuat pertama kali, atau dimulai ulang setelah program dihentikan).
async function tungguPenjalanSiap(saatMenunggu) {
  mulaiPenjalan();
  const mulai = Date.now();
  while (!penjalanSiap() && !penjalanGagal() && Date.now() - mulai < 240000) {
    saatMenunggu((Date.now() - mulai) / 1000);
    await new Promise((r) => setTimeout(r, 200));
  }
}

function spandukPenjalan() {
  const java = LANG === "java";
  return Kemajuan.spandukSiap({
    nama: LANG,
    label: LANG_LABEL[LANG] || LANG,
    awalMs: java ? 22000 : 9000,
    langgan: java ? onJavaReadyChange : onReadyChange,
    mulaiPada: java ? javaMulaiPada : pythonMulaiPada,
    siap: penjalanSiap,
    gagal: penjalanGagal,
    ulangi: java ? ulangiJava : ulangiPython,
    catatan: java ? "Java butuh memori cukup besar. Bila ponselmu terus gagal, kerjakan bab ini di laptop atau komputer." : "",
  });
}

// Sisa waktu menunggu penjalan siap, dari perkiraan lama muat sebelumnya.
function sisaMuat() {
  const java = LANG === "java";
  const est = Kemajuan.perkiraanMs(LANG, java ? 22000 : 9000);
  const lewat = Date.now() - (java ? javaMulaiPada() : pythonMulaiPada());
  return { frac: Math.min(0.95, Math.max(0.03, lewat / est)), teks: "Menunggu " + (LANG_LABEL[LANG] || LANG) + " siap, " + Kemajuan.teksSisa((est - lewat) / 1000) + ". Programmu otomatis dijalankan begitu siap." };
}
const pesanMenunggu = () => sisaMuat().teks;

function challengeCard(m, ch) {
  const draftKey = key("draft", m.bab);
  const bisa = supports(LANG);
  const bahasa = LANG_LABEL[LANG] || LANG;
  const startCode = store.get(draftKey, null) ?? (ch ? ch.starter : STARTER_BEBAS[LANG] || "");
  const holder = h("div", { "aria-label": "Editor kode " + bahasa });
  const stdin = h("textarea", { class: "stdin", id: "stdin", rows: "2", "aria-label": "Masukan untuk program (satu baris per input)" });
  stdin.value = ch ? ch.contohMasukan : "";
  const out = h("pre", { class: "out", "aria-live": "polite" }, "Keluaran muncul di sini.");
  const result = h("div", { "aria-live": "polite" });
  const banding = h("div", { "aria-live": "polite", class: "banding" });
  const hintBox = h("div", {});
  let hintShown = store.get(key("hint", m.bab), 0);
  const hintBtn = h("button", { type: "button", class: "btn btn-sm" });

  function renderHints() {
    hintBox.replaceChildren();
    if (!ch) return;
    ch.petunjuk.slice(0, hintShown).forEach((p, i) => {
      const box = h("div", { class: "hint" }, h("strong", {}, ["Petunjuk soal", "Baca di buku", "Tonton video"][i] + ": "), p.isi);
      hintBox.append(box);
    });
    hintBtn.textContent = hintShown >= ch.petunjuk.length ? "Semua petunjuk sudah dibuka" : "Butuh petunjuk? (" + hintShown + " dari " + ch.petunjuk.length + ")";
    hintBtn.disabled = hintShown >= ch.petunjuk.length;
  }
  hintBtn.addEventListener("click", () => {
    hintShown++;
    store.set(key("hint", m.bab), hintShown);
    renderHints();
  });

  const runBtn = h("button", { type: "button", class: "btn btn-primary" }, "Jalankan");
  const sendBtn = h("button", { type: "button", class: "btn" }, "Kirim jawaban");
  // Khusus instruktur: mengisi kunci jawaban dari database (tabel kunci_jawaban) lalu mengirimnya.
  const kunciBtn = ch && Kunci.adalahInstruktur() ? h("button", { type: "button", class: "btn", title: "Khusus instruktur: isi kunci jawaban lalu kirim" }, "Isi kunci (instruktur)") : null;
  const resetBtn = h("button", { type: "button", class: "btn btn-ghost" }, "Kembalikan kode awal");
  if (!bisa) {
    runBtn.disabled = true;
    sendBtn.disabled = true;
  }

  runBtn.addEventListener("click", async () => {
    markStarted(m.bab);
    if (rekam) rekam.jalankan();
    // Cuplikan cara menulis sampai tombol ini ditekan; tidak memutus rantai rekaman Kirim.
    const lihatJalan = rekam ? rekam.lihat() : null;
    store.set(key("runs", m.bab), store.get(key("runs", m.bab), 0) + 1);
    sinkronBab(m.bab);
    runBtn.disabled = true;
    out.className = "out";
    out.textContent = penjalanSiap() ? "" : pesanMenunggu();
    const lines = stdin.value === "" ? [] : stdin.value.split("\n");
    const kodeJalan = editor.getValue();
    await tungguPenjalanSiap(() => (out.textContent = pesanMenunggu()));
    if (penjalanGagal()) {
      out.className = "out err";
      out.textContent = penjalanGagal().pesan + "\n\nTekan Coba lagi di spanduk atas editor.";
      runBtn.disabled = false;
      return;
    }
    const berhenti = Kemajuan.hitungBatas(BATAS_DETIK(), (t) => (out.textContent = t));
    const r = await run(kodeJalan, lines, true, LANG);
    berhenti();
    const galatJalan = r.timeout ? { jenis: "Timeout", pesan: "Berjalan terlalu lama dan dihentikan" } : klasifikasiGalat(LANG, r.error);
    let cocokContoh = null;
    if (r.timeout) {
      out.className = "out err";
      out.textContent = "Program berjalan terlalu lama dan dihentikan. Periksa perulangan yang tidak pernah berhenti.";
    } else {
      out.className = "out" + (r.error ? " err" : "");
      out.textContent = (r.stdout ? r.stdout + "\n" : "") + (r.error || "") || "(tidak ada keluaran)";
    }
    banding.replaceChildren();
    if (ch && !r.timeout && !r.error) {
      const t = ch.tests.find((x) => !x.hidden && normIn(x.input.join("\n")) === normIn(stdin.value));
      if (t) {
        // Keluaran Jalankan memuat gema masukan; bandingkan keluaran murni seperti saat penilaian.
        const teksHasil = out.textContent;
        out.textContent = teksHasil + "\n\nMembandingkan dengan keluaran yang diharapkan";
        const murni = await run(kodeJalan, lines, false, LANG);
        out.textContent = teksHasil;
        const cocok = !murni.error && !murni.timeout && normOut(murni.stdout) === normOut(t.expected);
        cocokContoh = cocok;
        banding.append(h("div", { class: "verdict " + (cocok ? "pass" : "fail") }, cocok ? "Cocok dengan keluaran yang diharapkan untuk masukan ini." : "Belum cocok dengan keluaran yang diharapkan."));
        if (!cocok) banding.append(h("div", { class: "muted" }, "Yang diharapkan"), h("pre", {}, t.expected), h("div", { class: "muted" }, "Keluaran programmu"), h("pre", {}, normOut(murni.stdout || murni.error || "") || "(kosong)"));
      }
    }
    // Setiap Jalankan dicatat (hasil, jenis galat, kode, cara menulis) untuk jejak peserta. Keluaran program tidak disimpan.
    Sinkron.catat(COURSE.id, m.bab, { jenis: "jalankan", hasil: r.timeout ? "timeout" : r.error ? "galat" : "jalan", galat_jenis: galatJalan && galatJalan.jenis, galat_pesan: galatJalan && galatJalan.pesan, cocok_contoh: cocokContoh, petunjuk: store.get(key("hint", m.bab), 0), kode: kodeJalan, pola: lihatJalan && lihatJalan.pola, rekaman: lihatJalan && lihatJalan.rekaman });
    runBtn.disabled = false;
  });

  resetBtn.addEventListener("click", () => {
    if (confirm("Kode kamu akan diganti dengan kode awal. Lanjutkan?")) {
      editor.setValue(ch ? ch.starter : "");
      banding.replaceChildren();
      result.replaceChildren();
    }
  });

  if (kunciBtn)
    kunciBtn.addEventListener("click", async () => {
      kunciBtn.disabled = true;
      const k = await Kunci.ambilKunci(COURSE.id, m.bab);
      kunciBtn.disabled = false;
      if (k.galat) {
        result.replaceChildren(h("div", { class: "verdict fail" }, k.galat));
        return;
      }
      editor.setValue(k.isi);
      sendBtn.click();
    });

  sendBtn.addEventListener("click", async () => {
    markStarted(m.bab);
    sendBtn.disabled = true;
    const bar = Kemajuan.barKemajuan();
    result.replaceChildren(bar);
    bar.perbarui(0, penjalanSiap() ? "Memeriksa semua kasus uji" : pesanMenunggu());
    const kodeKirim = editor.getValue();
    await tungguPenjalanSiap(() => bar.perbarui(sisaMuat().frac, pesanMenunggu()));
    if (penjalanGagal()) {
      // Belum dinilai: tidak dihitung sebagai percobaan dan tidak dikirim ke server.
      result.replaceChildren(h("div", { class: "verdict fail" }, "Jawaban belum bisa diperiksa: " + penjalanGagal().pesan), h("p", { class: "muted" }, "Ini bukan kesalahan kodemu dan tidak dihitung sebagai percobaan. Tekan Coba lagi di spanduk atas editor, lalu kirim lagi."));
      sendBtn.disabled = false;
      return;
    }
    const rk = rekam ? rekam.ambil() : null; // pola dan rekaman cara menulis sejak kirim sebelumnya
    const res = await grade(kodeKirim, ch.tests, (c, i, e) => run(c, i, e, LANG), (i, n) => bar.perbarui((i - 1) / n, "Memeriksa kasus " + i + " dari " + n));
    const passed = res.filter((r) => r.status === "pass").length;
    const all = passed === ch.tests.length;
    const tries = store.get(key("tries", m.bab), 0) + 1;
    store.set(key("tries", m.bab), tries);
    store.set(key("kirimTerakhir", m.bab), { kode: kodeKirim, lulus: all, kasus_lulus: passed, kasus_total: ch.tests.length, waktu: new Date().toISOString() });
    Sinkron.catat(COURSE.id, m.bab, { lulus: all, kasus_lulus: passed, kasus_total: ch.tests.length, kasus_gagal: res.map((r, i) => (r.status === "pass" ? 0 : i + 1)).filter((x) => x > 0), hasil: all ? "lulus" : "gagal", petunjuk: store.get(key("hint", m.bab), 0), kode: kodeKirim, pola: rk && rk.pola, rekaman: rk && rk.rekaman });
    result.replaceChildren(
      h("div", { class: "verdict " + (all ? "pass" : "fail") }, all ? "Lulus. Semua " + ch.tests.length + " kasus cocok." : "Belum lulus: " + passed + " dari " + ch.tests.length + " kasus cocok."),
      ...res.map(caseView)
    );
    if (all && !isDone(m.bab)) {
      store.set(key("done", m.bab), true);
      store.set(key("lulus", m.bab), new Date().toISOString());
      // "langsung" = lulus tanpa membuka satu pun petunjuk; "bantuan" = memakai petunjuk (dibaca instruktur sebagai tanda belum mandiri).
      store.set(key("jalur", m.bab), store.get(key("hint", m.bab), 0) > 0 ? "bantuan" : "langsung");
      renderSidebar();
      $("#statusLine").textContent = "Bab " + m.bab + " - " + STATUS_TEXT.selesai;
      const em = $("#statusLine").previousSibling;
      if (em) em.className = "st selesai";
    }
    sinkronBab(m.bab);
    sendBtn.disabled = false;
  });

  // Tiga kelompok: info (soal, rujukan, contoh), kode (editor dan hasil), bantu (petunjuk). Biasanya bertumpuk
  // berurutan info, kode, bantu; di mode fokus info dan bantu ada di kolom kiri dan kode di kolom kanan.
  const grup = (kelas, ...isi) => h("div", { class: kelas }, ...isi);
  const card = h(
    "section",
    { class: "card soal soal-grid", "aria-label": "Latihan kode" },
    grup(
      "g-kiri",
      grup(
        "g-info",
        h("h3", {}, ch ? "Tantangan: " + ch.judul : "Coba bebas"),
        ch ? ch.soal.map((p) => h("p", {}, p)) : h("p", { class: "muted" }, "Tantangan untuk bab ini belum disiapkan. Kamu tetap bisa mencoba kode di editor."),
        ch ? rujukanBox(ch.rujukan) : null,
        ch ? contohBox(ch) : null
      ),
      grup("g-bantu", ch ? h("div", { class: "actions" }, hintBtn) : null, hintBox)
    ),
    grup(
      "g-kode",
      bisa ? spandukPenjalan() : null,
      bisa ? null : h("p", { class: "placeholder" }, "Penjalan kode " + bahasa + " belum tersedia di situs ini. Kamu bisa menulis kode di editor, tetapi belum bisa menjalankan atau menilainya di sini."),
      holder,
      Tata.gripTinggi(TATA, () => editor),
      h("label", { for: "stdin", class: "muted" }, "Masukan untuk tombol Jalankan (satu baris untuk setiap input)"),
      stdin,
      h("div", { class: "actions" }, runBtn, ch ? sendBtn : null, ch ? resetBtn : null, kunciBtn),
      out,
      banding,
      result
    )
  );
  let rekam = null; // perekam cara menulis, dipasang setelah editor dibuat
  const jagaTempel = {
    lokasi: "latihan",
    saatTempel: (lokasi) => Sinkron.aktivitas(COURSE.id, m.bab, "tempel_diblokir", { lokasi }),
    kecualikan: () => !!Auth.getProfile() && Auth.getProfile().peran === "instruktur",
  };
  Anticopas.blokirSalinTempel(card, jagaTempel);
  queueMicrotask(() => {
    editor = CodeMirror(holder, {
      value: startCode,
      mode: CM_MODE[LANG] || "text/plain",
      lineNumbers: true,
      lineWrapping: typeof matchMedia !== "undefined" && matchMedia("(max-width: 900px)").matches, // ponsel: baris panjang dilipat agar terbaca
      indentUnit: 4,
      indentWithTabs: false,
      extraKeys: { Tab: (cm) => cm.replaceSelection("    ", "end") },
    });
    // Salin dan tempel dimatikan: peserta mengetik sendiri. Jumlah percobaan tempel dicatat (bukan isinya).
    Anticopas.blokirDiCodeMirror(editor, jagaTempel);
    rekam = Rekam.pasangRekam(editor, startCode);
    let t = null;
    editor.on("change", () => {
      markStarted(m.bab);
      clearTimeout(t);
      t = setTimeout(() => store.set(draftKey, editor.getValue()), 400);
    });
  });
  renderHints();
  return card;
}

// Lampiran PDF: kiriman terakhir (walaupun belum lulus) atau, bila belum pernah mengirim, kode di editor saat ini.
function lampiranLaporan(m, ch) {
  if (m.jenis === "unggah" || !ch) return null;
  const k = store.get(key("kirimTerakhir", m.bab), null);
  if (m.jenis === "konsep") {
    if (!k) return { tipe: "konsep", judul: "hasil tantangan konsep", isi: "", hasil: "Belum pernah memeriksa jawaban tantangan konsep." };
    return { tipe: "konsep", judul: "hasil tantangan konsep", isi: "", hasil: "Skor terakhir " + k.persen + " persen (" + k.kasus_lulus + " dari " + k.kasus_total + " bagian benar): " + (k.lulus ? "lulus." : "belum lulus.") };
  }
  if (k) {
    const hasil = k.lulus ? "Hasil: lulus, semua " + k.kasus_total + " kasus uji cocok." : "Hasil: belum lulus, " + k.kasus_lulus + " dari " + k.kasus_total + " kasus uji cocok.";
    return { tipe: "kode", judul: "kode terakhir yang dikirim", isi: k.kode, hasil };
  }
  const draf = store.get(key("draft", m.bab), null);
  return { tipe: "kode", judul: "kode di editor (belum pernah dikirim)", isi: draf || (ch ? ch.starter : ""), hasil: "Belum pernah dikirim untuk dinilai." };
}

// Lampiran PDF untuk praktik bab ini: kode terakhir milik peserta (Bagian A dan, bila ada, Bagian B) beserta status dan jumlah pemeriksaan.
function lampiranPraktik(def) {
  if (!def) return null;
  const komentar = COURSE && COURSE.bahasa === "java" ? "//" : "#";
  const bagian = [["A", def]].concat(def.bagianB ? [["B", def.bagianB]] : []);
  const isi = [];
  const hasil = [];
  for (const [nama, d] of bagian) {
    const s = PraktikData.bacaLokal(store, COURSE.id, def.bab, nama);
    const st = PraktikUI.NAMA_STATUS[s.status === "lulus" || s.status === "sedang" ? s.status : "belum"].toLowerCase();
    hasil.push((def.bagianB ? "Bagian " + nama + ": " : "Praktik: ") + st + (s.jumlah_kirim ? ", diperiksa " + s.jumlah_kirim + " kali" : "") + (s.isi === null ? " (belum dikerjakan)" : ""));
    if (s.isi !== null) isi.push((def.bagianB ? komentar + " ===== Bagian " + nama + ": " + d.berkas + " =====\n" : "") + s.isi);
  }
  return { judul: "praktik: " + def.judul + " (" + def.berkas + (def.bagianB ? ", " + def.bagianB.berkas : "") + ")", isi: isi.join("\n\n"), hasil: hasil.join(". ") + "." };
}

async function renderBab(n) {
  const m = MATERI.find((x) => x.bab === n);
  if (!m) {
    renderTidakAda();
    return;
  }
  current = m.bab;
  Sesi.catatKonteks(COURSE && COURSE.id, m.bab); // jam dan lama belajar (tanpa isi) untuk kehadiran; gagal tidak mengganggu
  renderSidebar();
  const main = $("#main");
  let ch = null;
  if (m.challenge) {
    try {
      ch = await loadJson("data/kuliah/" + COURSE.id + "/challenges/bab-" + String(m.bab).padStart(2, "0") + ".json");
    } catch (e) {
      ch = null;
    }
  }
  Tata.bersihkan();
  TATA = Tata.baru(store);
  // Pemberitahuan sekali per akun: apa yang dicatat situs.
  const perluInfo = !store.get("info-pencatatan-3", false) && !(Auth.getProfile() && Auth.getProfile().peran === "instruktur");
  const infoBar = perluInfo
    ? h("div", { class: "info-bar", role: "note" }, h("p", {}, "Supaya latihan adil, situs mencatat cara kamu mengerjakan: kapan dan bagaimana kode diketik, perangkat yang dipakai masuk, percobaan menempel, jam dan lama kamu aktif belajar di situs ini (dipakai sebagai kehadiran dan keaktifan), serta setiap kali kamu menekan Jalankan atau Kirim beserta hasilnya dan jenis kesalahannya (bukan keluaran programmu). Isi yang ditempel tidak dicatat. Selengkapnya di ", h("a", { href: "#panduan" }, "Panduan"), "."), h("button", { type: "button", class: "btn btn-sm", onclick: (e) => {
        store.set("info-pencatatan-3", true);
        e.target.closest(".info-bar").remove();
      } }, "Mengerti"))
    : null;
  const defPraktik = PRAKTIK.has(m.bab) ? await PraktikData.muatPraktik(COURSE.id, m.bab) : null;
  const kartuPraktik = defPraktik ? PraktikUI.kartuPraktik(ctxPraktik(), defPraktik) : null;
  const vc = videoCard(m);
  const isi = m.jenis === "kode" ? challengeCard(m, ch) : m.jenis === "konsep" ? konsepCard(m, ch) : tugasCard(m);
  const cols = h("div", { class: "cols" }, vc, isi);
  const profilLap = Auth.getProfile() || { nama: "(tanpa akun)", nim: "-", kelas: "-" };
  const laporan = laporanCard({
    store,
    kunci: key("laporan", m.bab),
    mataKuliah: { id: COURSE.id, nama: COURSE.nama },
    bab: m.bab,
    judul: m.judul,
    pertanyaan: m.pertanyaanKonsep,
    profil: profilLap,
    instruktur: () => !!Auth.getProfile() && Auth.getProfile().peran === "instruktur",
    simpanKeServer: (baris) => Sinkron.laporan(COURSE.id, m.bab, baris),
    catatTempel: () => Sinkron.aktivitas(COURSE.id, m.bab, "tempel_diblokir", { lokasi: "laporan" }),
    lampiran: () => lampiranLaporan(m, ch),
    lampiranPraktik: () => lampiranPraktik(defPraktik),
  });
  Sinkron.ambilLaporan(COURSE.id, m.bab).then((baris) => baris && laporan.terapkanServer(baris));
  const bar = Tata.pasang(cols, vc, TATA, { punyaVideo: !!(m.video && m.video.length), punyaEditor: m.jenis === "kode", ambilEditor: () => editor });
  main.replaceChildren(...[
    infoBar,
    h(
      "section",
      { class: "card bab-intro" },
      h("p", { class: "eyebrow" }, mark(m.bab), h("span", { id: "statusLine" }, "Bab " + m.bab + " - " + STATUS_TEXT[statusOf(m.bab)])),
      h("h2", {}, m.judul),
      h("p", {}, m.ringkasan),
      m.buku ? h("p", { class: "muted" }, "Baca selengkapnya di buku: " + m.buku.teks + (m.buku.halaman ? " (hlm. " + m.buku.halaman + ")" : "") + ".") : null
    ),
    bar,
    cols,
    m.jenis === "konsep" && m.tugas ? tugasCard(m, true) : null,
    kartuPraktik,
    laporan
  ].filter(Boolean));
  main.scrollTop = 0;
  window.scrollTo(0, 0);
  tanyaRiset(main);
}

function babGrid() {
  return h(
    "div",
    { class: "grid" },
    MATERI.map((m) =>
      h(
        "a",
        { class: "bab-card", href: babHref(m.bab) },
        mark(m.bab),
        h(
          "div",
          {},
          h("span", { class: "num" }, "BAB " + String(m.bab).padStart(2, "0") + (m.jenis === "unggah" ? " / UNGGAH TUGAS" : m.jenis === "konsep" ? " / KONSEP" : " / KODE")),
          h("strong", {}, m.judul),
          h("span", { class: "muted" }, STATUS_TEXT[statusOf(m.bab)])
        )
      )
    )
  );
}

function nextBab() {
  const m = MATERI.find((x) => !isDone(x.bab));
  return m ? m.bab : MATERI[0].bab;
}

function progressBar(done, total, label) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return h("div", { class: "pbar", role: "progressbar", "aria-valuenow": String(done), "aria-valuemin": "0", "aria-valuemax": String(total), "aria-label": label }, h("i", { style: "width:" + pct + "%" }));
}

function courseCard(c, publik) {
  const { total, done } = courseProgress(c);
  const ready = c.aktif && total > 0;
  const bahasa = c.bahasa ? LANG_LABEL[c.bahasa] || c.bahasa : "Tanpa kode";
  const body = h(
    "div",
    { class: "course-body" },
    h("span", { class: "num" }, ready ? total + " BAB" : "SEGERA HADIR"),
    h("strong", {}, c.nama),
    h("span", { class: "muted" }, c.deskripsi || ""),
    h("div", { class: "course-meta" }, h("span", { class: "badge" }, bahasa), ready ? h("span", { class: "muted" }, publik ? "Masuk untuk mulai" : done + " dari " + total + " bab selesai") : h("span", { class: "badge lain" }, "Sedang disiapkan")),
    ready && !publik ? progressBar(done, total, "Bab selesai di " + c.nama) : null
  );
  if (!ready) return h("div", { class: "course-card disabled", "aria-disabled": "true" }, body);
  return h("a", { class: "course-card", href: "#k/" + c.id }, body);
}

function courseGrid(publik) {
  const list = COURSES.slice().sort((a, b) => (a.urutan || 100) - (b.urutan || 100));
  return h("div", { class: "grid courses" }, list.map((c) => courseCard(COURSE_CACHE[c.id] || Object.assign({ materi: [] }, c), publik)));
}

function renderBeranda() {
  if (Auth.localMode() || (Auth.enabled() && Auth.getUserId())) renderDashboard();
  else renderLanding();
}

// Halaman depan publik: bisa dilihat tanpa masuk. Masuk baru diminta saat memilih mata kuliah.
function renderLanding() {
  const aktif = Object.values(COURSE_CACHE).filter((c) => c.aktif && c.materi.length);
  const totalBab = aktif.reduce((n, c) => n + c.materi.length, 0);
  const code = h("pre", {});
  code.innerHTML = [
    '<span class="c"># Selamat datang</span>',
    '<span class="k">for</span> kuliah <span class="k">in</span> daftar_kuliah:',
    '    <span class="k">if</span> kuliah.aktif:',
    '        print(<span class="s">"Siap dikerjakan:"</span>, kuliah.nama)',
    '    <span class="k">else</span>:',
    '        print(<span class="s">"Segera hadir:"</span>, kuliah.nama)',
  ].join("\n");
  const langkah = (n, judul, teks) => h("div", { class: "step" }, h("span", { class: "step-no" }, n), h("strong", {}, judul), h("span", { class: "muted" }, teks));
  $("#main").replaceChildren(
    h(
      "section",
      { class: "hero" },
      h(
        "div",
        {},
        h("span", { class: "pill" }, h("i", {}), "Gratis dan tanpa instal", h("b", {}, "Bisa dari ponsel")),
        h("h1", {}, "Belajar langsung,", h("br"), h("span", { class: "grad" }, "sampai bisa ngoding")),
        h("p", { class: "lead" }, "Pilih mata kuliahmu, tulis kode langsung di browser dan lihat hasilnya saat itu juga, lalu kerjakan laporan singkat. Kamu baru diminta masuk saat mulai mengerjakan."),
        h("div", { class: "cta" }, h("a", { class: "btn btn-primary", href: "#kuliah" }, "Lihat mata kuliah"), h("a", { class: "btn", href: "#panduan" }, "Cara memakai")),
        h("div", { class: "stats" }, h("div", {}, h("small", {}, "Mata kuliah"), h("strong", {}, String(aktif.length))), h("div", {}, h("small", {}, "Bab latihan"), h("strong", {}, String(totalBab))), h("div", {}, h("small", {}, "Biaya"), h("strong", {}, "Gratis")))
      ),
      h(
        "div",
        { class: "stage" },
        h("div", { class: "codewin", "aria-hidden": "true" }, h("div", { class: "dots" }, h("i", { style: "background:#ff6159" }), h("i", { style: "background:#ffbd2e" }), h("i", { style: "background:#28c840" })), code),
        h("div", { class: "float-card fc1" }, h("span", { class: "ic" }, String(aktif.length)), h("div", {}, h("b", {}, "Mata kuliah"), h("small", {}, "Pilih yang kamu ambil"))),
        h("div", { class: "float-card fc2" }, h("span", { class: "ic" }, "PDF"), h("div", {}, h("b", {}, "Laporan praktikum"), h("small", {}, "Ditulis dengan bahasamu sendiri"))),
        h("div", { class: "float-card fc3" }, h("span", { class: "ic" }, "5s"), h("div", {}, h("b", {}, "Aman dicoba"), h("small", {}, "Program macet berhenti sendiri")))
      )
    ),
    h("div", { class: "section-title", id: "daftar" }, h("h2", {}, "Mata kuliah yang tersedia")),
    h("p", { class: "free-note" }, "Pilih salah satu untuk mulai. Kamu akan diminta masuk, lalu langsung diarahkan ke mata kuliah yang kamu pilih."),
    courseGrid(true),
    h("div", { class: "section-title" }, h("h2", {}, "Cara kerjanya")),
    h(
      "div",
      { class: "steps" },
      langkah("1", "Pilih mata kuliah", "Lihat daftar di atas. Bab bebas dikerjakan dalam urutan apa pun."),
      Auth.pendaftaranTerbuka()
        ? langkah("2", "Daftar atau masuk", "Buat akun dengan email dan kata sandi (sekali saja), lalu isi nama, NIM, dan kelas. Berikutnya cukup masuk.")
        : langkah("2", "Masuk dengan akun dari dosen", "Dosen sudah mendaftarkanmu. Masuk dengan email dan kata sandi awal dari dosen, lalu buat kata sandi barumu."),
      langkah("3", "Kerjakan dan laporkan", "Tulis kode, jalankan, kirim jawaban, lalu tulis laporan singkat dengan bahasamu sendiri.")
    )
  );
}

function renderDashboard() {
  const cs = Object.values(COURSE_CACHE);
  const aktif = cs.filter((c) => c.aktif && c.materi.length).length;
  const { done, total } = allProgress();
  const nama = Auth.enabled() && Auth.getProfile() ? Auth.getProfile().nama.trim().split(/\s+/)[0] : "";
  const last = COURSES.find((c) => c.id === store.get("terakhir", null) && c.aktif);
  const code = h("pre", {});
  code.innerHTML = [
    '<span class="c"># Selamat datang</span>',
    '<span class="k">for</span> kuliah <span class="k">in</span> daftar_kuliah:',
    '    <span class="k">if</span> kuliah.aktif:',
    '        print(<span class="s">"Siap dikerjakan:"</span>, kuliah.nama)',
    '    <span class="k">else</span>:',
    '        print(<span class="s">"Segera hadir:"</span>, kuliah.nama)',
  ].join("\n");
  $("#main").replaceChildren(
    h(
      "section",
      { class: "hero" },
      h(
        "div",
        {},
        h("span", { class: "pill" }, h("i", {}), "Gratis dan tanpa instal", h("b", {}, "Bisa dari ponsel")),
        nama ? h("p", { class: "greet" }, "Halo, " + nama + ".") : null,
        h("h1", {}, "Belajar langsung,", h("br"), h("span", { class: "grad" }, "sampai bisa ngoding")),
        h("p", { class: "lead" }, "Pilih mata kuliahmu, tulis kode langsung di browser dan lihat hasilnya saat itu juga, lalu kerjakan laporan singkat. Urutan bab bebas."),
        h(
          "div",
          { class: "cta" },
          last ? h("a", { class: "btn btn-primary", href: "#k/" + last.id }, "Lanjutkan: " + last.nama) : h("a", { class: "btn btn-primary", href: "#kuliah" }, "Pilih mata kuliah"),
          last ? h("a", { class: "btn", href: "#kuliah" }, "Semua mata kuliah") : null
        ),
        h("div", { class: "stats" }, h("div", {}, h("small", {}, "Mata kuliah"), h("strong", {}, String(aktif))), h("div", {}, h("small", {}, "Bab selesai"), h("strong", {}, done + " dari " + total)), h("div", {}, h("small", {}, "Urutan"), h("strong", {}, "Bebas")))
      ),
      h(
        "div",
        { class: "stage" },
        h("div", { class: "codewin", "aria-hidden": "true" }, h("div", { class: "dots" }, h("i", { style: "background:#ff6159" }), h("i", { style: "background:#ffbd2e" }), h("i", { style: "background:#28c840" })), code),
        h("div", { class: "float-card fc1" }, h("span", { class: "ic" }, String(aktif)), h("div", {}, h("b", {}, "Mata kuliah"), h("small", {}, "Pilih yang kamu ambil"))),
        h("div", { class: "float-card fc2" }, h("span", { class: "ic" }, "PDF"), h("div", {}, h("b", {}, "Laporan praktikum"), h("small", {}, "Ditulis dengan bahasamu sendiri"))),
        h("div", { class: "float-card fc3" }, h("span", { class: "ic" }, "5s"), h("div", {}, h("b", {}, "Aman dicoba"), h("small", {}, "Program macet berhenti sendiri")))
      )
    ),
    h("div", { class: "section-title" }, h("h2", {}, "Pilih mata kuliah")),
    h("p", { class: "free-note" }, "Pilih mata kuliah, lalu bab mana saja. Tidak ada yang terkunci. Bilah di tiap kartu menunjukkan bab yang sudah kamu selesaikan di mata kuliah itu."),
    courseGrid()
  );
}

function renderKuliah(publik) {
  $("#main").replaceChildren(
    h("div", { class: "section-title" }, h("h2", {}, "Mata kuliah")),
    h("p", { class: "free-note" }, publik ? "Pilih mata kuliah untuk mulai. Kamu akan diminta masuk." : "Pilih mata kuliah yang kamu ambil. Progresmu dicatat terpisah untuk tiap mata kuliah."),
    courseGrid(publik)
  );
}

function renderCourse(c) {
  const { total, done } = courseProgress(c);
  const ready = c.aktif && total > 0;
  Sesi.catatKonteks(c.id, null);
  $("#main").replaceChildren(...[
    h(
      "section",
      { class: "card" },
      h("p", { class: "eyebrow" }, h("a", { href: "#kuliah" }, "Mata kuliah"), " / ", c.nama),
      h("h2", {}, c.nama),
      h("p", {}, c.deskripsi || ""),
      h("p", { class: "muted" }, ready ? done + " dari " + total + " bab selesai." : "Mata kuliah ini sedang disiapkan oleh pengajar. Kembali lagi nanti."),
      ready ? progressBar(done, total, "Bab selesai di " + c.nama) : null,
      ready ? h("div", { class: "cta", style: "margin-top:12px" }, h("a", { class: "btn btn-primary", href: "#k/" + c.id + "/bab-" + nextBab() }, done ? "Lanjutkan" : "Mulai belajar")) : null
    ),
    ready ? h("div", { class: "section-title" }, h("h2", {}, "Daftar bab")) : null,
    ready ? h("p", { class: "free-note" }, "Pilih bab mana saja. Penanda menunjukkan mana yang belum, sedang, atau sudah selesai.") : null,
    ready ? babGrid() : null,
    ready && Auth.getUserId() ? LaporanAkhirUI.kartuLaporanAkhir({ store, kuliah: c, instruktur: () => !!Auth.getProfile() && Auth.getProfile().peran === "instruktur" }) : null
  ].filter(Boolean));
}

// Setelah praktik berubah: segarkan lingkaran status di sidebar dan kepala bab.
function perbaruiTandaPraktik() {
  renderSidebar();
  const sl = $("#statusLine");
  const em = sl && sl.previousSibling;
  if (em && em.classList && em.classList.contains("st")) em.replaceWith(mark(current));
}
const ctxPraktik = () => ({ store, kuliah: COURSE, instruktur: () => !!Auth.getProfile() && Auth.getProfile().peran === "instruktur", perbaruiTanda: perbaruiTandaPraktik });

function renderTidakAda() {
  $("#main").replaceChildren(gateCard("Halaman tidak ditemukan", "Mata kuliah atau bab yang kamu cari belum ada.", h("div", { class: "actions" }, h("a", { class: "btn btn-primary", href: "#kuliah" }, "Lihat mata kuliah"))));
}

function renderPanduan() {
  const li = (t) => h("li", {}, t);
  $("#main").replaceChildren(
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Cara memakai"),
      h("ol", {}, li("Pilih mata kuliah. Saat mulai, masuk dengan email dan kata sandi (atau daftar bila belum punya akun), lalu isi nama, NIM, dan kelas satu kali."), li("Pilih bab dari daftar. Urutannya bebas, tidak ada yang terkunci."), li("Baca ringkasan, lalu tonton video bantuan kalau perlu. Video tidak wajib."), li("Bab selesai dihitung terpisah untuk tiap mata kuliah. Kamu bisa berpindah mata kuliah kapan saja lewat menu Mata kuliah."), li("Kerjakan tantangan di editor. Tombol Jalankan mencoba kodemu; tombol Kirim jawaban menilai dengan beberapa kasus uji."), li("Kalau semua kasus cocok, bab ditandai selesai dan laporan terbuka."), li("Kalau macet, buka petunjuk satu per satu: soal, bagian buku, lalu video.")),
      h("h3", { style: "margin-top:16px" }, "Arti penanda"),
      h("div", { class: "legend", style: "border:0;margin:0;padding:0" }, h("div", {}, h("span", { class: "st" }), "Belum dikerjakan"), h("div", {}, h("span", { class: "st sedang" }), "Sedang dikerjakan: sudah mengetik atau menjalankan, belum lulus"), h("div", {}, h("span", { class: "st selesai" }), "Selesai: tantangan lulus")),
      h("h3", { style: "margin-top:16px" }, "Catatan"),
      h("ul", {}, li("Program yang berjalan terlalu lama dihentikan otomatis: 5 detik untuk Python, 8 detik untuk Java. Selama program berjalan ada hitungan waktunya."), li("Java perlu disiapkan dulu saat bab dibuka (sekitar 20 detik pertama kali). Bilah kemajuan di atas editor menunjukkan sisa waktunya; sambil menunggu, baca soalnya. Bila muncul pesan gagal, tekan Coba lagi; kodemu tidak hilang."),
      li("Di ponsel: gunakan Wi-Fi untuk membuka bab pertama (pengunduhan awal cukup besar, setelah itu tersimpan). Java butuh memori cukup besar; bila terus gagal di ponselmu, kerjakan bab Java di laptop. Memegang ponsel secara mendatar membuat editor lebih lega."), li("Saat dinilai, teks di dalam input(...) tidak dihitung; yang dibandingkan hanya hasil print."), li("Salin dan tempel dimatikan di halaman latihan. Ketik sendiri kodemu: justru mengetik yang membuatmu paham."),
      li("Yang dicatat situs (diumumkan terbuka): kapan dan bagaimana kamu mengetik di editor latihan (waktu dan perubahan kode, bukan tombol di luar editor), kode tiap kali kamu mengirim jawaban, perangkat yang dipakai masuk (ID acak di browser ini, bukan alamat atau data perangkat kerasmu), jumlah percobaan menempel, jam dan lama kamu aktif di situs beserta bab yang kamu buka, serta setiap kali kamu menekan Jalankan atau Kirim beserta hasilnya dan jenis kesalahannya (bukan keluaran programmu) (aktif berarti tab terlihat dan ada gerakan; dipakai untuk kehadiran dan keaktifan, tanpa isi apa pun dan tanpa melihat tab atau aplikasi lain). Data ini hanya dibaca dosen pengampu untuk memastikan latihan dikerjakan sendiri, tidak dipakai sebagai satu-satunya dasar tuduhan, dan dihapus di akhir semester."), li("Tampilan bisa diatur: geser garis antara video dan soal, tarik pegangan di bawah editor untuk menambah tinggi, sembunyikan video, atau pakai Mode fokus (Esc untuk keluar)."), li("Progres tersimpan di akunmu, jadi tetap ada saat kamu masuk dari perangkat lain."))
    )
  );
}

// ---------- Masuk dan data awal ----------

function field(id, label, attrs, hint) {
  const input = h("input", Object.assign({ id, class: "input", name: id }, attrs));
  const err = h("p", { class: "field-err", id: id + "Err", role: "alert" });
  return { input, err, node: h("div", { class: "field" }, h("label", { for: id }, label), input, hint ? h("p", { class: "muted" }, hint) : null, err) };
}

function gateCard(title, lead, ...kids) {
  return h("section", { class: "card gate-card" }, h("h2", {}, title), lead ? h("p", { class: "muted" }, lead) : null, ...kids);
}

function renderLoading() {
  $("#main").replaceChildren(gateCard("Memeriksa sesi", "Sebentar."));
}

let PESAN_LOGIN = "";
let PEMULIHAN = false;

// Kolom kata sandi dengan tombol tampilkan/sembunyikan (membantu mengetik di ponsel).
function sandiField(id, label, attrs) {
  const f = field(id, label, Object.assign({ type: "password" }, attrs));
  const tombol = h("button", { type: "button", class: "pw-toggle", "aria-pressed": "false" }, "Tampilkan");
  tombol.addEventListener("click", () => {
    const lihat = f.input.type === "password";
    f.input.type = lihat ? "text" : "password";
    tombol.textContent = lihat ? "Sembunyikan" : "Tampilkan";
    tombol.setAttribute("aria-pressed", String(lihat));
  });
  const bungkus = h("div", { class: "pw-wrap" });
  f.input.replaceWith(bungkus);
  bungkus.append(f.input, tombol);
  return f;
}

// Tombol kirim ulang email dengan jeda 60 detik.
function kirimUlangBtn(kirim, pesanEl, galatEl, label) {
  const btn = h("button", { type: "button", class: "btn btn-ghost" }, label);
  let timer = null;
  function jeda() {
    let s = 60;
    btn.disabled = true;
    btn.textContent = label + " (" + s + ")";
    clearInterval(timer);
    timer = setInterval(() => {
      s--;
      btn.textContent = s > 0 ? label + " (" + s + ")" : label;
      if (s <= 0) {
        btn.disabled = false;
        clearInterval(timer);
      }
    }, 1000);
  }
  btn.addEventListener("click", async () => {
    galatEl.textContent = "";
    btn.disabled = true;
    try {
      await kirim();
      pesanEl.textContent = "Email baru dikirim.";
      jeda();
    } catch (e) {
      pesanEl.textContent = "";
      galatEl.textContent = e.message;
      btn.disabled = false;
    }
  });
  return { btn, jeda };
}

function renderMasuk(konteks) {
  const terbuka = Auth.pendaftaranTerbuka();
  // div (bukan p): bisa memuat tombol kirim ulang dan paragraf info saat email belum dikonfirmasi.
  const msg = h("div", { class: "form-msg", role: "status", "aria-live": "polite" });
  const fe = field("email", "Email", { type: "email", autocomplete: "username", inputmode: "email", placeholder: "nama@email.com", required: "" });
  const fs = sandiField("sandi", "Kata sandi", { autocomplete: "current-password", required: "" });
  const btn = h("button", { type: "submit", class: "btn btn-primary" }, "Masuk");
  const form = h(
    "form",
    { novalidate: "" },
    fe.node,
    fs.node,
    h("div", { class: "actions" }, btn, h("a", { class: "btn btn-ghost", href: "#kuliah" }, "Lihat mata kuliah")),
    msg,
    h("p", { class: "alt-link" }, h("a", { href: "#lupa" }, "Lupa kata sandi?"))
  );
  const galat = PESAN_LOGIN;
  PESAN_LOGIN = "";
  const lead = terbuka
    ? "Masuk dengan email dan kata sandimu."
    : "Masuk dengan email yang didaftarkan dosen dan kata sandi awal dari dosen. Kamu akan diminta membuat kata sandi baru saat pertama masuk.";
  const bawah = terbuka ? h("p", { class: "alt-link" }, "Belum punya akun? ", h("a", { href: "#daftar" }, "Daftar")) : h("p", { class: "alt-link muted" }, "Akun peserta dibuat oleh dosen.");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    fe.err.textContent = "";
    fs.err.textContent = "";
    msg.textContent = "";
    const ee = Auth.validasiEmail(fe.input.value);
    if (ee) {
      fe.err.textContent = ee;
      return;
    }
    if (!fs.input.value) {
      fs.err.textContent = "Isi kata sandi.";
      return;
    }
    btn.disabled = true;
    msg.textContent = "Memeriksa";
    try {
      await Auth.signIn(fe.input.value, fs.input.value);
      msg.textContent = "Berhasil masuk.";
    } catch (e) {
      msg.textContent = "";
      fs.err.textContent = e.message;
      if (/belum dikonfirmasi/.test(e.message)) {
        const info = h("p", { class: "form-msg", role: "status" });
        const r = kirimUlangBtn(() => Auth.resendConfirmation(fe.input.value), info, fs.err, "Kirim ulang email konfirmasi");
        msg.replaceChildren(r.btn, info);
      }
    } finally {
      btn.disabled = false;
    }
  });
  $("#main").replaceChildren(gateCard(konteks ? "Masuk untuk membuka " + konteks : "Masuk", lead, galat ? h("p", { class: "field-err", role: "alert" }, galat) : null, form, bawah));
  fe.input.focus();
}

function renderDaftar(konteks) {
  if (!Auth.pendaftaranTerbuka()) {
    $("#main").replaceChildren(gateCard("Pendaftaran ditutup", "Akun peserta dibuat oleh dosen. Masuk dengan email yang didaftarkan dan kata sandi awal dari dosen.", h("div", { class: "actions" }, h("a", { class: "btn btn-primary", href: "#masuk" }, "Ke halaman masuk"))));
    return;
  }
  const msg = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const fe = field("email", "Email", { type: "email", autocomplete: "username", inputmode: "email", placeholder: "nama@email.com", required: "" });
  const fs = sandiField("sandi", "Kata sandi", { autocomplete: "new-password", required: "" });
  const fu = sandiField("ulang", "Ulangi kata sandi", { autocomplete: "new-password", required: "" });
  const btn = h("button", { type: "submit", class: "btn btn-primary" }, "Daftar");
  const form = h("form", { novalidate: "" }, fe.node, fs.node, h("p", { class: "muted" }, "Minimal " + Auth.MIN_SANDI + " karakter, memuat huruf dan angka."), fu.node, h("div", { class: "actions" }, btn), msg);
  const bawah = h("p", { class: "alt-link" }, "Sudah punya akun? ", h("a", { href: "#masuk" }, "Masuk"));
  const card = gateCard(konteks ? "Daftar untuk membuka " + konteks : "Daftar", "Buat akun dengan email dan kata sandi. Setelah itu kamu mengisi nama, NIM, dan kelas satu kali.", form, bawah);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    fe.err.textContent = "";
    fs.err.textContent = "";
    fu.err.textContent = "";
    msg.textContent = "";
    const ee = Auth.validasiEmail(fe.input.value);
    const es = Auth.validasiSandi(fs.input.value);
    const eu = !es && fs.input.value !== fu.input.value ? "Kata sandi dan pengulangannya belum sama." : "";
    fe.err.textContent = ee;
    fs.err.textContent = es;
    fu.err.textContent = eu;
    if (ee || es || eu) return;
    btn.disabled = true;
    msg.textContent = "Mendaftarkan";
    try {
      const hasil = await Auth.signUp(fe.input.value, fs.input.value);
      if (!hasil.perluKonfirmasi) {
        msg.textContent = "Akun dibuat.";
        return;
      }
      const email = fe.input.value.trim();
      const info = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
      const galat = h("p", { class: "field-err", role: "alert" });
      const r = kirimUlangBtn(() => Auth.resendConfirmation(email), info, galat, "Kirim ulang email");
      card.replaceChildren(
        h("h2", {}, "Cek emailmu"),
        h("p", {}, "Kami mengirim email konfirmasi ke ", h("strong", {}, email), "."),
        h("ol", { class: "steps-list" }, h("li", {}, "Buka emailmu dan klik tautan konfirmasi."), h("li", {}, "Akunmu aktif dan kamu langsung masuk."), h("li", {}, "Tidak ketemu? Periksa folder spam atau promosi.")),
        h("div", { class: "actions" }, r.btn, h("a", { class: "btn btn-ghost", href: "#masuk" }, "Sudah konfirmasi? Masuk")),
        info,
        galat
      );
      r.jeda();
    } catch (e) {
      msg.textContent = "";
      fe.err.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  });
  $("#main").replaceChildren(card);
  fe.input.focus();
}

function renderLupa() {
  const msg = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const fe = field("email", "Email", { type: "email", autocomplete: "username", inputmode: "email", placeholder: "nama@email.com", required: "" });
  const btn = h("button", { type: "submit", class: "btn btn-primary" }, "Kirim tautan atur ulang");
  const form = h("form", { novalidate: "" }, fe.node, h("div", { class: "actions" }, btn, h("a", { class: "btn btn-ghost", href: "#masuk" }, "Kembali")), msg);
  const card = gateCard("Lupa kata sandi", "Masukkan emailmu. Kami mengirim tautan untuk membuat kata sandi baru. Kalau emailnya tidak menerima apa pun, minta dosen mengatur ulang kata sandimu.", form);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    fe.err.textContent = "";
    const ee = Auth.validasiEmail(fe.input.value);
    if (ee) {
      fe.err.textContent = ee;
      return;
    }
    btn.disabled = true;
    msg.textContent = "Mengirim";
    try {
      await Auth.resetPassword(fe.input.value);
      const email = fe.input.value.trim();
      const info = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
      const galat = h("p", { class: "field-err", role: "alert" });
      const r = kirimUlangBtn(() => Auth.resetPassword(email), info, galat, "Kirim ulang");
      card.replaceChildren(
        h("h2", {}, "Cek emailmu"),
        h("p", {}, "Kalau ", h("strong", {}, email), " terdaftar, tautan untuk membuat kata sandi baru sudah dikirim."),
        h("p", { class: "muted" }, "Klik tautannya, lalu buat kata sandi baru. Tidak ketemu? Periksa folder spam atau promosi."),
        h("div", { class: "actions" }, r.btn, h("a", { class: "btn btn-ghost", href: "#masuk" }, "Kembali ke masuk")),
        info,
        galat
      );
      r.jeda();
    } catch (e) {
      msg.textContent = "";
      fe.err.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  });
  $("#main").replaceChildren(card);
  fe.input.focus();
}

// mode "awal": kata sandi awal dari dosen, wajib diganti. mode "pemulihan": dari tautan atur ulang kata sandi.
function renderSandiBaru(mode) {
  const msg = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const fs = sandiField("sandi", "Kata sandi baru", { autocomplete: "new-password", required: "" });
  const fu = sandiField("ulang", "Ulangi kata sandi baru", { autocomplete: "new-password", required: "" });
  const btn = h("button", { type: "submit", class: "btn btn-primary" }, "Simpan kata sandi");
  const keluarBtn = h("button", { type: "button", class: "btn btn-ghost" }, "Keluar");
  keluarBtn.addEventListener("click", keluar);
  const form = h("form", { novalidate: "" }, fs.node, h("p", { class: "muted" }, "Minimal " + Auth.MIN_SANDI + " karakter, memuat huruf dan angka."), fu.node, h("div", { class: "actions" }, btn, keluarBtn), msg);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    fs.err.textContent = "";
    fu.err.textContent = "";
    msg.textContent = "";
    const es = Auth.validasiSandi(fs.input.value);
    const eu = !es && fs.input.value !== fu.input.value ? "Kata sandi dan pengulangannya belum sama." : "";
    fs.err.textContent = es;
    fu.err.textContent = eu;
    if (es || eu) return;
    btn.disabled = true;
    msg.textContent = "Menyimpan";
    try {
      await Auth.updatePassword(fs.input.value);
      PEMULIHAN = false;
      afterAuthChange("#beranda");
    } catch (e) {
      msg.textContent = "";
      fs.err.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  });
  const awal = mode === "awal";
  $("#main").replaceChildren(gateCard(awal ? "Buat kata sandi baru" : "Atur kata sandi baru", awal ? "Kata sandi awal dari dosen hanya untuk masuk pertama. Buat kata sandi baru yang hanya kamu yang tahu." : "Buat kata sandi baru untuk akunmu.", form));
  fs.input.focus();
}

// ---------- Pilihan kelas: Prodi, Angkatan, Kelas ----------

function kelasOpsi(cur) {
  const prodi = (Array.isArray(CFG.prodi) && CFG.prodi.length ? CFG.prodi : [{ kode: "SI", nama: "Sistem Informasi" }]).map((p) => [p.kode, p.kode + " - " + p.nama]);
  const mulai = Number(CFG.angkatanMulai) || 2024;
  const akhir = Math.max(new Date().getFullYear(), mulai);
  const tahun = [];
  for (let y = akhir; y >= mulai; y--) tahun.push(y); // tahun terbaru lebih dulu; bertambah otomatis tiap tahun
  const rombel = Array.isArray(CFG.kelas) && CFG.kelas.length ? CFG.kelas.slice() : ["A", "B", "C", "D"];
  // Nilai tersimpan di luar pilihan (mis. angkatan lebih lama) tetap ditampilkan supaya tidak hilang diam-diam.
  if (cur && !prodi.some((p) => p[0] === cur.prodi)) prodi.push([cur.prodi, cur.prodi]);
  if (cur && !tahun.includes(cur.angkatan)) tahun.push(cur.angkatan);
  if (cur && !rombel.includes(cur.rombel)) rombel.push(cur.rombel);
  return { prodi, tahun: tahun.map((t) => [t, String(t)]), rombel: rombel.map((r) => [r, r]) };
}

function selectBox(id, label, opsi, nilai, kosong) {
  const sel = h("select", { id, name: id, class: "input" }, h("option", { value: "" }, kosong), opsi.map((o) => h("option", { value: String(o[0]) }, o[1])));
  sel.value = nilai === undefined || nilai === null ? "" : String(nilai);
  return { sel, node: h("div", { class: "field" }, h("label", { for: id }, label), sel) };
}

function kelasField(nilaiAwal) {
  const cur = Auth.parseKelas(nilaiAwal);
  const lama = nilaiAwal && !cur ? nilaiAwal : "";
  const op = kelasOpsi(cur);
  const prodiAwal = cur ? cur.prodi : op.prodi.length === 1 ? op.prodi[0][0] : "";
  const s1 = selectBox("kelas-prodi", "Prodi", op.prodi, prodiAwal, "Pilih prodi");
  const s2 = selectBox("kelas-angkatan", "Angkatan", op.tahun, cur ? cur.angkatan : "", "Pilih tahun");
  const s3 = selectBox("kelas-rombel", "Kelas", op.rombel, cur ? cur.rombel : "", "Pilih kelas");
  const err = h("p", { class: "field-err", id: "kelasErr", role: "alert" });
  const node = h(
    "fieldset",
    { class: "field kelas-field" },
    h("legend", {}, "Kelas"),
    lama ? h("p", { class: "muted" }, "Kelas lamamu tercatat \u201c" + lama + "\u201d. Pilih kelas yang baru di bawah ini.") : null,
    h("div", { class: "kelas-row" }, s1.node, s2.node, s3.node),
    err
  );
  return { node, err, value: () => Auth.formatKelas(s1.sel.value, s2.sel.value, s3.sel.value) };
}

// Formulir data awal: wajib diisi sebelum mengerjakan.
function renderProfilForm() {
  const p = Auth.getProfile() || {};
  const fn = field("nama", "Nama lengkap", { autocomplete: "name", maxlength: "100", required: "" });
  const fi = field("nim", "NIM", { inputmode: "text", autocomplete: "off", maxlength: "30", required: "" }, "Tulis seperti di kartu mahasiswa.");
  const fk = kelasField(p.kelas);
  fn.input.value = p.nama || "";
  fi.input.value = p.nim || "";
  const msg = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const saveBtn = h("button", { type: "submit", class: "btn btn-primary" }, "Simpan dan mulai");
  const outBtn = h("button", { type: "button", class: "btn btn-ghost" }, "Keluar");
  outBtn.addEventListener("click", keluar);
  const form = h("form", { novalidate: "" }, fn.node, fi.node, fk.node, h("div", { class: "actions" }, saveBtn, outBtn), msg);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const val = { nama: fn.input.value, nim: fi.input.value, kelas: fk.value() };
    const errs = Auth.validateProfile(val);
    fn.err.textContent = errs.nama || "";
    fi.err.textContent = errs.nim || "";
    fk.err.textContent = errs.kelas || "";
    if (Object.keys(errs).length) return;
    saveBtn.disabled = true;
    msg.textContent = "Menyimpan";
    try {
      await Auth.saveProfile(val);
      afterAuthChange("#beranda");
    } catch (e) {
      msg.textContent = "";
      if (/NIM/.test(e.message)) fi.err.textContent = e.message;
      else msg.textContent = e.message;
    } finally {
      saveBtn.disabled = false;
    }
  });
  $("#main").replaceChildren(gateCard("Isi data dirimu dulu", "Sebelum mulai, lengkapi data ini. Dipakai untuk laporan dan penilaian. Isi sekali saja; bisa diubah nanti di halaman Profil.", form));
  fn.input.focus();
}

const TEKS_RISET = "Dosen pengampu sedang meneliti bagaimana mahasiswa belajar memrogram memakai situs ini. Bila kamu setuju, catatan belajarmu (waktu, hasil tiap percobaan, jenis kesalahan, dan cara menulis kode) boleh dipakai dalam laporan penelitian tanpa nama, dengan kode acak sebagai pengganti identitas. Menolak tidak berpengaruh apa pun pada nilai, akses, atau perlakuan dosen. Kamu bisa mengubah pilihan kapan saja di halaman Profil; ekspor berikutnya mengikuti pilihan terbaru.";

// Bagian "Penelitian" di Profil: peserta menyetujui atau menolak datanya dipakai untuk penelitian (anonim). Tidak berpengaruh ke nilai.
function risetProfilKartu() {
  const kotak = h("div", { class: "riset-profil" }, h("h3", {}, "Penelitian"), h("p", { class: "muted" }, "Memuat pilihanmu"));
  Auth.ambilPersetujuanRiset().then((r) => {
    if (!r.ada) {
      kotak.replaceChildren(h("h3", {}, "Penelitian"), h("p", { class: "muted" }, "Pilihan ini belum tersedia. Coba lagi nanti."));
      return;
    }
    const pesan = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
    const pilih = async (nilai) => {
      pesan.textContent = "Menyimpan";
      const hasil = await Auth.setPersetujuanRiset(nilai);
      pesan.textContent = hasil.ok ? (nilai ? "Terima kasih. Datamu boleh dipakai untuk penelitian secara anonim." : "Tercatat: datamu tidak dipakai untuk penelitian.") : hasil.galat;
      if (hasil.ok) {
        store.set("riset-nanti", 0);
        document.querySelectorAll(".riset-bar").forEach((x) => x.remove());
      }
    };
    const radio = (nilai, teks) => {
      const id = "riset-" + String(nilai);
      const input = h("input", { type: "radio", name: "riset", id, checked: r.nilai === nilai ? "" : false });
      input.addEventListener("change", () => pilih(nilai));
      return h("label", { for: id, class: "riset-pilihan" }, input, " " + teks);
    };
    kotak.replaceChildren(h("h3", {}, "Penelitian"), h("p", { class: "muted" }, TEKS_RISET), radio(true, "Saya setuju datanya dipakai untuk penelitian (anonim)"), radio(false, "Saya tidak setuju"), r.nilai === null ? h("p", { class: "muted" }, "Kamu belum menjawab. Sampai kamu menjawab, datamu tidak dipakai.") : null, pesan);
  });
  return kotak;
}

// Pertanyaan persetujuan sekali di halaman bab, sampai dijawab (Nanti menundanya tiga hari di browser ini).
function tanyaRiset(main) {
  const p = Auth.getProfile();
  if (!p || p.peran === "instruktur") return;
  const nanti = store.get("riset-nanti", 0);
  if (nanti && Date.now() - nanti < 3 * 86400000) return;
  Auth.ambilPersetujuanRiset().then((r) => {
    if (!r.ada || r.nilai !== null || document.querySelector(".riset-bar") || !document.querySelector("#main .bab-intro")) return;
    const pesan = h("span", { class: "muted", role: "status" });
    const jawab = async (nilai) => {
      const hasil = await Auth.setPersetujuanRiset(nilai);
      if (hasil.ok) bar.remove();
      else pesan.textContent = hasil.galat;
    };
    const bar = h("div", { class: "info-bar riset-bar", role: "note" }, h("p", {}, h("strong", {}, "Penelitian. "), "Dosen sedang meneliti cara mahasiswa belajar memrogram di situs ini. Bolehkah catatan belajarmu dipakai untuk penelitian, tanpa nama? Menolak tidak berpengaruh pada nilai."), h("details", { class: "riset-rinci" }, h("summary", {}, "Selengkapnya"), h("p", { class: "muted" }, TEKS_RISET)), h("div", { class: "actions" }, h("button", { type: "button", class: "btn btn-sm btn-primary", onclick: () => jawab(true) }, "Setuju"), h("button", { type: "button", class: "btn btn-sm", onclick: () => jawab(false) }, "Tidak setuju"), h("button", { type: "button", class: "btn btn-sm btn-ghost", onclick: () => { store.set("riset-nanti", Date.now()); bar.remove(); } }, "Nanti"), pesan));
    main.prepend(bar);
  });
}

function initials(name) {
  const w = (name || "?").trim().split(/\s+/).filter(Boolean);
  return ((w[0] || "?")[0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
}

// Halaman Profil: lihat dan ubah nama, NIM, kelas.
function renderProfil() {
  const p = Auth.getProfile() || {};
  const fn = field("nama", "Nama lengkap", { autocomplete: "name", maxlength: "100", required: "" });
  const fi = field("nim", "NIM", { autocomplete: "off", maxlength: "30", required: "" });
  const fk = kelasField(p.kelas);
  fn.input.value = p.nama || "";
  fi.input.value = p.nim || "";
  const msg = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const saveBtn = h("button", { type: "submit", class: "btn btn-primary" }, "Simpan perubahan");
  const outBtn = h("button", { type: "button", class: "btn btn-ghost" }, "Keluar");
  outBtn.addEventListener("click", keluar);
  const head = h(
    "div",
    { class: "prof-head" },
    h("span", { class: "avatar", "aria-hidden": "true" }, initials(p.nama)),
    h("div", {}, h("strong", { id: "profName" }, p.nama || ""), h("div", { class: "muted" }, Auth.getEmail() || ""), p.peran === "instruktur" ? h("span", { class: "badge" }, "Instruktur") : null)
  );
  const stats = h("div", { class: "stats prof-stats" }, h("div", {}, h("small", {}, "Kelas"), h("strong", { id: "profKelas" }, p.kelas || "-")));
  const baris = COURSES.map((c) => COURSE_CACHE[c.id])
    .filter((c) => c && c.aktif && c.materi.length)
    .map((c) => {
      const pr = courseProgress(c);
      return h("li", {}, h("div", { class: "prog-row" }, h("a", { href: "#k/" + c.id }, c.nama), h("span", { class: "muted" }, pr.done + " dari " + pr.total + " bab selesai")), progressBar(pr.done, pr.total, "Bab selesai di " + c.nama));
    });
  const progres = h("div", { class: "prof-progress" }, h("h3", {}, "Bab selesai per mata kuliah"), baris.length ? h("ul", { class: "prog-list" }, baris) : h("p", { class: "muted" }, "Belum ada mata kuliah yang aktif."));
  const form = h("form", { novalidate: "" }, fn.node, fi.node, fk.node, h("div", { class: "actions" }, saveBtn, outBtn), msg);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    msg.textContent = "";
    const val = { nama: fn.input.value, nim: fi.input.value, kelas: fk.value() };
    const errs = Auth.validateProfile(val);
    fn.err.textContent = errs.nama || "";
    fi.err.textContent = errs.nim || "";
    fk.err.textContent = errs.kelas || "";
    if (Object.keys(errs).length) return;
    saveBtn.disabled = true;
    msg.textContent = "Menyimpan";
    try {
      const saved = await Auth.saveProfile(val);
      updateUserBar();
      $("#profName").textContent = saved.nama;
      $("#profKelas").textContent = saved.kelas;
      document.querySelector(".avatar").textContent = initials(saved.nama);
      msg.textContent = "Perubahan tersimpan.";
    } catch (e) {
      msg.textContent = "";
      if (/NIM/.test(e.message)) fi.err.textContent = e.message;
      else msg.textContent = e.message;
    } finally {
      saveBtn.disabled = false;
    }
  });
  // Ganti kata sandi (peserta yang sudah masuk, tanpa email).
  const fsb = sandiField("sandi-baru", "Kata sandi baru", { autocomplete: "new-password" });
  const fub = sandiField("ulang-baru", "Ulangi kata sandi baru", { autocomplete: "new-password" });
  const msgSandi = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const sandiBtn = h("button", { type: "submit", class: "btn" }, "Ganti kata sandi");
  const formSandi = h("form", { novalidate: "", class: "ganti-sandi" }, h("h3", {}, "Ganti kata sandi"), fsb.node, h("p", { class: "muted" }, "Minimal " + Auth.MIN_SANDI + " karakter, memuat huruf dan angka."), fub.node, h("div", { class: "actions" }, sandiBtn), msgSandi);
  formSandi.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    fsb.err.textContent = "";
    fub.err.textContent = "";
    msgSandi.textContent = "";
    const es = Auth.validasiSandi(fsb.input.value);
    const eu = !es && fsb.input.value !== fub.input.value ? "Kata sandi dan pengulangannya belum sama." : "";
    fsb.err.textContent = es;
    fub.err.textContent = eu;
    if (es || eu) return;
    sandiBtn.disabled = true;
    msgSandi.textContent = "Menyimpan";
    try {
      await Auth.updatePassword(fsb.input.value);
      fsb.input.value = "";
      fub.input.value = "";
      msgSandi.textContent = "Kata sandi diganti. Pakai yang baru saat masuk berikutnya.";
    } catch (e) {
      msgSandi.textContent = "";
      fsb.err.textContent = e.message;
    } finally {
      sandiBtn.disabled = false;
    }
  });
  $("#main").replaceChildren(
    h("section", { class: "card gate-card prof-card" }, h("h2", {}, "Profil"), head, stats, progres, form, h("p", { class: "muted" }, "NIM dipakai sebagai identitas di laporan dan penilaian. Hubungi dosen bila NIM-mu ditolak karena sudah terpakai."), risetProfilKartu(), formSandi, h("p", { class: "muted" }, "Email tidak bisa diubah di sini. Bila perlu email lain, daftar ulang dengan email baru atau hubungi dosen."))
  );
}

// Ditampilkan bila situs belum tersambung ke Supabase dan mode lokal tidak dinyalakan.
function renderSetup() {
  const li = (t) => h("li", {}, t);
  $("#main").replaceChildren(
    gateCard(
      "Situs belum tersambung ke Supabase",
      "Peserta wajib masuk sebelum membuka bab, jadi situs butuh Supabase. Pemilik situs perlu mengisi URL dan kunci anon.",
      h(
        "ol",
        {},
        li("Ikuti langkah di docs/PEMASANGAN.md, lalu isi SUPABASE_URL dan SUPABASE_ANON_KEY di site/config.js."),
        li("Untuk mencoba tanpa Supabase: jalankan python tools/server_uji.py (login tiruan: kotak Email tiruan dengan tombol Klik tautan di email)."),
        li("Untuk melihat tampilan tanpa akun sama sekali: ubah MODE_LOKAL menjadi true di site/config.js.")
      )
    )
  );
}

function renderGateError(message) {
  const retry = h("button", { type: "button", class: "btn btn-primary" }, "Coba lagi");
  retry.addEventListener("click", () => location.reload());
  $("#main").replaceChildren(gateCard("Belum bisa dimuat", message, h("div", { class: "actions" }, retry)));
}

function updateUserBar() {
  const on = Auth.enabled() && !!Auth.getUserId() && !!Auth.getProfile();
  $("#userChip").hidden = !on;
  $("#logoutBtn").hidden = !on;
  $("#navProfil").hidden = !on;
  $("#navInstruktur").hidden = !(on && Auth.getProfile().peran === "instruktur");
  $("#loginBtn").hidden = !(Auth.enabled() && !Auth.getUserId());
  $("#daftarBtn").hidden = !(Auth.enabled() && !Auth.getUserId() && Auth.pendaftaranTerbuka());
  $("#navHome").textContent = Auth.localMode() || on ? "Dashboard" : "Beranda";
  if (on) $("#userChip").textContent = Auth.getProfile().nama;
}

function afterAuthChange(fallback) {
  NS = Auth.enabled() ? Auth.getUserId() || "lokal" : "lokal";
  terapkanTujuan(fallback);
  route();
}

function setPage(kind) {
  const gate = kind === "gate";
  Promo.halaman(kind === "bab");
  document.body.classList.toggle("gate", gate);
  document.body.classList.toggle("home", kind !== "bab");
  $("#navHome").classList.toggle("on", kind === "beranda");
  $("#navMateri").classList.toggle("on", kind === "kuliah" || kind === "course" || kind === "bab");
  $("#navPanduan").classList.toggle("on", kind === "panduan");
  $("#navInstruktur").classList.toggle("on", kind === "instruktur");
  $("#navProfil").classList.toggle("on", kind === "profil");
  $("#sidebar").classList.remove("open");
  $("#menuBtn").setAttribute("aria-expanded", "false");
}

let routeTok = 0;

const PUBLIK = ["", "#", "#beranda", "#kuliah", "#panduan"];
const TUJUAN_KEY = "latihan:tujuan";
const simpanTujuan = (h) => {
  try {
    localStorage.setItem(TUJUAN_KEY, JSON.stringify({ h, t: Date.now() }));
  } catch (e) {}
};
const hapusTujuan = () => {
  try {
    localStorage.removeItem(TUJUAN_KEY);
  } catch (e) {}
};
// Tujuan hanya diingat satu jam, supaya pilihan lama tidak tiba-tiba membuka mata kuliah yang tak diingat.
const ambilTujuan = () => {
  try {
    const x = JSON.parse(localStorage.getItem(TUJUAN_KEY) || "null");
    return x && typeof x.h === "string" && Date.now() - x.t < 3600000 ? x.h : null;
  } catch (e) {
    return null;
  }
};

// Sesudah masuk (termasuk kembali dari tautan email, yang membuka alamat dasar tanpa #),
// lanjutkan ke mata kuliah yang tadi dipilih. Tanpa tujuan, pakai `fallback` bila ada.
function terapkanTujuan(fallback) {
  if (!(Auth.getUserId() && Auth.getProfile())) return;
  const h = location.hash;
  const kosong = h === "" || h === "#" || h === "#masuk" || h === "#daftar" || h === "#lupa";
  const t = ambilTujuan();
  if (t) hapusTujuan();
  const tujuan = t || fallback || null;
  if (tujuan && kosong) history.replaceState(null, "", tujuan);
}

function namaTujuan(hash) {
  const m = /^#k\/([a-z0-9-]+)/.exec(hash || "");
  const c = m ? COURSES.find((x) => x.id === m[1]) : null;
  return c ? c.nama : "";
}

// Keluar: kembali ke halaman depan (publik), bukan ke formulir masuk.
async function keluar() {
  await Sesi.akhiriSesi(); // kirim sisa waktu sebelum sesi masuk dilepas
  await Auth.signOut();
  hapusTujuan();
  if (location.hash !== "#beranda") location.hash = "#beranda";
  else route();
}

async function route() {
  Tata.bersihkan();
  const tok = ++routeTok;
  const stale = () => tok !== routeTok;
  const hash = location.hash;
  const login = Auth.enabled() && !!Auth.getUserId();
  const bisaMasuk = Auth.localMode() || login;

  // Kata sandi awal dari dosen atau tautan atur ulang kata sandi: wajib membuat kata sandi baru dulu.
  if (login && (PEMULIHAN || Auth.perluGantiSandi())) {
    setPage("gate");
    updateUserBar();
    renderSandiBaru(PEMULIHAN ? "pemulihan" : "awal");
    return;
  }
  // Sudah masuk tetapi belum mengisi data diri: wajib diisi dulu, di halaman mana pun.
  if (login && !Auth.getProfile()) {
    setPage("gate");
    updateUserBar();
    renderProfilForm();
    return;
  }
  if (login) {
    NS = Auth.getUserId();
    // Beri waktu singkat agar progres dari server tergabung sebelum halaman pertama digambar; bila lambat, lanjut saja.
    await Promise.race([hidrasi(), new Promise((r) => setTimeout(r, 4000))]);
    if (stale()) return;
  }
  updateUserBar();
  $("#progressText").textContent = "";
  $("#pyStatus").hidden = true;

  if (hash === "#masuk" || hash === "#daftar" || hash === "#lupa") {
    if (bisaMasuk) {
      location.replace("#beranda");
      return;
    }
    setPage("gate");
    if (Auth.needsSetup()) renderSetup();
    else if (hash === "#daftar") renderDaftar(namaTujuan(ambilTujuan() || ""));
    else if (hash === "#lupa") renderLupa();
    else renderMasuk(namaTujuan(ambilTujuan() || ""));
    return;
  }

  let m;
  // tautan lama: #bab-N menuju mata kuliah terakhir; #materi menuju daftar mata kuliah
  if ((m = /^#bab-(\d+)$/.exec(hash))) {
    location.replace("#k/" + lastCourseId() + "/bab-" + m[1]);
    return;
  }
  if (hash === "#materi") {
    location.replace("#kuliah");
    return;
  }

  // Halaman publik (landing, daftar mata kuliah, panduan) terbuka tanpa masuk.
  // Selain itu butuh masuk; tujuan diingat supaya setelah masuk langsung ke sana.
  if (!PUBLIK.includes(hash) && !bisaMasuk) {
    setPage("gate");
    if (Auth.needsSetup()) {
      renderSetup();
      return;
    }
    simpanTujuan(hash);
    renderMasuk(namaTujuan(hash));
    return;
  }

  if ((m = /^#k\/([a-z0-9-]+)\/bab-(\d+)$/.exec(hash))) {
    const c = await loadCourse(m[1]);
    if (stale()) return;
    const n = Number(m[2]);
    if (!c || !c.aktif || !c.materi.some((x) => x.bab === n)) {
      setPage("kuliah");
      renderTidakAda();
      return;
    }
    useCourse(c, true);
    PRAKTIK = await PraktikData.muatIndeks(c.id, c.praktik === true);
    if (stale()) return;
    PraktikData.susulStatusKuliah(store, c.id).then((ch) => ch && !stale() && renderSidebar());
    setPage("bab");
    $("#pyStatus").hidden = c.bahasa !== "python" && c.bahasa !== "java";
    if (c.bahasa === "python") start();
    if (c.bahasa === "java") startJava();
    await renderBab(n);
    return;
  }
  if ((m = /^#k\/([a-z0-9-]+)$/.exec(hash))) {
    const c = await loadCourse(m[1]);
    if (stale()) return;
    if (!c) {
      setPage("kuliah");
      renderTidakAda();
      return;
    }
    const ready = c.aktif && c.materi.length > 0;
    useCourse(c, ready);
    PRAKTIK = ready ? await PraktikData.muatIndeks(c.id, c.praktik === true) : new Set();
    if (stale()) return;
    setPage("course");
    $("#pyStatus").hidden = c.bahasa !== "python";
    window.scrollTo(0, 0);
    renderCourse(c);
    return;
  }

  await loadAllCourses();
  if (stale()) return;
  window.scrollTo(0, 0);
  if (hash === "#kuliah") {
    setPage("kuliah");
    renderKuliah(!bisaMasuk);
  } else if (hash === "#panduan") {
    setPage("panduan");
    renderPanduan();
  } else if (hash === "#instruktur" && Auth.enabled()) {
    setPage("instruktur");
    await loadAllCourses();
    if (stale()) return;
    await renderInstruktur({ kuliahAktif: Object.values(COURSE_CACHE).filter((c) => c.aktif && c.materi.length) });
  } else if (hash === "#profil" && Auth.enabled()) {
    setPage("profil");
    renderProfil();
  } else {
    setPage("beranda");
    renderBeranda();
  }
}

let CFG = {};

async function init() {
  COURSES = await loadJson("data/matakuliah.json");
  try {
    CFG = await loadJson("data/config.json");
    $("#siteName").textContent = CFG.namaSitus || "Latihan";
    document.title = CFG.namaSitus || "Latihan";
  } catch (e) {}
  window.addEventListener("hashchange", route);
  Promo.mulai(() => !(Auth.getProfile() && Auth.getProfile().peran === "instruktur"));
  $("#logoutBtn").addEventListener("click", keluar);
  $("#menuBtn").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#menuBtn").setAttribute("aria-expanded", String(open));
  });
  onReadyChange((ok, galat) => {
    if (LANG !== "python") return;
    const c = $("#pyStatus");
    c.textContent = galat ? "Python: gagal dimuat" : ok ? "Python siap" : "Python: memuat";
    c.classList.toggle("ready", ok);
  });
  Sinkron.onStatus((st) => {
    const c = $("#syncStatus");
    c.hidden = !Sinkron.aktif() || st === "diam";
    c.textContent = { menyimpan: "Menyimpan", tersimpan: "Tersimpan di akun", gagal: "Belum tersimpan, dicoba lagi" }[st] || "";
    c.classList.toggle("ready", st === "tersimpan");
  });
  onJavaReadyChange((ok, galat) => {
    if (LANG !== "java") return;
    const c = $("#pyStatus");
    c.textContent = galat ? "Java: gagal dimuat" : ok ? "Java siap" : "Java: memuat (sekitar 20 detik)";
    c.classList.toggle("ready", ok);
  });
  if (Auth.enabled()) {
    // Baca dulu apa yang dibawa tautan email; pustaka Supabase akan menghapusnya dari alamat.
    const galatTautan = Auth.galatDariUrl();
    const dariTautan = Auth.dariTautanEmail();
    const pulih = Auth.jenisTautan() === "recovery";
    setPage("gate");
    renderLoading();
    try {
      await Auth.init();
    } catch (e) {
      setPage("gate");
      renderGateError(Auth.friendly(e));
      return;
    }
    if (dariTautan || galatTautan) history.replaceState(null, "", location.pathname + location.search + (galatTautan ? "#masuk" : ""));
    if (galatTautan && !Auth.getUserId()) PESAN_LOGIN = galatTautan;
    if (dariTautan && pulih && Auth.getUserId()) PEMULIHAN = true;
    Auth.onChange(() => afterAuthChange());
  }
  NS = Auth.enabled() ? Auth.getUserId() || "lokal" : "lokal";
  terapkanTujuan();
  await route();
  // Pyodide besar (sekitar 10 MB): hanya dimuat lebih awal untuk peserta yang sudah masuk.
  if (Auth.localMode() || Auth.getUserId()) {
    const last = COURSES.find((c) => c.id === store.get("terakhir", null));
    if (!last || last.bahasa === "python") (window.requestIdleCallback || setTimeout)(start);
  }
}

init().catch((e) => {
  $("#main").textContent = "Gagal memuat data: " + e.message;
});
