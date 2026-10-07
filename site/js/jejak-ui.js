// Bagian "Jejak peserta" di dashboard instruktur: daftar semua peserta yang masuk, riwayat tiap peserta (satu baris per
// Jalankan atau Kirim dengan hasil dan cara menulisnya), kolom yang bisa dipilih, dan putar ulang cara menulis tiap baris.
// Beda dari Sinyal integritas: di sini tidak ada penilaian curiga, hanya catatan apa yang dikerjakan peserta.
// Perhitungannya ada di jejak.js (diuji terpisah).
import { h } from "./dom.js";
import * as Auth from "./auth.js";
import { ambilSemua } from "./rekap.js";
import * as J from "./jejak.js";
import { bukaPutar } from "./putar-ui.js";
import { kolomBelumAda } from "./sinkron.js";
import { teksTanggal, jamWib, sisaTeks } from "./kehadiran.js";

let cache = null; // { cid, percobaan, sesi, risetAda }
const KUNCI_KOLOM = "latihan:kolom-jejak";
const ui = { cari: "", kelas: "", urut: { k: "terakhir", a: false }, pilih: "", bab: "", jenis: "", hasil: "", kolom: null, terbalik: false };

export function reset() {
  cache = null;
}
// Di server uji, ?sekarang=... menggeser jam "sekarang" (sama seperti tab Kehadiran).
function sekarang() {
  if (typeof window !== "undefined" && window.__fake) {
    const q = new URLSearchParams(location.search).get("sekarang");
    const t = q ? Date.parse(q) : NaN;
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}
function kolomTerpilih() {
  if (ui.kolom) return ui.kolom;
  let k = null;
  try {
    k = JSON.parse(localStorage.getItem(KUNCI_KOLOM) || "null");
  } catch (e) {}
  ui.kolom = Object.assign(J.kolomAwal(), k && typeof k === "object" ? k : {});
  return ui.kolom;
}
function simpanKolom() {
  try {
    localStorage.setItem(KUNCI_KOLOM, JSON.stringify(ui.kolom));
  } catch (e) {}
}

const KOLOM_LENGKAP = "id,user_id,bab,jenis,lulus,kasus_lulus,kasus_total,hasil,galat_jenis,galat_pesan,cocok_contoh,petunjuk,pola,dibuat_pada,diterima_pada";
const KOLOM_LAMA = "id,user_id,bab,jenis,lulus,kasus_lulus,kasus_total,pola,dibuat_pada,diterima_pada";

/** Mengambil riwayat percobaan (tanpa kode dan rekaman, yang berat) dan sesi belajar. Dipakai juga oleh bagian Riset. */
export async function ambilRingan(cid) {
  if (cache && cache.cid === cid) return cache;
  const c = Auth.getClient();
  const ambilPercobaan = (kolom) => ambilSemua(() => c.from("percobaan").select(kolom).eq("matakuliah_id", cid).order("id"));
  let percobaan;
  let risetAda = true;
  try {
    percobaan = await ambilPercobaan(KOLOM_LENGKAP);
  } catch (e) {
    if (!kolomBelumAda(e)) throw e;
    risetAda = false; // migrasi 0007 belum dijalankan: tetap tampilkan yang ada
    percobaan = await ambilPercobaan(KOLOM_LAMA);
  }
  let sesi = [];
  try {
    sesi = await ambilSemua(() => c.from("sesi_belajar").select("user_id,mulai,terakhir,aktif_detik").eq("matakuliah_id", cid).order("id"));
  } catch (e) {
    sesi = []; // migrasi 0006 belum ada: jejak tetap jalan tanpa data sesi
  }
  cache = { cid, percobaan: percobaan.map((r) => Object.assign({ matakuliah_id: cid }, r)), sesi, risetAda };
  return cache;
}

const lama = (t, skrg) => {
  const m = Math.max(0, Math.round((skrg - t) / 60000));
  return m < 1 ? "baru saja" : m < 60 ? m + " menit lalu" : m < 1440 ? Math.round(m / 60) + " jam lalu" : Math.round(m / 1440) + " hari lalu";
};
const pil = (teks, jenis = "t") => h("span", { class: "kh-pil " + jenis }, teks);
const stat = (angka, label) => h("div", { class: "d-stat" }, h("strong", {}, String(angka)), h("span", { class: "muted" }, label));

export async function render({ main, kepala, kuliah, unduh, peserta }) {
  if (!peserta) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "verdict fail" }, "Data peserta belum termuat. Tekan Muat ulang.")));
    return;
  }
  if (!cache || cache.cid !== kuliah.id) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "muted" }, "Memuat jejak peserta")));
    try {
      await ambilRingan(kuliah.id);
    } catch (e) {
      cache = null;
      main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "verdict fail" }, Auth.friendly(e))));
      return;
    }
  }
  const ulang = () => render({ main, kepala, kuliah, unduh, peserta });
  const skrg = sekarang();
  const ringkas = J.ringkasPeserta({ peserta, percobaan: cache.percobaan, sesi: cache.sesi, sekarang: skrg });
  const catatan = cache.risetAda ? null : h("p", { class: "kh-peringatan" }, "Migrasi 0007_riset_perilaku.sql belum dijalankan. Riwayat memuat Kirim saja, tanpa Jalankan, hasil, dan jenis galat.");
  if (ui.pilih && ringkas.some((r) => r.p.id === ui.pilih)) {
    main.replaceChildren(kepala, ...[catatan, ...detail({ ringkas: ringkas.find((r) => r.p.id === ui.pilih), kuliah, unduh, ulang, skrg })].filter(Boolean));
    return;
  }
  ui.pilih = "";
  main.replaceChildren(kepala, ...[catatan, ...daftar({ ringkas, unduh, ulang, kuliah, skrg })].filter(Boolean));
}

