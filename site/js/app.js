import { start, run, supports, onReadyChange } from "./runner.js";
import { grade } from "./grader.js";
import * as Auth from "./auth.js";

const $ = (sel) => document.querySelector(sel);

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

// Penyimpanan di browser, dipisah per pengguna (supaya komputer bersama tidak bercampur).
// Sinkronisasi progres ke Supabase menyusul.
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
let LANG = "python";

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

function mark(n) {
  const st = statusOf(n);
  return h("span", { class: "st " + (st === "belum" ? "" : st), role: "img", "aria-label": STATUS_TEXT[st], title: STATUS_TEXT[st] });
}

function markStarted(n) {
  if (!store.get(key("started", n), false) && !isDone(n)) {
    store.set(key("started", n), true);
    renderSidebar();
  }
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
  const frame = h("div", { class: "video" });
  const tabs = h("div", { class: "vtabs", role: "group", "aria-label": "Pilih video" });
  const info = h("p", { class: "muted" });
  function show(i) {
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
  const card = h("section", { class: "card", "aria-label": "Video bantuan" }, h("h3", {}, "Video bantuan"), frame, m.video.length > 1 ? tabs : null, info);
  show(0);
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
      h("div", { class: "muted" }, "Keluaran programmu"), h("pre", {}, r.error ? r.error : r.status === "timeout" ? "Program berjalan lebih dari 5 detik dan dihentikan." : r.actual)
    );
    if (r.status !== "pass") d.open = true;
  } else if (r.status !== "pass") {
    d.append(h("p", { class: "muted" }, r.status === "timeout" ? "Program berjalan lebih dari 5 detik dan dihentikan." : r.error ? "Programmu error pada kasus ini." : "Keluaran belum cocok. Cek batas nilai dan urutan syaratmu."));
  }
  return d;
}

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
  const resetBtn = h("button", { type: "button", class: "btn btn-ghost" }, "Kembalikan kode awal");
  if (!bisa) {
    runBtn.disabled = true;
    sendBtn.disabled = true;
  }

  runBtn.addEventListener("click", async () => {
    markStarted(m.bab);
    runBtn.disabled = true;
    out.className = "out";
    out.textContent = "Menjalankan";
    const lines = stdin.value === "" ? [] : stdin.value.split("\n");
    const r = await run(editor.getValue(), lines, true, LANG);
    if (r.timeout) {
      out.className = "out err";
      out.textContent = "Program berjalan lebih dari 5 detik dan dihentikan. Periksa perulangan yang tidak pernah berhenti.";
    } else {
      out.className = "out" + (r.error ? " err" : "");
      out.textContent = (r.stdout ? r.stdout + "\n" : "") + (r.error || "") || "(tidak ada keluaran)";
    }
    runBtn.disabled = false;
  });

  resetBtn.addEventListener("click", () => {
    if (confirm("Kode kamu akan diganti dengan kode awal. Lanjutkan?")) editor.setValue(ch ? ch.starter : "");
  });

  sendBtn.addEventListener("click", async () => {
    markStarted(m.bab);
    sendBtn.disabled = true;
    result.replaceChildren(h("p", { class: "muted" }, "Memeriksa semua kasus uji"));
    const res = await grade(editor.getValue(), ch.tests, (c, i, e) => run(c, i, e, LANG));
    const passed = res.filter((r) => r.status === "pass").length;
    const all = passed === ch.tests.length;
    const tries = store.get(key("tries", m.bab), 0) + 1;
    store.set(key("tries", m.bab), tries);
    result.replaceChildren(
      h("div", { class: "verdict " + (all ? "pass" : "fail") }, all ? "Lulus. Semua " + ch.tests.length + " kasus cocok." : "Belum lulus: " + passed + " dari " + ch.tests.length + " kasus cocok."),
      ...res.map(caseView)
    );
    if (all && !isDone(m.bab)) {
      store.set(key("done", m.bab), true);
      renderSidebar();
      $("#statusLine").textContent = "Bab " + m.bab + " - " + STATUS_TEXT.selesai;
      const em = $("#statusLine").previousSibling;
      if (em) em.className = "st selesai";
    }
    sendBtn.disabled = false;
  });

  const card = h(
    "section",
    { class: "card soal", "aria-label": "Latihan kode" },
    h("h3", {}, ch ? "Tantangan: " + ch.judul : "Coba bebas"),
    ch ? ch.soal.map((p) => h("p", {}, p)) : h("p", { class: "muted" }, "Tantangan untuk bab ini belum disiapkan. Kamu tetap bisa mencoba kode di editor."),
    bisa ? null : h("p", { class: "placeholder" }, "Penjalan kode " + bahasa + " belum tersedia di situs ini. Kamu bisa menulis kode di editor, tetapi belum bisa menjalankan atau menilainya di sini."),
    holder,
    h("label", { for: "stdin", class: "muted" }, "Masukan untuk tombol Jalankan (satu baris untuk setiap input)"),
    stdin,
    h("div", { class: "actions" }, runBtn, ch ? sendBtn : null, ch ? resetBtn : null),
    out,
    result,
    ch ? h("div", { class: "actions" }, hintBtn) : null,
    hintBox
  );
  queueMicrotask(() => {
    editor = CodeMirror(holder, {
      value: startCode,
      mode: CM_MODE[LANG] || "text/plain",
      lineNumbers: true,
      indentUnit: 4,
      indentWithTabs: false,
      extraKeys: { Tab: (cm) => cm.replaceSelection("    ", "end") },
    });
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

async function renderBab(n) {
  const m = MATERI.find((x) => x.bab === n);
  if (!m) {
    renderTidakAda();
    return;
  }
  current = m.bab;
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
  main.replaceChildren(
    h(
      "section",
      { class: "card" },
      h("p", { class: "eyebrow" }, mark(m.bab), h("span", { id: "statusLine" }, "Bab " + m.bab + " - " + STATUS_TEXT[statusOf(m.bab)])),
      h("h2", {}, m.judul),
      h("p", {}, m.ringkasan),
      m.buku ? h("p", { class: "muted" }, "Baca selengkapnya di buku: " + m.buku.teks + (m.buku.halaman ? " (hlm. " + m.buku.halaman + ")" : "") + ".") : null
    ),
    h(
      "div",
      { class: "cols" },
      videoCard(m),
      m.jenis === "unggah"
        ? h("section", { class: "card" }, h("h3", {}, "Kumpulkan tugas"), h("div", { class: "placeholder" }, "Bab ini tidak memakai kode. Kamu akan mengumpulkan foto atau PDF flowchart dan pseudocode. Fitur unggah dibuat pada Tahap 7."))
        : challengeCard(m, ch)
    ),
    h("section", { class: "card", "aria-label": "Laporan praktikum" }, h("h3", {}, "Laporan praktikum"), h("div", { class: "placeholder" }, isDone(m.bab) ? "Selamat, tantangan lulus. Formulir laporan hadir pada Tahap 2." : "Laporan terbuka setelah tantangan lulus."))
  );
  main.scrollTop = 0;
  window.scrollTo(0, 0);
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
          h("span", { class: "num" }, "BAB " + String(m.bab).padStart(2, "0") + (m.jenis === "unggah" ? " / UNGGAH TUGAS" : " / KODE")),
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
    h("p", { class: "free-note" }, "Pilih salah satu untuk mulai. Kamu akan diminta masuk lewat email, lalu langsung diarahkan ke mata kuliah yang kamu pilih."),
    courseGrid(true),
    h("div", { class: "section-title" }, h("h2", {}, "Cara kerjanya")),
    h(
      "div",
      { class: "steps" },
      langkah("1", "Pilih mata kuliah", "Lihat daftar di atas. Bab bebas dikerjakan dalam urutan apa pun."),
      Auth.pendaftaranTerbuka()
        ? langkah("2", "Masuk lewat email", "Kami kirim tautan masuk ke emailmu. Tanpa kata sandi. Isi nama, NIM, dan kelas satu kali.")
        : langkah("2", "Masuk lewat email", "Dosen sudah mendaftarkan emailmu. Kami kirim tautan masuk; tanpa kata sandi dan tanpa mendaftar. Datamu sudah terisi."),
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
    h("p", { class: "free-note" }, publik ? "Pilih mata kuliah untuk mulai. Kamu akan diminta masuk lewat email." : "Pilih mata kuliah yang kamu ambil. Progresmu dicatat terpisah untuk tiap mata kuliah."),
    courseGrid(publik)
  );
}

function renderCourse(c) {
  const { total, done } = courseProgress(c);
  const ready = c.aktif && total > 0;
  $("#main").replaceChildren(
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
    ready ? babGrid() : null
  );
}

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
      h("ol", {}, li("Pilih mata kuliah. Saat mulai, masuk lewat tautan yang dikirim ke emailmu (tanpa kata sandi), lalu isi nama, NIM, dan kelas satu kali."), li("Pilih bab dari daftar. Urutannya bebas, tidak ada yang terkunci."), li("Baca ringkasan, lalu tonton video bantuan kalau perlu. Video tidak wajib."), li("Bab selesai dihitung terpisah untuk tiap mata kuliah. Kamu bisa berpindah mata kuliah kapan saja lewat menu Mata kuliah."), li("Kerjakan tantangan di editor. Tombol Jalankan mencoba kodemu; tombol Kirim jawaban menilai dengan beberapa kasus uji."), li("Kalau semua kasus cocok, bab ditandai selesai dan laporan terbuka."), li("Kalau macet, buka petunjuk satu per satu: soal, bagian buku, lalu video.")),
      h("h3", { style: "margin-top:16px" }, "Arti penanda"),
      h("div", { class: "legend", style: "border:0;margin:0;padding:0" }, h("div", {}, h("span", { class: "st" }), "Belum dikerjakan"), h("div", {}, h("span", { class: "st sedang" }), "Sedang dikerjakan: sudah mengetik atau menjalankan, belum lulus"), h("div", {}, h("span", { class: "st selesai" }), "Selesai: tantangan lulus")),
      h("h3", { style: "margin-top:16px" }, "Catatan"),
      h("ul", {}, li("Program yang berjalan lebih dari 5 detik dihentikan otomatis."), li("Saat dinilai, teks di dalam input(...) tidak dihitung; yang dibandingkan hanya hasil print."), li("Progres sementara tersimpan di browser ini. Penyimpanan akun menyusul."))
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

function renderLogin(konteks) {
  let email = "";
  let cooldown = null;
  const msg = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const f = field("email", "Alamat email", { type: "email", autocomplete: "email", inputmode: "email", placeholder: "nama@email.com", required: "" });
  const sendBtn = h("button", { type: "submit", class: "btn btn-primary" }, "Kirim tautan masuk");
  const kembali = h("a", { class: "btn btn-ghost", href: "#kuliah" }, "Lihat mata kuliah");
  const form = h("form", { novalidate: "" }, f.node, h("div", { class: "actions" }, sendBtn, kembali), msg);

  const judul = konteks ? "Masuk untuk membuka " + konteks : "Masuk";
  const lead = Auth.pendaftaranTerbuka()
    ? "Masukkan emailmu. Kami mengirim tautan masuk; klik tautannya untuk masuk. Tidak perlu kata sandi dan tidak ada kode yang diketik."
    : "Masuk dengan email yang didaftarkan dosen. Kami mengirim tautan masuk ke emailmu; klik tautannya untuk masuk. Tidak perlu kata sandi dan tidak perlu mendaftar.";
  const galat = PESAN_LOGIN;
  PESAN_LOGIN = "";
  const card = gateCard(judul, lead, galat ? h("p", { class: "field-err", role: "alert" }, galat) : null, form);

  const resendBtn = h("button", { type: "button", class: "btn btn-ghost" }, "Kirim ulang tautan");
  const changeBtn = h("button", { type: "button", class: "btn btn-ghost" }, "Ganti email");
  const infoMsg = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const infoErr = h("p", { class: "field-err", role: "alert" });

  function startCooldown() {
    let s = 60;
    resendBtn.disabled = true;
    resendBtn.textContent = "Kirim ulang (" + s + ")";
    clearInterval(cooldown);
    cooldown = setInterval(() => {
      s--;
      resendBtn.textContent = s > 0 ? "Kirim ulang (" + s + ")" : "Kirim ulang tautan";
      if (s <= 0) {
        resendBtn.disabled = false;
        clearInterval(cooldown);
      }
    }, 1000);
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    f.err.textContent = "";
    email = f.input.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      f.err.textContent = "Tulis alamat email yang benar.";
      return;
    }
    sendBtn.disabled = true;
    msg.textContent = "Mengirim tautan";
    try {
      await Auth.sendLink(email);
      card.replaceChildren(
        h("h2", {}, "Cek emailmu"),
        h("p", {}, "Tautan masuk dikirim ke ", h("strong", {}, email), "."),
        h("ol", { class: "steps-list" }, h("li", {}, "Buka emailmu dan klik tautan di dalamnya."), h("li", {}, "Kamu langsung masuk dan diarahkan kembali ke sini."), h("li", {}, "Tidak ketemu? Periksa folder spam atau promosi.")),
        h("p", { class: "muted" }, "Tautan hanya berlaku satu kali. Kalau kamu membukanya di browser yang sama dengan halaman ini, halaman ini lanjut sendiri."),
        h("div", { class: "actions" }, resendBtn, changeBtn),
        infoMsg,
        infoErr
      );
      startCooldown();
    } catch (e) {
      msg.textContent = "";
      f.err.textContent = e.message;
    } finally {
      sendBtn.disabled = false;
    }
  });
  resendBtn.addEventListener("click", async () => {
    infoErr.textContent = "";
    resendBtn.disabled = true;
    try {
      await Auth.sendLink(email);
      infoMsg.textContent = "Tautan baru dikirim. Gunakan tautan terbaru.";
      startCooldown();
    } catch (e) {
      infoMsg.textContent = "";
      infoErr.textContent = e.message;
      resendBtn.disabled = false;
    }
  });
  changeBtn.addEventListener("click", () => {
    clearInterval(cooldown);
    msg.textContent = "";
    card.replaceChildren(h("h2", {}, judul), h("p", { class: "muted" }, lead), form);
    f.input.focus();
  });
  $("#main").replaceChildren(card);
  f.input.focus();
}

