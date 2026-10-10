// Logika murni praktikum: status tahap, berkas awal dan berkas contoh bagi yang tertinggal, validasi berkas, hasil uji,
// ekspor proyek sebagai satu halaman HTML, dan laporan praktikum. Tidak menyentuh DOM atau jaringan; diuji dengan
// tools/uji_praktikum.mjs. Definisi praktikum (tahap, langkah, kasus) ada di berkas JSON situs, bukan di database.
import { kelengkapan } from "./laporan.js";

export const MAKS_BERKAS = 30; // batas di tampilan; database membatasi 40
export const MAKS_UKURAN = 100000;
export const EKSTENSI = [".py", ".txt", ".json", ".csv", ".md"];
export const EKSTENSI_JAVA = [".java", ".txt", ".json", ".csv", ".md"];
export const NAMA_JAVA = /^[A-Za-z_][A-Za-z0-9_]{0,58}\.java$/;
export const NAMA_RESERVASI_JAVA = ["Uji", "GagalUji", "JavaRun"];
/** Akhiran berkas kode yang dijalankan untuk satu bahasa. */
export const berkasKode = (bahasa) => (bahasa === "java" ? /\.java$/i : /\.py$/i);
export const POLA_NAMA = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}$/;
export const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";

// ---------- status ----------
export const STATUS = { belum: "Belum", sedang: "Sedang dikerjakan", lulus: "Lulus", dilewati: "Dilewati" };

/** Baris status tiap tahap (dari tabel praktikum_tahap) menjadi peta tahap_id -> baris. */
export const petaStatus = (baris) => new Map((baris || []).map((r) => [r.tahap_id, r]));
export const statusTahap = (peta, id) => (peta.get(id) && peta.get(id).status) || "belum";

export function ringkasPraktikum(praktikum, peta) {
  const hit = { lulus: 0, dilewati: 0, sedang: 0, belum: 0 };
  for (const t of praktikum.tahap) hit[statusTahap(peta, t.id)]++;
  const total = praktikum.tahap.length;
  return Object.assign(hit, { total, persen: total ? Math.round((hit.lulus / total) * 100) : 0 });
}

/** Tahap yang menyebut bab tertentu (untuk notifikasi di halaman bab). */
export function tahapUntukBab(daftarPraktikum, bab) {
  const hasil = [];
  for (const p of daftarPraktikum) p.tahap.forEach((t, indeks) => (t.bab || []).includes(bab) && hasil.push({ praktikum: p, tahap: t, indeks }));
  return hasil;
}
/** Bab yang punya tahap praktik (untuk tanda "Ada praktik" di daftar bab). */
export function babBerpraktik(daftarPraktikum) {
  const s = new Set();
  for (const p of daftarPraktikum) for (const t of p.tahap) for (const b of t.bab || []) s.add(b);
  return s;
}
/** Tahap pertama yang belum lulus dan belum dilewati (untuk tombol "Lanjutkan"); -1 bila semua selesai. */
export function tahapBerikut(praktikum, peta) {
  return praktikum.tahap.findIndex((t) => !["lulus", "dilewati"].includes(statusTahap(peta, t.id)));
}

/** Tahap yang tidak punya kasus uji otomatis: dikerjakan di laptop atau dinilai dosen dengan rubrik. */
export const tanpaUji = (tahap) => !(tahap.kasus && tahap.kasus.length);
export const jalurTahap = (tahap) => tahap.jalur || "web";
export const NAMA_JALUR_TAHAP = { web: "Di website", laptop: "Di laptop sendiri" };

// ---------- berkas ----------
/** @returns {string} pesan galat, atau "" bila nama sah */
export function validasiNamaBerkas(nama, ada = [], { jumlah = ada.length, bahasa = "python" } = {}) {
  const n = String(nama || "");
  if (!n) return "Tulis nama berkas.";
  if (n.length > 60) return "Nama berkas terlalu panjang (maksimal 60 karakter).";
  if (/[\\/]/.test(n)) return "Nama berkas tidak boleh memuat garis miring (semua berkas ada di satu folder).";
  if (/\s/.test(n)) return "Nama berkas tidak boleh memuat spasi. Pakai garis bawah, mis. daftar_barang.py.";
  if (!POLA_NAMA.test(n)) return "Nama berkas hanya boleh huruf, angka, titik, strip, dan garis bawah, dan tidak boleh diawali titik.";
  const ekstensi = bahasa === "java" ? EKSTENSI_JAVA : EKSTENSI;
  if (!ekstensi.some((e) => n.toLowerCase().endsWith(e))) return "Akhiran berkas harus salah satu dari: " + ekstensi.join(", ") + ".";
  if (bahasa === "java" && n.toLowerCase().endsWith(".java")) {
    if (!NAMA_JAVA.test(n)) return "Nama berkas Java harus sama dengan nama kelasnya: huruf, angka, dan garis bawah saja, mis. Buku.java.";
    if (NAMA_RESERVASI_JAVA.includes(n.slice(0, -5))) return "Nama " + n + " dipakai penguji. Pilih nama kelas lain.";
  }
  if (ada.includes(n)) return "Sudah ada berkas bernama " + n + ".";
  if (jumlah >= MAKS_BERKAS) return "Sudah mencapai batas " + MAKS_BERKAS + " berkas. Hapus yang tidak dipakai dulu.";
  return "";
}
export const ukuranSah = (isi) => String(isi || "").length <= MAKS_UKURAN;

