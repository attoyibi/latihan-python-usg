// Tampilan laporan akhir: kartu di halaman mata kuliah (form akhir dan ekspor PDF) dan tab "Laporan akhir" di dashboard instruktur.
// Logika murni ada di laporan-akhir.js; pengumpulan data di laporan-akhir-data.js.
import { h } from "./dom.js";
import * as Auth from "./auth.js";
import * as Anticopas from "./anticopas.js";
import { buatPdfBlok } from "./pdf.js";
import { ambilSemua } from "./rekap.js";
import { muatIndeks } from "./praktik-data.js";
import { KOLOM, kelengkapan } from "./laporan.js";
import { KOLOM_AKHIR, kelengkapanAkhir, susunBlokAkhir, namaBerkasAkhir } from "./laporan-akhir.js";
import { kumpulkan, ringkasLokal, bacaAkhirLokal, simpanAkhir, susulAkhir } from "./laporan-akhir-data.js";

const unduhBlob = (blob, nama) => {
  const a = h("a", { href: URL.createObjectURL(blob), download: nama });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
};

/** Blok laporan menjadi tampilan di halaman (dipakai pratinjau dosen). */
export function blokKeDom(blok) {
  const el = h("div", { class: "la-dok" });
  for (const b of blok) {
    if (b.t === "judul") el.append(h("h3", {}, b.teks));
    else if (b.t === "kv") el.append(h("table", { class: "la-kv" }, h("tbody", {}, b.baris.map(([k, v]) => h("tr", {}, h("th", { scope: "row" }, k), h("td", {}, v))))));
    else if (b.t === "catatan") el.append(h("p", { class: "muted" }, b.teks));
    else if (b.t === "bagian") el.append(h("h4", {}, b.teks));
    else if (b.t === "paragraf") el.append(h("p", { class: b.kosong ? "muted" : "" }, b.teks));
    else if (b.t === "kode") el.append(h("pre", { class: "pk-keluaran" }, b.teks));
    else if (b.t === "kaki") el.append(h("p", { class: "muted" }, b.teks));
  }
  return el;
}