// Formulir data awal: wajib diisi sebelum mengerjakan.
function renderProfilForm() {
  const p = Auth.getProfile() || {};
  const fn = field("nama", "Nama lengkap", { autocomplete: "name", maxlength: "100", required: "" });
  const fi = field("nim", "NIM", { inputmode: "text", autocomplete: "off", maxlength: "30", required: "" }, "Tulis seperti di kartu mahasiswa.");
  const fk = field("kelas", "Kelas", { autocomplete: "off", maxlength: "30", placeholder: "SI-1A", required: "" });
  fn.input.value = p.nama || "";
  fi.input.value = p.nim || "";
  fk.input.value = p.kelas || "";
  const msg = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const saveBtn = h("button", { type: "submit", class: "btn btn-primary" }, "Simpan dan mulai");
  const outBtn = h("button", { type: "button", class: "btn btn-ghost" }, "Keluar");
  outBtn.addEventListener("click", keluar);
  const form = h("form", { novalidate: "" }, fn.node, fi.node, fk.node, h("div", { class: "actions" }, saveBtn, outBtn), msg);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const val = { nama: fn.input.value, nim: fi.input.value, kelas: fk.input.value };
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

function initials(name) {
  const w = (name || "?").trim().split(/\s+/).filter(Boolean);
  return ((w[0] || "?")[0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
}

// Halaman Profil: lihat dan ubah nama, NIM, kelas.
function renderProfil() {
  const p = Auth.getProfile() || {};
  const fn = field("nama", "Nama lengkap", { autocomplete: "name", maxlength: "100", required: "" });
  const fi = field("nim", "NIM", { autocomplete: "off", maxlength: "30", required: "" });
  const fk = field("kelas", "Kelas", { autocomplete: "off", maxlength: "30", placeholder: "SI-1A", required: "" });
  fn.input.value = p.nama || "";
  fi.input.value = p.nim || "";
  fk.input.value = p.kelas || "";
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
    const val = { nama: fn.input.value, nim: fi.input.value, kelas: fk.input.value };
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
  $("#main").replaceChildren(
    h("section", { class: "card gate-card prof-card" }, h("h2", {}, "Profil"), head, stats, progres, form, h("p", { class: "muted" }, "NIM dipakai sebagai identitas di laporan dan penilaian. Hubungi dosen bila NIM-mu ditolak karena sudah terpakai."))
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
  $("#loginBtn").hidden = !(Auth.enabled() && !Auth.getUserId());
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
  document.body.classList.toggle("gate", gate);
  document.body.classList.toggle("home", kind !== "bab");
  $("#navHome").classList.toggle("on", kind === "beranda");
  $("#navMateri").classList.toggle("on", kind === "kuliah" || kind === "course" || kind === "bab");
  $("#navPanduan").classList.toggle("on", kind === "panduan");
  $("#navProfil").classList.toggle("on", kind === "profil");
  $("#sidebar").classList.remove("open");
  $("#menuBtn").setAttribute("aria-expanded", "false");
}

let routeTok = 0;

const PUBLIK = ["", "#", "#beranda", "#kuliah", "#panduan"];
const TUJUAN_KEY = "latihan:tujuan";
const simpanTujuan = (h) => {
  try {
    localStorage.setItem(TUJUAN_KEY, h);
  } catch (e) {}
};
const hapusTujuan = () => {
  try {
    localStorage.removeItem(TUJUAN_KEY);
  } catch (e) {}
};
const ambilTujuan = () => {
  try {
    return localStorage.getItem(TUJUAN_KEY);
  } catch (e) {
    return null;
  }
};

// Sesudah masuk (termasuk kembali dari tautan email, yang membuka alamat dasar tanpa #),
// lanjutkan ke mata kuliah yang tadi dipilih. Tanpa tujuan, pakai `fallback` bila ada.
function terapkanTujuan(fallback) {
  if (!(Auth.getUserId() && Auth.getProfile())) return;
  const h = location.hash;
  const kosong = h === "" || h === "#" || h === "#masuk";
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
  await Auth.signOut();
  hapusTujuan();
  if (location.hash !== "#beranda") location.hash = "#beranda";
  else route();
}

async function route() {
  const tok = ++routeTok;
  const stale = () => tok !== routeTok;
  const hash = location.hash;
  const login = Auth.enabled() && !!Auth.getUserId();
  const bisaMasuk = Auth.localMode() || login;

  // Sudah masuk tetapi belum mengisi data diri: wajib diisi dulu, di halaman mana pun.
  if (login && !Auth.getProfile()) {
    setPage("gate");
    updateUserBar();
    renderProfilForm();
    return;
  }
  if (login) NS = Auth.getUserId();
  updateUserBar();
  $("#progressText").textContent = "";
  $("#pyStatus").hidden = true;

  if (hash === "#masuk") {
    if (bisaMasuk) {
      location.replace("#beranda");
      return;
    }
    hapusTujuan();
    setPage("gate");
    if (Auth.needsSetup()) renderSetup();
    else renderLogin();
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
    renderLogin(namaTujuan(hash));
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
    setPage("bab");
    $("#pyStatus").hidden = c.bahasa !== "python";
    if (c.bahasa === "python") start();
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
  $("#logoutBtn").addEventListener("click", keluar);
  $("#menuBtn").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#menuBtn").setAttribute("aria-expanded", String(open));
  });
  onReadyChange((ok) => {
    const c = $("#pyStatus");
    c.textContent = ok ? "Python siap" : "Python: memuat";
    c.classList.toggle("ready", ok);
  });
  if (Auth.enabled()) {
    // Baca dulu apa yang dibawa tautan email; pustaka Supabase akan menghapusnya dari alamat.
    const galatTautan = Auth.galatDariUrl();
    const dariTautan = Auth.dariTautanEmail();
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
