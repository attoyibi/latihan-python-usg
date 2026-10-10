// Kartu Praktik di halaman bab: mengecil secara default. Berisi Bagian A (terbimbing: lengkapi bagian ____) dan, di bab yang punya,
// Bagian B (kembangkan: memperluas program dasar tanpa ____). Logika murni ada di praktik.js, penyimpanan dan sinkron di praktik-data.js.
//
// ctx = { store, kuliah: {id, nama, bahasa}, instruktur(): boolean, perbaruiTanda(): void }
// Praktik wajib untuk melengkapi bab, tetapi tidak mengunci apa pun: kedua bagian boleh dibuka kapan saja dan tanpa urutan.
// Titik di lingkaran status bab hijau hanya bila Bagian A dan B (bila ada) sama-sama lulus.
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
// Contoh jawaban instruktur di tabel kunci_jawaban: Bagian A bernomor 50 + bab, Bagian B bernomor 70 + bab.
export const nomorKunci = (bab, bagian) => (bagian === "B" ? 70 : 50) + bab;

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

/**
 * Satu bagian praktik (editor, Jalankan, Periksa, petunjuk).
 * @param {"A"|"B"} bagian  @param {object} d definisi bagian itu (Bagian A: definisi praktik; Bagian B: def.bagianB)
 * @param {() => void} saatStatus dipanggil bila status bagian ini berubah
 */
