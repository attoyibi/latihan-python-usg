// Tab "Laporan" di dashboard instruktur: daftar laporan peserta, membaca isinya, dan menilai dengan rubrik skala 1 sampai 4.
// Penilaian disimpan di tabel penilaian_laporan (hanya instruktur yang boleh menulisnya). Logika murni ada di penilaian.js.
import { h } from "./dom.js";
import * as Auth from "./auth.js";
import { ambilSemua } from "./rekap.js";
import { KOLOM } from "./laporan.js";
import { RUBRIK, susunDaftar, saringDaftar, validasiRubrik, csvPenilaian } from "./penilaian.js";

let cache = null; // { cid, laporan, penilaian }
let saring = { bab: "", belumDinilai: false, cari: "" };

export function reset() {
  cache = null;
}

async function muat(cid) {
  const client = Auth.getClient();
  try {
    const [laporan, penilaian] = await Promise.all([
      ambilSemua(() => client.from("laporan").select("*").eq("matakuliah_id", cid).order("id")),
      ambilSemua(() => client.from("penilaian_laporan").select("*").order("laporan_id")),
    ]);
    cache = { cid, laporan, penilaian };
    return "";
  } catch (e) {
    cache = null;
    return Auth.friendly(e);
  }
}

const waktu = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "-" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
};

export async function render({ main, kepala, kuliah, unduh, peserta }) {
  if (!peserta) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "verdict fail" }, "Data peserta belum termuat. Tekan Muat ulang.")));
    return;
  }
  if (!cache || cache.cid !== kuliah.id) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "muted" }, "Memuat laporan")));
    const g = await muat(kuliah.id);
    if (g) {
      main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "verdict fail" }, g)));
      return;
    }
  }
  const ulang = () => render({ main, kepala, kuliah, unduh, peserta });
  const daftarSemua = susunDaftar({ laporan: cache.laporan, peserta, penilaian: cache.penilaian });
  const daftar = saringDaftar(daftarSemua, saring);
  const belum = daftarSemua.filter((x) => !x.dinilai).length;

  const selBab = h("select", { id: "lBab", "aria-label": "Bab" }, h("option", { value: "" }, "Semua bab"), kuliah.materi.map((m) => h("option", { value: String(m.bab), selected: String(m.bab) === saring.bab ? "" : false }, "Bab " + m.bab)));
  selBab.addEventListener("change", () => {
    saring.bab = selBab.value;
    ulang();
  });
  const cek = h("input", { type: "checkbox", id: "lBelum", checked: saring.belumDinilai ? "" : false });
  cek.addEventListener("change", () => {
    saring.belumDinilai = cek.checked;
    ulang();
  });
  const cari = h("input", { type: "search", id: "lCari", placeholder: "Cari nama atau NIM", value: saring.cari, "aria-label": "Cari nama atau NIM" });
  cari.addEventListener("input", () => {
    saring.cari = cari.value;
    const pos = cari.selectionStart;
    ulang().then(() => {
      const c = document.querySelector("#lCari");
      if (c) {
        c.focus();
        c.setSelectionRange(pos, pos);
      }
    });
  });

  const baris = daftar.map((x) => {
    const r = x.ringkas;
    return h(
      "tr",
      {},
      h("th", { scope: "row", class: "nama" }, h("strong", {}, x.peserta.nama), h("small", {}, (x.peserta.nim || "") + " - " + (x.peserta.kelas || ""))),
      h("td", {}, String(x.laporan.bab)),
      h("td", {}, r.terisi + "/" + r.total),
      h("td", {}, String(r.karakter)),
      h("td", { class: r.rasioKetik !== null && r.rasioKetik < 0.6 ? "tempel ada" : "" , title: "Persen huruf yang tercatat diketik langsung dibanding isi laporan. Rendah bila isi masuk lewat jalan lain." }, r.rasioKetik === null ? "-" : Math.round(r.rasioKetik * 100) + "%"),
      h("td", { class: r.tempel ? "tempel ada" : "tempel" }, r.tempel ? String(r.tempel) : "-"),
      h("td", {}, String(r.menit)),
      h("td", { class: "muted" }, r.diekspor ? waktu(r.diekspor) : "belum"),
      h("td", {}, x.dinilai ? x.rata + " / 4" : h("span", { class: "muted" }, "belum dinilai")),
      h("td", {}, h("button", { type: "button", class: "btn btn-sm", onclick: () => bukaNilai(x, ulang) }, x.dinilai ? "Baca dan ubah nilai" : "Baca dan nilai"))
    );
  });

  main.replaceChildren(
    kepala,
    h("section", { class: "card catatan" }, h("strong", {}, "Cara memakai"), h("p", { class: "muted" }, "Laporan peserta selalu terbuka dan tidak pernah dikunci, jadi di sini juga muncul laporan yang belum lengkap. Kolom 'Diketik' menunjukkan berapa persen isi yang tercatat diketik langsung. Nilai rubrik 1 sampai 4 disimpan per laporan; peserta tidak melihatnya di situs ini.")),
    h(
      "section",
      { class: "card" },
      h("h3", {}, "Laporan praktikum (" + daftarSemua.length + ", " + belum + " belum dinilai)"),
      h("div", { class: "filters" }, selBab, h("label", { class: "muted" }, cek, " hanya yang belum dinilai"), cari, h("button", { type: "button", class: "btn btn-sm", onclick: () => unduh("penilaian-" + kuliah.id + ".csv", csvPenilaian(daftar)) }, "Unduh CSV")),
      daftar.length
        ? h("div", { class: "tablewrap" }, h("table", { class: "rekap" }, h("caption", { class: "sr-only" }, "Laporan praktikum peserta"), h("thead", {}, h("tr", {}, ["Peserta", "Bab", "Kolom memadai", "Karakter", "Diketik", "Tempel", "Menit", "Diekspor", "Nilai", ""].map((t) => h("th", { scope: "col", class: t === "Peserta" ? "nama" : "" }, t)))), h("tbody", {}, baris)))
        : h("p", { class: "muted" }, daftarSemua.length ? "Tidak ada laporan yang cocok dengan saringan." : "Belum ada laporan yang tersimpan.")
    )
  );
}

