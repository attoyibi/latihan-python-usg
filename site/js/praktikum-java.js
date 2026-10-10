// Praktikum Java: menyusun pekerjaan untuk penjalan Java multi-berkas (JavaRun mode paket) dan membaca hasilnya. Murni (tanpa DOM
// atau jaringan), jadi bisa diuji di Node dengan JVM sungguhan (tools/uji_praktikum_java.mjs).
//
// Skema kasus uji sama dengan praktikum Python (lihat praktikum_harness.py), disesuaikan dengan Java:
//   {"nama": "...", "kode": "Buku b = new Buku(\"A\", 2);\nsama(2, b.getStok());"}     badan method main kelas Uji; lulus bila tidak melempar
//   {"nama": "...", "jalankan": "Main", "masukan": ["1", "2"], "memuat": ["Total"]}    kelas Main dijalankan; keluaran harus memuat semua teks
// Di dalam "kode" tersedia cek(syarat, pesan), sama(diharapkan, nyata), privat(Kelas.class, "atribut"), abstrak(Kelas.class),
// dan import java.util.*.

export const PEMISAH = { berkas: "\u0005", bagian: "\u0003", paket: "\u0004", multi: "\u0002", kasus: "\f" };
export const MAKS_KELUARAN = 4000;
const RE_KENDALI = /[\u0001-\u0005]/g;
export const NAMA_RESERVASI = ["Uji", "GagalUji", "JavaRun"];

export const bersihkan = (isi) => String(isi === null || isi === undefined ? "" : isi).replace(RE_KENDALI, "");
export const namaKelas = (berkas) => String(berkas).replace(/\.java$/i, "");

/** Kelas bantu penguji: dikompilasi bersama berkas peserta. Nama tetap supaya pesan galat mudah dibaca. */
export function bangunSumberUji(kode) {
  return [
    "import java.util.*;",
    "class GagalUji extends RuntimeException { GagalUji(String p) { super(p); } }",
    "public class Uji {",
    "    static void cek(boolean syarat, String pesan) { if (!syarat) throw new GagalUji(pesan); }",
    "    static void sama(Object diharapkan, Object nyata) {",
    '        if (!Objects.equals(diharapkan, nyata)) throw new GagalUji("Diharapkan " + diharapkan + " tetapi hasilnya " + nyata);',
    "    }",
    "    static boolean privat(Class<?> kelas, String atribut) throws Exception {",
    "        return java.lang.reflect.Modifier.isPrivate(kelas.getDeclaredField(atribut).getModifiers());",
    "    }",
    "    static boolean abstrak(Class<?> kelas) { return java.lang.reflect.Modifier.isAbstract(kelas.getModifiers()); }",
    "    public static void main(String[] args) throws Exception {",
    kode,
    "    }",
    "}",
    "",
  ].join("\n");
}

/** Satu paket: kelas utama, masukan, dan semua berkas (peta nama -> isi). */
export function susunPaket(utama, masukan, berkas) {
  const f = [];
  for (const [n, i] of Object.entries(berkas)) f.push(n, bersihkan(i));
  return [utama, masukan, f.join(PEMISAH.berkas)].join(PEMISAH.bagian);
}
const masukanTeks = (m) => ((m || []).length ? m.join("\n") + "\n" : "");

/**
 * Menyusun pekerjaan dari perintah. Hanya berkas .java yang dikompilasi; berkas lain (.txt, .csv, ...) tidak ikut karena
 * ECJ hanya menerima kode (berkas data dibaca program lewat folder kerja, bukan lewat paket).
 * @returns {{sumber:string, tafsir:object[]}}
 */
export function susunPekerjaan(berkas, perintah) {
  const java = Object.fromEntries(Object.entries(berkas).filter(([n]) => /\.java$/i.test(n)));
  const paket = [];
  const tafsir = [];
  if (perintah.aksi === "jalankan") {
    paket.push(susunPaket(namaKelas(perintah.entri), masukanTeks(perintah.masukan), java));
    tafsir.push({ jenis: "jalankan" });
  } else {
    for (const k of perintah.kasus || []) {
      if (k.kode !== undefined) {
        paket.push(susunPaket("Uji", "", Object.assign({}, java, { "Uji.java": bangunSumberUji(k.kode) })));
        tafsir.push({ jenis: "kode", kasus: k });
      } else {
        paket.push(susunPaket(namaKelas(k.jalankan || "Main"), masukanTeks(k.masukan), java));
        tafsir.push({ jenis: "jalankan", kasus: k });
      }
    }
  }
  return { sumber: PEMISAH.multi + paket.join(PEMISAH.paket), tafsir };
}

