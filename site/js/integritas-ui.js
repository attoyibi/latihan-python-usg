// Tab "Sinyal integritas" di dashboard instruktur: daftar peserta menurut sinyal, rincian beralasan, perangkat dipakai
// banyak akun (dengan tombol tandai laboratorium), dan pemutar ulang cara peserta mengetik.
// Analisisnya ada di integritas.js; modul ini hanya mengambil data dan menggambar.
import { h } from "./dom.js";
import * as Auth from "./auth.js";
import { ambilSemua } from "./rekap.js";
import { analisis, csvSinyal, JENIS, TINGKAT } from "./integritas.js";
import { susunUlang } from "./rekam.js";

let cache = null; // { cid, data }
let saring = { tingkat: "semua", jenis: "", cari: "" };
let terbuka = new Set(); // peserta yang rinciannya dibuka
let galat = "";

export function reset() {
  cache = null;
  terbuka = new Set();
}

const TEKS_TINGKAT = { tinggi: "Tinggi", sedang: "Sedang", rendah: "Rendah" };
const LAMBANG = { tinggi: "●", sedang: "◐", rendah: "○" };

async function muat(cid) {
  const client = Auth.getClient();
  galat = "";
  try {
    const [sesi, bersama, percobaan] = await Promise.all([
      ambilSemua(() => client.from("sesi_perangkat").select("*").order("device_id").order("user_id")),
      ambilSemua(() => client.from("perangkat_bersama").select("*").order("device_id")),
      ambilSemua(() => client.from("percobaan").select("id,user_id,bab,jenis,lulus,kasus_lulus,kasus_total,kode,pola,dibuat_pada").eq("matakuliah_id", cid).eq("jenis", "kirim").order("id")),
    ]);
    cache = { cid, data: { sesi, bersama, percobaan } };
  } catch (e) {
    galat = Auth.friendly(e);
    cache = null;
  }
}

const waktu = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
};