/** Peta nama -> {isi, asal} menjadi peta nama -> isi (yang dikirim ke penguji). */
export const keIsi = (berkas) => Object.fromEntries(Object.entries(berkas).map(([n, b]) => [n, b.isi]));

/**
 * Melengkapi ruang kerja untuk membuka tahap `idx`: berkas contoh dari tahap-tahap SEBELUMNYA yang belum dimiliki peserta
 * (karena dilewati atau belum dikerjakan), dan berkas awal tahap ini bila belum ada. Berkas milik peserta tidak pernah
 * ditimpa. pakaiContoh = ada berkas dari tahap sebelumnya yang masih berupa contoh.
 */
export function lengkapiDariContoh(praktikum, idx, berkas) {
  const hasil = Object.assign({}, berkas);
  const ditambah = [];
  const dariSebelum = new Set();
  for (let j = 0; j < idx; j++) {
    for (const [nama, isi] of Object.entries(praktikum.tahap[j].contoh || {})) {
      dariSebelum.add(nama);
      // Tahap yang merevisi berkas tahap sebelumnya memberi contoh baru: contoh yang belum diubah peserta diperbarui ke versi terbaru.
      if (!hasil[nama] || (hasil[nama].asal === "contoh" && hasil[nama].isi !== isi)) {
        hasil[nama] = { isi, asal: "contoh" };
        if (!ditambah.includes(nama)) ditambah.push(nama);
      }
    }
  }
  for (const [nama, isi] of Object.entries((praktikum.tahap[idx] && praktikum.tahap[idx].awal) || {})) {
    if (!hasil[nama]) {
      hasil[nama] = { isi, asal: "awal" };
      ditambah.push(nama);
    }
  }
  const pakaiContoh = Object.entries(hasil).some(([nama, b]) => b.asal === "contoh" && dariSebelum.has(nama));
  return { berkas: hasil, ditambah, pakaiContoh };
}
/** Mengembalikan berkas awal tahap ini ke kerangka semula. Berkas lain tidak disentuh. */
export function kembalikanAwal(praktikum, idx, berkas) {
  const hasil = Object.assign({}, berkas);
  for (const [nama, isi] of Object.entries(praktikum.tahap[idx].awal || {})) hasil[nama] = { isi, asal: "awal" };
  return hasil;
}
/** Menggantikan berkas yang diminta tahap ini dengan berkas contoh (untuk yang ingin melanjutkan tanpa mengerjakannya). */
export function terapkanContoh(praktikum, idx, berkas) {
  const hasil = Object.assign({}, berkas);
  for (const [nama, isi] of Object.entries(praktikum.tahap[idx].contoh || {})) hasil[nama] = { isi, asal: "contoh" };
  return hasil;
}
/** Tandai berkas sebagai milik peserta begitu ia mengubah isinya. */
export const tandaiMilik = (berkas, nama, isi) => Object.assign({}, berkas, { [nama]: { isi, asal: "milik" } });

// ---------- hasil uji ----------
/**
 * Mengolah hasil penguji (kasus) menjadi ringkasan. Rincian kasus tersembunyi yang gagal disembunyikan.
 * @param {{nama:string, lulus:boolean, pesan:string, tersembunyi?:boolean, keluaran?:string}[]} kasus
 */
