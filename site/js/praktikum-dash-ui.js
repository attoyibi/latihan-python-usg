// Bagian "Praktikum" di dashboard instruktur: siapa sudah sampai tahap mana, tahap yang sering macet, laporan praktikum, dan
// berkas kerja peserta (hanya baca). Perhitungannya ada di praktikum.js (rekapPraktikum). Tabel dari migrasi 0008; bila belum
// dijalankan, tab ini hanya menampilkan petunjuk dan bagian lain dashboard tidak terpengaruh.
import { h } from "./dom.js";
import * as Auth from "./auth.js";
import { ambilSemua } from "./rekap.js";
import { muatDaftar, tabelBelumAda } from "./praktikum-data.js";
import { analisisJava } from "./praktikum-java.js";
import { rekapPraktikum, csvPraktikum, KODE_SEL } from "./praktikum.js";

let cache = null; // { cid, pid, tahap, laporan }
const ui = { pid: "", kelas: "", lihat: null };

export function reset() {
  cache = null;
  ui.lihat = null;
}

const LAMBANG = { lulus: "✓", "lulus-contoh": "✓*", dilewati: "–", sedang: "◐", belum: "○" };
const stat = (angka, label) => h("div", { class: "d-stat" }, h("strong", {}, String(angka)), h("span", { class: "muted" }, label));
const waktu = (iso) => {
  if (!iso) return "belum ada";
  const d = new Date(iso);
  return isNaN(d) ? "belum ada" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
};

async function muat(cid) {
  if (cache && cache.cid === cid) return cache;
  const c = Auth.getClient();
  const baca = (tabel) => ambilSemua(() => c.from(tabel).select("*").eq("matakuliah_id", cid).order("user_id"));
  const [tahap, laporan] = await Promise.all([baca("praktikum_tahap"), baca("praktikum_laporan")]);
  cache = { cid, tahap, laporan };
  return cache;
}

async function bacaBerkas(cid, pid, uid) {
  const { data, error } = await Auth.getClient().from("praktikum_berkas").select("nama,isi,asal,diperbarui_pada").eq("matakuliah_id", cid).eq("praktikum_id", pid).eq("user_id", uid).order("nama");
  if (error) throw error;
  return data || [];
}

