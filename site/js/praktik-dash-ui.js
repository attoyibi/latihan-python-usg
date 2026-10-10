// Tab "Praktik" di dashboard instruktur: siapa sudah mengerjakan praktik bab mana, bab yang sering macet, dan kode praktik
// peserta (hanya baca). Perhitungannya ada di praktik.js (rekapPraktik). Tabel dari migrasi 0008; bila belum dijalankan,
// tab ini hanya menampilkan petunjuk dan bagian dashboard yang lain tidak terpengaruh.
import { h } from "./dom.js";
import * as Auth from "./auth.js";
import { ambilSemua } from "./rekap.js";
import { muatIndeks, muatPraktik, tabelBelumAda } from "./praktik-data.js";
import { rekapPraktik, csvPraktik, idPraktik, KODE_SEL } from "./praktik.js";

let cache = null; // { cid, tahap }
const ui = { kelas: "", lihat: null };

export function reset() {
  cache = null;
  ui.lihat = null;
}

const LAMBANG = { lulus: "✓", sedang: "◐", belum: "○" };
const stat = (angka, label) => h("div", { class: "d-stat" }, h("strong", {}, String(angka)), h("span", { class: "muted" }, label));
const waktu = (iso) => {
  if (!iso) return "belum ada";
  const d = new Date(iso);
  return isNaN(d) ? "belum ada" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
};

async function muat(cid) {
  if (cache && cache.cid === cid) return cache;
  const tahap = await ambilSemua(() => Auth.getClient().from("praktikum_tahap").select("*").eq("matakuliah_id", cid).order("user_id"));
  cache = { cid, tahap };
  return cache;
}

async function bacaBerkas(cid, bab, uid) {
  const { data, error } = await Auth.getClient().from("praktikum_berkas").select("nama,isi,diperbarui_pada").eq("matakuliah_id", cid).eq("praktikum_id", idPraktik(bab)).eq("user_id", uid).order("nama");
  if (error) throw error;
  return data || [];
}