// ---------- kartu di halaman mata kuliah ----------
/** @param {{store:object, kuliah:{id,nama,materi,praktik?}, instruktur:()=>boolean}} ctx */
export function kartuLaporanAkhir(ctx) {
  const mk = ctx.kuliah.id;
  const profil = () => Auth.getProfile() || { nama: "(tanpa akun)", nim: "-", kelas: "-" };
  let lap = bacaAkhirLokal(ctx.store, mk);
  const pesan = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const status = h("span", { class: "muted lap-status" });
  const ringkas = h("p", { class: "muted", "aria-live": "polite" }, "Menghitung ringkasan");
  let timer = null;
  let terakhirKetik = 0;

  const segarRingkas = async () => {
    const r = await ringkasLokal(ctx.store, ctx.kuliah, profil());
    ringkas.textContent = "Di perangkat ini: latihan lulus " + r.latihanLulus + " dari " + r.latihanTotal + " bab" + (r.praktikTotal ? ", praktik lulus " + r.praktikLulus + " dari " + r.praktikTotal : "") + ", form akhir " + r.akhirBaik + " dari " + r.akhirTotal + " kolom memadai. Saat diekspor, data dari akunmu di server ikut digabung.";
  };
  const simpan = () => {
    simpanAkhir(ctx.store, mk, lap);
    status.textContent = "Tersimpan " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    segarRingkas();
  };

  const medan = KOLOM_AKHIR.map((k) => {
    const area = h("textarea", { class: "input lap-area", id: "la-" + k.id, rows: "4", autocomplete: "off", spellcheck: "true", "aria-describedby": "la-bantu-" + k.id });
    area.value = (lap.jawaban || {})[k.id] || "";
    const hitung = h("span", { class: "lap-hitung muted" });
    const perbarui = () => {
      const n = area.value.trim().length;
      hitung.textContent = n + " karakter" + (n >= k.min ? " (cukup)" : " (disarankan minimal " + k.min + ")");
      hitung.classList.toggle("cukup", n >= k.min);
    };
    area.addEventListener("beforeinput", (e) => {
      if (e.inputType === "insertText" && e.data) lap.ketikan[k.id] = (lap.ketikan[k.id] || 0) + e.data.length;
      else if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") lap.ketikan[k.id] = (lap.ketikan[k.id] || 0) + 1;
    });
    area.addEventListener("input", () => {
      const t = Date.now();
      if (terakhirKetik) lap.durasi += Math.min(20, (t - terakhirKetik) / 1000);
      terakhirKetik = t;
      lap.jawaban[k.id] = area.value;
      perbarui();
      clearTimeout(timer);
      timer = setTimeout(simpan, 1500);
    });
    area.addEventListener("blur", () => {
      clearTimeout(timer);
      simpan();
    });
    perbarui();
    return h("div", { class: "field lap-kolom" }, h("label", { for: "la-" + k.id }, k.label), h("p", { class: "muted lap-bantu", id: "la-bantu-" + k.id }, k.petunjuk), area, hitung);
  });

  const pdfBtn = h("button", { type: "button", class: "btn btn-primary" }, "Ekspor laporan akhir (PDF)");
  pdfBtn.addEventListener("click", async () => {
    pdfBtn.disabled = true;
    pesan.textContent = "Mengumpulkan kode dan refleksi semua bab";
    try {
      clearTimeout(timer);
      lap.diekspor = new Date().toISOString();
      simpan();
      const p = profil();
      const paket = await kumpulkan({ kuliah: ctx.kuliah, profil: p, uid: Auth.getUserId() || "lokal", store: ctx.store });
      pesan.textContent = "Menyiapkan PDF";
      const blob = await buatPdfBlok(susunBlokAkhir(paket), paket.akhir.kode || lap.kode);
      unduhBlob(blob, namaBerkasAkhir(paket));
      const kl = kelengkapanAkhir(lap.jawaban);
      pesan.textContent = "PDF diunduh." + (kl.lengkap ? "" : " Perlu diketahui: form akhir baru " + kl.baik + " dari " + kl.total + " kolom yang memadai; kamu tetap boleh mengumpulkannya.");
    } catch (e) {
      pesan.textContent = "Gagal membuat PDF: " + e.message;
    } finally {
      pdfBtn.disabled = false;
    }
  });

  const kartu = h(
    "section",
    { class: "card la-kartu", "aria-labelledby": "la-judul" },
    h("div", { class: "section-title" }, h("h2", { id: "la-judul" }, "Laporan akhir")),
    h("p", { class: "free-note" }, "Satu PDF berisi status dan kode latihan, kode praktik, dan refleksi dari semua bab, ditambah form akhir ini. Kodenya terkumpul otomatis; kamu hanya menulis form akhir dengan kalimatmu sendiri (salin dan tempel dimatikan). Bisa diekspor kapan saja, walaupun belum semua bab selesai."),
    ringkas,
    ...medan,
    h("div", { class: "actions" }, pdfBtn, status),
    pesan
  );
  Anticopas.blokirSalinTempel(kartu, { lokasi: "laporan", kecualikan: ctx.instruktur, saatTempel: () => { lap.tempel = (lap.tempel || 0) + 1; clearTimeout(timer); timer = setTimeout(simpan, 1500); } });
  segarRingkas();
  // pulihkan dari server bila ada yang lebih maju (mis. dikerjakan di perangkat lain)
  susulAkhir(ctx.store, mk).then((gab) => {
    lap = gab;
    KOLOM_AKHIR.forEach((k) => {
      const a = kartu.querySelector("#la-" + k.id);
      if (a && document.activeElement !== a && a.value !== (lap.jawaban[k.id] || "")) {
        a.value = lap.jawaban[k.id] || "";
        a.dispatchEvent(new Event("change"));
      }
    });
    segarRingkas();
  });
  return kartu;
}

// ---------- tab di dashboard instruktur ----------
let cache = null; // { cid, data }
const ui = { kelas: "", buka: null };
export function reset() {
  cache = null;
  ui.buka = null;
}
const waktu = (iso) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "-");

