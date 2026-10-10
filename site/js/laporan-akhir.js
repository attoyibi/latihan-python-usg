// Laporan akhir: satu dokumen per peserta per mata kuliah yang menggabungkan, untuk setiap bab, status dan kode latihan, kode praktik,
// dan refleksi laporan bab, ditambah form akhir. Bagian murni (tanpa DOM dan jaringan) diuji dengan tools/uji_laporan_akhir.mjs.
//
// Kode TIDAK diketik atau ditempel peserta di laporan: ia ditarik otomatis dari kiriman terakhir (tabel percobaan atau browser),
// dan dari berkas praktik. Hanya form akhir yang ditulis peserta, sehingga aturan salin-tempel tetap utuh.
import { KOLOM, kelengkapan } from "./laporan.js";

export const PID_AKHIR = "akhir";
export const MAKS_BARIS_KODE = 80;
export const KOLOM_AKHIR = [
  { id: "apa", label: "Apa yang kamu pelajari dan hasilkan", petunjuk: "Ceritakan dengan kalimatmu sendiri apa yang sekarang kamu bisa buat atau pahami dari mata kuliah ini.", min: 80 },
  { id: "kendala", label: "Kendala terbesar dan cara mengatasinya", petunjuk: "Apa yang paling sulit, dan bagaimana kamu mengatasinya? Jujur saja, ini bagian terpenting.", min: 60 },
  { id: "kesimpulan", label: "Kesimpulan dan rencana belajar selanjutnya", petunjuk: "Apa yang akan kamu lakukan berbeda, dan apa yang ingin kamu pelajari berikutnya?", min: 60 },
];
export const kelengkapanAkhir = (jawaban) => kelengkapan(jawaban || {}, KOLOM_AKHIR);

/** Memotong kode yang sangat panjang supaya PDF tidak membengkak. @returns {{teks:string, dipotong:number}} */
export function potongKode(kode, maks = MAKS_BARIS_KODE) {
  const baris = String(kode || "").replace(/\r/g, "").replace(/\s+$/, "").split("\n");
  if (baris.length <= maks) return { teks: baris.join("\n"), dipotong: 0 };
  return { teks: baris.slice(0, maks).join("\n"), dipotong: baris.length - maks };
}

/**
 * Memilih kiriman yang dilaporkan untuk tiap bab dari baris tabel percobaan (jenis kirim): kiriman LULUS terakhir bila ada,
 * kalau tidak, kiriman terakhir. @returns {Map<number,{kode:string,lulus:boolean,kasus_lulus:number,kasus_total:number,kirim:number}>}
 */
export function pilihKiriman(baris) {
  const poBab = new Map();
  for (const r of baris || []) {
    if (!poBab.has(r.bab)) poBab.set(r.bab, []);
    poBab.get(r.bab).push(r);
  }
  const hasil = new Map();
  for (const [bab, daftar] of poBab) {
    const urut = daftar.slice().sort((a, b) => String(a.dibuat_pada || "").localeCompare(String(b.dibuat_pada || "")));
    const terpilih = urut.filter((r) => r.lulus === true).pop() || urut[urut.length - 1];
    hasil.set(bab, { kode: terpilih.kode || "", lulus: terpilih.lulus === true, kasus_lulus: terpilih.kasus_lulus ?? null, kasus_total: terpilih.kasus_total ?? null, kirim: urut.length });
  }
  return hasil;
}

const STATUS_LATIHAN = { selesai: "lulus", sedang: "sedang dikerjakan", belum: "belum dikerjakan" };
const STATUS_PRAKTIK = { lulus: "lulus", sedang: "sedang dikerjakan", belum: "belum dikerjakan" };

/** Satu kalimat status untuk satu bab. */
export function kalimatStatus(b) {
  const bagian = [];
  if (b.jenis === "kode" || b.jenis === "konsep") {
    const l = b.latihan || {};
    let t = (b.jenis === "konsep" ? "Tantangan konsep: " : "Latihan: ") + (STATUS_LATIHAN[l.status] || STATUS_LATIHAN.belum);
    if (l.kasus_total) t += " (" + l.kasus_lulus + " dari " + l.kasus_total + (b.jenis === "konsep" ? " bagian benar" : " kasus uji cocok") + ")";
    if (l.kirim) t += ", " + l.kirim + " kali kirim";
    bagian.push(t);
  } else bagian.push("Bab ini dikumpulkan sebagai tugas unggahan.");
  if (b.praktik) bagian.push("Praktik: " + (STATUS_PRAKTIK[b.praktik.status] || STATUS_PRAKTIK.belum) + (b.praktik.kirim ? ", diperiksa " + b.praktik.kirim + " kali" : ""));
  return bagian.join(". ") + ".";
}