// ---------- hasil ----------
function pecah(hasil) {
  const i = hasil.indexOf("\n");
  return { status: i < 0 ? hasil : hasil.slice(0, i), isi: i < 0 ? "" : hasil.slice(i + 1) };
}
const potong = (s, n = MAKS_KELUARAN) => (s.length > n ? s.slice(0, n) + "\n(dipotong)" : s);

/** Pesan galat dari keluaran GALAT_JALAN: baris pengecualian, tanpa jejak panjang. */
export function pesanGalatJalan(isi) {
  const k = isi.indexOf('Exception in thread "main" ');
  const dari = k < 0 ? isi : isi.slice(k + 'Exception in thread "main" '.length);
  const baris = dari.trimEnd().split("\n");
  const utama = baris[0].replace(/^GagalUji: /, "");
  const jejak = baris.slice(1).filter((b) => /^\sat /.test(b) && !/\sat Uji\./.test(b)).slice(0, 3);
  return [utama, ...jejak].join("\n");
}
export function pesanKompilasi(isi) {
  return "Galat kompilasi:\n" + isi.trimEnd().split("\n").slice(0, 8).join("\n");
}

/**
 * Mengubah hasil mentah penjalan (per paket dipisah \f) menjadi bentuk yang sama dengan penguji Python:
 * {kasus:[{nama, tersembunyi, lulus, pesan, keluaran}]} atau {keluaran, galat}.
 */
export function uraikanHasil(mentah, tafsir) {
  const bagian = String(mentah || "").split(PEMISAH.kasus);
  if (tafsir.length === 1 && tafsir[0].jenis === "jalankan" && !tafsir[0].kasus) {
    const { status, isi } = pecah(bagian[0] || "");
    if (status === "GALAT_KOMPILASI") return { keluaran: "", galat: pesanKompilasi(isi) };
    if (status === "GALAT_JALAN") {
      const k = isi.indexOf('Exception in thread "main"');
      return { keluaran: potong(k < 0 ? "" : isi.slice(0, k)), galat: pesanGalatJalan(isi) };
    }
    return { keluaran: potong(isi), galat: null };
  }
  return {
    kasus: tafsir.map((t, i) => {
      const k = t.kasus;
      const hasil = { nama: k.nama, tersembunyi: !!k.tersembunyi, lulus: false, pesan: "", keluaran: "" };
      const { status, isi } = pecah(bagian[i] === undefined ? "GALAT_KOMPILASI\nTidak ada hasil dari penjalan." : bagian[i]);
      if (status === "GALAT_KOMPILASI") {
        // galat di berkas penguji (Uji.java) berarti kode peserta tidak cocok dengan nama yang diharapkan
        hasil.pesan = pesanKompilasi(isi).replace(/Uji\.java:(\d+)/g, "pemeriksaan (baris $1)");
        return hasil;
      }
      if (t.jenis === "kode") {
        hasil.lulus = status === "OK";
        hasil.pesan = hasil.lulus ? "" : pesanGalatJalan(isi);
        return hasil;
      }
      hasil.keluaran = potong(isi);
      if (status === "GALAT_JALAN") {
        const kk = isi.indexOf('Exception in thread "main"');
        hasil.keluaran = potong(kk < 0 ? "" : isi.slice(0, kk));
        hasil.pesan = pesanGalatJalan(isi);
        return hasil;
      }
      const hilang = (k.memuat || []).filter((x) => !isi.includes(x));
      hasil.lulus = hilang.length === 0;
      if (!hasil.lulus) hasil.pesan = "Keluaran belum memuat: " + hilang.map((x) => JSON.stringify(x)).join("; ");
      return hasil;
    }),
  };
}

// ---------- pemeriksaan kelengkapan tugas akhir (statis, hanya membaca teks kode) ----------
/** Membuang komentar dan isi string/karakter supaya kata kunci di dalamnya tidak ikut terhitung. */
export function bersihkanKode(kode) {
  return String(kode || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\.|[^"\\n])*"/g, '""')
    .replace(/'(?:\.|[^'\\n])'/g, "''");
}
const hitung = (teks, re) => (teks.match(re) || []).length;