export function ringkasHasil(kasus) {
  const benar = kasus.filter((k) => k.lulus).length;
  return {
    lulus: kasus.length > 0 && benar === kasus.length,
    benar,
    total: kasus.length,
    tampil: kasus.map((k) => ({ nama: k.tersembunyi ? "Kasus tersembunyi" : k.nama, lulus: k.lulus, pesan: k.tersembunyi && !k.lulus ? "Belum lulus (rincian disembunyikan)." : k.pesan || "", tersembunyi: !!k.tersembunyi })),
  };
}
/** Hasil yang disimpan di riwayat versi: tanpa keluaran panjang, dan tanpa rincian kasus tersembunyi. */
export const hasilUntukRiwayat = (ringkas) => ({ benar: ringkas.benar, total: ringkas.total, kasus: ringkas.tampil.map((k) => ({ nama: k.nama, lulus: k.lulus, pesan: String(k.pesan || "").slice(0, 300) })) });

// ---------- ekspor HTML ----------
const lolos = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** JSON aman untuk ditaruh di dalam <script>: karakter < diganti agar tidak bisa menutup tag script. */
const jsonAman = (x) => JSON.stringify(x).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/**
 * Satu halaman HTML mandiri berisi proyek peserta dan penjalan Python di browser. Dibuka dengan klik dua kali; butuh internet
 * hanya untuk mengunduh Python di browser (Pyodide). Masukan program (input()) ditanyakan lewat kotak dialog browser.
 * @param {{judul:string, deskripsi?:string, berkas:Object<string,string>, entri:string, oleh?:string}} d
 */