// ---------- daftar semua peserta ----------
const KEPALA = [["nama", "Peserta"], ["terakhir", "Terakhir aktif"], ["sesi", "Sesi"], ["menit", "Menit aktif"], ["jalankan", "Jalankan"], ["kirim", "Kirim"], ["lulus", "Lulus"], ["galat", "Galat"]];

function daftar({ ringkas, unduh, ulang, kuliah, skrg }) {
  const kelasAda = [...new Set(ringkas.map((r) => r.p.kelas).filter(Boolean))].sort();
  let L = ringkas.filter((r) => (!ui.kelas || r.p.kelas === ui.kelas) && (!ui.cari || (r.p.nama || "").toLowerCase().includes(ui.cari.toLowerCase()) || (r.p.nim || "").toLowerCase().includes(ui.cari.toLowerCase())));
  const cmp = J.URUT_PESERTA[ui.urut.k] || J.URUT_PESERTA.terakhir;
  L = L.slice().sort((a, b) => (ui.urut.a ? -cmp(a, b) : cmp(a, b)) || (a.p.nama || "").localeCompare(b.p.nama || "", "id"));
  const aktif = ringkas.filter((r) => r.aktif24).length;
  const belum = ringkas.filter((r) => r.belumMulai).length;
  const cari = h("input", { type: "search", id: "jCari", placeholder: "Cari nama atau NIM", value: ui.cari, "aria-label": "Cari nama atau NIM" });
  cari.addEventListener("input", () => {
    ui.cari = cari.value;
    const pos = cari.selectionStart;
    ulang().then(() => {
      const c = document.querySelector("#jCari");
      if (c) {
        c.focus();
        c.setSelectionRange(pos, pos);
      }
    });
  });
  const selKelas = h("select", { id: "jKelas", "aria-label": "Kelas", onchange: (e) => { ui.kelas = e.target.value; ulang(); } }, h("option", { value: "" }, "Semua kelas"), kelasAda.map((k) => h("option", { value: k, selected: k === ui.kelas ? "" : false }, k)));
  const th = (k, t) => h("th", { scope: "col", class: "klik" + (ui.urut.k === k ? " urut" : ""), onclick: () => { ui.urut = ui.urut.k === k ? { k, a: !ui.urut.a } : { k, a: k === "nama" }; ulang(); } }, t + (ui.urut.k === k ? (ui.urut.a ? " ↑" : " ↓") : ""));
  const baris = L.map((r) =>
    h(
      "tr",
      { class: "klik", onclick: () => { ui.pilih = r.p.id; ui.bab = ui.jenis = ui.hasil = ""; ulang(); } },
      h("th", { scope: "row", class: "nama" }, h("strong", {}, r.p.nama), h("small", {}, (r.p.nim || "") + " | " + (r.p.kelas || ""))),
      h("td", {}, r.terakhir ? lama(r.terakhir, skrg) : pil("belum pernah mulai", "t")),
      h("td", {}, String(r.sesi)),
      h("td", {}, String(r.menit)),
      h("td", {}, String(r.jalankan)),
      h("td", {}, String(r.kirim)),
      h("td", {}, r.lulus === null ? "-" : r.lulus + "%"),
      h("td", {}, String(r.galat))
    )
  );
  return [
    h("section", { class: "card" },
      h("div", { class: "d-stats" }, stat(ringkas.length, "peserta masuk"), stat(aktif, "aktif 24 jam terakhir"), stat(belum, "belum pernah mulai"), stat(cache.percobaan.length, "percobaan tercatat")),
      h("p", { class: "muted" }, "Semua akun peserta yang pernah masuk muncul di sini, termasuk yang belum mengerjakan apa pun. Ketuk satu baris untuk membuka riwayatnya dan memutar ulang cara menulisnya.")
    ),
    h("section", { class: "card" },
      h("h3", {}, "Semua peserta"),
      h("div", { class: "filters" }, cari, selKelas, h("button", { type: "button", class: "btn btn-sm", onclick: () => unduh("jejak-peserta-" + kuliah.id + ".csv", J.csvPeserta(L)) }, "Unduh CSV")),
      L.length ? h("div", { class: "tablewrap" }, h("table", { class: "rekap" }, h("caption", { class: "sr-only" }, "Semua peserta dan ringkasan aktivitasnya"), h("thead", {}, h("tr", {}, KEPALA.map(([k, t]) => th(k, t)))), h("tbody", {}, baris))) : h("p", { class: "muted" }, "Tidak ada peserta yang cocok.")
    ),
  ];
}