/**
 * Ringkasan unsur PBO yang terlihat di kode: hanya penanda untuk membantu dosen dan peserta, bukan penilaian. Kode yang
 * tidak dikompilasi pun tetap dianalisis. Mengembalikan daftar {kunci, label, ada, rincian}.
 */
export function analisisJava(berkas) {
  const nama = Object.keys(berkas).filter((n) => /\.java$/i.test(n));
  const gabung = nama.map((n) => bersihkanKode(berkas[n])).join("\n");
  const kelas = hitung(gabung, /\b(?:class|interface|enum)\s+[A-Za-z_]\w*/g) - hitung(gabung, /\b\.class\b/g);
  const punyaMain = /\bpublic\s+static\s+void\s+main\s*\(/.test(gabung);
  const turunan = hitung(gabung, /\bclass\s+[A-Za-z_]\w*(?:\s*<[^>{]*>)?\s+extends\s+[A-Za-z_]\w*/g);
  const abstrak = hitung(gabung, /\babstract\s+class\b/g) + hitung(gabung, /\binterface\s+[A-Za-z_]\w*/g);
  const eksepsiSendiri = hitung(gabung, /\bclass\s+[A-Za-z_]\w*\s+extends\s+(?:\w*Exception|Throwable|Error)\b/g);
  const catchBlok = hitung(gabung, /\bcatch\s*\(/g);
  const privatCount = hitung(gabung, /\bprivate\s+[\w<>\[\], ?]+\s+[A-Za-z_]\w*\s*[;=]/g);
  const koleksi = /\b(?:ArrayList|LinkedList|HashMap|TreeMap|LinkedHashMap|HashSet|TreeSet|LinkedHashSet|List\s*<|Map\s*<|Set\s*<|Deque\s*<|Queue\s*<)/.test(gabung);
  const berkasIo = /\b(?:Files\s*\.|FileReader|FileWriter|BufferedReader|BufferedWriter|FileInputStream|FileOutputStream|PrintWriter)\b/.test(gabung);
  const gui = /\b(?:javax\.swing|java\.awt|javafx)\b|\bJFrame\b/.test(gabung);
  const jdbc = /\b(?:java\.sql|DriverManager|PreparedStatement)\b/.test(gabung);
  const rancangan = Object.entries(berkas).find(([n]) => /\.md$/i.test(n));
  const panjangRancangan = rancangan ? String(rancangan[1]).replace(/\s+/g, " ").trim().length : 0;
  return [
    { kunci: "kelas", label: "Jumlah kelas dan interface", ada: kelas >= 5, rincian: kelas + " (disarankan minimal 5)" },
    { kunci: "main", label: "Program utama (main)", ada: punyaMain, rincian: punyaMain ? "ada" : "belum ada" },
    { kunci: "enkapsulasi", label: "Enkapsulasi (atribut private)", ada: privatCount >= 3, rincian: privatCount + " atribut private" },
    { kunci: "pewarisan", label: "Pewarisan (extends)", ada: turunan >= 1, rincian: turunan + " kelas turunan" },
    { kunci: "abstraksi", label: "Abstraksi (abstract class atau interface)", ada: abstrak >= 1, rincian: abstrak + " ditemukan" },
    { kunci: "eksepsi", label: "Eksepsi buatan sendiri dan penanganannya", ada: eksepsiSendiri >= 1 && catchBlok >= 1, rincian: eksepsiSendiri + " eksepsi sendiri, " + catchBlok + " blok catch" },
    { kunci: "koleksi", label: "Collection (List, Map, atau Set)", ada: koleksi, rincian: koleksi ? "dipakai" : "belum terlihat" },
    { kunci: "berkas", label: "Penyimpanan ke berkas", ada: berkasIo, rincian: berkasIo ? "dipakai" : "belum terlihat" },
    { kunci: "rancangan", label: "Dokumen rancangan (.md)", ada: panjangRancangan >= 300, rincian: panjangRancangan + " karakter" },
    { kunci: "gui", label: "Tambahan: antarmuka grafis", ada: gui, rincian: gui ? "terlihat (tidak dapat dijalankan di website)" : "tidak ada", tambahan: true },
    { kunci: "jdbc", label: "Tambahan: basis data JDBC", ada: jdbc, rincian: jdbc ? "terlihat (tidak dapat dijalankan di website)" : "tidak ada", tambahan: true },
  ];
}
