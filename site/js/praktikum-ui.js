// Tampilan praktikum: bagian di halaman mata kuliah, tanda dan pemberitahuan di bab, daftar tahap, dan halaman tahap dengan
// ruang kerja berkas. Logikanya ada di praktikum.js (murni) dan praktikum-data.js (simpan dan sinkron).
//
// ctx = { store, kuliah: {id, nama, bahasa}, instruktur(): boolean, ulang(): void (gambar ulang halaman) }
// Praktikum tidak pernah mengunci apa pun: tahap boleh dilewati dan dibuka urut apa saja, laporan dan ekspor selalu aktif.
import { h } from "./dom.js";
import * as Auth from "./auth.js";
import * as Anticopas from "./anticopas.js";
import { runProyek } from "./runner.js";
import { buatPdfBlok } from "./pdf.js";
import { kodeVerifikasiBaru, laporanKosong } from "./laporan.js";
import * as P from "./praktikum.js";
import * as D from "./praktikum-data.js";
import { runProyekJava } from "./javarunner.js";
import { analisisJava } from "./praktikum-java.js";
import * as Kunci from "./kunci.js";

const sekarang = () => new Date().toISOString();
const NAMA_STATUS = P.STATUS;
/** Menjalankan atau menguji proyek di penjalan yang sesuai bahasa praktikum (Python atau Java). */
const jalankanProyek = (pk, berkas, perintah) => (pk.bahasa === "java" ? runProyekJava(berkas, perintah) : runProyek(berkas, perintah));
const ekstensiKode = (pk) => P.berkasKode(pk.bahasa);
/** Nama status yang ditampilkan: tahap yang dinilai dosen disebut "Siap dinilai", bukan "Lulus". */
const namaStatus = (tahap, st) => (P.tanpaUji(tahap) && st === "lulus" ? "Siap dinilai" : NAMA_STATUS[st]);
const adaMain = (isi) => /\bstatic\s+void\s+main\s*\(/.test(String(isi || ""));
const babHref = (ctx, n) => "#k/" + ctx.kuliah.id + "/bab-" + n;
export const hrefPraktikum = (ctx, pid, tid) => "#k/" + ctx.kuliah.id + "/praktikum/" + pid + (tid ? "/" + tid : "");

function bar(selesai, total, label) {
  const pct = total ? Math.round((selesai / total) * 100) : 0;
  return h("div", { class: "pbar", role: "progressbar", "aria-valuenow": String(selesai), "aria-valuemin": "0", "aria-valuemax": String(total), "aria-label": label }, h("i", { style: "width:" + pct + "%" }));
}
const unduh = (blob, nama) => {
  const a = h("a", { href: URL.createObjectURL(blob), download: nama });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
};
/** Tombol dua langkah tanpa dialog bawaan browser: klik pertama menanyakan, klik kedua melakukan. */
function tombolKonfirmasi(label, tanya, aksi, kelas = "btn") {
  const kotak = h("span", { class: "pk-konfirmasi" });
  const awal = () => {
    const b = h("button", { type: "button", class: kelas }, label);
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

// ---------- pengelola pekerjaan (lokal dulu, lalu antrean ke server) ----------
const tahapBaru = () => ({ status: "belum", jalur: "web", jumlah_kirim: 0, pertama_dibuka: null, lulus_pada: null, pakai_contoh: false, centang: {} });
export function kelola(ctx, pk) {
  const mk = ctx.kuliah.id;
  const pid = pk.id;
  const kerja = D.bacaKerja(ctx.store, mk, pid);
  if (!Array.isArray(kerja.hapus)) kerja.hapus = [];
  const simpan = () => D.simpanKerja(ctx.store, mk, pid, kerja);
  const api = {
    kerja,
    mk,
    pid,
    peta: () => D.petaTahapLokal(kerja),
    isi: () => P.keIsi(kerja.berkas),
    baris: (tid) => kerja.tahap[tid] || tahapBaru(),
    ubahTahap(tid, patch) {
      const r = Object.assign(tahapBaru(), kerja.tahap[tid], patch);
      kerja.tahap[tid] = r;
      simpan();
      D.antreTahap(mk, pid, tid, r);
      return r;
    },
    tulis(nama, isi, asal = "milik", antre = true) {
      kerja.berkas[nama] = { isi, asal, t: sekarang() };
      kerja.hapus = kerja.hapus.filter((n) => n !== nama);
      simpan();
      if (antre) D.antreBerkas(mk, pid, nama, kerja.berkas[nama]);
    },
    hapus(nama) {
      delete kerja.berkas[nama];
      kerja.hapus = [...kerja.hapus.filter((n) => n !== nama), nama].slice(-50);
      simpan();
      D.antreHapusBerkas(mk, pid, nama);
    },
    ganti(berkasBaru) {
      // berkasBaru: peta nama -> {isi, asal}; tulis semua yang berubah
      for (const [n, b] of Object.entries(berkasBaru)) {
        const lama = kerja.berkas[n];
        if (!lama || lama.isi !== b.isi || lama.asal !== b.asal) api.tulis(n, b.isi, b.asal);
      }
    },
    sudahLangkah(tid) {
      return api.baris(tid).centang || {};
    },
    laporan() {
      if (!kerja.laporan) kerja.laporan = laporanKosong();
      return kerja.laporan;
    },
    simpanLaporan(tandaiEkspor = false) {
      const l = api.laporan();
      l.diperbarui = sekarang();
      if (tandaiEkspor) l.diekspor = l.diperbarui;
      simpan();
      D.antreLaporan(mk, pid, { jawaban: l.jawaban, jumlah_ketikan: l.ketikan, percobaan_tempel: l.tempel, durasi_menulis_detik: Math.round(l.durasi), kode_verifikasi: l.kode, dikumpulkan_pada: l.diekspor });
    },
    simpan,
  };
  return api;
}

const sudahDisusul = new Set();
/** Menggabungkan pekerjaan di server ke lokal (sekali per praktikum per muat halaman). Mengembalikan true bila ada yang berubah. */
export async function susulDariServer(ctx, pk, k) {
  const id = [Auth.getUserId(), k.mk, k.pid].join("|");
  if (sudahDisusul.has(id)) return false;
  sudahDisusul.add(id);
  const s = await D.ambilServer(k.mk, k.pid);
  if (!s) {
    sudahDisusul.delete(id);
    return false;
  }
  const sebelum = JSON.stringify([k.kerja.berkas, k.kerja.tahap, k.kerja.laporan]);
  k.kerja.berkas = D.gabungBerkas(k.kerja.berkas, s.berkas, k.kerja.hapus);
  k.kerja.tahap = D.gabungTahap(k.kerja.tahap, s.tahap);
  if (s.laporan) k.kerja.laporan = D.gabungLaporan(k.kerja.laporan, s.laporan);
  // yang hanya ada di lokal (mis. dibuat saat offline) disusulkan ke server
  const diServer = new Map(s.berkas.map((r) => [r.nama, r.diperbarui_pada]));
  for (const [n, b] of Object.entries(k.kerja.berkas)) if (!diServer.has(n) || String(b.t || "") > String(diServer.get(n))) D.antreBerkas(k.mk, k.pid, n, b);
  const sesudah = JSON.stringify([k.kerja.berkas, k.kerja.tahap, k.kerja.laporan]);
  if (sebelum === sesudah) return false;
  k.simpan();
  return true;
}

// ---------- bagian di halaman mata kuliah, tanda, dan pemberitahuan ----------
export const tandaAdaPraktik = () => h("span", { class: "pk-chip", title: "Ada praktik untuk bab ini (tidak wajib)" }, "Ada praktik");

/** Bagian "Praktikum" di paling bawah halaman mata kuliah. null bila mata kuliah tidak punya praktikum. */
export function bagianPraktikum(ctx, daftar) {
  if (!daftar || !daftar.length) return null;
  const proyek = daftar.filter((p) => p.jenis !== "latihan");
  const latihan = daftar.filter((p) => p.jenis === "latihan");
  const kartu = (pk) => {
    const k = kelola(ctx, pk);
    const ring = P.ringkasPraktikum(pk, k.peta());
    const berikut = P.tahapBerikut(pk, k.peta());
    return h(
      "article",
      { class: "card pk-kartu" },
      h("h3", {}, pk.judul),
      h("p", {}, pk.deskripsi),
      bar(ring.lulus + ring.dilewati, ring.total, "Tahap praktikum selesai atau dilewati"),
      h("p", { class: "muted" }, ring.lulus + " lulus, " + ring.dilewati + " dilewati, " + (ring.total - ring.lulus - ring.dilewati) + " belum, dari " + ring.total + " tahap."),
      h("div", { class: "cta" }, h("a", { class: "btn btn-primary", href: hrefPraktikum(ctx, pk.id, berikut >= 0 && ring.lulus + ring.dilewati > 0 ? pk.tahap[berikut].id : "") }, ring.lulus + ring.dilewati === 0 ? "Mulai" : berikut >= 0 ? "Lanjutkan" : "Lihat"), " ", h("a", { class: "btn", href: hrefPraktikum(ctx, pk.id) }, "Daftar tahap"))
    );
  };
  const baris = (pk) => {
    const k = kelola(ctx, pk);
    const ring = P.ringkasPraktikum(pk, k.peta());
    return h("li", {}, h("a", { class: "pk-lat", href: hrefPraktikum(ctx, pk.id) }, h("span", { class: "num" }, "BAB " + String(pk.bab || "").padStart(2, "0")), h("strong", {}, pk.judul.replace(/^Latihan bab \d+: /, "")), h("span", { class: "muted" }, ring.lulus + " dari " + ring.total + " tahap lulus")));
  };
  const otoSemua = ctx.instruktur() ? h("button", { type: "button", class: "btn pk-oto" }, "Jawab semua praktikum otomatis (instruktur)") : null;
  const pesanOto = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  if (otoSemua)
    otoSemua.addEventListener("click", async () => {
      otoSemua.disabled = true;
      let lulus = 0;
      let total = 0;
      try {
        for (const pk of daftar) {
          const hasil = await jawabOtomatis(ctx, pk, pk.tahap.map((x, i) => i), (i) => (pesanOto.textContent = pk.judul + ": tahap " + (i + 1) + " dari " + pk.tahap.length));
          lulus += hasil.filter((r) => r.lulus).length;
          total += hasil.length;
          const gagal = hasil.filter((r) => !r.lulus);
          if (gagal.length) {
            pesanOto.textContent = pk.judul + ": tahap " + (gagal[0].idx + 1) + " tidak lulus (" + (gagal[0].galat || "") + "). Berhenti.";
            otoSemua.disabled = false;
            return;
          }
        }
        pesanOto.textContent = lulus + " dari " + total + " tahap lulus.";
        ctx.ulang();
      } catch (e) {
        pesanOto.textContent = "Gagal: " + e.message;
        otoSemua.disabled = false;
      }
    });
  return h(
    "section",
    { class: "pk-bagian", "aria-labelledby": "pk-judul" },
    h("div", { class: "section-title" }, h("h2", { id: "pk-judul" }, "Praktikum")),
    h("p", { class: "free-note" }, "Latihan tambahan di luar soal bab. Tidak wajib dan tidak terkunci: lewati yang sudah kamu kuasai, dan tersedia berkas contoh bila kamu tertinggal."),
    ...proyek.map(kartu),
    latihan.length ? h("h3", { class: "pk-sub" }, "Latihan per bab") : null,
    latihan.length ? h("p", { class: "muted" }, "Tiap latihan berdiri sendiri dan berfokus pada satu bab. Kerjakan yang kamu perlukan, dalam urutan apa saja.") : null,
    latihan.length ? h("ul", { class: "pk-lat-daftar" }, latihan.map(baris)) : null,
    otoSemua ? h("div", { class: "pk-aksi" }, otoSemua) : null,
    pesanOto
  );
}

/** Bar pemberitahuan di halaman bab. null bila bab tidak punya praktik, praktiknya sudah selesai, atau peserta memilih "Nanti saja". */
export function notifBab(ctx, daftar, bab) {
  if (!daftar || !daftar.length) return null;
  const kunci = "pk-nanti:" + ctx.kuliah.id + ":" + bab;
  if (ctx.store.get(kunci, false)) return null;
  const sisa = P.tahapUntukBab(daftar, bab).filter(({ praktikum, tahap }) => !["lulus", "dilewati"].includes(P.statusTahap(kelola(ctx, praktikum).peta(), tahap.id)));
  if (!sisa.length) return null;
  const { praktikum, tahap, indeks } = sisa[0];
  const nanti = h("button", { type: "button", class: "btn" }, "Nanti saja");
  const bartar = h(
    "div",
    { class: "info-bar pk-notif", role: "note" },
    h("p", {}, h("strong", {}, "Ada praktik untuk bab ini. "), "Tahap " + (indeks + 1) + " dari " + praktikum.tahap.length + " proyek " + praktikum.judul + ": " + tahap.judul + ". Tidak wajib; boleh dilewati."),
    h("a", { class: "btn btn-primary", href: hrefPraktikum(ctx, praktikum.id, tahap.id) }, "Kerjakan praktik"),
    nanti
  );
  nanti.addEventListener("click", () => {
    ctx.store.set(kunci, true);
    bartar.remove();
  });
  return bartar;
}

// ---------- editor berkas ----------
const modeDari = (nama) => (/\.py$/i.test(nama) ? "python" : /\.java$/i.test(nama) ? "text/x-java" : "text/plain");
function pasangEditor(holder, nama, isi, saatUbah, jaga) {
  let aktif = nama;
  if (typeof CodeMirror === "undefined") {
    const ta = h("textarea", { class: "input pk-teks", rows: "16", spellcheck: "false", "aria-label": "Isi berkas" });
    ta.value = isi;
    ta.addEventListener("input", () => saatUbah(aktif, ta.value));
    ta.addEventListener("paste", (e) => {
      if (jaga.kecualikan()) return;
      e.preventDefault();
      jaga.saatTempel("praktikum");
      Anticopas.tampilkanPesan();
    });
    holder.append(ta);
    return { tampil: (n, i) => ((aktif = n), (ta.value = i)), nilai: () => ta.value, fokus: () => ta.focus(), segarkan() {} };
  }
  const opsi = (n, i) => ({ value: i, mode: modeDari(n), lineNumbers: true, lineWrapping: typeof matchMedia !== "undefined" && matchMedia("(max-width: 900px)").matches, indentUnit: 4, indentWithTabs: false, extraKeys: { Tab: (c) => c.replaceSelection("    ", "end") } });
  const cm = CodeMirror(holder, opsi(nama, isi));
  Anticopas.blokirDiCodeMirror(cm, jaga);
  cm.on("change", (c, ch) => {
    if (ch.origin !== "setValue") saatUbah(aktif, cm.getValue());
  });
  return {
    tampil(n, i) {
      aktif = n;
      cm.swapDoc(CodeMirror.Doc(i, modeDari(n)));
      cm.refresh();
    },
    nilai: () => cm.getValue(),
    fokus: () => cm.focus(),
    segarkan: () => cm.refresh(),
  };
}

// ---------- jawab otomatis (khusus instruktur) ----------
/**
 * Mengisi berkas contoh jawaban lalu mengirim (menguji) tiap tahap secara berurutan. Hanya untuk akun instruktur: untuk
 * mencoba atau memperagakan praktikum. Contoh jawaban memang sudah ada di berkas JSON situs; ini hanya mengisinya ke ruang kerja.
 * @param {number[]} indeks tahap yang dijawab
 */
export async function jawabOtomatis(ctx, pk, indeks, saatProgres = () => {}) {
  if (!ctx.instruktur()) throw new Error("Khusus instruktur.");
  const k = kelola(ctx, pk);
  const hasil = [];
  for (const idx of indeks) {
    const tahap = pk.tahap[idx];
    saatProgres(idx);
    if (tahap.kunciBab) {
      // Contoh jawaban tahap ini tidak ada di situs (agar peserta tidak bisa melihatnya): diambil dari tabel kunci, khusus instruktur.
      const kk = await Kunci.ambilKunci(ctx.kuliah.id, tahap.kunciBab);
      if (kk.galat) {
        hasil.push({ idx, lulus: false, galat: kk.galat });
        continue;
      }
      let peta = null;
      try {
        peta = JSON.parse(kk.isi);
      } catch (e) {}
      if (!peta || typeof peta !== "object") {
        hasil.push({ idx, lulus: false, galat: "Format kunci tidak sah." });
        continue;
      }
      const baru = {};
      for (const [n, i] of Object.entries(peta)) if (P.POLA_NAMA.test(n) && typeof i === "string" && i.length <= P.MAKS_UKURAN) baru[n] = { isi: i, asal: "milik" };
      k.ganti(baru);
    } else {
      const lengkap = P.lengkapiDariContoh(pk, idx, k.kerja.berkas);
      k.ganti(lengkap.berkas);
      k.ganti(P.terapkanContoh(pk, idx, k.kerja.berkas));
    }
    const isi = k.isi();
    const lama = k.baris(tahap.id);
    const kasus = P.tanpaUji(tahap) ? [{ nama: "kompilasi", kode: "" }] : tahap.kasus;
    const r = await jalankanProyek(pk, isi, { aksi: "kasus", kasus });
    if (r.timeout || r.error || !r.proyek) {
      hasil.push({ idx, lulus: false, galat: r.error || "waktu habis" });
      continue;
    }
    const ring = P.ringkasHasil(r.proyek.kasus || []);
    const patch = { jumlah_kirim: (lama.jumlah_kirim || 0) + 1, pakai_contoh: true, pertama_dibuka: lama.pertama_dibuka || sekarang() };
    if (ring.lulus) Object.assign(patch, { status: "lulus", lulus_pada: lama.lulus_pada || sekarang() });
    else if (lama.status !== "lulus") patch.status = "sedang";
    k.ubahTahap(tahap.id, patch);
    D.antreVersi(k.mk, k.pid, tahap.id, isi, P.hasilUntukRiwayat(ring), ring.lulus);
    hasil.push({ idx, lulus: ring.lulus, benar: ring.benar, total: ring.total, galat: ring.lulus ? null : ring.tampil.filter((c) => !c.lulus).map((c) => c.nama + ": " + c.pesan).join("; ") });
  }
  return hasil;
}

// ---------- halaman tahap ----------
const JENIS_PETUNJUK = { soal: "Petunjuk", buku: "Di buku", kode: "Contoh kecil", kata: "Istilah" };

/** Isi halaman satu tahap. Mengembalikan daftar elemen untuk #main. */
export function halamanTahap(ctx, pk, idx) {
  const tahap = pk.tahap[idx];
  const k = kelola(ctx, pk);
  const instruktur = ctx.instruktur();
  // ruang kerja disiapkan: berkas contoh dari tahap sebelumnya yang belum dimiliki, dan berkas awal tahap ini
  const lengkap = P.lengkapiDariContoh(pk, idx, k.kerja.berkas);
  for (const n of lengkap.ditambah) k.tulis(n, lengkap.berkas[n].isi, lengkap.berkas[n].asal);
  const baris0 = k.baris(tahap.id);
  if (baris0.status === "belum") k.ubahTahap(tahap.id, { status: "sedang", pertama_dibuka: sekarang() });
  else if (!baris0.pertama_dibuka) k.ubahTahap(tahap.id, { pertama_dibuka: sekarang() });

  let aktif = tahap.diminta && tahap.diminta[0] && k.kerja.berkas[tahap.diminta[0]] ? tahap.diminta[0] : Object.keys(k.kerja.berkas).sort()[0];
  const nama = () => Object.keys(k.kerja.berkas).sort();

  // ----- bagian atas -----
  const baru = h("p", { class: "muted" }, "Tahap " + (idx + 1) + " dari " + pk.tahap.length);
  const statusChip = h("span", { class: "pk-status" });
  const segarStatus = () => {
    const st = k.baris(tahap.id).status;
    statusChip.textContent = namaStatus(tahap, st);
    statusChip.className = "pk-status pk-st-" + st;
  };
  segarStatus();
  const bannerContoh = h("div", { class: "info-bar pk-contoh", role: "note", hidden: true });
  const segarBanner = () => {
    const dariContoh = Object.keys(k.kerja.berkas).filter((n) => k.kerja.berkas[n].asal === "contoh");
    bannerContoh.hidden = !dariContoh.length;
    bannerContoh.replaceChildren(h("p", {}, "Berkas contoh yang belum kamu ubah: " + dariContoh.join(", ") + ". Contoh ini mengisi tempat berkas yang belum kamu buat sendiri, supaya tahap ini tetap bisa jalan. Ganti dengan buatanmu kapan saja; selama belum diganti, laporanmu mencatat bahwa tahap ini memakai contoh."));
  };
  segarBanner();

  const langkah = h(
    "ol",
    { class: "pk-langkah" },
    tahap.langkah.map((teks, i) => {
      const cb = h("input", { type: "checkbox", id: "pk-l-" + i });
      cb.checked = !!k.sudahLangkah(tahap.id)[i];
      cb.addEventListener("change", () => {
        const c = Object.assign({}, k.sudahLangkah(tahap.id));
        if (cb.checked) c[i] = true;
        else delete c[i];
        k.ubahTahap(tahap.id, { centang: c });
      });
      return h("li", {}, h("label", { for: "pk-l-" + i }, cb, " ", teks));
    })
  );

  const petunjuk = (tahap.petunjuk || []).length
    ? h("div", { class: "pk-petunjuk" }, (tahap.petunjuk || []).map((p) => h("details", { class: "lipat" }, h("summary", {}, JENIS_PETUNJUK[p.jenis] || "Petunjuk"), h("p", {}, p.isi))))
    : null;

  // ----- ruang kerja -----
  const daftarBerkas = h("ul", { class: "pk-berkas", "aria-label": "Berkas proyek" });
  const pesanKerja = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const tulisPesan = (t) => (pesanKerja.textContent = t || "");
  const tempel = () => {
    const l = k.laporan();
    l.tempel = (l.tempel || 0) + 1;
    k.simpanLaporan();
  };
  const jaga = { lokasi: "praktikum", saatTempel: tempel, kecualikan: () => instruktur };
  let timerTulis = null;
  const saatUbah = (n, isi) => {
    const lama = k.kerja.berkas[n];
    k.kerja.berkas[n] = { isi, asal: "milik", t: sekarang() };
    if (lama && lama.asal !== "milik") {
      gambarBerkas();
      segarBanner();
    }
    clearTimeout(timerTulis);
    timerTulis = setTimeout(() => {
      k.tulis(n, k.kerja.berkas[n].isi, "milik");
      segarEntri();
    }, 500);
  };
  const holder = h("div", { class: "pk-editor" });
  let ed = null;
  const bukaBerkas = (n) => {
    if (ed) {
      clearTimeout(timerTulis);
      const lama = k.kerja.berkas[aktif];
      if (lama) k.tulis(aktif, lama.isi, lama.asal);
    }
    aktif = n;
    if (ed) ed.tampil(n, (k.kerja.berkas[n] || { isi: "" }).isi);
    gambarBerkas();
    if (dapatDijalankan(n)) entriPilih.value = n; // yang dijalankan mengikuti berkas yang sedang dibuka
  };
  const entriPilih = h("select", { class: "pk-entri", "aria-label": "Berkas yang dijalankan" });
  const dapatDijalankan = (n) => ekstensiKode(pk).test(n) && (pk.bahasa !== "java" || adaMain((k.kerja.berkas[n] || {}).isi));
  const segarEntri = () => {
    const kode = nama().filter(dapatDijalankan);
    const pilihan = entriPilih.value;
    entriPilih.replaceChildren(...kode.map((n) => h("option", { value: n }, n)));
    entriPilih.value = kode.includes(pilihan) ? pilihan : kode.includes(aktif) ? aktif : kode.includes(pk.entri) ? pk.entri : kode[0] || "";
  };
  function gambarBerkas() {
    daftarBerkas.replaceChildren(
      ...nama().map((n) => {
        const b = k.kerja.berkas[n];
        const diminta = (tahap.diminta || []).includes(n);
        const tombol = h(
          "button",
          { type: "button", class: "pk-nama" + (n === aktif ? " on" : ""), "aria-current": n === aktif ? "true" : "false" },
          n,
          diminta ? h("span", { class: "pk-tag pk-tag-diminta", title: "Berkas yang diperiksa tahap ini" }, "diperiksa") : null,
          b.asal === "contoh" ? h("span", { class: "pk-tag", title: "Berkas contoh, belum kamu ubah" }, "contoh") : null
        );
        tombol.addEventListener("click", () => bukaBerkas(n));
        return h("li", {}, tombol);
      })
    );
    namaAktif.textContent = aktif || "(belum ada berkas)";
    segarEntri();
  }
  const namaAktif = h("strong", { class: "pk-nama-aktif" });

  // berkas baru, ganti nama, hapus
  const kotakNama = h("div", { class: "pk-kotak-nama", hidden: true });
  const tampilkanKotakNama = (judul, awal, saatSimpan) => {
    const input = h("input", { class: "input", type: "text", "aria-label": judul, value: awal, autocomplete: "off", spellcheck: "false", maxlength: "60" });
    const ok = h("button", { type: "button", class: "btn btn-primary" }, "Simpan");
    const batal = h("button", { type: "button", class: "btn" }, "Batal");
    const pesan = h("span", { class: "form-msg", role: "alert" });
    const tutup = () => {
      kotakNama.hidden = true;
      kotakNama.replaceChildren();
    };
    const proses = () => {
      const n = input.value.trim();
      const galat = P.validasiNamaBerkas(n, nama().filter((x) => x !== awal || n !== awal), { jumlah: nama().length - (awal ? 1 : 0), bahasa: pk.bahasa });
      if (galat) {
        pesan.textContent = galat;
        return;
      }
      tutup();
      saatSimpan(n);
    };
    ok.addEventListener("click", proses);
    batal.addEventListener("click", tutup);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        proses();
      } else if (e.key === "Escape") tutup();
    });
    kotakNama.hidden = false;
    kotakNama.replaceChildren(h("label", {}, judul + " "), input, ok, batal, pesan);
    input.focus();
    input.select();
  };
  const baruBtn = h("button", { type: "button", class: "btn" }, "+ Berkas baru");
  baruBtn.addEventListener("click", () => tampilkanKotakNama("Nama berkas baru", "", (n) => {
    k.tulis(n, "", "milik");
    bukaBerkas(n);
    ed.fokus();
  }));
  const gantiBtn = h("button", { type: "button", class: "btn" }, "Ganti nama");
  gantiBtn.addEventListener("click", () => {
    if (!aktif) return;
    tampilkanKotakNama("Nama baru untuk " + aktif, aktif, (n) => {
      if (n === aktif) return;
      const b = k.kerja.berkas[aktif];
      const lama = aktif;
      k.tulis(n, b.isi, "milik");
      k.hapus(lama);
      bukaBerkas(n);
    });
  });
  const hapusBtn = tombolKonfirmasi("Hapus berkas", "Hapus berkas ini?", () => {
    if (!aktif) return;
    k.hapus(aktif);
    const sisa = nama();
    aktif = sisa[0];
    ed.tampil(aktif || "", aktif ? k.kerja.berkas[aktif].isi : "");
    gambarBerkas();
    segarBanner();
  });

  // ----- jalankan -----
  const masukan = h("textarea", { class: "input pk-masukan", rows: "2", placeholder: pk.bahasa === "java" ? "Masukan untuk Scanner, satu baris per nextLine() (boleh kosong)" : "Masukan untuk input(), satu baris per pertanyaan (boleh kosong)", "aria-label": "Masukan untuk program", spellcheck: "false" });
  const keluaran = h("pre", { class: "pk-keluaran", "aria-live": "polite", tabindex: "0" }, "Keluaran program akan tampil di sini.");
  const hasilBox = h("div", { class: "pk-hasil", "aria-live": "polite" });
  const jalankanBtn = h("button", { type: "button", class: "btn" }, "Jalankan");
  const tanpaUjiTahap = P.tanpaUji(tahap);
  const kirimBtn = h("button", { type: "button", class: "btn btn-primary" }, tanpaUjiTahap ? (k.baris(tahap.id).status === "lulus" ? "Batalkan tanda siap dinilai" : "Tandai siap dinilai") : "Kirim jawaban");
  let sibuk = false;
  const atur = (b) => {
    sibuk = b;
    jalankanBtn.disabled = b;
    kirimBtn.disabled = b;
    if (periksaBtn) periksaBtn.disabled = b;
  };
  const siapkanBerkas = () => {
    clearTimeout(timerTulis);
    if (aktif && k.kerja.berkas[aktif] && ed) {
      const sekarangIsi = ed.nilai();
      if (sekarangIsi !== k.kerja.berkas[aktif].isi) k.kerja.berkas[aktif] = { isi: sekarangIsi, asal: "milik", t: sekarang() };
      k.tulis(aktif, k.kerja.berkas[aktif].isi, k.kerja.berkas[aktif].asal);
    }
    return k.isi();
  };
  jalankanBtn.addEventListener("click", async () => {
    if (sibuk) return;
    const entri = entriPilih.value;
    if (!entri) {
      keluaran.textContent = pk.bahasa === "java" ? "Belum ada berkas dengan method main untuk dijalankan. Tulis public static void main(String[] args) di salah satu kelas." : "Belum ada berkas .py untuk dijalankan. Buat berkas baru dulu.";
      return;
    }
    atur(true);
    jalankanBtn.textContent = "Menjalankan";
    keluaran.textContent = "";
    try {
      const r = await jalankanProyek(pk, siapkanBerkas(), { aksi: "jalankan", entri, masukan: masukan.value ? masukan.value.split("\n") : [] });
      if (r.timeout) keluaran.textContent = "Program berjalan terlalu lama dan dihentikan. Periksa perulangan tanpa akhir atau input() yang menunggu masukan.";
      else if (r.error) keluaran.textContent = r.error;
      else if (!r.proyek) keluaran.textContent = "Tidak ada hasil.";
      else keluaran.textContent = (r.proyek.keluaran || "") + (r.proyek.galat ? (r.proyek.keluaran ? "\n" : "") + r.proyek.galat : "") || "(program selesai tanpa keluaran)";
      keluaran.classList.toggle("pk-galat", !!(r.error || r.timeout || (r.proyek && r.proyek.galat)));
    } finally {
      jalankanBtn.textContent = "Jalankan";
      atur(false);
    }
  });

  // ----- kirim -----
  const tautLanjut = h("p", { class: "pk-lanjut", hidden: true });
  // Tahap tanpa kasus uji (dinilai dosen): tombol ini menandai peserta siap dinilai, bukan menguji.
  const tandaiSelesai = () => {
    const lama = k.baris(tahap.id);
    if (lama.status === "lulus") {
      k.ubahTahap(tahap.id, { status: "sedang", lulus_pada: null });
      kirimBtn.textContent = "Tandai siap dinilai";
      tulisPesan("Tanda siap dinilai dibatalkan.");
    } else {
      const isi = siapkanBerkas();
      k.ubahTahap(tahap.id, { status: "lulus", lulus_pada: sekarang(), jumlah_kirim: (lama.jumlah_kirim || 0) + 1 });
      D.antreVersi(k.mk, k.pid, tahap.id, isi, {}, true);
      kirimBtn.textContent = "Batalkan tanda siap dinilai";
      tulisPesan("Ditandai siap dinilai. Dosen akan membaca berkasmu; kamu tetap boleh memperbaikinya.");
    }
    segarStatus();
  };
  kirimBtn.addEventListener("click", async () => {
    if (sibuk) return;
    if (tanpaUjiTahap) {
      tandaiSelesai();
      return;
    }
    atur(true);
    kirimBtn.textContent = "Menguji";
    hasilBox.replaceChildren();
    tautLanjut.hidden = true;
    try {
      const isi = siapkanBerkas();
      const r = await jalankanProyek(pk, isi, { aksi: "kasus", kasus: tahap.kasus });
      if (r.timeout || r.error || !r.proyek) {
        hasilBox.replaceChildren(h("p", { class: "form-msg" }, r.timeout ? "Pengujian berjalan terlalu lama dan dihentikan. Periksa perulangan tanpa akhir atau input() yang menunggu masukan." : r.error || "Pengujian tidak menghasilkan apa-apa. Coba lagi."));
        return;
      }
      const ring = P.ringkasHasil(r.proyek.kasus || []);
      const lama = k.baris(tahap.id);
      const sudahLulus = lama.status === "lulus";
      const patch = { jumlah_kirim: (lama.jumlah_kirim || 0) + 1, pakai_contoh: (tahap.diminta || []).some((n) => k.kerja.berkas[n] && k.kerja.berkas[n].asal === "contoh") };
      if (ring.lulus && !sudahLulus) Object.assign(patch, { status: "lulus", lulus_pada: sekarang() });
      else if (!sudahLulus && lama.status !== "dilewati") patch.status = "sedang";
      k.ubahTahap(tahap.id, patch);
      D.antreVersi(k.mk, k.pid, tahap.id, isi, P.hasilUntukRiwayat(ring), ring.lulus);
      k.kerja.riwayat = [{ tahap_id: tahap.id, t: sekarang(), lulus: ring.lulus, benar: ring.benar, total: ring.total }, ...(k.kerja.riwayat || [])].slice(0, 30);
      k.simpan();
      segarStatus();
      hasilBox.replaceChildren(
        h("p", { class: "pk-ringkas " + (ring.lulus ? "ok" : "") }, ring.lulus ? "Lulus: " + ring.benar + " dari " + ring.total + " pemeriksaan benar." : "Belum lulus: " + ring.benar + " dari " + ring.total + " pemeriksaan benar. Perbaiki lalu Kirim lagi; tidak ada batas percobaan."),
        h("ul", { class: "pk-kasus" }, ring.tampil.map((c) => h("li", { class: c.lulus ? "ok" : "gagal" }, h("span", { "aria-hidden": "true" }, c.lulus ? "✓ " : "✗ "), h("strong", {}, c.nama), c.lulus || !c.pesan ? null : h("pre", { class: "pk-pesan" }, c.pesan))))
      );
      if (ring.lulus && idx + 1 < pk.tahap.length) {
        tautLanjut.hidden = false;
        tautLanjut.replaceChildren(h("a", { class: "btn btn-primary", href: hrefPraktikum(ctx, pk.id, pk.tahap[idx + 1].id) }, "Lanjut ke tahap " + (idx + 2)));
      } else if (ring.lulus) {
        tautLanjut.hidden = false;
        tautLanjut.replaceChildren(h("a", { class: "btn btn-primary", href: hrefPraktikum(ctx, pk.id) }, "Semua tahap selesai: lihat hasil dan laporan"));
      }
      riwayatBox.dataset.muat = "";
    } finally {
      kirimBtn.textContent = "Kirim jawaban";
      atur(false);
    }
  });

  // ----- bantuan: kembalikan, contoh, lewati, riwayat -----
  const segarSemua = () => {
    gambarBerkas();
    segarBanner();
    if (aktif && !k.kerja.berkas[aktif]) aktif = nama()[0];
    ed.tampil(aktif || "", aktif ? k.kerja.berkas[aktif].isi : "");
  };
  const kembaliBtn0 = tombolKonfirmasi("Kembalikan berkas awal", "Berkas awal tahap ini dikembalikan ke kerangka semula. Perubahanmu pada berkas itu hilang. Lanjutkan?", () => {
    k.ganti(P.kembalikanAwal(pk, idx, k.kerja.berkas));
    tulisPesan("Berkas awal tahap ini dikembalikan.");
    segarSemua();
  });
  const kembaliBtn = Object.keys(tahap.awal || {}).length ? kembaliBtn0 : null;
  const contohBtn = (tahap.contoh && Object.keys(tahap.contoh).length)
    ? tombolKonfirmasi("Pakai berkas contoh", "Berkas yang diminta tahap ini diganti dengan contoh jawaban. Tidak apa-apa bila kamu sudah paham dan hanya ingin lanjut. Lanjutkan?", () => {
        k.ganti(P.terapkanContoh(pk, idx, k.kerja.berkas));
        k.ubahTahap(tahap.id, { pakai_contoh: true });
        tulisPesan("Berkas contoh dipakai. Kamu tetap boleh mengubahnya.");
        segarSemua();
      })
    : null;
  const lewatiBtn = h("button", { type: "button", class: "btn" }, "Lewati tahap ini");
  lewatiBtn.addEventListener("click", () => {
    const st = k.baris(tahap.id).status;
    if (st !== "lulus") k.ubahTahap(tahap.id, { status: "dilewati" });
    segarStatus();
    location.hash = idx + 1 < pk.tahap.length ? hrefPraktikum(ctx, pk.id, pk.tahap[idx + 1].id) : hrefPraktikum(ctx, pk.id);
  });
  const otoBtn = instruktur ? h("button", { type: "button", class: "btn pk-oto", title: "Khusus instruktur: isi contoh jawaban lalu kirim" }, "Jawab otomatis (instruktur)") : null;
  if (otoBtn)
    otoBtn.addEventListener("click", async () => {
      if (sibuk) return;
      atur(true);
      otoBtn.disabled = true;
      try {
        const [r] = await jawabOtomatis(ctx, pk, [idx]);
        tulisPesan(r.lulus ? "Terjawab otomatis dan lulus (" + r.benar + "/" + r.total + ")." : "Terisi, tetapi pengujian belum lulus: " + (r.galat || r.benar + "/" + r.total));
        ctx.ulang();
      } catch (e) {
        tulisPesan("Gagal: " + e.message);
      } finally {
        otoBtn.disabled = false;
        atur(false);
      }
    });
  const riwayatBox = h("div", { class: "pk-riwayat" });
  const riwayatBtn = h("button", { type: "button", class: "btn" }, "Riwayat versi");
  riwayatBtn.addEventListener("click", async () => {
    if (riwayatBox.dataset.muat === "1") {
      riwayatBox.replaceChildren();
      riwayatBox.dataset.muat = "";
      return;
    }
    riwayatBox.dataset.muat = "1";
    riwayatBox.replaceChildren(h("p", { class: "muted" }, "Memuat riwayat"));
    const versi = await D.ambilVersi(k.mk, k.pid, tahap.id);
    if (!versi.length) {
      const lokal = (k.kerja.riwayat || []).filter((r) => r.tahap_id === tahap.id);
      riwayatBox.replaceChildren(lokal.length ? h("div", {}, h("p", { class: "muted" }, "Versi tersimpan di server belum bisa dibaca. Kiriman di perangkat ini:"), h("ul", {}, lokal.map((r) => h("li", {}, new Date(r.t).toLocaleString("id-ID") + ": " + (r.lulus ? "lulus" : "belum lulus") + " (" + r.benar + "/" + r.total + ")")))) : h("p", { class: "muted" }, "Belum ada versi. Versi tersimpan setiap kali kamu menekan Kirim jawaban."));
      return;
    }
    riwayatBox.replaceChildren(
      h("p", { class: "muted" }, "Versi dari tiap kali Kirim jawaban (20 terakhir). Memulihkan versi mengganti berkas yang ada di versi itu; berkas lain tidak disentuh."),
      h("ul", { class: "pk-versi" }, versi.map((v) => {
        const pulih = tombolKonfirmasi("Pulihkan", "Berkas yang ada di versi ini diganti dengan isinya. Berkas lain tidak disentuh. Lanjutkan?", () => {
          const b = {};
          for (const [n, i] of Object.entries(v.berkas || {})) if (P.POLA_NAMA.test(n)) b[n] = { isi: String(i), asal: "milik" };
          k.ganti(b);
          tulisPesan("Versi dipulihkan.");
          segarSemua();
        });
        return h("li", {}, h("span", {}, new Date(v.dibuat_pada).toLocaleString("id-ID") + ": " + (v.lulus ? "lulus" : "belum lulus") + (v.hasil && v.hasil.total ? " (" + v.hasil.benar + "/" + v.hasil.total + ")" : "") + " "), pulih);
      }))
    );
  });

  // ----- navigasi antar tahap -----
  const nav = h(
    "nav",
    { class: "pk-nav", "aria-label": "Pindah tahap" },
    idx > 0 ? h("a", { class: "btn", href: hrefPraktikum(ctx, pk.id, pk.tahap[idx - 1].id) }, "Tahap sebelumnya") : null,
    h("a", { class: "btn", href: hrefPraktikum(ctx, pk.id) }, "Daftar tahap"),
    idx + 1 < pk.tahap.length ? h("a", { class: "btn", href: hrefPraktikum(ctx, pk.id, pk.tahap[idx + 1].id) }, "Tahap berikutnya") : null
  );

  // ----- unggah berkas dari laptop (hanya praktikum yang mengizinkan, mis. tugas akhir) -----
  const unggahInput = pk.izinUnggah ? h("input", { type: "file", multiple: "", accept: ".java,.md,.txt,.csv,.json", hidden: "" }) : null;
  const unggahBtn = pk.izinUnggah ? h("button", { type: "button", class: "btn" }, "Unggah berkas dari laptop") : null;
  if (unggahBtn) {
    unggahBtn.addEventListener("click", () => unggahInput.click());
    unggahInput.addEventListener("change", async () => {
      const diterima = [];
      const ditolak = [];
      for (const f of Array.from(unggahInput.files || [])) {
        const ada = nama().filter((x) => x !== f.name);
        const galat = P.validasiNamaBerkas(f.name, ada, { jumlah: nama().length - (k.kerja.berkas[f.name] ? 1 : 0), bahasa: pk.bahasa });
        if (galat) {
          ditolak.push(f.name + ": " + galat);
          continue;
        }
        if (f.size > P.MAKS_UKURAN) {
          ditolak.push(f.name + ": lebih dari " + P.MAKS_UKURAN + " karakter");
          continue;
        }
        const isi = (await f.text()).replace(/\r\n/g, "\n").replace(/\u0000/g, "");
        k.tulis(f.name, isi, "milik");
        diterima.push(f.name);
      }
      unggahInput.value = "";
      if (diterima.length) {
        const l = k.laporan();
        l.ketikan = Object.assign({}, l.ketikan, { _unggah: ((l.ketikan && l.ketikan._unggah) || 0) + diterima.length });
        k.simpanLaporan();
        if (!aktif || !k.kerja.berkas[aktif]) aktif = diterima[0];
        gambarBerkas();
        segarBanner();
        if (ed) ed.tampil(aktif, k.kerja.berkas[aktif].isi);
        tampilAnalisis();
      }
      tulisPesan((diterima.length ? "Diunggah: " + diterima.join(", ") + ". " : "") + (ditolak.length ? "Tidak diterima: " + ditolak.join("; ") : ""));
    });
  }

  // ----- periksa kompilasi dan penanda kelengkapan (tahap yang dinilai dosen) -----
  const periksaBox = tahap.dinilaiDosen ? h("div", { class: "pk-periksa", "aria-live": "polite" }) : null;
  const periksaBtn = tahap.dinilaiDosen && pk.bahasa === "java" ? h("button", { type: "button", class: "btn" }, "Periksa kompilasi") : null;
  const tampilAnalisis = () => {
    if (!periksaBox || pk.bahasa !== "java") return;
    const a = analisisJava(k.isi());
    periksaBox.replaceChildren(
      h("h4", {}, "Penanda kelengkapan (otomatis)"),
      h("p", { class: "muted" }, "Hanya membaca teks kodemu untuk menunjukkan unsur yang sudah terlihat. Ini penanda, bukan nilai: dosen menilai isi dan kualitasnya."),
      h("ul", { class: "pk-analisis" }, a.map((x) => h("li", { class: x.ada ? "ok" : "belum" }, h("span", { "aria-hidden": "true" }, x.ada ? "✓ " : "○ "), h("strong", {}, x.label), " ", h("span", { class: "muted" }, x.rincian))))
    );
  };
  if (periksaBtn)
    periksaBtn.addEventListener("click", async () => {
      if (sibuk) return;
      atur(true);
      periksaBtn.textContent = "Memeriksa";
      try {
        const isi = siapkanBerkas();
        tampilAnalisis();
        const r = await jalankanProyek(pk, isi, { aksi: "kasus", kasus: [{ nama: "kompilasi", kode: "" }] });
        const c = r.proyek && r.proyek.kasus && r.proyek.kasus[0];
        const kodeGuiJdbc = /javax\.swing|java\.awt|java\.sql|javafx/.test(Object.values(isi).join("\n"));
        tulisPesan(r.timeout ? "Pemeriksaan terlalu lama dan dihentikan." : r.error ? r.error : c && c.lulus ? "Semua berkas berhasil dikompilasi." + (kodeGuiJdbc ? " Antarmuka grafis dan JDBC hanya diperiksa kompilasinya; menjalankannya butuh laptop." : "") : "Belum bisa dikompilasi:\n" + (c ? c.pesan : "tidak ada hasil"));
      } finally {
        periksaBtn.textContent = "Periksa kompilasi";
        atur(false);
      }
    });

  const kerjaBox = h(
    "section",
    { class: "card pk-kerja", "aria-label": "Ruang kerja" },
    h("h3", {}, "Ruang kerja"),
    h("p", { class: "muted" }, "Kamu membuat berkasnya sendiri. Salin dan tempel dimatikan; jumlah percobaan tempel dicatat, isinya tidak. Berkas tersimpan otomatis."),
    h("div", { class: "pk-kerja-grid" }, h("div", { class: "pk-kolom-berkas" }, daftarBerkas, baruBtn, unggahBtn, unggahInput), h("div", { class: "pk-kolom-editor" }, h("div", { class: "pk-bar" }, namaAktif, gantiBtn, hapusBtn), kotakNama, holder)),
    h("div", { class: "pk-jalan" }, h("label", { class: "pk-label" }, "Jalankan berkas ", entriPilih), jalankanBtn, kirimBtn, periksaBtn),
    masukan,
    keluaran,
    pesanKerja,
    hasilBox,
    periksaBox,
    tautLanjut
  );
  Anticopas.blokirSalinTempel(kerjaBox, { lokasi: "praktikum", kecualikan: () => instruktur, saatTempel: tempel });

  gambarBerkas();
  tampilAnalisis();
  queueMicrotask(() => {
    ed = pasangEditor(holder, aktif || "", aktif ? k.kerja.berkas[aktif].isi : "", saatUbah, jaga);
  });

  susulDariServer(ctx, pk, k).then((berubah) => berubah && ctx.ulang());

  return [
    h("section", { class: "card pk-kepala" },
      h("p", { class: "eyebrow" }, h("a", { href: "#k/" + ctx.kuliah.id }, ctx.kuliah.nama), " / ", h("a", { href: hrefPraktikum(ctx, pk.id) }, pk.judul)),
      h("h2", {}, "Tahap " + (idx + 1) + ": " + tahap.judul),
      h("p", { class: "pk-meta" }, baru, statusChip, (tahap.bab || []).length ? h("span", { class: "muted" }, "Bab terkait: ") : null, ...(tahap.bab || []).map((b) => h("a", { class: "pk-bab", href: babHref(ctx, b) }, "Bab " + b))),
      h("p", {}, tahap.tujuan),
      tanpaUjiTahap ? h("p", { class: "info-bar pk-dosen", role: "note" }, "Tahap ini dinilai dosen dengan rubrik (lihat di halaman daftar tahap), tidak diuji otomatis. Tekan Tandai siap dinilai bila sudah siap; kamu tetap boleh memperbaikinya setelah itu.") : null,
      h("h3", {}, "Langkah"),
      h("p", { class: "muted" }, "Kotak centang hanya penanda untukmu; tidak ada yang memeriksanya."),
      langkah,
      (tahap.diminta || []).length ? h("p", {}, h("strong", {}, "Berkas yang diperiksa: "), tahap.diminta.join(", ")) : null,
      petunjuk
    ),
    bannerContoh,
    kerjaBox,
    h("section", { class: "card pk-bantu" }, h("h3", {}, "Bantuan dan pilihan"), h("div", { class: "pk-aksi" }, kembaliBtn, contohBtn, lewatiBtn, riwayatBtn, otoBtn), riwayatBox),
    nav,
  ];
}