// ---------- riwayat satu peserta ----------
function detail({ ringkas, kuliah, unduh, ulang, skrg }) {
  const p = ringkas.p;
  const semua = J.riwayatPeserta(cache.percobaan, p.id);
  const babAda = [...new Set(semua.map((r) => r.bab))].sort((a, b) => a - b);
  const tampil = J.saringRiwayat(semua, { bab: ui.bab, jenis: ui.jenis, hasil: ui.hasil });
  const urut = ui.terbalik ? tampil.slice().reverse() : tampil;
  const kolom = kolomTerpilih();
  const aktifKol = J.KOLOM.filter((k) => kolom[k.id]);
  const menu = (id, label, nilai, opsi, ubah) => h("select", { id, "aria-label": label, onchange: (e) => ubah(e.target.value) }, h("option", { value: "" }, label + ": semua"), opsi.map(([v, t]) => h("option", { value: String(v), selected: String(v) === String(nilai) ? "" : false }, t)));
  const sel = (r, k) => {
    const nilai = r[k.id];
    if (k.id === "t") return h("td", { title: teksTanggal(r.t) + " " + jamWib(r.t) + " WIB" }, teksTanggal(r.t) + " " + jamWib(r.t));
    if (k.id === "hasil") return h("td", {}, pil(r.hasil, r.jenisHasil));
    if (k.id === "galat") return h("td", { title: r.pesan || "" }, r.galat || "-");
    return h("td", { class: typeof nilai === "number" ? "n" : "" }, nilai === null || nilai === undefined || nilai === "" ? "-" : String(nilai));
  };
  const tabel = tampil.length
    ? h("div", { class: "tablewrap" }, h("table", { class: "rekap" }, h("caption", { class: "sr-only" }, "Riwayat " + p.nama), h("thead", {}, h("tr", {}, [...aktifKol.map((k) => h("th", { scope: "col" }, k.label)), h("th", { scope: "col" }, "")])), h("tbody", {}, urut.map((r) => h("tr", {}, [...aktifKol.map((k) => sel(r, k)), h("td", {}, h("button", { type: "button", class: "btn btn-sm btn-ghost", onclick: () => putar(r, p, kuliah, true) }, "Putar"))])))))
    : h("p", { class: "muted" }, semua.length ? "Tidak ada baris yang cocok dengan saringan." : "Peserta ini belum mengerjakan apa pun. " + (ringkas.sesi ? "Ia sudah membuka situs " + ringkas.sesi + " kali (" + ringkas.menit + " menit aktif)." : ""));
  const pilihKolom = h("details", { class: "kh-kolom" }, h("summary", {}, "Pilih kolom"), h("div", { class: "kh-pilkol" }, J.KOLOM.map((k) => h("label", {}, h("input", { type: "checkbox", checked: kolom[k.id] ? "" : false, onchange: (e) => { kolom[k.id] = e.target.checked; simpanKolom(); ulang(); } }), " " + k.label))));
  const jalankan = semua.filter((r) => r.jenis === "Jalankan").length;
  return [
    h("section", { class: "card" },
      h("button", { type: "button", class: "btn btn-sm btn-ghost", onclick: () => { ui.pilih = ""; ulang(); } }, "← Semua peserta"),
      h("h3", { style: "margin-top:10px" }, p.nama),
      h("p", { class: "muted" }, (p.nim || "-") + " | " + (p.kelas || "-") + " | terakhir aktif " + (ringkas.terakhir ? lama(ringkas.terakhir, skrg) : "belum pernah") + " | " + ringkas.sesi + " sesi, " + ringkas.menit + " menit aktif"),
      h("div", { class: "d-stats" }, stat(semua.length, "baris tercatat"), stat(jalankan, "kali Jalankan"), stat(semua.length - jalankan, "kali Kirim atau Periksa"), stat(ringkas.galat, "galat saat menjalankan"))
    ),
    h("section", { class: "card" },
      h("h3", {}, "Riwayat"),
      h("div", { class: "filters" },
        menu("jBab", "Bab", ui.bab, babAda.map((b) => [b, "Bab " + b]), (v) => { ui.bab = v; ulang(); }),
        menu("jJenis", "Jenis", ui.jenis, [["Jalankan", "Jalankan"], ["Kirim", "Kirim atau Periksa"]], (v) => { ui.jenis = v; ulang(); }),
        menu("jHasil", "Hasil", ui.hasil, [["berhasil", "Berhasil"], ["gagal", "Gagal atau galat"]], (v) => { ui.hasil = v; ulang(); }),
        h("button", { type: "button", class: "btn btn-sm", onclick: () => { ui.terbalik = !ui.terbalik; ulang(); } }, ui.terbalik ? "Terlama dulu" : "Terbaru dulu"),
        h("button", { type: "button", class: "btn btn-sm", onclick: () => unduh("jejak-" + (p.nim || p.id) + ".csv", J.csvRiwayat(urut, p)) }, "Unduh CSV")
      ),
      pilihKolom,
      tabel,
      h("p", { class: "kh-info" }, "Satu baris = satu kali tombol Jalankan atau Kirim. Mengetik, Dihapus, Linier, dan Lompat dihitung dari cara menulis sejak Kirim sebelumnya. Putar memutar ulang cara peserta menulis sampai baris itu. Pilihan kolom diingat di browser ini.")
    ),
  ];
}

