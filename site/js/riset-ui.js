// Bagian "Riset" di dashboard instruktur: ringkasan kohort perilaku belajar dan ekspor data anonim untuk penelitian.
// Hanya peserta yang menyatakan setuju (di Profil) yang ikut dihitung dan diekspor. Perhitungannya ada di riset.js.
import { h } from "./dom.js";
import * as Auth from "./auth.js";
import { ambilSemua } from "./rekap.js";
import { ambilRingan } from "./jejak-ui.js";
import * as R from "./riset.js";
import { teksTanggal, jamWib } from "./kehadiran.js";

let cacheLog = null; // { cid, baris }
const ui = { kode: false, rekaman: false, angkatan: false, pesan: "", sibuk: false };

export function reset() {
  cacheLog = null;
}

const stat = (angka, label) => h("div", { class: "d-stat" }, h("strong", {}, String(angka)), h("span", { class: "muted" }, label));
const info = (teks) => h("p", { class: "kh-info" }, teks);
const batang = (label, nilai, maks, ket, kelas = "") => h("div", { class: "rs-bar" }, h("span", {}, label), h("div", { class: "rs-t", role: "img", "aria-label": label + " " + ket }, h("i", { class: kelas, style: "width:" + (maks > 0 ? Math.round((nilai / maks) * 100) : 0) + "%" })), h("span", { class: "muted rs-n" }, ket));