export function bangunHtmlEkspor(d) {
  const data = { berkas: d.berkas, entri: d.entri, pyodide: PYODIDE_URL };
  const daftar = Object.keys(d.berkas).sort();
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${lolos(d.judul)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:16px;background:#f6f8f8;color:#0b1b1c;line-height:1.55}
main{max-width:760px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}
p.k{color:#4a5b5c;margin:0 0 14px}
button{font:inherit;padding:9px 18px;border-radius:10px;border:1px solid #0b7f7c;background:#0b7f7c;color:#fff;cursor:pointer}
button.l{background:#fff;color:#0b7f7c}
button:disabled{opacity:.6;cursor:wait}
pre{background:#0b3d3f;color:#d9f3f1;padding:12px 14px;border-radius:12px;white-space:pre-wrap;word-break:break-word;min-height:120px;font-size:14px}
details{margin:14px 0;background:#fff;border:1px solid #dbe6e5;border-radius:12px;padding:10px 14px}
summary{cursor:pointer;font-weight:600}
code{font-size:13px}
.s{color:#4a5b5c;font-size:13px}
@media (prefers-color-scheme:dark){body{background:#081616;color:#eaf4f3}p.k,.s{color:#9db3b2}details{background:#0c1e1e;border-color:#254242}button.l{background:#0c1e1e}}
</style>
</head>
<body>
<main>
<h1>${lolos(d.judul)}</h1>
<p class="k">${lolos(d.deskripsi || "Aplikasi ini dibuat di praktikum dan berjalan di browser.")}${d.oleh ? " Dibuat oleh " + lolos(d.oleh) + "." : ""}</p>
<p><button id="jalan" disabled>Memuat Python</button> <button id="bersih" class="l" hidden>Bersihkan layar</button></p>
<p class="s">Program akan menanyakan masukan lewat kotak dialog. Tekan Batal untuk mengakhiri masukan. Python diunduh dari internet sekali saat halaman dibuka.</p>
<pre id="layar" aria-live="polite">Siap dijalankan setelah Python selesai dimuat.</pre>
<details><summary>Lihat kode (${daftar.length} berkas)</summary>
${daftar.map((n) => `<h3>${lolos(n)}</h3><pre><code>${lolos(d.berkas[n])}</code></pre>`).join("\n")}
</details>
<p class="s">Dibuat dari situs latihan. Berkas ini berdiri sendiri dan boleh dibagikan.</p>
</main>
<script type="application/json" id="proyek">${jsonAman(data)}</script>
<script>
(function(){
var P=JSON.parse(document.getElementById("proyek").textContent);
var layar=document.getElementById("layar"),tbl=document.getElementById("jalan"),bersih=document.getElementById("bersih"),py=null;
function tulis(t){layar.textContent+=t}
window.minta=function(p){var l=layar.textContent.replace(/\\s+$/,"").split("\\n").pop();var t=window.prompt(p||l||"Masukan:");return t===null?null:String(t)};
function muat(){
 var s=document.createElement("script");s.src=P.pyodide;
 s.onload=function(){loadPyodide().then(function(x){py=x;
  py.setStdout({batched:function(l){tulis(l+"\\n")}});py.setStderr({batched:function(l){tulis(l+"\\n")}});
  tbl.disabled=false;tbl.textContent="Jalankan aplikasi";layar.textContent="Siap. Tekan Jalankan aplikasi.";
 }).catch(gagal)};
 s.onerror=function(){gagal(new Error("Python tidak bisa diunduh. Periksa koneksi internet lalu muat ulang halaman."))};
 document.head.appendChild(s);
}
function gagal(e){layar.textContent="Gagal memuat Python: "+e.message;tbl.textContent="Gagal"}
tbl.onclick=function(){
 tbl.disabled=true;bersih.hidden=false;layar.textContent="";
 try{
  var dir="/home/pyodide/proyek";
  try{py.FS.mkdir(dir)}catch(e){}
  Object.keys(P.berkas).forEach(function(n){py.FS.writeFile(dir+"/"+n,P.berkas[n])});
  py.runPython("import builtins, sys, os, js, runpy\\nos.chdir('"+dir+"')\\nsys.path.insert(0,'"+dir+"')\\n"+
   "def _input(prompt=''):\\n    t = js.minta(str(prompt))\\n    if t is None:\\n        raise EOFError('Masukan dihentikan')\\n    print(str(prompt) + t)\\n    return t\\n"+
   "builtins.input = _input\\n"+
   "for _m in [m for m in list(sys.modules) if str(getattr(sys.modules[m], '__file__', '') or '').startswith('"+dir+"')]:\\n    del sys.modules[_m]\\n");
  py.runPython("runpy.run_path('"+dir+"/"+P.entri+"', run_name='__main__')");
 }catch(e){
  var m=String(e&&e.message||e).split("\\n").filter(function(l){return l.indexOf("pyodide")<0&&l.indexOf("_pyodide")<0}).slice(-6).join("\\n");
  tulis("\\n[Program berhenti] "+m+"\\n");
 }
 tbl.disabled=false;
};
bersih.onclick=function(){layar.textContent=""};
muat();
})();
</script>
</body>
</html>
`;
}
export const namaBerkasHtml = (judul) => "aplikasi-" + (String(judul || "praktikum").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "praktikum") + ".html";

// ---------- laporan praktikum ----------
export const KOLOM_LAPORAN = [
  { id: "apa", label: "Apa yang kamu bangun dan pelajari", petunjuk: "Ceritakan proyek yang kamu kerjakan dan apa yang sekarang kamu pahami, dengan kalimatmu sendiri.", min: 60 },
  { id: "kendala", label: "Kendala dan cara mengatasinya", petunjuk: "Apa yang sulit atau membuatmu tersangkut, dan bagaimana kamu mengatasinya? Jujur saja, ini bagian terpenting.", min: 40 },
  { id: "kesimpulan", label: "Kesimpulan", petunjuk: "Apa yang akan kamu lakukan berbeda bila membangun proyek ini lagi?", min: 40 },
];
export const kelengkapanLaporan = (jawaban) => kelengkapan(jawaban, KOLOM_LAPORAN);

const TEKS_JALUR = { web: "Di website", laptop: "Laptop sendiri", ponsel: "Tanpa PC (ponsel)" };
export const teksJalur = (j) => TEKS_JALUR[j] || TEKS_JALUR.web;

/**
 * Blok-blok untuk PDF laporan praktikum (format blok sama dengan pdf.js). Otomatis memuat identitas, jalur, dan status tahap;
 * kolom kosong tetap muncul sebagai "(belum diisi)".
 */
export function susunLaporanPraktikum(d) {
  const ring = ringkasPraktikum(d.praktikum, petaStatus(d.statusTahap));
  const kl = kelengkapanLaporan(d.jawaban || {});
  const tgl = (d.diekspor || new Date()).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) + ", " + (d.diekspor || new Date()).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const blok = [];
  blok.push({ t: "judul", teks: "LAPORAN PRAKTIKUM" });
  blok.push({ t: "kv", baris: [["Mata kuliah", d.matakuliah], ["Praktikum", d.praktikum.judul], ["Cara mengerjakan", teksJalur(d.jalur)], ["Nama", d.nama], ["NIM", d.nim], ["Kelas", d.kelas], ["Diekspor", tgl]] });
  blok.push({ t: "catatan", teks: "Kelengkapan: " + kl.baik + " dari " + kl.total + " kolom terisi memadai. Tahap: " + ring.lulus + " lulus, " + ring.dilewati + " dilewati, " + (ring.total - ring.lulus - ring.dilewati) + " belum selesai dari " + ring.total + "." });
  for (const k of KOLOM_LAPORAN) {
    blok.push({ t: "bagian", teks: k.label });
    const isi = String((d.jawaban || {})[k.id] || "").trim();
    blok.push({ t: "paragraf", teks: isi || "(belum diisi)", kosong: !isi });
  }
  blok.push({ t: "bagian", teks: "Status tahap" });
  const peta = petaStatus(d.statusTahap);
  blok.push({ t: "kode", teks: d.praktikum.tahap.map((t, i) => { const r = peta.get(t.id); return "Tahap " + (i + 1) + " " + t.judul + ": " + STATUS[statusTahap(peta, t.id)] + (r && r.jumlah_kirim ? " (" + r.jumlah_kirim + " kali kirim)" : "") + (r && r.pakai_contoh ? " [memakai berkas contoh]" : "") + (r && r.jalur === "laptop" && r.status === "lulus" ? " [dikerjakan di laptop, ditandai sendiri]" : ""); }).join("\n") });
  blok.push({ t: "kaki", teks: "Kode verifikasi: " + d.kodeVerifikasi });
  return blok;
}
export const namaBerkasLaporan = (d) => "laporan-praktikum-" + String(d.praktikum.id || "praktikum").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + String(d.nim || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf";

// ---------- baris untuk database ----------
export const barisBerkas = (mk, pid, nama, b) => ({ matakuliah_id: mk, praktikum_id: pid, nama, isi: b.isi, asal: b.asal });
export const barisTahap = (mk, pid, tid, r) => ({ matakuliah_id: mk, praktikum_id: pid, tahap_id: tid, status: r.status, jalur: r.jalur || "web", jumlah_kirim: r.jumlah_kirim || 0, pertama_dibuka: r.pertama_dibuka || null, lulus_pada: r.lulus_pada || null, pakai_contoh: !!r.pakai_contoh, centang: r.centang || {} });

// ---------- rekap untuk dashboard instruktur ----------
export const KODE_SEL = { lulus: "lulus", "lulus-contoh": "lulus (contoh)", "lulus-laptop": "selesai di laptop (laporan sendiri)", dilewati: "dilewati", sedang: "sedang", belum: "belum" };
const kodeSel = (r) => (!r ? "belum" : r.status === "lulus" ? (r.jalur === "laptop" ? "lulus-laptop" : r.pakai_contoh ? "lulus-contoh" : "lulus") : r.status);

/**
 * Peserta x tahap dari baris praktikum_tahap dan praktikum_laporan (satu praktikum).
 * @returns {{baris:object[], perTahap:object[], mulai:number, selesai:number}}
 */
export function rekapPraktikum({ peserta, tahap = [], laporan = [], praktikum }) {
  const poTahap = new Map();
  for (const r of tahap) {
    if (!poTahap.has(r.user_id)) poTahap.set(r.user_id, new Map());
    poTahap.get(r.user_id).set(r.tahap_id, r);
  }
  const poLaporan = new Map(laporan.map((r) => [r.user_id, r]));
  const baris = peserta.map((p) => {
    const t = poTahap.get(p.id) || new Map();
    const sel = {};
    let lulus = 0;
    let dilewati = 0;
    let sedang = 0;
    let kirim = 0;
    let terakhir = "";
    for (const d of praktikum.tahap) {
      const r = t.get(d.id);
      sel[d.id] = { kode: kodeSel(r), kirim: r ? r.jumlah_kirim || 0 : 0 };
      if (r) {
        kirim += r.jumlah_kirim || 0;
        if (String(r.diperbarui_pada || "") > terakhir) terakhir = r.diperbarui_pada;
      }
      if (sel[d.id].kode.startsWith("lulus")) lulus++;
      else if (sel[d.id].kode === "dilewati") dilewati++;
      else if (sel[d.id].kode === "sedang") sedang++;
    }
    const l = poLaporan.get(p.id);
    const kl = l ? kelengkapan(l.jawaban || {}, KOLOM_LAPORAN) : { baik: 0, total: KOLOM_LAPORAN.length };
    return { peserta: p, sel, lulus, dilewati, sedang, kirim, mulai: t.size > 0, selesai: lulus + dilewati === praktikum.tahap.length, terakhir: terakhir || (l && l.diperbarui_pada) || "", laporan: { ada: !!l, baik: kl.baik, total: kl.total, tempel: l ? l.percobaan_tempel || 0 : 0, diekspor: !!(l && l.dikumpulkan_pada) } };
  });
  const perTahap = praktikum.tahap.map((d) => {
    let lulus = 0;
    let dilewati = 0;
    let sedang = 0;
    let contoh = 0;
    let kirim = 0;
    let pernahKirim = 0;
    for (const b of baris) {
      const s = b.sel[d.id];
      if (s.kode.startsWith("lulus")) lulus++;
      if (s.kode === "lulus-contoh") contoh++;
      if (s.kode === "dilewati") dilewati++;
      if (s.kode === "sedang") sedang++;
      if (s.kirim > 0) {
        kirim += s.kirim;
        pernahKirim++;
      }
    }
    return { id: d.id, judul: d.judul, bab: d.bab || [], lulus, dilewati, sedang, contoh, kirimRata: pernahKirim ? Math.round((kirim / pernahKirim) * 10) / 10 : 0 };
  });
  return { baris, perTahap, mulai: baris.filter((b) => b.mulai).length, selesai: baris.filter((b) => b.selesai && b.mulai).length };
}

// Awalan = + - @ dianggap rumus oleh Excel; beri apostrof supaya nama atau isian peserta tetap teks.
const kutip = (s) => {
  const t = String(s === null || s === undefined ? "" : s);
  return '"' + (/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replace(/"/g, '""') + '"';
};
export function csvPraktikum(rekap, praktikum) {
  const kepala = ["NIM", "Nama", "Kelas", ...praktikum.tahap.map((t, i) => "Tahap " + (i + 1)), "Lulus", "Dilewati", "Kirim", "Kolom laporan memadai", "Tempel diblokir", "Aktivitas terakhir"];
  const baris = [kepala.map(kutip).join(",")];
  for (const b of rekap.baris) baris.push([b.peserta.nim, b.peserta.nama, b.peserta.kelas, ...praktikum.tahap.map((t) => KODE_SEL[b.sel[t.id].kode]), b.lulus, b.dilewati, b.kirim, b.laporan.baik + "/" + b.laporan.total, b.laporan.tempel, b.terakhir].map(kutip).join(","));
  return baris.join("\r\n") + "\r\n";
}

// ---------- ekspor proyek Java ----------
/**
 * Halaman HTML berisi seluruh kode proyek Java beserta cara menjalankannya di komputer yang punya JDK. Berbeda dari ekspor
 * Python, halaman ini tidak menjalankan programnya: Java butuh JDK (browser tidak bisa menjalankannya tanpa pustaka besar).
 */
export function bangunHtmlEksporJava(d) {
  const daftar = Object.keys(d.berkas).sort();
  const utama = d.entri ? namaKelasJava(d.entri) : "Main";
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${lolos(d.judul)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:16px;background:#f6f8f8;color:#0b1b1c;line-height:1.55}
main{max-width:820px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}
p.k{color:#4a5b5c;margin:0 0 14px}
pre{background:#0b3d3f;color:#d9f3f1;padding:12px 14px;border-radius:12px;white-space:pre-wrap;word-break:break-word;font-size:13px;overflow-x:auto}
details{margin:10px 0;background:#fff;border:1px solid #dbe6e5;border-radius:12px;padding:10px 14px}
summary{cursor:pointer;font-weight:600}
.s{color:#4a5b5c;font-size:13px}
@media (prefers-color-scheme:dark){body{background:#081616;color:#eaf4f3}p.k,.s{color:#9db3b2}details{background:#0c1e1e;border-color:#254242}}
</style>
</head>
<body>
<main>
<h1>${lolos(d.judul)}</h1>
<p class="k">${lolos(d.deskripsi || "Proyek Java yang dibuat di praktikum.")}${d.oleh ? " Dibuat oleh " + lolos(d.oleh) + "." : ""}</p>
<h2>Cara menjalankan</h2>
<ol>
<li>Pasang JDK 11 atau lebih baru (mis. Eclipse Temurin).</li>
<li>Simpan tiap kode di bawah sebagai berkas dengan nama yang sama, dalam satu folder.</li>
<li>Di terminal pada folder itu: <code>javac *.java</code> lalu <code>java ${lolos(utama)}</code>.</li>
</ol>
<p class="s">Halaman ini hanya menampilkan kode (${daftar.length} berkas). Java tidak bisa dijalankan langsung dari halaman web biasa.</p>
${daftar.map((n) => `<details open><summary>${lolos(n)}</summary><pre><code>${lolos(d.berkas[n])}</code></pre></details>`).join("\n")}
</main>
</body>
</html>
`;
}
const namaKelasJava = (n) => String(n).replace(/\.java$/i, "");