async function putar(r, p, kuliah, dariAwal) {
  const c = Auth.getClient();
  const { data, error } = await c.from("percobaan").select("id,jenis,rekaman,kode").eq("matakuliah_id", kuliah.id).eq("user_id", p.id).eq("bab", r.bab).order("id");
  if (error) {
    bukaPutar({ judul: p.nama + ", bab " + r.bab, info: "Gagal memuat rekaman: " + Auth.friendly(error) });
    return;
  }
  const rantai = J.rantaiPutar(data || [], r.id, dariAwal);
  const info = teksTanggal(r.t) + " " + jamWib(r.t) + ": " + r.jenis + ", " + r.hasil + (r.galat ? " (" + r.galat + (r.pesan ? ": " + r.pesan : "") + ")" : "") + ". " + (dariAwal ? "Diputar dari awal bab sampai baris ini" + (rantai.segmen > 1 ? " (" + rantai.segmen + " bagian rekaman digabung)." : ".") : "Hanya bagian rekaman baris ini.");
  const alih = h("button", { type: "button", class: "btn btn-sm", onclick: () => { dlg.close(); putar(r, p, kuliah, !dariAwal); } }, dariAwal ? "Hanya langkah ini" : "Dari awal bab");
  const dlg = bukaPutar({ judul: p.nama + ", bab " + r.bab, info, rekaman: rantai.rekaman, kode: rantai.kode, tambahan: [h("div", { class: "actions" }, alih)] });
}
