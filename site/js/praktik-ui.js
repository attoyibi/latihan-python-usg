// Kartu Praktik di halaman bab: mengecil secara default, satu berkas, kerangka dengan bagian ____ yang harus dilengkapi.
// Logika murni ada di praktik.js, penyimpanan dan sinkron di praktik-data.js.
//
// ctx = { store, kuliah: {id, nama}, instruktur(): boolean, perbaruiTanda(): void }
// Praktik wajib untuk melengkapi bab, tetapi tidak mengunci apa pun: boleh dibuka kapan saja dan dikerjakan tanpa urutan.
import { h } from "./dom.js";
import * as Anticopas from "./anticopas.js";
import * as Sinkron from "./sinkron.js";
import { runProyek } from "./runner.js";
import { runProyekJava } from "./javarunner.js";
import { ambilKunci } from "./kunci.js";
import * as P from "./praktik.js";
import * as D from "./praktik-data.js";

export const NAMA_STATUS = P.STATUS;
export const statusLokal = D.statusLokal;

const sekarang = () => new Date().toISOString();
/** Penanda kecil di sudut lingkaran status bab: kosong, setengah, atau penuh. */
export const titikPraktik = (status) => h("span", { class: "pm" + (status === "belum" ? "" : " " + status), "aria-hidden": "true" });

function tombolKonfirmasi(label, tanya, aksi) {
  const kotak = h("span", { class: "pk-konfirmasi" });
  const awal = () => {
    const b = h("button", { type: "button", class: "btn" }, label);
    b.addEventListener("click", () => {
      const ya = h("button", { type: "button", class: "btn btn-primary" }, "Ya, lanjutkan");
      const batal = h("button", { type: "button", class: "btn" }, "Batal");
      ya.addEventListener("click", () => {
        kotak.replaceChildren(awal());
        aksi();
      });
      batal.addEventListener("click", () => kotak.replaceChildren(awal()));
      kotak.replaceChildren(h("span", { class: "pk-tanya" }, tanya), ya, batal);
      ya.focus();
    });
    return b;
  };
  kotak.replaceChildren(awal());
  return kotak;
}

function pasangEditor(holder, isi, saatUbah, jaga, java) {
  if (typeof CodeMirror === "undefined") {
    const ta = h("textarea", { class: "input pk-teks", rows: "14", spellcheck: "false", "aria-label": "Kode praktik" });
    ta.value = isi;
    ta.addEventListener("input", () => saatUbah(ta.value));
    ta.addEventListener("paste", (e) => {
      if (jaga.kecualikan()) return;
      e.preventDefault();
      jaga.saatTempel();
      Anticopas.tampilkanPesan();
    });
    holder.append(ta);
    return { nilai: () => ta.value, setNilai: (v) => (ta.value = v), segarkan() {} };
  }
  const cm = CodeMirror(holder, {
    value: isi,
    mode: java ? "text/x-java" : "python",
    lineNumbers: true,
    lineWrapping: typeof matchMedia !== "undefined" && matchMedia("(max-width: 900px)").matches,
    indentUnit: 4,
    indentWithTabs: false,
    extraKeys: { Tab: (c) => c.replaceSelection("    ", "end") },
  });
  Anticopas.blokirDiCodeMirror(cm, jaga);
  cm.on("change", (c, ch) => {
    if (ch.origin !== "setValue") saatUbah(cm.getValue());
  });
  return { nilai: () => cm.getValue(), setNilai: (v) => cm.setValue(v), segarkan: () => cm.refresh() };
}

