import { start, run, onReadyChange } from "./runner.js";
import { grade } from "./grader.js";

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

// Penyimpanan sementara di browser. Dipindah ke Supabase pada Tahap 3.
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("latihan:" + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("latihan:" + key, JSON.stringify(value));
    } catch (e) {}
  },
};

let MATERI = [];
let current = 0;
let editor = null;

async function loadJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}

function isDone(n) {
  return !!store.get("done:" + n, false);
}

// Tiga status, tanpa kunci: belum, sedang, selesai.
function statusOf(n) {
  if (isDone(n)) return "selesai";
  if (store.get("started:" + n, false) || store.get("tries:" + n, 0) > 0) return "sedang";
  return "belum";
}
const STATUS_TEXT = { belum: "Belum dikerjakan", sedang: "Sedang dikerjakan", selesai: "Selesai" };

function mark(n) {
  const st = statusOf(n);
  return h("span", { class: "st " + (st === "belum" ? "" : st), role: "img", "aria-label": STATUS_TEXT[st], title: STATUS_TEXT[st] });
}

function markStarted(n) {
  if (!store.get("started:" + n, false) && !isDone(n)) {
    store.set("started:" + n, true);
    renderSidebar();
  }
}

function renderSidebar() {
  const ol = $("#babList");
  ol.replaceChildren();
  for (const m of MATERI) {
    const a = h(
      "a",
      { href: "#bab-" + m.bab, class: m.bab === current ? "on" : "", "aria-current": m.bab === current ? "page" : false },
      mark(m.bab),
      h("span", { class: "no" }, String(m.bab)),
      h("span", {}, m.judul)
    );
    ol.append(h("li", {}, a));
  }
  const n = MATERI.filter((m) => isDone(m.bab)).length;
  $("#progressText").textContent = "Selesai " + n + " dari " + MATERI.length;
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
  const draftKey = "draft:" + m.bab;
  const startCode = store.get(draftKey, null) ?? (ch ? ch.starter : '# Coba tulis kode Python di sini\nprint("Halo, Gresik")\n');
  const holder = h("div", { "aria-label": "Editor kode Python" });
  const stdin = h("textarea", { class: "stdin", id: "stdin", rows: "2", "aria-label": "Masukan untuk program (satu baris per input)" });
  stdin.value = ch ? ch.contohMasukan : "";
  const out = h("pre", { class: "out", "aria-live": "polite" }, "Keluaran muncul di sini.");
  const result = h("div", { "aria-live": "polite" });
  const hintBox = h("div", {});
  let hintShown = store.get("hint:" + m.bab, 0);
  const hintBtn = h("button", { type: "button" });

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
    store.set("hint:" + m.bab, hintShown);
    renderHints();
  });

  const runBtn = h("button", { type: "button", class: "primary" }, "Jalankan");
  const sendBtn = h("button", { type: "button" }, "Kirim jawaban");
  const resetBtn = h("button", { type: "button", class: "ghost" }, "Kembalikan kode awal");

  runBtn.addEventListener("click", async () => {
    markStarted(m.bab);
    runBtn.disabled = true;
    out.className = "out";
    out.textContent = "Menjalankan";
    const lines = stdin.value === "" ? [] : stdin.value.split("\n");
    const r = await run(editor.getValue(), lines, true);
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
    const res = await grade(editor.getValue(), ch.tests, run);
    const passed = res.filter((r) => r.status === "pass").length;
    const all = passed === ch.tests.length;
    const tries = store.get("tries:" + m.bab, 0) + 1;
    store.set("tries:" + m.bab, tries);
    result.replaceChildren(
      h("div", { class: "verdict " + (all ? "pass" : "fail") }, all ? "Lulus. Semua " + ch.tests.length + " kasus cocok." : "Belum lulus: " + passed + " dari " + ch.tests.length + " kasus cocok."),
      ...res.map(caseView)
    );
    if (all && !isDone(m.bab)) {
      store.set("done:" + m.bab, true);
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
      mode: "python",
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
  const m = MATERI.find((x) => x.bab === n) || MATERI[0];
  current = m.bab;
  renderSidebar();
  const main = $("#main");
  let ch = null;
  if (m.challenge) {
    try {
      ch = await loadJson("data/challenges/bab-" + String(m.bab).padStart(2, "0") + ".json");
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
      h("p", { class: "muted" }, "Baca selengkapnya di buku: " + m.buku.teks + " (hlm. " + m.buku.halaman + ").")
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
        { class: "bab-card", href: "#bab-" + m.bab },
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

function renderBeranda() {
  const done = MATERI.filter((m) => isDone(m.bab)).length;
  const code = h("pre", {});
  code.innerHTML = [
    '<span class="c"># Selamat datang</span>',
    '<span class="k">for</span> bab <span class="k">in</span> range(<span class="n">1</span>, <span class="n">15</span>):',
    '    <span class="k">if</span> bab_selesai(bab):',
    '        print(<span class="s">"Bab"</span>, bab, <span class="s">"selesai"</span>)',
    '    <span class="k">else</span>:',
    '        print(<span class="s">"Bab"</span>, bab, <span class="s">"menunggu kamu"</span>)',
  ].join("\n");
  $("#main").replaceChildren(
    h(
      "section",
      { class: "hero" },
      h(
        "div",
        {},
        h("span", { class: "pill" }, h("i", {}), "Gratis dan tanpa instal", h("b", {}, "Bisa dari ponsel")),
        h("h1", {}, "Belajar ", CFG.mataKuliah || "pemrograman", h("br"), h("span", { class: "grad" }, "sampai bisa ngoding")),
        h("p", { class: "lead" }, "Tulis kode " + (CFG.bahasa || "Python") + " langsung di browser, lihat hasilnya saat itu juga, lalu kerjakan laporan singkat. Pilih bab mana pun yang kamu mau."),
        h("div", { class: "cta" }, h("a", { class: "btn btn-primary", href: "#bab-" + nextBab() }, done ? "Lanjutkan belajar" : "Mulai belajar"), h("a", { class: "btn", href: "#materi" }, "Lihat semua bab")),
        h("div", { class: "stats" }, h("div", {}, h("small", {}, "Bab tersedia"), h("strong", {}, String(MATERI.length))), h("div", {}, h("small", {}, "Kamu selesai"), h("strong", {}, done + " bab")), h("div", {}, h("small", {}, "Urutan"), h("strong", {}, "Bebas")))
      ),
      h(
        "div",
        { class: "stage" },
        h("div", { class: "codewin", "aria-hidden": "true" }, h("div", { class: "dots" }, h("i", { style: "background:#ff6159" }), h("i", { style: "background:#ffbd2e" }), h("i", { style: "background:#28c840" })), code),
        h("div", { class: "float-card fc1" }, h("span", { class: "ic" }, "14"), h("div", {}, h("b", {}, "Bab bebas dipilih"), h("small", {}, "Tidak ada yang terkunci"))),
        h("div", { class: "float-card fc2" }, h("span", { class: "ic" }, "PDF"), h("div", {}, h("b", {}, "Laporan praktikum"), h("small", {}, "Ditulis dengan bahasamu sendiri"))),
        h("div", { class: "float-card fc3" }, h("span", { class: "ic" }, "5s"), h("div", {}, h("b", {}, "Aman dicoba"), h("small", {}, "Program macet berhenti sendiri")))
      )
    ),
    h("div", { class: "section-title" }, h("h2", {}, "Daftar bab")),
    h("p", { class: "free-note" }, "Pilih bab mana saja. Penanda di tiap kartu menunjukkan mana yang belum, sedang, atau sudah selesai."),
    babGrid()
  );
}

function renderMateri() {
  $("#main").replaceChildren(
    h("div", { class: "section-title" }, h("h2", {}, "Materi")),
    h("p", { class: "free-note" }, "Bebas mulai dari bab mana pun. Tidak ada bab yang terkunci."),
    babGrid()
  );
}

function renderPanduan() {
  const li = (t) => h("li", {}, t);
  $("#main").replaceChildren(
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Cara memakai"),
      h("ol", {}, li("Pilih bab dari daftar. Urutannya bebas, tidak ada yang terkunci."), li("Baca ringkasan, lalu tonton video bantuan kalau perlu. Video tidak wajib."), li("Kerjakan tantangan di editor. Tombol Jalankan mencoba kodemu; tombol Kirim jawaban menilai dengan beberapa kasus uji."), li("Kalau semua kasus cocok, bab ditandai selesai dan laporan terbuka."), li("Kalau macet, buka petunjuk satu per satu: soal, bagian buku, lalu video.")),
      h("h3", { style: "margin-top:16px" }, "Arti penanda"),
      h("div", { class: "legend", style: "border:0;margin:0;padding:0" }, h("div", {}, h("span", { class: "st" }), "Belum dikerjakan"), h("div", {}, h("span", { class: "st sedang" }), "Sedang dikerjakan: sudah mengetik atau menjalankan, belum lulus"), h("div", {}, h("span", { class: "st selesai" }), "Selesai: tantangan lulus")),
      h("h3", { style: "margin-top:16px" }, "Catatan"),
      h("ul", {}, li("Program yang berjalan lebih dari 5 detik dihentikan otomatis."), li("Saat dinilai, teks di dalam input(...) tidak dihitung; yang dibandingkan hanya hasil print."), li("Progres sementara tersimpan di browser ini. Penyimpanan akun menyusul."))
    )
  );
}

function setPage(kind) {
  document.body.classList.toggle("home", kind !== "bab");
  $("#navHome").classList.toggle("on", kind === "beranda");
  $("#navMateri").classList.toggle("on", kind === "materi" || kind === "bab");
  $("#navPanduan").classList.toggle("on", kind === "panduan");
  $("#sidebar").classList.remove("open");
  $("#menuBtn").setAttribute("aria-expanded", "false");
}

function route() {
  const hash = location.hash;
  const m = /^#bab-(\d+)$/.exec(hash);
  if (m) {
    setPage("bab");
    renderBab(Number(m[1]));
    return;
  }
  current = 0;
  renderSidebar();
  window.scrollTo(0, 0);
  if (hash === "#materi") { setPage("materi"); renderMateri(); }
  else if (hash === "#panduan") { setPage("panduan"); renderPanduan(); }
  else { setPage("beranda"); renderBeranda(); }
}

let CFG = {};

async function init() {
  MATERI = await loadJson("data/materi.json");
  try {
    CFG = await loadJson("data/config.json");
    $("#siteName").textContent = CFG.namaSitus || "Latihan";
    document.title = (CFG.namaSitus || "Latihan") + " - " + (CFG.mataKuliah || "");
  } catch (e) {}
  window.addEventListener("hashchange", route);
  $("#menuBtn").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#menuBtn").setAttribute("aria-expanded", String(open));
  });
  onReadyChange((ok) => {
    const c = $("#pyStatus");
    c.textContent = ok ? "Python siap" : "Python: memuat";
    c.classList.toggle("ready", ok);
  });
  route();
  (window.requestIdleCallback || setTimeout)(start);
}

init().catch((e) => {
  $("#main").textContent = "Gagal memuat data: " + e.message;
});