async function muatSemua(kuliah) {
  if (cache && cache.cid === kuliah.id) return cache.data;
  const c = Auth.getClient();
  const sel = (tabel, kolom) => ambilSemua(() => c.from(tabel).select(kolom).eq("matakuliah_id", kuliah.id).order("user_id"));
  const tanpaGalat = async (f) => {
    try {
      return await f();
    } catch (e) {
      return null;
    }
  };
  const [progres, tahap, laporan, akhir] = await Promise.all([sel("progres", "user_id,bab,status"), tanpaGalat(() => sel("praktikum_tahap", "user_id,praktikum_id,tahap_id,status")), sel("laporan", "user_id,bab,jawaban"), tanpaGalat(() => sel("praktikum_laporan", "user_id,praktikum_id,jawaban,dikumpulkan_pada"))]);
  const data = { progres, tahap: tahap || [], laporan, akhir: (akhir || []).filter((r) => r.praktikum_id === "akhir"), praktikAda: tahap !== null };
  cache = { cid: kuliah.id, data };
  return data;
}

export async function render({ main, kepala, kuliah, unduh, peserta }) {
  const kartu = (...isi) => main.replaceChildren(kepala, h("section", { class: "card" }, h("h3", {}, "Laporan akhir"), ...isi));
  if (!peserta) {
    kartu(h("p", { class: "verdict fail" }, "Data peserta belum termuat. Tekan Muat ulang."));
    return;
  }
  const ulang = () => render({ main, kepala, kuliah, unduh, peserta });
  let d;
  try {
    d = await muatSemua(kuliah);
  } catch (e) {
    kartu(h("p", { class: "verdict fail" }, "Gagal memuat: " + (e.message || e)));
    return;
  }
  const babPraktik = [...(await muatIndeks(kuliah.id, kuliah.praktik === true))];
  const babLatihan = kuliah.materi.filter((m) => m.jenis !== "unggah").map((m) => m.bab);
  const per = (arr, f) => {
    const m = new Map();
    for (const r of arr) {
      if (!m.has(r.user_id)) m.set(r.user_id, []);
      m.get(r.user_id).push(r);
    }
    return f ? new Map([...m].map(([k, v]) => [k, f(v)])) : m;
  };
  const progresU = per(d.progres);
  const tahapU = per(d.tahap);
  const laporanU = per(d.laporan);
  const akhirU = per(d.akhir);

  const kelasSel = h("select", { "aria-label": "Kelas" }, h("option", { value: "" }, "Semua kelas"), [...new Set(peserta.map((p) => p.kelas).filter(Boolean))].sort().map((k) => h("option", { value: k, selected: k === ui.kelas ? "" : false }, k)));
  kelasSel.addEventListener("change", () => {
    ui.kelas = kelasSel.value;
    ui.buka = null;
    ulang();
  });
  const tersaring = (ui.kelas ? peserta.filter((p) => p.kelas === ui.kelas) : peserta).slice().sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
  const baris = tersaring.map((p) => {
    const lat = (progresU.get(p.id) || []).filter((r) => r.status === "selesai" && babLatihan.includes(r.bab)).length;
    const pr = (tahapU.get(p.id) || []).filter((r) => r.status === "lulus" && r.tahap_id === "p01" && babPraktik.includes(Number((/^bab-(\d{2})$/.exec(r.praktikum_id) || [])[1]))).length;
    const ref = (laporanU.get(p.id) || []).filter((r) => kelengkapan(r.jawaban || {}, KOLOM).baik >= 3).length;
    const ak = (akhirU.get(p.id) || [])[0];
    const kl = kelengkapanAkhir(ak && ak.jawaban);
    return { p, lat, pr, ref, kl, diekspor: !!(ak && ak.dikumpulkan_pada), ada: !!ak };
  });

  const csv = () => {
    const kutip = (s) => {
      const t = String(s === null || s === undefined ? "" : s);
      return '"' + (/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replace(/"/g, '""') + '"';
    };
    const kepalaCsv = ["NIM", "Nama", "Kelas", "Latihan lulus", "Praktik lulus", "Refleksi bab memadai", "Form akhir memadai", "Form akhir diekspor"];
    return [kepalaCsv.map(kutip).join(","), ...baris.map((b) => [b.p.nim, b.p.nama, b.p.kelas, b.lat + "/" + babLatihan.length, b.pr + "/" + babPraktik.length, b.ref + "/" + kuliah.materi.length, b.kl.baik + "/" + b.kl.total, b.diekspor ? "ya" : "belum"].map(kutip).join(","))].join("\r\n") + "\r\n";
  };

  const panel = h("div", { class: "la-panel", "aria-live": "polite" });
  const bukaPeserta = async (b) => {
    ui.buka = b.p.id;
    panel.replaceChildren(h("p", { class: "muted" }, "Mengumpulkan laporan " + b.p.nama));
    try {
      const paket = await kumpulkan({ kuliah, profil: b.p, uid: b.p.id });
      const blok = susunBlokAkhir(paket);
      const pdf = h("button", { type: "button", class: "btn btn-primary" }, "Unduh PDF");
      const psn = h("span", { class: "form-msg", role: "status" });
      pdf.addEventListener("click", async () => {
        pdf.disabled = true;
        psn.textContent = "Menyiapkan PDF";
        try {
          unduhBlob(await buatPdfBlok(blok, paket.akhir.kode || "-"), namaBerkasAkhir(paket));
          psn.textContent = "PDF diunduh.";
        } catch (e) {
          psn.textContent = "Gagal: " + e.message;
        } finally {
          pdf.disabled = false;
        }
      });
      panel.replaceChildren(h("div", { class: "actions" }, h("strong", {}, "Laporan akhir " + b.p.nama), pdf, psn), blokKeDom(blok));
    } catch (e) {
      panel.replaceChildren(h("p", { class: "verdict fail" }, "Gagal mengumpulkan: " + (e.message || e)));
    }
  };

  const tabel = h(
    "div",
    { class: "tablewrap" },
    h("table", { class: "rekap peserta" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col", class: "nama" }, "Peserta"), ["Latihan lulus", "Praktik lulus", "Refleksi bab", "Form akhir", "Diekspor", ""].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, baris.map((b) => h("tr", {},
        h("th", { scope: "row", class: "nama" }, b.p.nama, h("small", {}, b.p.nim + " / " + (b.p.kelas || "-"))),
        h("td", {}, b.lat + "/" + babLatihan.length),
        h("td", {}, babPraktik.length ? b.pr + "/" + babPraktik.length : "-"),
        h("td", {}, b.ref + "/" + kuliah.materi.length),
        h("td", {}, b.ada ? b.kl.baik + "/" + b.kl.total + " kolom" : "belum"),
        h("td", {}, b.diekspor ? "ya" : "belum"),
        h("td", {}, h("button", { type: "button", class: "btn btn-sm", onclick: () => bukaPeserta(b) }, "Buka laporan"))
      )))
    )
  );
  main.replaceChildren(
    kepala,
    h(
      "section",
      { class: "card" },
      h("h3", {}, "Laporan akhir"),
      h("p", { class: "muted" }, "Gabungan seluruh bab per peserta: status dan kode latihan, kode praktik, refleksi bab, dan form akhir. Hanya dibaca; kodenya ditarik dari data yang sudah tersimpan." + (d.praktikAda ? "" : " Data praktik belum bisa dibaca (migrasi 0008 belum dijalankan).")),
      h("div", { class: "filters" }, h("label", {}, "Kelas ", kelasSel), h("button", { type: "button", class: "btn btn-sm", onclick: () => unduh("laporan-akhir-" + kuliah.id + ".csv", csv()) }, "Unduh CSV")),
      tabel,
      h("p", { class: "muted" }, "Kolom Refleksi bab: jumlah bab yang sedikitnya 3 dari 5 kolomnya terisi memadai. Form akhir: kolom memadai dari 3.")
    ),
    h("section", { class: "card" }, panel)
  );
  if (ui.buka) {
    const b = baris.find((x) => x.p.id === ui.buka);
    if (b) bukaPeserta(b);
  }
}
