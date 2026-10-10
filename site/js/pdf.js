// Menyusun dan membuat PDF laporan praktikum. `susunLaporan` (murni, diuji dengan node) mengubah data laporan menjadi
// blok-blok; `buatPdf` menggambarnya dengan jsPDF (dimuat dari CDN hanya saat ekspor).
//
// jsPDF bawaan memakai huruf standar (Latin-1), cukup untuk bahasa Indonesia. Karakter di luar itu (panah, tanda centang,
// emoji, huruf bukan Latin) diganti agar tidak menjadi sandi kacau; lihat `bersihkanTeks`.

const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

const GANTI = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", "→": "->", "←": "<-", "✓": "v", "✔": "v", "•": "-", " ": " ", "\t": "    " };

/** Menyisakan karakter yang bisa digambar huruf standar PDF; sisanya diganti. */
export function bersihkanTeks(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/\r/g, "")
    .replace(/[‘’“”–—…→←✓✔• \t]/g, (c) => GANTI[c])
    .replace(/[^\n\x20-\x7E¡-ÿ]/gu, "?");
}

const TGL = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) + ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/**
 * @param {{
 *  matakuliah:string, nomor:number, judul:string, nama:string, nim:string, kelas:string,
 *  kolom:{id:string,label:string,min:number}[], jawaban:Object<string,string>, kodeVerifikasi:string,
 *  lampiran?:{tipe:string,judul:string,isi:string,hasil:string}|null, diekspor?:Date
 * }} d
 */
export function susunLaporan(d) {
  const blok = [];
  const kurang = d.kolom.filter((k) => String(d.jawaban[k.id] || "").trim().length < k.min);
  blok.push({ t: "judul", teks: "LAPORAN PRAKTIKUM" });
  blok.push({ t: "kv", baris: [["Mata kuliah", d.matakuliah], ["Materi", "Bab " + d.nomor + ": " + d.judul], ["Nama", d.nama], ["NIM", d.nim], ["Kelas", d.kelas], ["Diekspor", TGL(d.diekspor || new Date())]] });
  blok.push({
    t: "catatan",
    teks: kurang.length ? "Kelengkapan: " + (d.kolom.length - kurang.length) + " dari " + d.kolom.length + " kolom terisi memadai. Belum memadai: " + kurang.map((k) => k.label).join(", ") + "." : "Kelengkapan: semua " + d.kolom.length + " kolom terisi memadai.",
  });
  for (const k of d.kolom) {
    blok.push({ t: "bagian", teks: k.label });
    const isi = String(d.jawaban[k.id] || "").trim();
    blok.push({ t: "paragraf", teks: isi || "(belum diisi)", kosong: !isi });
  }
  if (d.lampiran) {
    blok.push({ t: "bagian", teks: "Lampiran: " + d.lampiran.judul });
    if (d.lampiran.hasil) blok.push({ t: "paragraf", teks: d.lampiran.hasil });
    if (d.lampiran.isi) blok.push({ t: "kode", teks: d.lampiran.isi });
  }
  blok.push({ t: "kaki", teks: "Kode verifikasi: " + d.kodeVerifikasi });
  return blok;
}

let jspdfJanji = null;
export function muatJsPdf() {
  if (globalThis.jspdf && globalThis.jspdf.jsPDF) return Promise.resolve(globalThis.jspdf.jsPDF);
  if (!jspdfJanji) {
    jspdfJanji = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = JSPDF_URL;
      s.onload = () => (globalThis.jspdf && globalThis.jspdf.jsPDF ? resolve(globalThis.jspdf.jsPDF) : reject(new Error("Pustaka PDF gagal dimuat.")));
      s.onerror = () => {
        jspdfJanji = null;
        reject(new Error("Pustaka PDF tidak bisa diunduh. Periksa koneksi internet lalu coba lagi."));
      };
      document.head.append(s);
    });
  }
  return jspdfJanji;
}

/** Menggambar blok ke dokumen jsPDF (A4). Dipisah dari muat pustaka supaya bisa diuji dengan jsPDF tiruan. */
export function gambarPdf(JsPDF, blok, kodeVerifikasi) {
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const L = 18;
  const R = 192;
  const T = 20;
  const B = 280;
  let y = T;
  const lebar = R - L;
  const baris = (teks, ukuran, gaya, mono) => {
    doc.setFont(mono ? "courier" : "helvetica", gaya || "normal");
    doc.setFontSize(ukuran);
    return doc.splitTextToSize(bersihkanTeks(teks), lebar);
  };
  const tulis = (teks, ukuran = 11, gaya = "normal", mono = false, jarak = 1.4) => {
    const tinggi = (ukuran * 0.3528) * (mono ? 1.15 : 1.35);
    for (const b of baris(teks, ukuran, gaya, mono)) {
      if (y + tinggi > B) {
        doc.addPage();
        y = T;
        doc.setFont(mono ? "courier" : "helvetica", gaya);
        doc.setFontSize(ukuran);
      }
      doc.text(b, L, y);
      y += tinggi;
    }
    y += jarak;
  };
  for (const b of blok) {
    if (b.t === "judul") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text(bersihkanTeks(b.teks), L, y);
      y += 3;
      doc.setDrawColor(11, 127, 124);
      doc.setLineWidth(0.6);
      doc.line(L, y, R, y);
      y += 7;
    } else if (b.t === "kv") {
      for (const [k, v] of b.baris) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(bersihkanTeks(k), L, y);
        doc.setFont("helvetica", "normal");
        const nilai = doc.splitTextToSize(bersihkanTeks(v), lebar - 32);
        nilai.forEach((n, i) => doc.text(n, L + 32, y + i * 5));
        y += Math.max(1, nilai.length) * 5 + 0.6;
      }
      y += 3;
    } else if (b.t === "catatan") {
      tulis(b.teks, 9.5, "italic", false, 4);
    } else if (b.t === "bagian") {
      if (y + 18 > B) {
        doc.addPage();
        y = T;
      }
      y += 2;
      tulis(b.teks, 12, "bold", false, 0.8);
    } else if (b.t === "paragraf") {
      tulis(b.teks, 11, b.kosong ? "italic" : "normal", false, 3);
    } else if (b.t === "kode") {
      tulis(b.teks, 8.5, "normal", true, 3);
    }
  }
  // kaki tiap halaman: kode verifikasi dan nomor halaman
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(L, 287, R, 287);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Kode verifikasi: " + bersihkanTeks(kodeVerifikasi), L, 292);
    doc.text("Halaman " + i + " dari " + n, R, 292, { align: "right" });
  }
  return doc;
}

export async function buatPdf(d) {
  const JsPDF = await muatJsPdf();
  const doc = gambarPdf(JsPDF, susunLaporan(d), d.kodeVerifikasi);
  return doc.output("blob");
}

/** PDF dari blok yang sudah disusun (dipakai laporan praktikum, yang menyusun bloknya sendiri). */
export async function buatPdfBlok(blok, kodeVerifikasi) {
  const JsPDF = await muatJsPdf();
  return gambarPdf(JsPDF, blok, kodeVerifikasi).output("blob");
}

export function namaBerkas(d) {
  const aman = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return "laporan-" + aman(d.matakuliahId || d.matakuliah) + "-bab-" + String(d.nomor).padStart(2, "0") + "-" + aman(d.nim) + ".pdf";
}
