// Dashboard instruktur: siapa sudah paham (lulus tanpa petunjuk), siapa memakai bantuan, siapa tersangkut.
// Data dibaca dari tabel profiles dan progres. Yang boleh membaca data semua peserta hanyalah
// instruktur (aturan keamanan di database); peserta biasa hanya akan mendapat datanya sendiri.
import { h, $ } from "./dom.js";
import * as Auth from "./auth.js";
import * as IntegUI from "./integritas-ui.js";
import * as LaporanUI from "./laporan-ui.js";
import * as KehadiranUI from "./kehadiran-ui.js";
import * as JejakUI from "./jejak-ui.js";
import * as RisetUI from "./riset-ui.js";
import { kolomBelumAda } from "./sinkron.js";
import { SEL, SEL_TEKS, susunRekap, saringPeserta, pilihanSaringan, buatCsv, ambilSemua, AMBANG_TERSANGKUT } from "./rekap.js";

const LAMBANG = { "selesai-langsung": "✓", "selesai-bantuan": "✓*", sedang: "◐", belum: "○", unggah: "–" };

let keadaan = { tab: "progres", cid: "", data: null, saring: { prodi: "", angkatan: "", rombel: "", cari: "" }, urut: "nama", muat: false, galat: "" };

function formatWaktu(iso) {
  if (!iso) return "belum ada";
  const d = new Date(iso);
  if (isNaN(d)) return "belum ada";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

async function muat(cid) {
  const client = Auth.getClient();
  keadaan.muat = true;
  keadaan.galat = "";
  try {
    // Kolom persetujuan penelitian (migrasi 0007) dicoba dulu; bila belum ada, dashboard tetap jalan tanpanya.
    const ambilPeserta = (kolom) => ambilSemua(() => client.from("profiles").select(kolom).eq("peran", "peserta").order("id"));
    const [peserta, progres, tempel] = await Promise.all([
      ambilPeserta("id,nama,nim,kelas,prodi,angkatan,rombel,peran,riset_setuju,kode_riset").catch((e) => {
        if (!kolomBelumAda(e)) throw e;
        return ambilPeserta("id,nama,nim,kelas,prodi,angkatan,rombel,peran");
      }),
      ambilSemua(() => client.from("progres").select("*").eq("matakuliah_id", cid).order("user_id").order("bab")),
      ambilSemua(() => client.from("aktivitas").select("user_id,bab,detail").eq("matakuliah_id", cid).eq("jenis", "tempel_diblokir").order("id")),
    ]);
    keadaan.data = { peserta, progres, tempel, diambil: new Date().toISOString() };
  } catch (e) {
    keadaan.galat = Auth.friendly(e);
    keadaan.data = null;
  }
  keadaan.muat = false;
}

function unduh(nama, isi) {
  const blob = new Blob(["﻿" + isi], { type: "text/csv;charset=utf-8" });
  const a = h("a", { href: URL.createObjectURL(blob), download: nama });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export async function renderInstruktur({ kuliahAktif }) {
  const main = $("#main");
  if (!Auth.getProfile() || Auth.getProfile().peran !== "instruktur") {
    main.replaceChildren(h("section", { class: "card" }, h("h2", {}, "Khusus instruktur"), h("p", {}, "Halaman ini hanya untuk akun instruktur."), h("a", { class: "btn", href: "#beranda" }, "Kembali")));
    return;
  }
  if (!kuliahAktif.length) {
    main.replaceChildren(h("section", { class: "card" }, h("h2", {}, "Dashboard instruktur"), h("p", {}, "Belum ada mata kuliah aktif.")));
    return;
  }
  if (!keadaan.cid || !kuliahAktif.some((c) => c.id === keadaan.cid)) keadaan.cid = kuliahAktif[0].id;
  const kuliah = kuliahAktif.find((c) => c.id === keadaan.cid);

  const gambar = () => tampilkan(main, kuliahAktif, kuliah);
  main.replaceChildren(h("section", { class: "card" }, h("h2", {}, "Dashboard instruktur"), h("p", { class: "muted" }, "Memuat data peserta")));
  if (!keadaan.data) await muat(kuliah.id);
  gambar();
}

function tampilkan(main, kuliahAktif, kuliah) {
  const materi = kuliah.materi;
  const baru = async () => {
    main.replaceChildren(h("section", { class: "card" }, h("h2", {}, "Dashboard instruktur"), h("p", { class: "muted" }, "Memuat data peserta")));
    IntegUI.reset();
    LaporanUI.reset();
    KehadiranUI.reset();
    JejakUI.reset();
    RisetUI.reset();
    await muat(keadaan.cid);
    tampilkan(main, kuliahAktif, kuliah);
  };

  const selKuliah = h("select", { id: "dKuliah", "aria-label": "Mata kuliah" }, kuliahAktif.map((c) => h("option", { value: c.id, selected: c.id === kuliah.id ? "" : false }, c.nama)));
  selKuliah.addEventListener("change", () => {
    keadaan.cid = selKuliah.value;
    keadaan.data = null;
    IntegUI.reset();
    LaporanUI.reset();
    KehadiranUI.reset();
    JejakUI.reset();
    RisetUI.reset();
    keadaan.saring = { prodi: "", angkatan: "", rombel: "", cari: "" };
    renderInstruktur({ kuliahAktif });
  });

  const tab = (id, teks) =>
    h("button", { type: "button", class: "tab" + (keadaan.tab === id ? " on" : ""), role: "tab", "aria-selected": String(keadaan.tab === id), onclick: () => {
      keadaan.tab = id;
      renderInstruktur({ kuliahAktif });
    } }, teks);
  const kepala = h(
    "section",
    { class: "card" },
    h("h2", {}, "Dashboard instruktur"),
    h("p", { class: "muted" }, keadaan.tab === "jejak" ? "Semua peserta yang masuk, apa yang mereka kerjakan (berhasil maupun gagal), dan putar ulang cara mereka menulis." : keadaan.tab === "riset" ? "Perilaku belajar peserta yang menyetujui, dan ekspor data anonim untuk penelitian." : keadaan.tab === "kehadiran" ? "Kesiapan sebelum kelas, kehadiran per pertemuan, aktivitas per hari dan minggu, dan keaktifan, mengikuti jadwal tiap kelas." : keadaan.tab === "laporan" ? "Baca laporan praktikum peserta dan beri nilai dengan rubrik." : keadaan.tab === "progres" ? "Siapa yang sudah paham, siapa yang masih memakai bantuan, dan siapa yang tersangkut. Data diambil dari akun peserta di Supabase." : "Sinyal untuk memilih siapa yang perlu ditanya langsung. Bukan bukti kecurangan."),
    h("div", { class: "tabs", role: "tablist", "aria-label": "Bagian dashboard" }, tab("progres", "Progres"), tab("integritas", "Sinyal integritas"), tab("laporan", "Laporan"), tab("kehadiran", "Kehadiran"), tab("jejak", "Jejak peserta"), tab("riset", "Riset")),
    h("div", { class: "filters" }, h("label", {}, "Mata kuliah ", selKuliah), h("button", { type: "button", class: "btn btn-sm", onclick: baru }, "Muat ulang"))
  );

  if (keadaan.tab === "jejak") {
    JejakUI.render({ main, kepala, kuliah, unduh, peserta: keadaan.data ? keadaan.data.peserta : null });
    return;
  }
  if (keadaan.tab === "riset") {
    RisetUI.render({ main, kepala, kuliah, peserta: keadaan.data ? keadaan.data.peserta : null, progres: keadaan.data ? keadaan.data.progres : [] });
    return;
  }
  if (keadaan.tab === "kehadiran") {
    KehadiranUI.render({ main, kepala, kuliah, unduh, peserta: keadaan.data ? keadaan.data.peserta : null, progres: keadaan.data ? keadaan.data.progres : [] });
    return;
  }
  if (keadaan.tab === "laporan") {
    LaporanUI.render({ main, kepala, kuliah, unduh, peserta: keadaan.data ? keadaan.data.peserta : null });
    return;
  }
  if (keadaan.tab === "integritas") {
    IntegUI.render({ main, kepala, kuliah, unduh, peserta: keadaan.data ? keadaan.data.peserta : null, tempel: keadaan.data ? keadaan.data.tempel : [] });
    return;
  }

  if (keadaan.galat || !keadaan.data) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "verdict fail" }, keadaan.galat || "Data belum bisa dimuat.")));
    return;
  }

  const { peserta, progres, tempel, diambil } = keadaan.data;
  const pil = pilihanSaringan(peserta);
  const buatMenu = (id, label, nilai, opsi, ubah) => {
    const s = h("select", { id, "aria-label": label }, h("option", { value: "" }, label + ": semua"), opsi.map((o) => h("option", { value: String(o), selected: String(o) === String(nilai) ? "" : false }, String(o))));
    s.addEventListener("change", () => ubah(s.value));
    return s;
  };
  const kelasKe = (k, v) => {
    keadaan.saring[k] = v;
    tampilkan(main, kuliahAktif, kuliah);
  };
  const cari = h("input", { type: "search", id: "dCari", placeholder: "Cari nama atau NIM", value: keadaan.saring.cari, "aria-label": "Cari nama atau NIM" });
  cari.addEventListener("input", () => {
    keadaan.saring.cari = cari.value;
    const pos = cari.selectionStart;
    tampilkan(main, kuliahAktif, kuliah);
    const baruCari = $("#dCari");
    baruCari.focus();
    baruCari.setSelectionRange(pos, pos);
  });
  kepala.append(
    h(
      "div",
      { class: "filters" },
      buatMenu("dProdi", "Prodi", keadaan.saring.prodi, pil.prodi, (v) => kelasKe("prodi", v)),
      buatMenu("dAngkatan", "Angkatan", keadaan.saring.angkatan, pil.angkatan, (v) => kelasKe("angkatan", v)),
      buatMenu("dRombel", "Kelas", keadaan.saring.rombel, pil.rombel, (v) => kelasKe("rombel", v)),
      cari
    )
  );

  const terpilih = saringPeserta(peserta, keadaan.saring);
  const rekap = susunRekap({ peserta: terpilih, progres, materi, tempel });
  const { ringkasan } = rekap;

  const kartu = (angka, label) => h("div", { class: "d-stat" }, h("strong", {}, String(angka)), h("span", { class: "muted" }, label));
  const ringkas = h(
    "section",
    { class: "card" },
    h("div", { class: "d-stats" }, kartu(ringkasan.jumlahPeserta, "peserta"), kartu(ringkasan.rataSelesai + " dari " + ringkasan.totalBabKode, "rata-rata bab kode selesai"), kartu(ringkasan.belumMulai, "belum mulai"), kartu(ringkasan.tersangkut, "tersangkut (kirim " + AMBANG_TERSANGKUT + " kali atau lebih, belum lulus)"), kartu(ringkasan.adaTempel, "pernah mencoba menempel")),
    h("p", { class: "muted" }, "Data diambil " + formatWaktu(diambil) + ". Muat ulang untuk melihat yang terbaru.")
  );

  // Daftar tersangkut: paling banyak kirim di atas.
  const tersangkut = rekap.baris
    .filter((b) => b.tersangkut.length)
    .map((b) => ({ b, maks: Math.max(...b.tersangkut.map((t) => t.kirim)) }))
    .sort((x, y) => y.maks - x.maks);
  const kartuSangkut = tersangkut.length
    ? h(
        "section",
        { class: "card" },
        h("h3", {}, "Perlu dihampiri"),
        h("ul", { class: "sangkut" }, tersangkut.map(({ b }) => h("li", {}, h("strong", {}, b.peserta.nama), " (" + (b.peserta.nim || "") + ", " + (b.peserta.kelas || "") + "): ", b.tersangkut.map((t) => "bab " + t.bab + " sudah " + t.kirim + " kali kirim").join("; "))))
      )
    : null;

  // Tabel bab: bab mana yang paling sulit.
  const tabelBab = h(
    "section",
    { class: "card" },
    h("h3", {}, "Per bab"),
    h(
      "div",
      { class: "tablewrap" },
      h(
        "table",
        { class: "rekap" },
        h("caption", { class: "sr-only" }, "Ringkasan per bab"),
        h("thead", {}, h("tr", {}, ["Bab", "Selesai", "Tanpa petunjuk", "Dengan petunjuk", "Sedang", "Belum", "Rata-rata kirim"].map((t) => h("th", { scope: "col" }, t)))),
        h(
          "tbody",
          {},
          rekap.perBab.map((b) =>
            b.unggah
              ? h("tr", {}, h("th", { scope: "row" }, b.bab + ". " + b.judul), h("td", { colspan: "6", class: "muted" }, "Tugas unggah, belum dilacak"))
              : h(
                  "tr",
                  {},
                  h("th", { scope: "row" }, b.bab + ". " + b.judul),
                  h("td", {}, b.selesai + " (" + b.persenSelesai + "%)"),
                  h("td", {}, String(b.langsung)),
                  h("td", {}, String(b.bantuan)),
                  h("td", {}, String(b.sedang)),
                  h("td", {}, String(b.belum)),
                  h("td", {}, b.rataKirim === null ? "-" : String(b.rataKirim))
                )
          )
        )
      )
    )
  );

  // Tabel peserta x bab.
  const urutan = {
    nama: (a, b) => (a.peserta.nama || "").localeCompare(b.peserta.nama || "", "id"),
    selesai: (a, b) => b.selesai - a.selesai || (a.peserta.nama || "").localeCompare(b.peserta.nama || "", "id"),
    sedikit: (a, b) => a.selesai - b.selesai || (a.peserta.nama || "").localeCompare(b.peserta.nama || "", "id"),
  };
  const baris = rekap.baris.slice().sort(urutan[keadaan.urut] || urutan.nama);
  const selUrut = h(
    "select",
    { id: "dUrut", "aria-label": "Urutkan" },
    [["nama", "Urut nama"], ["sedikit", "Paling sedikit selesai dulu"], ["selesai", "Paling banyak selesai dulu"]].map(([v, t]) => h("option", { value: v, selected: v === keadaan.urut ? "" : false }, t))
  );
  selUrut.addEventListener("change", () => {
    keadaan.urut = selUrut.value;
    tampilkan(main, kuliahAktif, kuliah);
  });
  const csv = h("button", { type: "button", class: "btn btn-sm", onclick: () => unduh("rekap-" + kuliah.id + ".csv", buatCsv(rekap, materi)) }, "Unduh CSV");

  const sel = (c, m) =>
    h(
      "td",
      { class: "sel " + c.kode, title: "Bab " + m.bab + ": " + SEL_TEKS[c.kode] + (c.kirim ? ", kirim " + c.kirim + " kali" : "") },
      h("span", { "aria-label": SEL_TEKS[c.kode] }, LAMBANG[c.kode]),
      c.kirim ? h("small", {}, String(c.kirim)) : null
    );
  const tabel = h(
    "section",
    { class: "card" },
    h("h3", {}, "Peserta dan bab"),
    h("div", { class: "filters" }, selUrut, csv),
    h(
      "p",
      { class: "muted d-legend" },
      LAMBANG[SEL.SELESAI_LANGSUNG] + " selesai tanpa petunjuk; " + LAMBANG[SEL.SELESAI_BANTUAN] + " selesai memakai petunjuk; " + LAMBANG[SEL.SEDANG] + " sedang (angka = berapa kali kirim); " + LAMBANG[SEL.BELUM] + " belum; " + LAMBANG[SEL.UNGGAH] + " tugas unggah."
    ),
    baris.length
      ? h(
          "div",
          { class: "tablewrap" },
          h(
            "table",
            { class: "rekap peserta" },
            h("caption", { class: "sr-only" }, "Status tiap peserta di tiap bab"),
            h("thead", {}, h("tr", {}, h("th", { scope: "col", class: "nama" }, "Peserta"), materi.map((m) => h("th", { scope: "col", title: m.judul }, String(m.bab))), h("th", { scope: "col" }, "Selesai"), h("th", { scope: "col", title: "Berapa kali peserta mencoba menempel (paste) kode atau masukan dan diblokir. Isi yang ditempel tidak dicatat." }, "Tempel"), h("th", { scope: "col" }, "Terakhir aktif"))),
            h(
              "tbody",
              {},
              baris.map((b) =>
                h(
                  "tr",
                  {},
                  h("th", { scope: "row", class: "nama" }, h("strong", {}, b.peserta.nama), h("small", {}, (b.peserta.nim || "") + " - " + (b.peserta.kelas || ""))),
                  materi.map((m) => sel(b.sel[m.bab], m)),
                  h("td", {}, b.selesai + "/" + ringkasan.totalBabKode),
                  h("td", { class: b.tempel > 0 ? "tempel ada" : "tempel", title: b.tempel ? b.tempel + " percobaan tempel diblokir. Ini petunjuk untuk dibicarakan, bukan bukti kecurangan." : "" }, b.tempel ? String(b.tempel) : "-"),
                  h("td", { class: "muted" }, formatWaktu(b.terakhir))
                )
              )
            )
          )
        )
      : h("p", { class: "muted" }, "Tidak ada peserta yang cocok dengan saringan.")
  );

  main.replaceChildren(...[kepala, ringkas, kartuSangkut, tabelBab, tabel].filter(Boolean));
}
