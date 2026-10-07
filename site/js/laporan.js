// Laporan praktikum per bab. SELALU terbuka dan SELALU bisa diekspor ke PDF, walaupun tantangannya belum lulus atau
// kodenya gagal. Yang dibatasi hanya salin dan tempel di kolom laporan, supaya diketik sendiri.
//
// Keadaan laporan disimpan di browser (per akun) dan disusulkan ke Supabase (tabel laporan) lewat sinkron.js.
import { h } from "./dom.js";
import * as Anticopas from "./anticopas.js";
import { buatPdf, namaBerkas } from "./pdf.js";

// Lima kolom. `min` hanya petunjuk kelengkapan; tidak pernah memblokir apa pun.
export const KOLOM = [
  { id: "tujuan", label: "Tujuan", petunjuk: "Apa yang ingin kamu capai atau pelajari pada bab ini? Tulis dengan kalimatmu sendiri.", min: 40 },
  { id: "konsep", label: "Pertanyaan konsep", petunjuk: "", min: 60 },
  { id: "langkah", label: "Langkah pengerjaan", petunjuk: "Ceritakan langkah-langkah yang kamu lakukan, dari membaca sampai kodemu berjalan.", min: 60 },
  { id: "kendala", label: "Kendala dan cara mengatasinya", petunjuk: "Apa yang sulit atau membuatmu tersangkut, dan bagaimana kamu mengatasinya? Jujur saja, ini bagian terpenting.", min: 40 },
  { id: "kesimpulan", label: "Kesimpulan", petunjuk: "Apa yang sekarang kamu pahami yang sebelumnya belum?", min: 40 },
];

export const kodeVerifikasiBaru = () => {
  const b = new Uint8Array(8);
  (globalThis.crypto || window.crypto).getRandomValues(b);
  const huruf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(b, (x) => huruf[x % huruf.length]).join("") + "";
};

/** Keadaan awal laporan satu bab. */
export const laporanKosong = () => ({ jawaban: {}, ketikan: {}, tempel: 0, durasi: 0, kode: kodeVerifikasiBaru(), diekspor: null, diperbarui: null });

/** Berapa kolom yang sudah memadai (panjang minimum), tanpa memblokir apa pun. */
export function kelengkapan(jawaban, kolom = KOLOM) {
  const baik = kolom.filter((k) => String(jawaban[k.id] || "").trim().length >= k.min).length;
  return { baik, total: kolom.length, lengkap: baik === kolom.length };
}

/** Baris untuk tabel laporan di Supabase. */
export const keBaris = (mataKuliah, bab, lap) => ({
  matakuliah_id: mataKuliah,
  bab,
  jawaban: lap.jawaban,
  jumlah_ketikan: lap.ketikan,
  percobaan_tempel: lap.tempel,
  durasi_menulis_detik: Math.round(lap.durasi),
  kode_verifikasi: lap.kode,
  status: "draf", // tidak pernah dikunci
  dikumpulkan_pada: lap.diekspor,
});

/** Menggabungkan laporan lokal dengan baris dari server: yang lebih panjang isinya dan lebih banyak ketikannya dianggap lebih maju. */
export function gabungkan(lokal, baris) {
  if (!baris) return lokal;
  const panjang = (j) => Object.values(j || {}).reduce((a, s) => a + String(s || "").length, 0);
  const server = { jawaban: baris.jawaban || {}, ketikan: baris.jumlah_ketikan || {}, tempel: baris.percobaan_tempel || 0, durasi: baris.durasi_menulis_detik || 0, kode: baris.kode_verifikasi, diekspor: baris.dikumpulkan_pada || null, diperbarui: baris.diperbarui_pada || null };
  if (!lokal || panjang(server.jawaban) > panjang(lokal.jawaban)) return Object.assign({}, server, { tempel: Math.max(server.tempel, lokal ? lokal.tempel : 0), durasi: Math.max(server.durasi, lokal ? lokal.durasi : 0) });
  // lokal lebih maju: pakai kode verifikasi server agar PDF cocok dengan catatan di sistem
  return Object.assign({}, lokal, { kode: server.kode || lokal.kode, tempel: Math.max(server.tempel, lokal.tempel), durasi: Math.max(server.durasi, lokal.durasi) });
}

/**
 * Kartu laporan.
 * @param {object} c
 *   c.store {get,set}; c.kunci (nama kunci penyimpanan); c.mataKuliah {id,nama}; c.bab; c.judul; c.pertanyaan;
 *   c.profil {nama,nim,kelas}; c.lampiran(): {tipe,judul,isi,hasil}|null; c.simpanKeServer(baris); c.catatTempel(); c.instruktur()
 */