export async function render({ main, kepala, kuliah, unduh, peserta, tempel }) {
  if (!peserta) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "verdict fail" }, "Data peserta belum termuat. Tekan Muat ulang.")));
    return;
  }
  if (!cache || cache.cid !== kuliah.id) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "muted" }, "Memuat data perangkat dan percobaan")));
    await muat(kuliah.id);
  }
  if (!cache) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "verdict fail" }, galat || "Data belum bisa dimuat.")));
    return;
  }
  const ulang = () => render({ main, kepala, kuliah, unduh, peserta, tempel });
  const hasil = analisis({ peserta, sesi: cache.data.sesi, bersama: cache.data.bersama, percobaan: cache.data.percobaan, tempel });
  const orang = new Map(peserta.map((p) => [p.id, p]));

  // Peringatan penggunaan: sinyal bukan bukti.
  const peringatan = h(
    "section",
    { class: "card catatan" },
    h("strong", {}, "Cara memakai"),
    h("p", { class: "muted" }, "Sinyal di sini bukan bukti kecurangan dan tidak diberi skor. Banyak yang wajar: komputer laboratorium dipakai bergantian, teman belajar bersama, atau memang mengetik lurus. Pakai untuk memilih siapa yang ditanya langsung: minta mereka menjelaskan kodenya atau mengubah satu barisnya. Bila ragu, putar ulang rekaman cara mengetiknya.")
  );

  const kartu = (angka, label) => h("div", { class: "d-stat" }, h("strong", {}, String(angka)), h("span", { class: "muted" }, label));
  const r = hasil.ringkasan;
  const ringkas = h("section", { class: "card" }, h("div", { class: "d-stats" }, kartu(r.bersinyalTinggi, "peserta bersinyal tinggi"), kartu(r.bersinyalSedang, "bersinyal sedang"), kartu(r.bersinyalRendah, "hanya sinyal rendah"), kartu(r.perangkatBersama, "perangkat dipakai banyak akun"), kartu(r.pasangan, "pasangan peserta yang mirip")));

  // --- saringan ---
  const selTingkat = h("select", { id: "iTingkat", "aria-label": "Tingkat sinyal" }, [["semua", "Semua yang punya sinyal"], ["sedang", "Sedang ke atas"], ["tinggi", "Hanya tinggi"]].map(([v, t]) => h("option", { value: v, selected: v === saring.tingkat ? "" : false }, t)));
  const selJenis = h("select", { id: "iJenis", "aria-label": "Jenis sinyal" }, h("option", { value: "" }, "Semua jenis"), Object.entries(JENIS).map(([k, t]) => h("option", { value: k, selected: k === saring.jenis ? "" : false }, t)));
  const cari = h("input", { type: "search", id: "iCari", placeholder: "Cari nama atau NIM", value: saring.cari, "aria-label": "Cari nama atau NIM" });
  selTingkat.addEventListener("change", () => {
    saring.tingkat = selTingkat.value;
    ulang();
  });
  selJenis.addEventListener("change", () => {
    saring.jenis = selJenis.value;
    ulang();
  });
  cari.addEventListener("input", () => {
    saring.cari = cari.value;
    const pos = cari.selectionStart;
    ulang().then(() => {
      const c = document.querySelector("#iCari");
      if (c) {
        c.focus();
        c.setSelectionRange(pos, pos);
      }
    });
  });
  const minimum = saring.tingkat === "tinggi" ? 3 : saring.tingkat === "sedang" ? 2 : 1;
  const q = saring.cari.trim().toLowerCase();
  const daftar = hasil.hasil.filter((x) => x.puncak >= minimum && (!saring.jenis || x.sinyal.some((s) => s.kode === saring.jenis)) && (!q || (x.peserta.nama || "").toLowerCase().includes(q) || (x.peserta.nim || "").toLowerCase().includes(q))).sort((a, b) => b.puncak - a.puncak || b.tinggi - a.tinggi || b.sedang - a.sedang || (a.peserta.nama || "").localeCompare(b.peserta.nama || "", "id"));

  const csv = h("button", { type: "button", class: "btn btn-sm", onclick: () => unduh("sinyal-" + kuliah.id + ".csv", csvSinyal(daftar)) }, "Unduh CSV");

  // --- tabel peserta ---
  const rincian = (x) =>
    h(
      "tr",
      { class: "rincian" },
      h(
        "td",
        { colspan: "6" },
        h("ul", { class: "sinyal-daftar" }, x.sinyal.map((s) =>
          h(
            "li",
            { class: "sinyal t-" + s.tingkat },
            h("span", { class: "lencana t-" + s.tingkat }, LAMBANG[s.tingkat] + " " + TEKS_TINGKAT[s.tingkat]),
            h("strong", {}, " " + s.judul + (s.bab ? " (bab " + s.bab + ")" : "")),
            h("p", {}, s.alasan),
            s.percobaan_id ? h("button", { type: "button", class: "btn btn-sm", onclick: () => putarUlang(s.percobaan_id, orang) }, "Putar ulang cara mengetiknya") : null
          )
        )),
        riwayatPeserta(x.peserta, orang)
      )
    );

  const baris = [];
  for (const x of daftar) {
    const buka = terbuka.has(x.peserta.id);
    baris.push(
      h(
        "tr",
        {},
        h("th", { scope: "row", class: "nama" }, h("strong", {}, x.peserta.nama), h("small", {}, (x.peserta.nim || "") + " - " + (x.peserta.kelas || ""))),
        h("td", { class: "angka t-tinggi" }, x.tinggi ? String(x.tinggi) : "-"),
        h("td", { class: "angka t-sedang" }, x.sedang ? String(x.sedang) : "-"),
        h("td", { class: "angka t-rendah" }, x.rendah ? String(x.rendah) : "-"),
        h("td", { class: "ringkas" }, [...new Set(x.sinyal.map((s) => s.judul))].slice(0, 3).join("; ") || "Tidak ada sinyal"),
        h("td", {}, x.sinyal.length ? h("button", { type: "button", class: "btn btn-sm btn-ghost", "aria-expanded": String(buka), onclick: () => {
          if (terbuka.has(x.peserta.id)) terbuka.delete(x.peserta.id);
          else terbuka.add(x.peserta.id);
          ulang();
        } }, buka ? "Tutup" : "Rincian") : "")
      )
    );
    if (buka) baris.push(rincian(x));
  }

  const tabel = h(
    "section",
    { class: "card" },
    h("h3", {}, "Peserta menurut sinyal"),
    h("div", { class: "filters" }, selTingkat, selJenis, cari, csv),
    h("p", { class: "muted d-legend" }, LAMBANG.tinggi + " tinggi (beberapa petunjuk kuat bertemu)  " + LAMBANG.sedang + " sedang (patut ditanya)  " + LAMBANG.rendah + " rendah (informasi, sering wajar)"),
    daftar.length
      ? h("div", { class: "tablewrap" }, h("table", { class: "rekap integritas" }, h("caption", { class: "sr-only" }, "Peserta dengan sinyal"), h("thead", {}, h("tr", {}, h("th", { scope: "col", class: "nama" }, "Peserta"), h("th", { scope: "col" }, "Tinggi"), h("th", { scope: "col" }, "Sedang"), h("th", { scope: "col" }, "Rendah"), h("th", { scope: "col" }, "Ringkasan"), h("th", { scope: "col" }, ""))), h("tbody", {}, baris)))
      : h("p", { class: "muted" }, "Tidak ada peserta yang cocok. Itu kabar baik bila saringannya longgar.")
  );

  // --- perangkat ---
  const perangkatPerhatian = hasil.perangkat.filter((d) => d.akun.length >= 2);
  const tandai = async (dev, nyala) => {
    const client = Auth.getClient();
    const res = nyala ? await client.from("perangkat_bersama").insert({ device_id: dev.device_id, catatan: "Ditandai dari dashboard", ditandai_oleh: Auth.getUserId() }) : await client.from("perangkat_bersama").delete().eq("device_id", dev.device_id);
    if (res.error) {
      alert("Gagal menyimpan: " + Auth.friendly(res.error));
      return;
    }
    cache = null;
    ulang();
  };
  const kartuPerangkat = h(
    "section",
    { class: "card" },
    h("h3", {}, "Perangkat yang dipakai banyak akun"),
    h("p", { class: "muted" }, "Satu browser yang dipakai masuk oleh lebih dari satu akun. Bila ini komputer laboratorium atau perangkat bersama, tandai supaya tidak lagi menjadi sinyal."),
    perangkatPerhatian.length
      ? h("div", { class: "tablewrap" }, h("table", { class: "rekap" }, h("thead", {}, h("tr", {}, ["Perangkat", "Jenis", "Akun yang memakai", "Status", ""].map((t) => h("th", { scope: "col" }, t)))), h("tbody", {}, perangkatPerhatian.map((d) =>
          h("tr", {},
            h("td", {}, h("code", {}, d.device_id.slice(4, 12))),
            h("td", {}, d.agen || "tidak diketahui"),
            h("td", { style: "white-space:normal" }, d.akun.map((a) => (orang.get(a.user_id) ? orang.get(a.user_id).nama : "?") + " (" + a.jumlah_masuk + "x, " + waktu(a.terakhir) + ")").join("; ")),
            h("td", {}, d.bersama ? "Perangkat bersama (lab)" : "Belum ditandai"),
            h("td", {}, h("button", { type: "button", class: "btn btn-sm", onclick: () => tandai(d, !d.bersama) }, d.bersama ? "Cabut tanda" : "Tandai perangkat bersama"))
          )
        ))))
      : h("p", { class: "muted" }, "Belum ada perangkat yang dipakai lebih dari satu akun.")
  );

  // --- pasangan ---
  const kartuPasangan = hasil.pasangan.length
    ? h("section", { class: "card" }, h("h3", {}, "Pasangan yang perlu dilihat"), h("ul", { class: "sangkut" }, hasil.pasangan.map((p) => h("li", {}, h("strong", {}, JENIS[p.jenis]), ": " + p.ids.map((id) => (orang.get(id) ? orang.get(id).nama : "?")).join(" dan ") + (p.bab ? " (bab " + p.bab + ")" : "")))))
    : null;

  main.replaceChildren(kepala, peringatan, ringkas, tabel, kartuPerangkat, kartuPasangan);
}