// ---------- halaman daftar tahap, ekspor HTML, dan laporan ----------
function kartuLaporan(ctx, pk, k) {
  const profil = Auth.getProfile() || { nama: "(tanpa akun)", nim: "-", kelas: "-" };
  const instruktur = ctx.instruktur();
  const lap = k.laporan();
  const pesan = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const status = h("span", { class: "muted lap-status" });
  let timer = null;
  let terakhir = 0;
  const simpan = () => {
    k.simpanLaporan();
    status.textContent = "Tersimpan " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };
  const medan = P.KOLOM_LAPORAN.map((kol) => {
    const area = h("textarea", { class: "input lap-area", id: "pl-" + kol.id, rows: "4", autocomplete: "off", spellcheck: "true", "aria-describedby": "pl-bantu-" + kol.id });
    area.value = (lap.jawaban || {})[kol.id] || "";
    const hitung = h("span", { class: "lap-hitung muted" });
    const perbarui = () => {
      const n = area.value.trim().length;
      hitung.textContent = n + " karakter" + (n >= kol.min ? " (cukup)" : " (disarankan minimal " + kol.min + ")");
      hitung.classList.toggle("cukup", n >= kol.min);
    };
    area.addEventListener("beforeinput", (e) => {
      if (e.inputType === "insertText" && e.data) lap.ketikan[kol.id] = (lap.ketikan[kol.id] || 0) + e.data.length;
      else if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") lap.ketikan[kol.id] = (lap.ketikan[kol.id] || 0) + 1;
    });
    area.addEventListener("input", () => {
      const t = Date.now();
      if (terakhir) lap.durasi += Math.min(20, (t - terakhir) / 1000);
      terakhir = t;
      lap.jawaban[kol.id] = area.value;
      perbarui();
      clearTimeout(timer);
      timer = setTimeout(simpan, 1500);
    });
    area.addEventListener("blur", () => {
      clearTimeout(timer);
      simpan();
    });
    perbarui();
    return h("div", { class: "field lap-kolom" }, h("label", { for: "pl-" + kol.id }, kol.label), h("p", { class: "muted lap-bantu", id: "pl-bantu-" + kol.id }, kol.petunjuk), area, hitung);
  });
  const pdfBtn = h("button", { type: "button", class: "btn btn-primary" }, "Ekspor PDF");
  pdfBtn.addEventListener("click", async () => {
    pdfBtn.disabled = true;
    pesan.textContent = "Menyiapkan PDF";
    try {
      clearTimeout(timer);
      k.simpanLaporan(true);
      const d = { matakuliah: ctx.kuliah.nama, praktikum: pk, jalur: "web", nama: profil.nama, nim: profil.nim, kelas: profil.kelas, jawaban: lap.jawaban, statusTahap: [...k.peta().values()], kodeVerifikasi: lap.kode, diekspor: new Date() };
      unduh(await buatPdfBlok(P.susunLaporanPraktikum(d), lap.kode), P.namaBerkasLaporan(Object.assign({}, d, { nim: profil.nim })));
      const kl = P.kelengkapanLaporan(lap.jawaban);
      pesan.textContent = "PDF diunduh." + (kl.lengkap ? "" : " Perlu diketahui: " + kl.baik + " dari " + kl.total + " kolom sudah memadai; kamu tetap boleh mengumpulkannya.");
    } catch (e) {
      pesan.textContent = "Gagal membuat PDF: " + e.message;
    } finally {
      pdfBtn.disabled = false;
    }
  });
  const kartu = h(
    "section",
    { class: "card bab-laporan", "aria-label": "Laporan praktikum" },
    h("h3", {}, "Laporan praktikum"),
    h("p", { class: "muted" }, "Laporan selalu terbuka dan bisa diekspor kapan saja, walaupun belum semua tahap selesai. Ketik sendiri jawabanmu (salin dan tempel dimatikan). Status tiap tahap dan kode verifikasi masuk otomatis."),
    ...medan,
    h("div", { class: "actions" }, pdfBtn, status),
    pesan
  );
  Anticopas.blokirSalinTempel(kartu, { lokasi: "laporan", kecualikan: () => instruktur, saatTempel: () => { lap.tempel = (lap.tempel || 0) + 1; clearTimeout(timer); timer = setTimeout(simpan, 1500); } });
  return kartu;
}