function bukaNilai(x, ulang) {
  const client = Auth.getClient();
  const dlg = h("dialog", { class: "putar", "aria-label": "Baca dan nilai laporan" });
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  const l = x.laporan;
  const j = l.jawaban || {};
  const r = x.ringkas;
  const tutup = h("button", { type: "button", class: "btn btn-sm", onclick: () => dlg.close() }, "Tutup");
  const pesan = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const sel = RUBRIK.map((k) => {
    const s = h("select", { id: "rub-" + k.id, "aria-label": k.label }, h("option", { value: "" }, "pilih skor"), [1, 2, 3, 4].map((v) => h("option", { value: String(v), selected: x.nilai && x.nilai[k.id] === v ? "" : false }, v + (v === 1 ? " (kurang)" : v === 4 ? " (sangat baik)" : ""))));
    return { k, s, baris: h("div", { class: "field" }, h("label", { for: "rub-" + k.id }, k.label), s) };
  });
  const komentar = h("textarea", { class: "input", id: "rub-komentar", rows: "3", maxlength: "2000", "aria-label": "Komentar" });
  komentar.value = x.nilai && x.nilai.komentar ? x.nilai.komentar : "";
  const simpan = h("button", { type: "button", class: "btn btn-primary" }, "Simpan nilai");
  simpan.addEventListener("click", async () => {
    const skor = {};
    for (const { k, s } of sel) skor[k.id] = s.value === "" ? NaN : Number(s.value);
    const galat = validasiRubrik(skor, komentar.value);
    if (galat) {
      pesan.textContent = galat;
      return;
    }
    simpan.disabled = true;
    pesan.textContent = "Menyimpan";
    const { error } = await client.from("penilaian_laporan").upsert({ laporan_id: l.id, penilai: Auth.getUserId(), ...skor, komentar: komentar.value.trim() || null, dinilai_pada: new Date().toISOString() }, { onConflict: "laporan_id" });
    simpan.disabled = false;
    if (error) {
      pesan.textContent = "Gagal menyimpan: " + Auth.friendly(error);
      return;
    }
    cache = null;
    dlg.close();
    ulang();
  });
  dlg.append(
    h("h3", {}, x.peserta.nama + ", bab " + l.bab),
    h("p", { class: "muted" }, "NIM " + (x.peserta.nim || "-") + ", kelas " + (x.peserta.kelas || "-") + ". Kode verifikasi " + (l.kode_verifikasi || "-") + ". " + r.terisi + " dari " + r.total + " kolom memadai, " + r.karakter + " karakter, " + (r.rasioKetik === null ? "" : Math.round(r.rasioKetik * 100) + " persen diketik langsung, ") + r.tempel + " percobaan tempel diblokir, " + r.menit + " menit menulis."),
    ...KOLOM.map((k) => h("div", { class: "lap-baca" }, h("strong", {}, k.label), h("p", { class: j[k.id] ? "" : "muted" }, j[k.id] || "(belum diisi)"))),
    h("h3", {}, "Penilaian"),
    ...sel.map((s) => s.baris),
    h("div", { class: "field" }, h("label", { for: "rub-komentar" }, "Komentar (opsional)"), komentar),
    h("div", { class: "actions" }, simpan, tutup),
    pesan
  );
  dlg.showModal();
}