// Riwayat singkat kiriman satu peserta: kapan, lulus atau tidak, dan ringkasan cara menulisnya.
function riwayatPeserta(p, orang) {
  const baris = cache.data.percobaan.filter((x) => x.user_id === p.id).sort((a, b) => (a.dibuat_pada < b.dibuat_pada ? -1 : 1));
  if (!baris.length) return h("p", { class: "muted" }, "Belum ada kiriman jawaban.");
  return h(
    "div",
    { class: "tablewrap" },
    h("table", { class: "rekap" }, h("caption", { class: "sr-only" }, "Riwayat kiriman " + p.nama),
      h("thead", {}, h("tr", {}, ["Waktu", "Bab", "Hasil", "Mengetik", "Dihapus", "Linier", "Lompat", "Jalankan", ""].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, baris.map((x) => {
        const o = x.pola || {};
        return h("tr", {}, h("td", {}, waktu(x.dibuat_pada)), h("td", {}, String(x.bab)), h("td", {}, x.lulus ? "Lulus" : (x.kasus_lulus || 0) + "/" + (x.kasus_total || "?")), h("td", {}, o.cps != null ? o.cps + " huruf/dtk" : "-"), h("td", {}, o.rasio_hapus != null ? Math.round(o.rasio_hapus * 100) + "%" : "-"), h("td", {}, o.linier != null ? Math.round(o.linier * 100) + "%" : "-"), h("td", {}, o.lompat != null ? String(o.lompat) : "-"), h("td", {}, o.jalankan != null ? String(o.jalankan) : "-"), h("td", {}, h("button", { type: "button", class: "btn btn-sm btn-ghost", onclick: () => putarUlang(x.id, orang) }, "Putar ulang")));
      })))
  );
}

// ---------- Pemutar ulang ----------

async function putarUlang(id, orang) {
  const client = Auth.getClient();
  const dlg = h("dialog", { class: "putar", "aria-label": "Putar ulang cara mengetik" });
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  const tutup = h("button", { type: "button", class: "btn btn-sm", onclick: () => dlg.close() }, "Tutup");
  dlg.append(h("p", { class: "muted" }, "Memuat rekaman"), h("div", { class: "actions" }, tutup));
  dlg.showModal();

  const { data, error } = await client.from("percobaan").select("id,user_id,bab,lulus,kasus_lulus,kasus_total,kode,pola,rekaman,dibuat_pada").eq("id", id).single();
  if (error || !data) {
    dlg.replaceChildren(h("p", { class: "verdict fail" }, error ? Auth.friendly(error) : "Rekaman tidak ditemukan."), h("div", { class: "actions" }, tutup));
    return;
  }
  const p = orang.get(data.user_id);
  const judul = h("h3", {}, (p ? p.nama : "Peserta") + ", bab " + data.bab);
  const info = h("p", { class: "muted" }, "Kiriman " + waktu(data.dibuat_pada) + ": " + (data.lulus ? "lulus" : (data.kasus_lulus || 0) + " dari " + (data.kasus_total || "?") + " kasus") + (data.pola && data.pola.cps != null ? ". Kecepatan rata-rata " + data.pola.cps + " huruf per detik, puncak " + data.pola.cps_puncak + "." : "."));
  const layar = h("pre", { class: "putar-kode", "aria-live": "off" });
  if (!data.rekaman) {
    layar.textContent = data.kode || "";
    dlg.replaceChildren(judul, info, h("p", { class: "muted" }, "Rekaman cara mengetik tidak tersedia untuk kiriman ini (terlalu besar, atau dikirim sebelum fitur ini ada). Berikut kode yang dikirim."), layar, h("div", { class: "actions" }, tutup));
    return;
  }
  const langkah = susunUlang(data.rekaman);
  let i = 0;
  let jalan = null;
  let kecepatan = 4;
  const slider = h("input", { type: "range", min: "0", max: String(langkah.length - 1), value: "0", "aria-label": "Posisi putar ulang" });
  const jam = h("span", { class: "muted" });
  const tombol = h("button", { type: "button", class: "btn btn-primary btn-sm" }, "Putar");
  const selCepat = h("select", { "aria-label": "Kecepatan" }, [1, 4, 16, 64].map((k) => h("option", { value: String(k), selected: k === kecepatan ? "" : false }, k + "x")));
  const gambar = () => {
    layar.textContent = langkah[i].teks;
    layar.classList.toggle("jalankan", langkah[i].jalankan);
    slider.value = String(i);
    jam.textContent = (langkah[i].t / 1000).toFixed(1) + " dari " + (langkah[langkah.length - 1].t / 1000).toFixed(1) + " detik" + (langkah[i].jalankan ? "  (tombol Jalankan ditekan)" : "");
  };
  const henti = () => {
    clearTimeout(jalan);
    jalan = null;
    tombol.textContent = "Putar";
  };
  const maju = () => {
    if (i >= langkah.length - 1) return henti();
    const jeda = Math.min(langkah[i + 1].t - langkah[i].t, 2500); // jeda panjang dipersingkat
    i++;
    jalan = setTimeout(() => {
      gambar();
      maju();
    }, Math.max(15, jeda / kecepatan));
  };
  tombol.addEventListener("click", () => {
    if (jalan) return henti();
    if (i >= langkah.length - 1) i = 0;
    tombol.textContent = "Jeda";
    gambar();
    maju();
  });
  selCepat.addEventListener("change", () => (kecepatan = Number(selCepat.value)));
  slider.addEventListener("input", () => {
    henti();
    i = Number(slider.value);
    gambar();
  });
  dlg.addEventListener("close", henti);
  dlg.replaceChildren(judul, info, h("div", { class: "filters" }, tombol, selCepat, slider, jam), layar, h("p", { class: "muted" }, "Jeda panjang dipersingkat saat diputar. Perhatikan: ditulis lurus dari atas ke bawah tanpa koreksi, atau kembali memperbaiki dan menjalankan di tengah jalan?"), h("div", { class: "actions" }, tutup));
  gambar();
}