export function laporanCard(c) {
  let lap = Object.assign(laporanKosong(), c.store.get(c.kunci, null) || {});
  const kolom = KOLOM.map((k) => (k.id === "konsep" ? Object.assign({}, k, { petunjuk: c.pertanyaan || "Jelaskan konsep utama bab ini dengan bahasamu sendiri." }) : k));
  const pesan = h("p", { class: "form-msg", role: "status", "aria-live": "polite" });
  const status = h("span", { class: "muted lap-status" });
  let timerSimpan = null;
  let terakhirKetik = 0;

  const simpan = () => {
    lap.diperbarui = new Date().toISOString();
    c.store.set(c.kunci, lap);
    c.simpanKeServer(keBaris(c.mataKuliah.id, c.bab, lap));
    status.textContent = "Tersimpan " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };
  const jadwalSimpan = () => {
    clearTimeout(timerSimpan);
    timerSimpan = setTimeout(simpan, 1500);
  };

  const medan = kolom.map((k) => {
    const area = h("textarea", { class: "input lap-area", id: "lap-" + k.id, rows: "4", "aria-describedby": "lap-bantu-" + k.id, autocomplete: "off", spellcheck: "true" });
    area.value = lap.jawaban[k.id] || "";
    const hitung = h("span", { class: "lap-hitung muted", id: "lap-hitung-" + k.id });
    const perbarui = () => {
      const n = area.value.trim().length;
      hitung.textContent = n + " karakter" + (n >= k.min ? " (cukup)" : " (disarankan minimal " + k.min + ")");
      hitung.classList.toggle("cukup", n >= k.min);
    };
    // Hitung huruf yang benar-benar diketik (bukan dimasukkan sekaligus) dan waktu menulis aktif.
    area.addEventListener("beforeinput", (e) => {
      if (e.inputType === "insertText" && e.data) lap.ketikan[k.id] = (lap.ketikan[k.id] || 0) + e.data.length;
      else if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") lap.ketikan[k.id] = (lap.ketikan[k.id] || 0) + 1;
    });
    area.addEventListener("input", () => {
      const sekarang = Date.now();
      if (terakhirKetik) lap.durasi += Math.min(20, (sekarang - terakhirKetik) / 1000);
      terakhirKetik = sekarang;
      lap.jawaban[k.id] = area.value;
      perbarui();
      jadwalSimpan();
    });
    area.addEventListener("blur", () => {
      clearTimeout(timerSimpan);
      simpan();
    });
    perbarui();
    return h("div", { class: "field lap-kolom" }, h("label", { for: "lap-" + k.id }, k.label), k.petunjuk ? h("p", { class: "muted lap-bantu", id: "lap-bantu-" + k.id }, k.petunjuk) : null, area, hitung);
  });

  const unduh = h("button", { type: "button", class: "btn btn-primary" }, "Ekspor PDF");
  unduh.addEventListener("click", async () => {
    unduh.disabled = true;
    pesan.textContent = "Menyiapkan PDF";
    try {
      lap.diekspor = new Date().toISOString();
      clearTimeout(timerSimpan);
      simpan();
      const data = { matakuliah: c.mataKuliah.nama, matakuliahId: c.mataKuliah.id, nomor: c.bab, judul: c.judul, nama: c.profil.nama, nim: c.profil.nim, kelas: c.profil.kelas, kolom, jawaban: lap.jawaban, kodeVerifikasi: lap.kode, lampiran: c.lampiran(), diekspor: new Date() };
      const blob = await buatPdf(data);
      const a = h("a", { href: URL.createObjectURL(blob), download: namaBerkas(data) });
      document.body.append(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
      const kl = kelengkapan(lap.jawaban, kolom);
      pesan.textContent = "PDF diunduh." + (kl.lengkap ? "" : " Perlu diketahui: " + kl.baik + " dari " + kl.total + " kolom sudah memadai; kamu tetap boleh mengumpulkannya.");
    } catch (e) {
      pesan.textContent = "Gagal membuat PDF: " + e.message;
    } finally {
      unduh.disabled = false;
    }
  });

  const kartu = h(
    "section",
    { class: "card bab-laporan", "aria-label": "Laporan praktikum" },
    h("h3", {}, "Laporan praktikum"),
    h("p", { class: "muted" }, "Laporan selalu terbuka dan bisa diekspor kapan saja, walaupun tantangannya belum lulus atau kodenya masih gagal. Ketik sendiri jawabanmu (salin dan tempel dimatikan); jawaban tersimpan otomatis."),
    ...medan,
    h("div", { class: "actions" }, unduh, status),
    pesan
  );
  Anticopas.blokirSalinTempel(kartu, {
    lokasi: "laporan",
    kecualikan: c.instruktur,
    saatTempel: () => {
      lap.tempel++;
      c.catatTempel();
      jadwalSimpan();
    },
  });
  // Pulihkan dari server bila ada yang lebih maju (mis. dikerjakan di perangkat lain).
  kartu.terapkanServer = (baris) => {
    lap = Object.assign(laporanKosong(), gabungkan(lap, baris));
    c.store.set(c.kunci, lap);
    kolom.forEach((k) => {
      const a = kartu.querySelector("#lap-" + k.id);
      if (a && document.activeElement !== a) {
        a.value = lap.jawaban[k.id] || "";
        a.dispatchEvent(new Event("change"));
        const n = a.value.trim().length;
        const hi = kartu.querySelector("#lap-hitung-" + k.id);
        if (hi) hi.textContent = n + " karakter" + (n >= k.min ? " (cukup)" : " (disarankan minimal " + k.min + ")");
      }
    });
  };
  return kartu;
}