function kartuEksporJava(ctx, pk, k) {
  const pesan = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const tombol = h("button", { type: "button", class: "btn btn-primary" }, "Ekspor kode (HTML)");
  tombol.addEventListener("click", () => {
    const isi = k.isi();
    if (!Object.keys(isi).length) {
      pesan.textContent = "Belum ada berkas. Buat atau unggah dulu.";
      return;
    }
    const profil = Auth.getProfile();
    const html = P.bangunHtmlEksporJava({ judul: pk.judul, deskripsi: pk.deskripsi, berkas: isi, entri: pk.entri, oleh: profil && profil.nama });
    unduh(new Blob([html], { type: "text/html;charset=utf-8" }), P.namaBerkasHtml(pk.judul));
    pesan.textContent = "Berkas HTML diunduh. Isinya seluruh kodemu beserta cara menjalankannya dengan JDK; halaman ini tidak menjalankan programnya.";
  });
  return h("section", { class: "card pk-ekspor" }, h("h3", {}, "Ekspor kode"), h("p", {}, "Semua berkas proyekmu dijadikan satu halaman HTML untuk diarsipkan atau dibagikan, lengkap dengan langkah menjalankannya di komputer yang punya JDK."), h("div", { class: "pk-jalan" }, tombol), pesan);
}