function unduhBerkas(nama, isi, tipe) {
  const blob = new Blob(["﻿" + isi], { type: tipe });
  const a = h("a", { href: URL.createObjectURL(blob), download: nama });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

async function muatLog(cid) {
  if (cacheLog && cacheLog.cid === cid) return cacheLog.baris;
  try {
    const baris = await ambilSemua(() => Auth.getClient().from("riset_ekspor_log").select("*").eq("matakuliah_id", cid).order("id"));
    cacheLog = { cid, baris };
    return baris;
  } catch (e) {
    return [];
  }
}

export async function render({ main, kepala, kuliah, peserta, progres = [] }) {
  if (!peserta) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "verdict fail" }, "Data peserta belum termuat. Tekan Muat ulang.")));
    return;
  }
  const risetAda = peserta.some((p) => p.riset_setuju !== undefined);
  if (!risetAda) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("h3", {}, "Riset"), h("p", { class: "kh-peringatan" }, "Fitur riset belum dipasang di database. Jalankan supabase/migrations/0007_riset_perilaku.sql di Supabase SQL Editor, lalu tekan Muat ulang. Tab lain tidak terpengaruh.")));
    return;
  }
  main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "muted" }, "Memuat data riset")));
  let data;
  try {
    data = await ambilRingan(kuliah.id);
  } catch (e) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("p", { class: "verdict fail" }, Auth.friendly(e))));
    return;
  }
  if (!data.risetAda) {
    main.replaceChildren(kepala, h("section", { class: "card" }, h("h3", {}, "Riset"), h("p", { class: "kh-peringatan" }, "Fitur riset belum dipasang di database. Jalankan supabase/migrations/0007_riset_perilaku.sql di Supabase SQL Editor, lalu tekan Muat ulang. Tab lain tidak terpengaruh.")));
    return;
  }
  const log = await muatLog(kuliah.id);
  const ulang = () => render({ main, kepala, kuliah, peserta, progres });
  const st = R.statusPersetujuan(peserta);
  const pesertaLayak = peserta.filter(R.layak);
  const k = R.ringkasKohort({ peserta, percobaan: data.percobaan, progres });
  const maksBab = Math.max(1, ...k.perBab.map((b) => b.median || 0));

  const persetujuan = h("section", { class: "card" },
    h("h3", {}, "Persetujuan penelitian"),
    h("div", { class: "d-stats" }, stat(st.setuju, "menyetujui"), stat(st.tidak, "tidak menyetujui"), stat(st.belum, "belum menjawab"), stat(pesertaLayak.length, "ikut dalam data riset")),
    info("Peserta menjawab di halaman Profil dan lewat pertanyaan saat membuka bab. Hanya yang menyetujui ikut di tab ini dan di ekspor; yang tidak menyetujui atau belum menjawab tidak pernah ikut, dan menolak tidak berpengaruh pada nilai atau akses. Pastikan izin etik institusimu sudah ada sebelum data dipakai untuk paper.")
  );

  const kohort = h("section", { class: "card" },
    h("h3", {}, "Kohort"),
    k.nBaris === 0
      ? h("p", { class: "muted" }, "Belum ada data dari peserta yang menyetujui. Tab ini terisi setelah ada peserta yang setuju dan mengerjakan latihan.")
      : h("div", {},
          h("div", { class: "d-stats" }, stat(k.nPeserta, "peserta dengan data"), stat(k.nBaris, "baris tercatat"), stat(k.nGalat, "galat saat menjalankan"), stat(k.kirimGagal, "Kirim gagal (kasus uji)"), k.lulusLangsung !== null ? stat(k.lulusLangsung + "%", "bab lulus tanpa petunjuk") : null),
          h("div", { class: "rs-dua" },
            h("div", {}, h("h4", {}, "Jenis galat saat menjalankan"), k.galat.length ? k.galat.map((g) => batang(g.nama, g.n, k.galat[0].n, g.persen + "% (" + g.n + ")", "rs-galat")) : h("p", { class: "muted" }, "Belum ada galat tercatat."), k.galatJenis.length ? h("p", { class: "muted" }, "Paling sering: " + k.galatJenis.slice(0, 5).map((g) => g.nama + " (" + g.n + ")").join(", ") + ".") : null),
            h("div", {}, h("h4", {}, "Kirim sampai lulus pertama, per bab (median)"), k.perBab.map((b) => batang("Bab " + b.bab, b.median || 0, maksBab, b.median === null ? "belum ada yang lulus" : b.median + " kali (" + b.lulus + " lulus" + (b.belum ? ", " + b.belum + " belum" : "") + ")", "rs-bab")))
          ),
          h("h4", {}, "Saat tersangkut"),
          k.tersangkut.n
            ? h("div", {}, h("p", { class: "muted" }, k.tersangkut.n + " kasus (peserta dan bab) butuh tiga kali Kirim atau lebih untuk lulus. Dari kasus itu:"), batang("Membuka petunjuk", k.tersangkut.petunjuk, 100, k.tersangkut.petunjuk + "%", "rs-lain"), batang("Menghapus banyak dan menulis ulang", k.tersangkut.hapus, 100, k.tersangkut.hapus + "%", "rs-lain"), batang("Kembali di hari lain (jeda lebih dari 6 jam)", k.tersangkut.kembali, 100, k.tersangkut.kembali + "%", "rs-lain"))
            : h("p", { class: "muted" }, "Belum ada kasus tersangkut."),
          info("Buka buku atau video belum tercatat per kejadian, jadi tidak muncul sebagai perilaku saat tersangkut. Angka di sini deskriptif, bukan hubungan sebab akibat. Hati-hati menyimpulkan dari kohort kecil.")
        )
  );

  // ---- ekspor ----
  const cek = (kunci, label) => h("label", { class: "rs-cek" }, h("input", { type: "checkbox", checked: ui[kunci] ? "" : false, onchange: (e) => { ui[kunci] = e.target.checked; ui.pesan = ""; ulang(); } }), " " + label);
  const pratinjau = R.bangunEkspor({ peserta, percobaan: data.percobaan, opsi: { angkatan: ui.angkatan } });
  const buat = async () => {
    // Kode dan rekaman berat, jadi baru dimuat saat dipilih dan hanya untuk peserta yang menyetujui.
    let percobaan = data.percobaan;
    if (ui.kode || ui.rekaman) {
      const c = Auth.getClient();
      const berat = new Map();
      for (const p of pesertaLayak) {
        const baris = await ambilSemua(() => c.from("percobaan").select("id,kode,rekaman").eq("matakuliah_id", kuliah.id).eq("user_id", p.id).order("id"));
        for (const b of baris) berat.set(b.id, b);
      }
      percobaan = data.percobaan.map((r) => Object.assign({}, r, berat.get(r.id) || {}));
    }
    return R.bangunEkspor({ peserta, percobaan, opsi: { angkatan: ui.angkatan, kode: ui.kode, rekaman: ui.rekaman } });
  };
  const unduhKe = async (jenis) => {
    if (ui.sibuk) return;
    ui.sibuk = true;
    ui.pesan = "Menyiapkan data";
    ulang();
    try {
      const e = await buat();
      if (!e.nBaris) {
        ui.pesan = "Belum ada data dari peserta yang menyetujui.";
        return;
      }
      const stempel = new Date().toISOString().slice(0, 10);
      const dasar = "riset-" + kuliah.id + "-" + stempel;
      if (jenis === "csv") unduhBerkas(dasar + ".csv", R.csvEkspor(e), "text/csv;charset=utf-8");
      if (jenis === "json") unduhBerkas(dasar + ".json", R.jsonEkspor(e), "application/json");
      if (jenis === "kamus") unduhBerkas("kamus-data-" + kuliah.id + "-" + stempel + ".txt", R.kamusData(e, { mataKuliah: kuliah.nama, dibuat: stempel }), "text/plain;charset=utf-8");
      const { error } = await Auth.getClient().from("riset_ekspor_log").insert({ matakuliah_id: kuliah.id, oleh: Auth.getUserId(), jumlah_peserta: e.nPeserta, jumlah_baris: e.nBaris, opsi: { format: jenis, angkatan: ui.angkatan, kode: ui.kode, rekaman: ui.rekaman } });
      cacheLog = null;
      ui.pesan = error ? "Unduhan selesai, tetapi catatan ekspor gagal disimpan: " + Auth.friendly(error) : "Selesai: " + e.nPeserta + " peserta, " + e.nBaris + " baris.";
    } catch (err) {
      ui.pesan = "Gagal menyiapkan data: " + Auth.friendly(err);
    } finally {
      ui.sibuk = false;
      ulang();
    }
  };
  const tombol = (teks, jenis) => h("button", { type: "button", class: "btn btn-sm", disabled: ui.sibuk ? "" : false, onclick: () => unduhKe(jenis) }, teks);
  const kolomPratinjau = pratinjau.kolom.map((c) => c.label);
  const ekspor = h("section", { class: "card" },
    h("h3", {}, "Ekspor data anonim"),
    h("p", { class: "kh-peringatan" }, "Sebelum mengekspor untuk penelitian: pastikan izin etik institusi dan persetujuan peserta sudah ada. Hanya peserta yang menyetujui yang ikut."),
    h("p", { class: "muted" }, "Identitas diganti kode acak (kode_riset). Nama, NIM, kelas, dan tanggal kalender tidak disertakan; waktu dinyatakan sebagai hari ke-n sejak awal data. Kunci pemetaan kode ke nama ada di kolom kode_riset tabel profiles dan hanya bisa dibaca akun instruktur."),
    h("div", { class: "rs-opsi" }, cek("angkatan", "sertakan angkatan"), cek("kode", "sertakan kode lengkap yang dijalankan (bisa memuat identitas bila peserta menuliskannya)"), cek("rekaman", "sertakan rekaman cara menulis (JSON, besar)")),
    h("p", { class: "muted" }, pratinjau.nPeserta + " peserta, " + pratinjau.nBaris + " baris" + (ui.kode || ui.rekaman ? " (kode atau rekaman dimuat saat diunduh)." : ".")),
    pratinjau.nBaris ? h("div", { class: "tablewrap" }, h("table", { class: "rekap rs-pratinjau" }, h("caption", { class: "sr-only" }, "Pratinjau ekspor"), h("thead", {}, h("tr", {}, kolomPratinjau.map((t) => h("th", { scope: "col" }, t)))), h("tbody", {}, pratinjau.baris.slice(0, 5).map((b) => h("tr", {}, b.map((v) => h("td", {}, v === "" ? "-" : String(v)))))))) : null,
    h("div", { class: "actions" }, tombol("Unduh CSV", "csv"), tombol("Unduh JSON", "json"), tombol("Unduh kamus data", "kamus")),
    h("p", { class: "form-msg", role: "status", "aria-live": "polite" }, ui.pesan),
    h("h4", {}, "Riwayat ekspor"),
    log.length ? h("div", { class: "kh-daftar" }, log.slice().reverse().slice(0, 10).map((l) => h("div", { class: "kh-rw" }, h("span", { class: "muted" }, teksTanggal(Date.parse(l.dibuat_pada) || 0) + " " + jamWib(Date.parse(l.dibuat_pada) || 0)), h("span", {}, l.jumlah_peserta + " peserta, " + l.jumlah_baris + " baris" + (l.opsi && l.opsi.format ? ", " + String(l.opsi.format).toUpperCase() : "") + (l.opsi && l.opsi.kode ? ", dengan kode" : "") + (l.opsi && l.opsi.rekaman ? ", dengan rekaman" : ""))))) : h("p", { class: "muted" }, "Belum pernah mengekspor.")
  );
  main.replaceChildren(kepala, persetujuan, kohort, ekspor);
}