export async function render({ main, kepala, kuliah, unduh, peserta }) {
  const pesanKartu = (...isi) => main.replaceChildren(kepala, h("section", { class: "card" }, h("h3", {}, "Praktikum"), ...isi));
  if (!peserta) {
    pesanKartu(h("p", { class: "verdict fail" }, "Data peserta belum termuat. Tekan Muat ulang."));
    return;
  }
  const daftar = await muatDaftar(kuliah.id, kuliah.praktikum === true);
  if (!daftar.length) {
    pesanKartu(h("p", { class: "muted" }, "Mata kuliah ini belum punya praktikum. Praktikum berupa berkas JSON di site/data/kuliah/" + kuliah.id + "/praktikum/ (lihat docs/PRAKTIKUM.md); begitu ada, tab ini terisi sendiri."));
    return;
  }
  if (!daftar.some((p) => p.id === ui.pid)) ui.pid = daftar[0].id;
  const pk = daftar.find((p) => p.id === ui.pid);
  const ulang = () => render({ main, kepala, kuliah, unduh, peserta });

  let data;
  try {
    const semua = await muat(kuliah.id);
    data = { tahap: semua.tahap.filter((r) => r.praktikum_id === pk.id), laporan: semua.laporan.filter((r) => r.praktikum_id === pk.id) };
  } catch (e) {
    pesanKartu(tabelBelumAda(e) ? h("p", { class: "kh-peringatan" }, "Fitur praktikum belum dipasang di database. Jalankan supabase/migrations/0008_praktikum.sql di Supabase SQL Editor (setelah 0001 sampai 0007), lalu tekan Muat ulang. Bagian dashboard yang lain tidak terpengaruh.") : h("p", { class: "verdict fail" }, "Gagal memuat: " + (e.message || e)));
    return;
  }

  const kelasSel = h("select", { "aria-label": "Kelas" }, h("option", { value: "" }, "Semua kelas"), [...new Set(peserta.map((p) => p.kelas).filter(Boolean))].sort().map((k) => h("option", { value: k, selected: k === ui.kelas ? "" : false }, k)));
  kelasSel.addEventListener("change", () => {
    ui.kelas = kelasSel.value;
    ui.lihat = null;
    ulang();
  });
  const pkSel = daftar.length > 1 ? h("select", { "aria-label": "Praktikum" }, daftar.map((p) => h("option", { value: p.id, selected: p.id === pk.id ? "" : false }, p.judul))) : null;
  if (pkSel)
    pkSel.addEventListener("change", () => {
      ui.pid = pkSel.value;
      ui.lihat = null;
      ulang();
    });

  const tersaring = ui.kelas ? peserta.filter((p) => p.kelas === ui.kelas) : peserta;
  const rekap = rekapPraktikum({ peserta: tersaring.slice().sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id")), tahap: data.tahap, laporan: data.laporan, praktikum: pk });
  const belumMulai = rekap.baris.length - rekap.mulai;

  const ringkas = h(
    "section",
    { class: "card" },
    h("h3", {}, pk.judul),
    h("p", { class: "muted" }, "Praktikum tidak wajib dan tidak terkunci, jadi 'belum mulai' bukan berarti tertinggal. Kolom ✓* berarti tahap itu lulus memakai berkas contoh."),
    h("div", { class: "filters" }, pkSel ? h("label", {}, "Praktikum ", pkSel) : null, h("label", {}, "Kelas ", kelasSel), h("button", { type: "button", class: "btn btn-sm", onclick: () => unduh("praktikum-" + kuliah.id + "-" + pk.id + ".csv", csvPraktikum(rekap, pk)) }, "Unduh CSV")),
    h("div", { class: "d-stats" }, stat(rekap.baris.length, "peserta"), stat(rekap.mulai, "sudah mulai"), stat(belumMulai, "belum mulai"), stat(rekap.selesai, "selesai semua tahap"), stat(rekap.baris.filter((b) => b.laporan.ada).length, "punya laporan"))
  );

  // Ringkasan semua praktikum (bila lebih dari satu): tahap lulus per peserta
  let semuaPk = null;
  if (daftar.length > 1) {
    const sem = await muat(kuliah.id);
    const urut = tersaring.slice().sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
    const per = daftar.map((p) => rekapPraktikum({ peserta: urut, tahap: sem.tahap.filter((r) => r.praktikum_id === p.id), laporan: sem.laporan.filter((r) => r.praktikum_id === p.id), praktikum: p }));
    const judulSingkat = (p) => (p.jenis === "latihan" ? "B" + p.bab : "TA");
    semuaPk = h(
      "section",
      { class: "card" },
      h("h3", {}, "Semua praktikum"),
      h("p", { class: "muted" }, "Banyaknya tahap lulus per peserta. B2, B3, dan seterusnya adalah latihan per bab; TA adalah tugas akhir (✓ berarti sudah ditandai siap dinilai)."),
      h("div", { class: "tablewrap" }, h("table", { class: "rekap peserta" },
        h("thead", {}, h("tr", {}, h("th", { scope: "col", class: "nama" }, "Peserta"), daftar.map((p) => h("th", { scope: "col", title: p.judul }, judulSingkat(p))), h("th", { scope: "col" }, "Berkas"))),
        h("tbody", {}, urut.map((pes, i) => h("tr", {},
          h("th", { scope: "row", class: "nama" }, pes.nama, h("small", {}, pes.nim + " / " + (pes.kelas || "-"))),
          daftar.map((p, pi) => {
            const b = per[pi].baris[i];
            const adaIsi = b.lulus + b.sedang + b.dilewati > 0;
            const proyek = p.jenis !== "latihan";
            const teks = proyek ? (b.lulus ? "✓" : adaIsi ? "◐" : "○") : adaIsi ? b.lulus + "/" + p.tahap.length : "○";
            const kelas = b.lulus === p.tahap.length ? "selesai-langsung" : adaIsi ? "sedang" : "belum";
            return h("td", { class: "sel " + kelas, title: p.judul }, teks);
          }),
          h("td", {}, per.reduce((a, r) => a + (r.baris[i].mulai ? 1 : 0), 0) ? h("button", { type: "button", class: "btn btn-sm", onclick: () => { ui.pid = daftar[daftar.length - 1].id; ui.lihat = pes.id; ulang(); } }, "Lihat tugas akhir") : null)
        )))
      ))
    );
  }

  const maksMacet = Math.max(1, ...rekap.perTahap.map((t) => t.sedang));
  const perTahap = h(
    "section",
    { class: "card" },
    h("h3", {}, "Per tahap"),
    h("p", { class: "muted" }, "Tahap dengan banyak peserta 'sedang' dan rata-rata kirim tinggi biasanya yang perlu dibahas di kelas."),
    h("div", { class: "tablewrap" }, h("table", { class: "rekap" },
      h("thead", {}, h("tr", {}, ["Tahap", "Bab", "Lulus", "Dengan contoh", "Dilewati", "Sedang", "Rata-rata kirim"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, rekap.perTahap.map((t, i) => h("tr", {}, h("td", {}, (i + 1) + ". " + t.judul), h("td", {}, t.bab.join(", ") || "-"), h("td", {}, String(t.lulus)), h("td", {}, String(t.contoh)), h("td", {}, String(t.dilewati)), h("td", { style: t.sedang === maksMacet && t.sedang > 0 ? "font-weight:700" : "" }, String(t.sedang)), h("td", {}, t.kirimRata ? String(t.kirimRata) : "-")))))
    )
  );

  const panelLihat = h("div", { class: "pk-dash-lihat", "aria-live": "polite" });
  const lihat = async (b) => {
    ui.lihat = b.peserta.id;
    panelLihat.replaceChildren(h("p", { class: "muted" }, "Memuat berkas " + b.peserta.nama));
    try {
      const berkas = await bacaBerkas(kuliah.id, pk.id, b.peserta.id);
      const lap = data.laporan.find((r) => r.user_id === b.peserta.id);
      const unggah = lap && lap.jumlah_ketikan ? lap.jumlah_ketikan._unggah || 0 : 0;
      const analisis = pk.bahasa === "java" && pk.jenis !== "latihan" ? analisisJava(Object.fromEntries(berkas.map((f) => [f.nama, f.isi]))) : null;
      panelLihat.replaceChildren(
        h("h4", {}, "Berkas kerja " + b.peserta.nama + " (" + berkas.length + ")"),
        h("p", { class: "muted" }, "Hanya baca. Berkas bertanda 'contoh' belum diubah peserta." + (unggah ? " Peserta mengunggah " + unggah + " berkas dari perangkatnya." : "")),
        analisis ? h("ul", { class: "pk-analisis" }, analisis.map((x) => h("li", { class: x.ada ? "ok" : "belum" }, h("span", { "aria-hidden": "true" }, x.ada ? "✓ " : "○ "), h("strong", {}, x.label), " ", h("span", { class: "muted" }, x.rincian)))) : null,
        lap && lap.jawaban && Object.values(lap.jawaban).some((v) => String(v).trim())
          ? h("details", { class: "lipat", open: "" }, h("summary", {}, "Laporan peserta"), ...Object.entries(lap.jawaban).filter(([, v]) => String(v).trim()).map(([kunci, v]) => h("div", {}, h("strong", {}, kunci), h("p", {}, String(v)))))
          : null,
        ...(berkas.length ? berkas.map((f) => h("details", { class: "lipat" }, h("summary", {}, f.nama + (f.asal === "contoh" ? " (contoh)" : f.asal === "awal" ? " (kerangka awal)" : "") + " - " + waktu(f.diperbarui_pada)), h("pre", { class: "pk-keluaran" }, f.isi))) : [h("p", { class: "muted" }, "Belum ada berkas.")])
      );
    } catch (e) {
      panelLihat.replaceChildren(h("p", { class: "verdict fail" }, "Gagal memuat berkas: " + (e.message || e)));
    }
  };

  const matriks = h(
    "section",
    { class: "card" },
    h("h3", {}, "Peserta dan tahap"),
    h("p", { class: "d-legend muted" }, "✓ lulus  ✓* lulus dengan berkas contoh  ◐ sedang dikerjakan  – dilewati  ○ belum"),
    h("div", { class: "tablewrap" }, h("table", { class: "rekap peserta" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col", class: "nama" }, "Peserta"), pk.tahap.map((t, i) => h("th", { scope: "col", title: t.judul }, String(i + 1))), ["Lulus", "Kirim", "Laporan", "Tempel", "Terakhir", ""].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, rekap.baris.map((b) => h("tr", {},
        h("th", { scope: "row", class: "nama" }, b.peserta.nama, h("small", {}, b.peserta.nim + " / " + (b.peserta.kelas || "-"))),
        pk.tahap.map((t) => h("td", { class: "sel " + (b.sel[t.id].kode.startsWith("lulus") ? "selesai-langsung" : b.sel[t.id].kode === "lulus-contoh" ? "selesai-bantuan" : b.sel[t.id].kode), title: t.judul + ": " + KODE_SEL[b.sel[t.id].kode] + (b.sel[t.id].kirim ? ", " + b.sel[t.id].kirim + " kirim" : "") }, LAMBANG[b.sel[t.id].kode], b.sel[t.id].kirim ? h("small", {}, String(b.sel[t.id].kirim)) : null)),
        h("td", {}, b.lulus + "/" + pk.tahap.length),
        h("td", {}, String(b.kirim)),
        h("td", {}, b.laporan.ada ? b.laporan.baik + "/" + b.laporan.total + (b.laporan.diekspor ? " ✓" : "") : "-"),
        h("td", {}, b.laporan.tempel ? String(b.laporan.tempel) : "-"),
        h("td", {}, waktu(b.terakhir)),
        h("td", {}, b.mulai || b.laporan.ada ? h("button", { type: "button", class: "btn btn-sm", onclick: () => lihat(b) }, "Lihat berkas") : null)
      )))
    )),
    h("p", { class: "muted" }, "Kolom Laporan: kolom yang sudah memadai dari 3, ✓ bila sudah diekspor PDF. Kolom Tempel: jumlah percobaan menempel yang diblokir (isinya tidak dicatat)."),
    panelLihat
  );
  if (!rekap.baris.length) matriks.append(h("p", { class: "muted" }, "Tidak ada peserta di kelas ini."));

  main.replaceChildren(...[kepala, ringkas, semuaPk, perTahap, matriks].filter(Boolean));
  if (ui.lihat) {
    const b = rekap.baris.find((x) => x.peserta.id === ui.lihat);
    if (b) lihat(b);
  }
}