function kartuEkspor(ctx, pk, k) {
  if (pk.bahasa === "java") return kartuEksporJava(ctx, pk, k);
  const pesan = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const pilih = h("select", { class: "pk-entri", "aria-label": "Berkas yang dijalankan aplikasi" });
  const isiPilihan = () => {
    const py = Object.keys(k.kerja.berkas).filter((n) => /\.py$/i.test(n)).sort();
    pilih.replaceChildren(...py.map((n) => h("option", { value: n }, n)));
    pilih.value = py.includes(pk.entri) ? pk.entri : py[0] || "";
  };
  isiPilihan();
  const tombol = h("button", { type: "button", class: "btn btn-primary" }, "Ekspor aplikasi (HTML)");
  tombol.addEventListener("click", () => {
    const isi = k.isi();
    if (!pilih.value) {
      pesan.textContent = "Belum ada berkas .py. Buat dulu di salah satu tahap.";
      return;
    }
    const profil = Auth.getProfile();
    const html = P.bangunHtmlEkspor({ judul: pk.judul, deskripsi: pk.deskripsi, berkas: isi, entri: pilih.value, oleh: profil && profil.nama });
    unduh(new Blob([html], { type: "text/html;charset=utf-8" }), P.namaBerkasHtml(pk.judul));
    pesan.textContent = "Berkas HTML diunduh. Buka dengan klik dua kali; butuh internet sekali untuk memuat Python di browser. Berkas ini berdiri sendiri dan boleh dibagikan." + (pilih.value !== pk.entri ? "" : "");
  });
  return h(
    "section",
    { class: "card pk-ekspor" },
    h("h3", {}, "Aplikasi hasil karyamu"),
    h("p", {}, "Semua berkas proyekmu dijadikan satu halaman HTML yang bisa dibuka siapa saja di browser, tanpa memasang Python. Tersedia kapan saja, bahkan sebelum proyek selesai."),
    h("div", { class: "pk-jalan" }, h("label", { class: "pk-label" }, "Jalankan berkas ", pilih), tombol),
    pesan
  );
}