export async function render({ main, kepala, kuliah, unduh, peserta }) {
  const kartu = (...isi) => main.replaceChildren(kepala, h("section", { class: "card" }, h("h3", {}, "Praktik"), ...isi));
  if (!peserta) {
    kartu(h("p", { class: "verdict fail" }, "Data peserta belum termuat. Tekan Muat ulang."));
    return;
  }
  const babsSet = await muatIndeks(kuliah.id, kuliah.praktik === true);
  const babs = [...babsSet].sort((a, b) => a - b);
  const denganB = babsSet.denganB || new Set();
  if (!babs.length) {
    kartu(h("p", { class: "muted" }, "Mata kuliah ini belum punya praktik. Praktik berupa berkas JSON per bab di site/data/kuliah/" + kuliah.id + "/praktik/ (lihat docs/PRAKTIK.md); begitu ada, tab ini terisi sendiri."));
    return;
  }
  const ulang = () => render({ main, kepala, kuliah, unduh, peserta });
  let data;
  try {
    data = await muat(kuliah.id);
  } catch (e) {
    kartu(tabelBelumAda(e) ? h("p", { class: "kh-peringatan" }, "Fitur praktik belum dipasang di database. Jalankan supabase/migrations/0008_praktikum.sql di Supabase SQL Editor (setelah 0001 sampai 0007), lalu tekan Muat ulang. Bagian dashboard yang lain tidak terpengaruh.") : h("p", { class: "verdict fail" }, "Gagal memuat: " + (e.message || e)));
    return;
  }

  const kelasSel = h("select", { "aria-label": "Kelas" }, h("option", { value: "" }, "Semua kelas"), [...new Set(peserta.map((p) => p.kelas).filter(Boolean))].sort().map((k) => h("option", { value: k, selected: k === ui.kelas ? "" : false }, k)));
  kelasSel.addEventListener("change", () => {
    ui.kelas = kelasSel.value;
    ui.lihat = null;
    ulang();
  });
  const tersaring = ui.kelas ? peserta.filter((p) => p.kelas === ui.kelas) : peserta;
  const rekap = rekapPraktik({ peserta: tersaring.slice().sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id")), tahap: data.tahap, babs, denganB });

  const ringkas = h(
    "section",
    { class: "card" },
    h("h3", {}, "Praktik per bab"),
    h("p", { class: "muted" }, "Praktik wajib untuk melengkapi bab, dikerjakan di kelas atau sesudahnya, dan tidak terkunci. ◐ berarti sudah mulai tetapi belum lulus. Bab yang punya Bagian B (kembangkan) baru ✓ bila Bagian A dan B sama-sama lulus."),
    h("div", { class: "filters" }, h("label", {}, "Kelas ", kelasSel), h("button", { type: "button", class: "btn btn-sm", onclick: () => unduh("praktik-" + kuliah.id + ".csv", csvPraktik(rekap, babs)) }, "Unduh CSV")),
    h("div", { class: "d-stats" }, stat(rekap.baris.length, "peserta"), stat(rekap.mulai, "sudah mulai"), stat(rekap.baris.length - rekap.mulai, "belum mulai"), stat(rekap.selesai, "lulus semua praktik"))
  );

  const maksMacet = Math.max(1, ...rekap.perBab.map((t) => t.sedang));
  const judulBab = new Map(kuliah.materi.map((m) => [m.bab, m.judul]));
  const perBab = h(
    "section",
    { class: "card" },
    h("h3", {}, "Per bab"),
    h("p", { class: "muted" }, "Bab dengan banyak peserta 'sedang' dan rata-rata kirim tinggi biasanya yang perlu dibahas di kelas."),
    h("div", { class: "tablewrap" }, h("table", { class: "rekap" },
      h("thead", {}, h("tr", {}, ["Bab", "Lulus", "Sedang", "Bagian A lulus", "Bagian B lulus", "Rata-rata kirim"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, rekap.perBab.map((t) => h("tr", {}, h("td", {}, t.bab + ". " + (judulBab.get(t.bab) || "")), h("td", {}, String(t.lulus)), h("td", { style: t.sedang === maksMacet && t.sedang > 0 ? "font-weight:700" : "" }, String(t.sedang)), h("td", {}, String(t.aLulus)), h("td", {}, t.adaB ? String(t.bLulus) : "-"), h("td", {}, t.kirimRata ? String(t.kirimRata) : "-")))))
    )
  );

  const panelLihat = h("div", { class: "pk-dash-lihat", "aria-live": "polite" });
  const lihat = async (b, bab) => {
    ui.lihat = b.peserta.id + "|" + bab;
    panelLihat.replaceChildren(h("p", { class: "muted" }, "Memuat kode " + b.peserta.nama + ", bab " + bab));
    try {
      const berkas = await bacaBerkas(kuliah.id, bab, b.peserta.id);
      const def = await muatPraktik(kuliah.id, bab);
      panelLihat.replaceChildren(
        h("h4", {}, "Kode praktik bab " + bab + ": " + b.peserta.nama),
        h("p", { class: "muted" }, "Hanya baca." + (def ? " Berkas: " + def.berkas + "." : "")),
        ...(berkas.length ? berkas.map((f) => h("details", { class: "lipat", open: "" }, h("summary", {}, f.nama + " - " + waktu(f.diperbarui_pada)), h("pre", { class: "pk-keluaran" }, f.isi))) : [h("p", { class: "muted" }, "Belum ada berkas.")])
      );
    } catch (e) {
      panelLihat.replaceChildren(h("p", { class: "verdict fail" }, "Gagal memuat kode: " + (e.message || e)));
    }
  };

  const matriks = h(
    "section",
    { class: "card" },
    h("h3", {}, "Peserta dan bab"),
    h("p", { class: "d-legend muted" }, "✓ lulus  ◐ sedang dikerjakan  ○ belum. Klik simbolnya untuk melihat kode peserta."),
    h("div", { class: "tablewrap" }, h("table", { class: "rekap peserta" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col", class: "nama" }, "Peserta"), babs.map((b) => h("th", { scope: "col", title: judulBab.get(b) || "" }, String(b))), ["Lulus", "Kirim", "Terakhir"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, rekap.baris.map((x) => h("tr", {},
        h("th", { scope: "row", class: "nama" }, x.peserta.nama, h("small", {}, x.peserta.nim + " / " + (x.peserta.kelas || "-"))),
        babs.map((b) => {
          const sel = x.sel[b];
          const isi = sel.kode === "belum" ? LAMBANG.belum : h("button", { type: "button", class: "btn btn-sm", "aria-label": "Lihat kode praktik bab " + b + " milik " + x.peserta.nama, onclick: () => lihat(x, b) }, LAMBANG[sel.kode]);
          const ab = sel.b !== null ? "A" + LAMBANG[sel.a] + " B" + LAMBANG[sel.b] : null;
          return h("td", { class: "sel " + (sel.kode === "lulus" ? "selesai-langsung" : sel.kode), title: "Bab " + b + ": " + KODE_SEL[sel.kode] + (ab ? " (" + ab + ")" : "") + (sel.kirim ? ", " + sel.kirim + " kirim" : "") }, isi, ab ? h("small", {}, ab) : sel.kirim ? h("small", {}, String(sel.kirim)) : null);
        }),
        h("td", {}, x.lulus + "/" + babs.length),
        h("td", {}, String(x.kirim)),
        h("td", {}, waktu(x.terakhir))
      )))
    )),
    panelLihat
  );
  if (!rekap.baris.length) matriks.append(h("p", { class: "muted" }, "Tidak ada peserta di kelas ini."));

  main.replaceChildren(kepala, ringkas, perBab, matriks);
  if (ui.lihat) {
    const [uid, bab] = ui.lihat.split("|");
    const x = rekap.baris.find((r) => r.peserta.id === uid);
    if (x) lihat(x, Number(bab));
  }
}