function bangunBagian(ctx, def, bagian, d, saatStatus) {
  const mk = ctx.kuliah.id;
  const bab = def.bab;
  const instruktur = ctx.instruktur();
  const java = ctx.kuliah.bahasa === "java";
  const jalankanProyek = java ? runProyekJava : runProyek;
  const bisaJalan = java || d.kasus.some((k) => k.jalankan);
  const sfx = bab + bagian;
  const kunciHint = (bagian === "B" ? "pk-hintB:" : "pk-hint:") + mk + ":" + bab;
  let s = D.bacaLokal(ctx.store, mk, bab, bagian);
  let ed = null;
  let kotor = false; // peserta sudah mengetik di sesi ini: penyusulan dari server tidak boleh menimpa
  const simpan = () => D.simpanLokal(ctx.store, mk, bab, s, bagian);

  const statusChip = h("span", { class: "pk-status" });
  const segarStatus = () => {
    const st = P.statusDari(s);
    statusChip.textContent = P.STATUS[st];
    statusChip.className = "pk-status pk-st-" + st;
  };
  segarStatus();

  const langkah = h("ol", { class: "pk-langkah" }, d.langkah.map((t) => h("li", {}, t)));
  const petunjuk = d.petunjuk || [];
  const hintBox = h("div", {});
  let hintTampil = Number(ctx.store.get(kunciHint, 0)) || 0;
  const hintBtn = h("button", { type: "button", class: "btn btn-sm" });
  const gambarHint = () => {
    hintBox.replaceChildren(...petunjuk.slice(0, hintTampil).map((p, i) => h("div", { class: "hint" }, h("strong", {}, (p.jenis === "buku" ? "Baca di buku" : "Petunjuk " + (i + 1)) + ": "), p.isi)));
    hintBtn.textContent = hintTampil >= petunjuk.length ? "Semua petunjuk sudah dibuka" : "Butuh petunjuk? (" + hintTampil + " dari " + petunjuk.length + ")";
    hintBtn.disabled = hintTampil >= petunjuk.length;
  };
  hintBtn.addEventListener("click", () => {
    hintTampil++;
    ctx.store.set(kunciHint, hintTampil);
    gambarHint();
  });
  gambarHint();

  const holder = h("div", { class: "pk-editor" });
  const stdin = h("textarea", { class: "input pk-masukan", id: "pk-masukan-" + sfx, rows: "2", "aria-label": "Masukan untuk program", spellcheck: "false", placeholder: java ? "Masukan untuk Scanner, satu baris per pertanyaan (boleh kosong)" : "Masukan untuk input(), satu baris per pertanyaan" });
  stdin.value = d.masukanContoh || "";
  const keluaran = h("pre", { class: "pk-keluaran", "aria-live": "polite", tabindex: "0" }, "Keluaran program akan tampil di sini.");
  const hasilBox = h("div", { class: "pk-hasil", "aria-live": "polite" });
  const jalanBtn = h("button", { type: "button", class: "btn" }, "Jalankan");
  const periksaBtn = h("button", { type: "button", class: "btn btn-primary" }, bagian === "B" ? "Periksa Bagian B" : "Periksa praktik");
  const labelPeriksa = periksaBtn.textContent;
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
    if (s.status === "belum" && isi !== d.awal) {
      s.status = "sedang";
      s.pertama_dibuka = s.pertama_dibuka || s.t;
    }
    simpan();
    if (s.status !== sebelum) {
      segarStatus();
      saatStatus();
    }
    clearTimeout(timerTulis);
    timerTulis = setTimeout(() => D.sinkronkan(mk, bab, bagian, d, s), 400);
  };
  const jaga = { kecualikan: () => instruktur, saatTempel: () => Sinkron.aktivitas(mk, bab, "tempel_diblokir", { lokasi: bagian === "B" ? "praktik-b" : "praktik" }) };
  const siapkanEditor = () => {
    if (ed) return;
    ed = pasangEditor(holder, s.isi !== null ? s.isi : d.awal, saatUbah, jaga, java);
  };
  const isiSaatIni = () => (ed ? ed.nilai() : s.isi !== null ? s.isi : d.awal);

  jalanBtn.addEventListener("click", async () => {
    if (sibuk) return;
    atur(true);
    jalanBtn.textContent = "Menjalankan";
    keluaran.textContent = "";
    try {
      const r = await jalankanProyek({ [d.berkas]: isiSaatIni() }, { aksi: "jalankan", entri: d.berkas, masukan: stdin.value ? stdin.value.split("\n") : [] });
      let teks;
      if (r.timeout) teks = "Program berjalan terlalu lama dan dihentikan. Periksa perulangan tanpa akhir atau input() yang menunggu masukan.";
      else if (r.error) teks = r.error;
      else if (!r.proyek) teks = "Tidak ada hasil.";
      else teks = (r.proyek.keluaran || "") + (r.proyek.galat ? (r.proyek.keluaran ? "\n" : "") + r.proyek.galat : "") || (bisaJalan ? "(program selesai tanpa keluaran)" : "(selesai; praktik ini diuji lewat tombol Periksa, bukan lewat keluaran)");
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
      const r = await jalankanProyek({ [d.berkas]: isi }, { aksi: "kasus", kasus: d.kasus });
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
      D.sinkronkan(mk, bab, bagian, d, s, { hasil: P.hasilUntukRiwayat(ring), lulus: ring.lulus });
      segarStatus();
      saatStatus();
      hasilBox.replaceChildren(
        h("p", { class: "pk-ringkas" + (ring.lulus ? " ok" : "") }, ring.lulus ? "Lulus: " + ring.benar + " dari " + ring.total + " pemeriksaan benar." : "Belum lulus: " + ring.benar + " dari " + ring.total + " pemeriksaan benar. Perbaiki lalu periksa lagi; tidak ada batas percobaan."),
        h("ul", { class: "pk-kasus" }, ring.tampil.map((c) => h("li", { class: c.lulus ? "ok" : "gagal" }, h("span", { "aria-hidden": "true" }, c.lulus ? "✓ " : "✗ "), h("strong", {}, c.nama), c.lulus || !c.pesan ? null : h("pre", { class: "pk-pesan" }, c.pesan))))
      );
    } finally {
      periksaBtn.textContent = labelPeriksa;
      atur(false);
    }
  });

  const kembaliBtn = tombolKonfirmasi("Kembalikan kerangka", "Kodemu diganti dengan kerangka awal. Perubahanmu hilang. Lanjutkan?", () => {
    siapkanEditor();
    ed.setNilai(d.awal);
    saatUbah(d.awal);
    pesan.textContent = "Kerangka awal dikembalikan.";
  });
  // Khusus instruktur: contoh jawaban diambil dari tabel kunci_jawaban; tidak ada di situs.
  const kunciBtn = instruktur ? h("button", { type: "button", class: "btn", title: "Khusus instruktur: isi contoh jawaban lalu periksa" }, "Isi kunci (instruktur)") : null;
  if (kunciBtn)
    kunciBtn.addEventListener("click", async () => {
      kunciBtn.disabled = true;
      const k = await ambilKunci(mk, nomorKunci(bab, bagian));
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

  const el = h(
    "div",
    { class: "praktik-bagian", "data-bagian": bagian },
    bagian === "B" || def.bagianB ? h("div", { class: "praktik-bagian-kepala" }, h("h4", {}, bagian === "B" ? "Bagian B: " + d.judul : "Bagian A: terbimbing"), statusChip) : null,
    h("p", {}, d.tujuan),
    h("h4", {}, "Langkah"),
    langkah,
    h("p", { class: "muted" }, "Berkas: " + d.berkas),
    holder,
    bisaJalan ? h("label", { for: "pk-masukan-" + sfx, class: "muted" }, java ? "Masukan untuk tombol Jalankan (satu baris untuk setiap pembacaan Scanner)" : "Masukan untuk tombol Jalankan (satu baris untuk setiap input)") : null,
    bisaJalan ? stdin : null,
    h("div", { class: "actions" }, jalanBtn, periksaBtn, kembaliBtn, kunciBtn),
    keluaran,
    pesan,
    hasilBox,
    h("div", { class: "actions" }, hintBtn),
    hintBox
  );
  // Tanpa Bagian B, chip status ada di kepala kartu (bukan di bagian ini).
  return {
    el,
    status: () => P.statusDari(s),
    chip: statusChip,
    buka: () => {
      siapkanEditor();
      ed.segarkan();
    },
    jaga,
    /** Dipanggil setelah data server digabung ke lokal; tidak menimpa bila peserta sudah mengetik. */
    muatUlang: () => {
      if (kotor) return;
      s = D.bacaLokal(ctx.store, mk, bab, bagian);
      segarStatus();
      if (ed && s.isi !== null && ed.nilai() !== s.isi) ed.setNilai(s.isi);
    },
  };
}

/** Kartu Praktik untuk satu bab. @param {object} def isi praktik/bab-NN.json (boleh memuat bagianB) */
export function kartuPraktik(ctx, def) {
  const mk = ctx.kuliah.id;
  const bab = def.bab;
  const instruktur = ctx.instruktur();
  const kunciBuka = "pk-buka:" + mk + ":" + bab;
  let buka = !!ctx.store.get(kunciBuka, false);

  const statusChip = h("span", { class: "pk-status" });
  let blokA = null;
  let blokB = null;
  const segarGabungan = () => {
    const st = P.statusGabungan(!!def.bagianB, blokA.status(), blokB ? blokB.status() : "belum");
    statusChip.textContent = P.STATUS[st];
    statusChip.className = "pk-status pk-st-" + st;
  };
  const saatStatus = () => {
    segarGabungan();
    ctx.perbaruiTanda();
  };
  blokA = bangunBagian(ctx, def, "A", def, saatStatus);
  blokB = def.bagianB ? bangunBagian(ctx, def, "B", def.bagianB, saatStatus) : null;
  segarGabungan();

  const ubah = h("span", { class: "praktik-ubah" }, buka ? "Tutup" : "Buka");
  const kepala = h("button", { type: "button", class: "praktik-kepala", "aria-expanded": String(buka), "aria-controls": "praktik-isi-" + bab }, h("span", { class: "eyebrow" }, "Praktik"), h("strong", {}, def.judul), statusChip, ubah);
  const isi = h(
    "div",
    { class: "praktik-isi", id: "praktik-isi-" + bab, hidden: !buka },
    h("p", { class: "muted" }, "Praktik dikerjakan di kelas atau sesudahnya." + (blokB ? " Bagian A dan Bagian B sama-sama diperiksa; titik hijau di bab ini muncul setelah keduanya lulus, dan urutannya bebas." : "") + " Salin dan tempel dimatikan; jumlah percobaan tempel dicatat (isinya tidak). Pekerjaanmu tersimpan otomatis."),
    blokA.el,
    blokB ? blokB.el : null
  );
  const kartu = h("section", { class: "card praktik-kartu", "aria-label": "Praktik" }, kepala, isi);
  const pasang = () => {
    kepala.setAttribute("aria-expanded", String(buka));
    ubah.textContent = buka ? "Tutup" : "Buka";
    isi.hidden = !buka;
    kartu.classList.toggle("buka", buka);
    if (buka) {
      blokA.buka();
      if (blokB) blokB.buka();
    }
  };
  kepala.addEventListener("click", () => {
    buka = !buka;
    ctx.store.set(kunciBuka, buka);
    pasang();
  });
  pasang();
  Anticopas.blokirSalinTempel(kartu, { lokasi: "praktik", kecualikan: () => instruktur, saatTempel: blokA.jaga.saatTempel });

  // pekerjaan di server (mis. dikerjakan di perangkat lain)
  D.susulPraktik(ctx.store, mk, bab, def).then((berubah) => {
    if (!berubah) return;
    blokA.muatUlang();
    if (blokB) blokB.muatUlang();
    segarGabungan();
    ctx.perbaruiTanda();
  });
  return kartu;
}