/** Ringkasan angka seluruh paket (dipakai catatan di PDF, dashboard, dan kartu di halaman mata kuliah). */
export function ringkasAkhir(paket) {
  const kode = paket.bab.filter((b) => b.jenis === "kode");
  const konsep = paket.bab.filter((b) => b.jenis === "konsep");
  const punyaPraktik = paket.bab.filter((b) => b.praktik);
  const wajib = paket.bab.filter((b) => b.jenis !== "unggah");
  const refleksi = paket.bab.filter((b) => kelengkapan((b.refleksi && b.refleksi.jawaban) || {}, KOLOM).baik >= 3);
  const ka = kelengkapanAkhir(paket.akhir && paket.akhir.jawaban);
  return {
    bab: paket.bab.length,
    latihanLulus: wajib.filter((b) => b.latihan && b.latihan.status === "selesai").length,
    latihanTotal: wajib.length,
    kodeLulus: kode.filter((b) => b.latihan && b.latihan.status === "selesai").length,
    kodeTotal: kode.length,
    konsepLulus: konsep.filter((b) => b.latihan && b.latihan.status === "selesai").length,
    praktikLulus: punyaPraktik.filter((b) => b.praktik.status === "lulus").length,
    praktikTotal: punyaPraktik.length,
    refleksiTerisi: refleksi.length,
    akhirBaik: ka.baik,
    akhirTotal: ka.total,
    akhirLengkap: ka.lengkap,
  };
}

const TGL = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) + ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/**
 * Blok-blok untuk PDF laporan akhir (format blok sama dengan pdf.js: judul, kv, catatan, bagian, paragraf, kode, kaki).
 * @param {object} paket {identitas:{nama,nim,kelas}, matakuliah:{nama}, bab:[{bab,judul,jenis,latihan,praktik,refleksi}], akhir:{jawaban,kode}, diekspor?:Date}
 */
export function susunBlokAkhir(paket) {
  const r = ringkasAkhir(paket);
  const blok = [];
  blok.push({ t: "judul", teks: "LAPORAN AKHIR" });
  blok.push({ t: "kv", baris: [["Mata kuliah", paket.matakuliah.nama], ["Nama", paket.identitas.nama], ["NIM", paket.identitas.nim], ["Kelas", paket.identitas.kelas], ["Diekspor", TGL(paket.diekspor || new Date())]] });
  blok.push({
    t: "catatan",
    teks: "Ringkasan: latihan lulus " + r.latihanLulus + " dari " + r.latihanTotal + " bab" + (r.praktikTotal ? "; praktik lulus " + r.praktikLulus + " dari " + r.praktikTotal : "") + "; refleksi bab terisi memadai " + r.refleksiTerisi + " dari " + r.bab + "; form akhir " + r.akhirBaik + " dari " + r.akhirTotal + " kolom terisi memadai.",
  });
  for (const b of paket.bab) {
    blok.push({ t: "bagian", teks: "Bab " + b.bab + ": " + b.judul });
    blok.push({ t: "paragraf", teks: kalimatStatus(b) });
    const jawaban = (b.refleksi && b.refleksi.jawaban) || {};
    const terisi = KOLOM.filter((k) => String(jawaban[k.id] || "").trim());
    if (terisi.length) for (const k of terisi) blok.push({ t: "paragraf", teks: k.label + ": " + String(jawaban[k.id]).trim() });
    else blok.push({ t: "paragraf", teks: "Refleksi bab: (belum diisi)", kosong: true });
    if (b.jenis === "kode") {
      const kode = b.latihan && b.latihan.kodeAkhir ? potongKode(b.latihan.kodeAkhir) : null;
      blok.push({ t: "paragraf", teks: kode ? "Kode latihan" + (b.latihan.lulus === false ? " (kiriman terakhir, belum lulus)" : "") + ":" : "Kode latihan: (belum ada kiriman)", kosong: !kode });
      if (kode) {
        blok.push({ t: "kode", teks: kode.teks });
        if (kode.dipotong) blok.push({ t: "catatan", teks: "(" + kode.dipotong + " baris lagi tidak ditampilkan)" });
      }
    }
    if (b.praktik) {
      const kode = b.praktik.isi ? potongKode(b.praktik.isi) : null;
      blok.push({ t: "paragraf", teks: kode ? "Kode praktik (" + b.praktik.berkas + "):" : "Kode praktik: (belum dikerjakan)", kosong: !kode });
      if (kode) {
        blok.push({ t: "kode", teks: kode.teks });
        if (kode.dipotong) blok.push({ t: "catatan", teks: "(" + kode.dipotong + " baris lagi tidak ditampilkan)" });
      }
    }
  }
  blok.push({ t: "bagian", teks: "Form akhir" });
  for (const k of KOLOM_AKHIR) {
    const isi = String(((paket.akhir && paket.akhir.jawaban) || {})[k.id] || "").trim();
    blok.push({ t: "paragraf", teks: k.label + ": " + (isi || "(belum diisi)"), kosong: !isi });
  }
  blok.push({ t: "kaki", teks: "Kode verifikasi: " + ((paket.akhir && paket.akhir.kode) || "-") });
  return blok;
}