/** Kartu Praktik untuk satu bab. @param {object} def isi praktik/bab-NN.json */
export function kartuPraktik(ctx, def) {
  const mk = ctx.kuliah.id;
  const bab = def.bab;
  const instruktur = ctx.instruktur();
  let s = D.bacaLokal(ctx.store, mk, bab);
  const kunciBuka = "pk-buka:" + mk + ":" + bab;
  const kunciHint = "pk-hint:" + mk + ":" + bab;
  let buka = !!ctx.store.get(kunciBuka, false);
  let ed = null;
  let kotor = false; // peserta sudah mengetik di sesi ini: penyusulan dari server tidak boleh menimpa
  const simpan = () => D.simpanLokal(ctx.store, mk, bab, s);
  const java = ctx.kuliah.bahasa === "java";
  const jalankanProyek = java ? runProyekJava : runProyek;
  const bisaJalan = java || def.kasus.some((k) => k.jalankan);

  const statusChip = h("span", { class: "pk-status" });
  const segarStatus = () => {
    const st = P.statusDari(s);
    statusChip.textContent = P.STATUS[st];
    statusChip.className = "pk-status pk-st-" + st;
  };
  segarStatus();

  const ubah = h("span", { class: "praktik-ubah" }, buka ? "Tutup" : "Buka");
  const kepala = h("button", { type: "button", class: "praktik-kepala", "aria-expanded": String(buka), "aria-controls": "praktik-isi-" + bab }, h("span", { class: "eyebrow" }, "Praktik"), h("strong", {}, def.judul), statusChip, ubah);

  // ----- isi -----
  const langkah = h("ol", { class: "pk-langkah" }, def.langkah.map((t) => h("li", {}, t)));
  const hintBox = h("div", {});
  let hintTampil = Number(ctx.store.get(kunciHint, 0)) || 0;
  const hintBtn = h("button", { type: "button", class: "btn btn-sm" });
  const gambarHint = () => {
    hintBox.replaceChildren(...def.petunjuk.slice(0, hintTampil).map((p, i) => h("div", { class: "hint" }, h("strong", {}, (p.jenis === "buku" ? "Baca di buku" : "Petunjuk " + (i + 1)) + ": "), p.isi)));
    hintBtn.textContent = hintTampil >= def.petunjuk.length ? "Semua petunjuk sudah dibuka" : "Butuh petunjuk? (" + hintTampil + " dari " + def.petunjuk.length + ")";
    hintBtn.disabled = hintTampil >= def.petunjuk.length;
  };
  hintBtn.addEventListener("click", () => {
    hintTampil++;
    ctx.store.set(kunciHint, hintTampil);
    gambarHint();
  });
  gambarHint();

  const holder = h("div", { class: "pk-editor" });
  const stdin = h("textarea", { class: "input pk-masukan", rows: "2", "aria-label": "Masukan untuk program", spellcheck: "false", placeholder: java ? "Masukan untuk Scanner, satu baris per pertanyaan (boleh kosong)" : "Masukan untuk input(), satu baris per pertanyaan" });
  stdin.value = def.masukanContoh || "";
  const keluaran = h("pre", { class: "pk-keluaran", "aria-live": "polite", tabindex: "0" }, "Keluaran program akan tampil di sini.");
  const hasilBox = h("div", { class: "pk-hasil", "aria-live": "polite" });
  const jalanBtn = h("button", { type: "button", class: "btn" }, "Jalankan");
  const periksaBtn = h("button", { type: "button", class: "btn btn-primary" }, "Periksa praktik");
  const pesan = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  let sibuk = false;
  const atur = (b) => {
    sibuk = b;
    jalanBtn.disabled = b;
    periksaBtn.disabled = b;
  };

  let timerTulis = null;
  const saatUbah = (isi) => {
    kotor = true;
    s.isi = isi;
    s.t = sekarang();
    const sebelum = s.status;
    if (s.status === "belum" && isi !== def.awal) {
      s.status = "sedang";
      s.pertama_dibuka = s.pertama_dibuka || s.t;
    }
    simpan();
    if (s.status !== sebelum) {
      segarStatus();
      ctx.perbaruiTanda();
    }
    clearTimeout(timerTulis);
    timerTulis = setTimeout(() => D.sinkronkan(mk, bab, def, s), 400);
  };
  const jaga = { kecualikan: () => instruktur, saatTempel: () => Sinkron.aktivitas(mk, bab, "tempel_diblokir", { lokasi: "praktik" }) };
  const siapkanEditor = () => {
    if (ed) return;
    ed = pasangEditor(holder, s.isi !== null ? s.isi : def.awal, saatUbah, jaga, java);
  };
  const isiSaatIni = () => (ed ? ed.nilai() : s.isi !== null ? s.isi : def.awal);

  jalanBtn.addEventListener("click", async () => {
    if (sibuk) return;
    atur(true);
    jalanBtn.textContent = "Menjalankan";
    keluaran.textContent = "";
    try {
      const r = await jalankanProyek({ [def.berkas]: isiSaatIni() }, { aksi: "jalankan", entri: def.berkas, masukan: stdin.value ? stdin.value.split("\n") : [] });
      let teks;
      if (r.timeout) teks = "Program berjalan terlalu lama dan dihentikan. Periksa perulangan tanpa akhir atau input() yang menunggu masukan.";
      else if (r.error) teks = r.error;
      else if (!r.proyek) teks = "Tidak ada hasil.";
      else teks = (r.proyek.keluaran || "") + (r.proyek.galat ? (r.proyek.keluaran ? "\n" : "") + r.proyek.galat : "") || (bisaJalan ? "(program selesai tanpa keluaran)" : "(selesai; praktik ini diuji lewat Periksa praktik, bukan lewat keluaran)");
      keluaran.textContent = teks;
      keluaran.classList.toggle("pk-galat", !!(r.error || r.timeout || (r.proyek && r.proyek.galat)));
    } finally {
      jalanBtn.textContent = "Jalankan";
      atur(false);
    }
  });

  periksaBtn.addEventListener("click", async () => {
    if (sibuk) return;
    atur(true);
    periksaBtn.textContent = "Memeriksa";
    hasilBox.replaceChildren();
    try {
      const isi = isiSaatIni();
      const r = await jalankanProyek({ [def.berkas]: isi }, { aksi: "kasus", kasus: def.kasus });
      if (r.timeout || r.error || !r.proyek) {
        hasilBox.replaceChildren(h("p", { class: "form-msg" }, r.timeout ? "Pemeriksaan berjalan terlalu lama dan dihentikan. Periksa perulangan tanpa akhir atau input() yang menunggu masukan." : r.error || "Pemeriksaan tidak menghasilkan apa-apa. Coba lagi."));
        return;
      }
      const ring = P.ringkasHasil(r.proyek.kasus || []);
      const t = sekarang();
      s.isi = isi;
      s.t = t;
      s.jumlah_kirim = (s.jumlah_kirim || 0) + 1;
      s.pertama_dibuka = s.pertama_dibuka || t;
      if (ring.lulus && s.status !== "lulus") {
        s.status = "lulus";
        s.lulus_pada = t;
      } else if (s.status === "belum") s.status = "sedang";
      s.riwayat = [{ t, lulus: ring.lulus, benar: ring.benar, total: ring.total }, ...(s.riwayat || [])].slice(0, 20);
      simpan();
      D.sinkronkan(mk, bab, def, s, { hasil: P.hasilUntukRiwayat(ring), lulus: ring.lulus });
      segarStatus();
      ctx.perbaruiTanda();
      hasilBox.replaceChildren(
        h("p", { class: "pk-ringkas" + (ring.lulus ? " ok" : "") }, ring.lulus ? "Lulus: " + ring.benar + " dari " + ring.total + " pemeriksaan benar." : "Belum lulus: " + ring.benar + " dari " + ring.total + " pemeriksaan benar. Perbaiki lalu periksa lagi; tidak ada batas percobaan."),
        h("ul", { class: "pk-kasus" }, ring.tampil.map((c) => h("li", { class: c.lulus ? "ok" : "gagal" }, h("span", { "aria-hidden": "true" }, c.lulus ? "✓ " : "✗ "), h("strong", {}, c.nama), c.lulus || !c.pesan ? null : h("pre", { class: "pk-pesan" }, c.pesan))))
      );
    } finally {
      periksaBtn.textContent = "Periksa praktik";
      atur(false);
    }
  });

  const kembaliBtn = tombolKonfirmasi("Kembalikan kerangka", "Kodemu diganti dengan kerangka awal. Perubahanmu hilang. Lanjutkan?", () => {
    siapkanEditor();
    ed.setNilai(def.awal);
    saatUbah(def.awal);
    pesan.textContent = "Kerangka awal dikembalikan.";
  });
  // Khusus instruktur: contoh jawaban diambil dari tabel kunci_jawaban (nomor 50 + bab); tidak ada di situs.
  const kunciBtn = instruktur ? h("button", { type: "button", class: "btn", title: "Khusus instruktur: isi contoh jawaban lalu periksa" }, "Isi kunci (instruktur)") : null;
  if (kunciBtn)
    kunciBtn.addEventListener("click", async () => {
      kunciBtn.disabled = true;
      const k = await ambilKunci(mk, 50 + bab);
      kunciBtn.disabled = false;
      if (k.galat) {
        pesan.textContent = k.galat;
        return;
      }
      siapkanEditor();
      ed.setNilai(k.isi);
      saatUbah(k.isi);
      periksaBtn.click();
    });

  const isi = h(
    "div",
    { class: "praktik-isi", id: "praktik-isi-" + bab, hidden: !buka },
    h("p", {}, def.tujuan),
    h("p", { class: "muted" }, "Praktik dikerjakan di kelas atau sesudahnya. Salin dan tempel dimatikan; jumlah percobaan tempel dicatat (isinya tidak). Pekerjaanmu tersimpan otomatis."),
    h("h4", {}, "Langkah"),
    langkah,
    h("p", { class: "muted" }, "Berkas: " + def.berkas),
    holder,
    bisaJalan ? h("label", { for: "pk-masukan-" + bab, class: "muted" }, java ? "Masukan untuk tombol Jalankan (satu baris untuk setiap pembacaan Scanner)" : "Masukan untuk tombol Jalankan (satu baris untuk setiap input)") : null,
    bisaJalan ? stdin : null,
    h("div", { class: "actions" }, jalanBtn, periksaBtn, kembaliBtn, kunciBtn),
    keluaran,
    pesan,
    hasilBox,
    h("div", { class: "actions" }, hintBtn),
    hintBox
  );
  stdin.id = "pk-masukan-" + bab;

  const kartu = h("section", { class: "card praktik-kartu", "aria-label": "Praktik" }, kepala, isi);
  const pasang = () => {
    kepala.setAttribute("aria-expanded", String(buka));
    ubah.textContent = buka ? "Tutup" : "Buka";
    isi.hidden = !buka;
    kartu.classList.toggle("buka", buka);
    if (buka) {
      siapkanEditor();
      ed.segarkan();
    }
  };
  kepala.addEventListener("click", () => {
    buka = !buka;
    ctx.store.set(kunciBuka, buka);
    pasang();
  });
  pasang();
  Anticopas.blokirSalinTempel(kartu, { lokasi: "praktik", kecualikan: () => instruktur, saatTempel: jaga.saatTempel });

  // pekerjaan di server (mis. dikerjakan di perangkat lain)
  D.susulPraktik(ctx.store, mk, bab).then((berubah) => {
    if (!berubah || kotor) return;
    s = D.bacaLokal(ctx.store, mk, bab);
    segarStatus();
    if (ed && s.isi !== null && ed.nilai() !== s.isi) ed.setNilai(s.isi);
    ctx.perbaruiTanda();
  });
  return kartu;
}