function kartuPenilaian(pk) {
  return h(
    "section",
    { class: "card pk-penilaian" },
    h("h3", {}, "Cara penilaian"),
    h("p", { class: "muted" }, "Kriteria ini sama untuk semua peserta dan terbuka sejak awal. Angka dalam kurung adalah bobotnya."),
    ...pk.penilaian.map((b) => h("div", { class: "pk-nilai-blok" }, h("h4", {}, b.judul), h("ul", {}, b.butir.map((x) => h("li", {}, x)))))
  );
}

/** Isi halaman daftar tahap satu praktikum. */
export function halamanPraktikum(ctx, pk) {
  const k = kelola(ctx, pk);
  const peta = k.peta();
  const ring = P.ringkasPraktikum(pk, peta);
  const berikut = P.tahapBerikut(pk, peta);
  susulDariServer(ctx, pk, k).then((berubah) => berubah && ctx.ulang());
  const daftar = h(
    "ol",
    { class: "pk-tahap-daftar" },
    pk.tahap.map((t, i) => {
      const st = P.statusTahap(peta, t.id);
      return h(
        "li",
        { class: "pk-tahap-item pk-st-" + st },
        h("a", { class: "pk-tahap-tautan", href: hrefPraktikum(ctx, pk.id, t.id) },
          h("span", { class: "pk-no" }, String(i + 1)),
          h("span", { class: "pk-tahap-isi" }, h("strong", {}, t.judul), h("span", { class: "muted" }, (t.bab || []).length ? "Bab " + t.bab.join(", ") : "")),
          h("span", { class: "pk-status pk-st-" + st }, namaStatus(t, st)))
      );
    })
  );
  const otoSemua = ctx.instruktur() ? h("button", { type: "button", class: "btn pk-oto" }, "Jawab semua tahap otomatis (instruktur)") : null;
  const pesanOto = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  if (otoSemua)
    otoSemua.addEventListener("click", async () => {
      otoSemua.disabled = true;
      try {
        const hasil = await jawabOtomatis(ctx, pk, pk.tahap.map((x, i) => i), (i) => (pesanOto.textContent = "Menjawab tahap " + (i + 1) + " dari " + pk.tahap.length));
        const lulus = hasil.filter((r) => r.lulus).length;
        pesanOto.textContent = lulus + " dari " + hasil.length + " tahap lulus.";
        ctx.ulang();
      } catch (e) {
        pesanOto.textContent = "Gagal: " + e.message;
        otoSemua.disabled = false;
      }
    });
  return [
    h("section", { class: "card pk-kepala" },
      h("p", { class: "eyebrow" }, h("a", { href: "#k/" + ctx.kuliah.id }, ctx.kuliah.nama), " / Praktikum"),
      h("h2", {}, pk.judul),
      h("p", {}, pk.deskripsi),
      (pk.gambaran || []).length ? h("ul", { class: "pk-gambaran" }, pk.gambaran.map((g) => h("li", {}, g))) : null,
      bar(ring.lulus + ring.dilewati, ring.total, "Tahap selesai atau dilewati"),
      h("p", { class: "muted" }, ring.lulus + " lulus, " + ring.dilewati + " dilewati, " + (ring.total - ring.lulus - ring.dilewati) + " belum, dari " + ring.total + " tahap. Urutan boleh bebas dan tidak ada yang terkunci."),
      h("div", { class: "cta" }, berikut >= 0 ? h("a", { class: "btn btn-primary", href: hrefPraktikum(ctx, pk.id, pk.tahap[berikut].id) }, ring.lulus + ring.dilewati === 0 ? "Mulai dari tahap 1" : "Lanjutkan: tahap " + (berikut + 1)) : null, otoSemua),
      pesanOto
    ),
    pk.penilaian ? kartuPenilaian(pk) : null,
    h("section", { class: "card" }, h("h3", {}, "Tahap"), daftar),
    pk.tanpaLaporan ? null : kartuEkspor(ctx, pk, k),
    pk.tanpaLaporan ? null : kartuLaporan(ctx, pk, k),
  ].filter(Boolean);
}