export const namaBerkasAkhir = (paket) => "laporan-akhir-" + String(paket.matakuliah.id || paket.matakuliah.nama || "kuliah").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + String(paket.identitas.nim || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf";

/**
 * Menyusun paket dari data mentah (baris tabel dan, bila ada, keadaan lokal peserta sendiri).
 * @param {object} d {profil, matakuliah:{id,nama}, materi:[{bab,judul,jenis}], babPraktik:Set<number>, defPraktik:Map<number,{judul,berkas}>,
 *   progres:[], percobaan:[], laporan:[], berkasPraktik:[], tahapPraktik:[], akhir:{...}|null, lokal?:{latihan(bab), laporan(bab), praktik(bab)}}
 */
export function susunPaket(d) {
  const kiriman = pilihKiriman(d.percobaan);
  const progres = new Map((d.progres || []).map((p) => [p.bab, p]));
  const laporan = new Map((d.laporan || []).map((l) => [l.bab, l]));
  const berkas = new Map();
  for (const f of d.berkasPraktik || []) {
    const m = /^bab-(\d{2})$/.exec(f.praktikum_id || "");
    if (m) berkas.set(Number(m[1]), f);
  }
  const tahap = new Map();
  for (const t of d.tahapPraktik || []) {
    const m = /^bab-(\d{2})$/.exec(t.praktikum_id || "");
    if (m && t.tahap_id === "p01") tahap.set(Number(m[1]), t);
  }
  const bab = d.materi.map((m) => {
    const lok = (d.lokal && d.lokal.latihan(m.bab)) || null;
    const pr = progres.get(m.bab);
    const k = kiriman.get(m.bab);
    const status = (lok && lok.selesai) || (pr && pr.status === "selesai") || (k && k.lulus) ? "selesai" : (lok && lok.mulai) || (pr && pr.status === "sedang") || k ? "sedang" : "belum";
    const kodeAkhir = lok && lok.kode ? lok.kode : k && m.jenis === "kode" ? k.kode : "";
    const punyaLok = !!lok && (!!lok.kode || lok.kasus_total != null);
    const latihan = {
      status,
      kirim: Math.max(lok ? lok.kirim || 0 : 0, pr ? pr.jumlah_kirim || 0 : 0, k ? k.kirim : 0),
      kodeAkhir: m.jenis === "kode" ? kodeAkhir : "",
      lulus: punyaLok ? lok.lulus : k ? k.lulus : null,
      kasus_lulus: punyaLok ? lok.kasus_lulus : k ? k.kasus_lulus : null,
      kasus_total: punyaLok ? lok.kasus_total : k ? k.kasus_total : null,
    };
    const lapLok = d.lokal && d.lokal.laporan(m.bab);
    const lapSrv = laporan.get(m.bab);
    const jawaban = Object.assign({}, (lapSrv && lapSrv.jawaban) || {}, (lapLok && lapLok.jawaban) || {});
    let praktik = null;
    if (d.babPraktik && d.babPraktik.has(m.bab)) {
      const def = (d.defPraktik && d.defPraktik.get(m.bab)) || {};
      const lp = d.lokal && d.lokal.praktik(m.bab);
      const f = berkas.get(m.bab);
      const t = tahap.get(m.bab);
      const urut = { belum: 0, sedang: 1, lulus: 2 };
      const sl = lp ? lp.status : "belum";
      const ss = t ? t.status : "belum";
      praktik = { judul: def.judul || "", berkas: def.berkas || (f && f.nama) || "", status: urut[sl] >= urut[ss] ? sl : ss, kirim: Math.max(lp ? lp.jumlah_kirim || 0 : 0, t ? t.jumlah_kirim || 0 : 0), isi: lp && lp.isi ? lp.isi : f ? f.isi : "" };
    }
    return { bab: m.bab, judul: m.judul, jenis: m.jenis, latihan, refleksi: { jawaban }, praktik };
  });
  return { identitas: { nama: d.profil.nama, nim: d.profil.nim, kelas: d.profil.kelas }, matakuliah: d.matakuliah, bab, akhir: d.akhir || { jawaban: {}, kode: "" }, diekspor: d.diekspor || new Date() };
}
