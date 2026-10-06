#!/usr/bin/env node
// Menguji logika dashboard instruktur (site/js/rekap.js): rekap, saringan, CSV, dan pemuatan per halaman.
// Jalankan:  node tools/uji_rekap.mjs
import { susunRekap, saringPeserta, pilihanSaringan, buatCsv, ambilSemua, kodeSel, SEL, AMBANG_TERSANGKUT } from "../site/js/rekap.js";

let gagal = 0;
function cek(nama, ok, detail = "") {
  if (!ok) gagal++;
  console.log((ok ? "OK    " : "GAGAL ") + nama + (ok ? "" : "  " + detail));
}

const materi = [
  { bab: 1, judul: "Satu", jenis: "kode" },
  { bab: 2, judul: "Dua", jenis: "kode" },
  { bab: 3, judul: "Tiga (unggah)", jenis: "unggah" },
  { bab: 4, judul: "Empat", jenis: "kode" },
];
const peserta = [
  { id: "a", nama: "Ani", nim: "111", kelas: "SI-2024-A", prodi: "SI", angkatan: 2024, rombel: "A" },
  { id: "b", nama: "Budi", nim: "222", kelas: "SI-2025-B", prodi: "SI", angkatan: 2025, rombel: "B" },
  { id: "c", nama: "Cici", nim: "333", kelas: "SI-1A", prodi: "SI", angkatan: null, rombel: null },
  { id: "d", nama: "=Danu", nim: "444", kelas: "TI-2024-A", prodi: "TI", angkatan: 2024, rombel: "A" },
];
const progres = [
  { user_id: "a", bab: 1, status: "selesai", jalur: "langsung", jumlah_kirim: 1, jumlah_jalankan: 4 },
  { user_id: "a", bab: 2, status: "selesai", jalur: "bantuan", jumlah_kirim: 4, jumlah_jalankan: 9 },
  { user_id: "a", bab: 4, status: "sedang", jumlah_kirim: 6, jumlah_jalankan: 12, diperbarui_pada: "2026-10-05T10:00:00Z" },
  { user_id: "b", bab: 1, status: "sedang", jumlah_kirim: 2, jumlah_jalankan: 3, diperbarui_pada: "2026-10-06T08:00:00Z" },
  { user_id: "x", bab: 1, status: "selesai", jalur: "langsung", jumlah_kirim: 1, jumlah_jalankan: 1 },
];

const tempel = [
  { user_id: "a", bab: 1, detail: { jumlah: 2, lokasi: "latihan" } },
  { user_id: "a", bab: 4, detail: { jumlah: 1 } },
  { user_id: "d", bab: 1, detail: null },
];
const r = susunRekap({ peserta, progres, materi, tempel });
cek("satu baris per peserta, termasuk yang belum mulai", r.baris.length === 4);
cek("progres milik orang yang tidak ada di daftar diabaikan", r.baris.every((b) => b.peserta.id !== "x"));
const ani = r.baris.find((b) => b.peserta.id === "a");
cek("selesai tanpa petunjuk terbaca", ani.sel[1].kode === SEL.SELESAI_LANGSUNG);
cek("selesai dengan petunjuk terbaca", ani.sel[2].kode === SEL.SELESAI_BANTUAN);
cek("bab unggah ditandai tidak dilacak", ani.sel[3].kode === SEL.UNGGAH);
cek("bab sedang terbaca beserta jumlah kirim", ani.sel[4].kode === SEL.SEDANG && ani.sel[4].kirim === 6);
cek("jumlah bab selesai per peserta", ani.selesai === 2 && ani.sedang === 1);
cek("peserta tersangkut dikenali (kirim >= ambang, belum lulus)", ani.tersangkut.length === 1 && ani.tersangkut[0].bab === 4 && 6 >= AMBANG_TERSANGKUT);
cek("peserta dengan kirim di bawah ambang tidak tersangkut", r.baris.find((b) => b.peserta.id === "b").tersangkut.length === 0);
cek("aktivitas terakhir diambil dari waktu terbaru", ani.terakhir === "2026-10-05T10:00:00Z");
const cici = r.baris.find((b) => b.peserta.id === "c");
cek("peserta tanpa progres: semua belum", cici.selesai === 0 && cici.sedang === 0 && cici.sel[1].kode === SEL.BELUM);
cek("ringkasan: belum mulai dan total bab kode", r.ringkasan.belumMulai === 2 && r.ringkasan.totalBabKode === 3 && r.ringkasan.jumlahPeserta === 4);
cek("ringkasan: rata-rata bab selesai", r.ringkasan.rataSelesai === 0.5, String(r.ringkasan.rataSelesai));
const b1 = r.perBab.find((x) => x.bab === 1);
cek("per bab: selesai, langsung, bantuan", b1.selesai === 1 && b1.langsung === 1 && b1.bantuan === 0 && b1.sedang === 1 && b1.belum === 2, JSON.stringify(b1));
cek("per bab: persen selesai dan rata-rata kirim", b1.persenSelesai === 25 && b1.rataKirim === 1.5, JSON.stringify(b1));
cek("per bab: bab unggah ditandai", r.perBab.find((x) => x.bab === 3).unggah === true);
cek("kodeSel: baris kosong = belum", kodeSel({ jenis: "kode" }, null) === SEL.BELUM);
cek("kodeSel: selesai tanpa jalur dianggap langsung", kodeSel({ jenis: "kode" }, { status: "selesai", jalur: null }) === SEL.SELESAI_LANGSUNG);

cek("percobaan tempel dijumlahkan per peserta", r.baris.find((b) => b.peserta.id === "a").tempel === 3, String(r.baris[0].tempel));
cek("baris tempel tanpa detail dihitung satu", r.baris.find((b) => b.peserta.id === "d").tempel === 1);
cek("peserta tanpa percobaan tempel bernilai 0", r.baris.find((b) => b.peserta.id === "b").tempel === 0);
cek("ringkasan: berapa peserta pernah mencoba menempel", r.ringkasan.adaTempel === 2);
cek("tanpa data tempel, semua nol", susunRekap({ peserta, progres, materi }).baris.every((b) => b.tempel === 0));

cek("saringan prodi", saringPeserta(peserta, { prodi: "TI" }).length === 1);
cek("saringan angkatan (teks dari menu)", saringPeserta(peserta, { angkatan: "2024" }).length === 2);
cek("saringan kelas (rombel)", saringPeserta(peserta, { rombel: "A" }).length === 2);
cek("saringan gabungan", saringPeserta(peserta, { prodi: "SI", angkatan: "2024", rombel: "A" }).map((p) => p.id).join() === "a");
cek("pencarian nama tidak peka huruf besar", saringPeserta(peserta, { cari: "bUd" }).length === 1);
cek("pencarian NIM", saringPeserta(peserta, { cari: "333" }).length === 1);
cek("tanpa saringan = semua", saringPeserta(peserta).length === 4);
cek("peserta berkelas lama (tanpa angkatan) tidak ikut saat angkatan dipilih", !saringPeserta(peserta, { angkatan: "2024" }).some((p) => p.id === "c"));
const pil = pilihanSaringan(peserta);
cek("pilihan menu diambil dari data, terurut", pil.prodi.join() === "SI,TI" && pil.angkatan.join() === "2024,2025" && pil.rombel.join() === "A,B");

const csv = buatCsv(r, materi);
const baris = csv.trim().split("\r\n");
cek("CSV: satu baris judul + satu per peserta", baris.length === 5);
cek("CSV: kolom judul memuat bab, jumlah kirim, dan ringkasan", baris[0] === "NIM,Nama,Kelas,Bab 1,Bab 2,Bab 3,Bab 4,Kirim bab 1,Kirim bab 2,Kirim bab 4,Bab selesai,Bab sedang,Tempel diblokir,Aktivitas terakhir", baris[0]);
cek("CSV: baris peserta benar", baris[1].startsWith("111,Ani,SI-2024-A,selesai-langsung,selesai-bantuan,unggah,sedang,1,4,6,2,1,3,"), baris[1]);
cek("CSV: nama berawalan = diberi apostrof (cegah rumus Excel)", baris.some((l) => l.includes("'=Danu")));
cek("CSV: nilai bertanda koma dikutip", buatCsv({ baris: [{ peserta: { nim: "1", nama: "Rina, S.Kom", kelas: "x" }, sel: { 1: { kode: "belum", kirim: 0 } }, selesai: 0, sedang: 0, terakhir: null }] }, [{ bab: 1, jenis: "kode" }]).includes('"Rina, S.Kom"'));

// Pemuatan per halaman: 2500 baris, 1000 per permintaan, harus terkumpul semua tanpa duplikat.
const semua = Array.from({ length: 2500 }, (_, i) => ({ i }));
let permintaan = 0;
const bangun = () => ({
  range: async (a, b) => {
    permintaan++;
    return { data: semua.slice(a, b + 1), error: null };
  },
});
const hasil = await ambilSemua(bangun);
cek("ambilSemua mengumpulkan 2500 baris dalam 3 permintaan", hasil.length === 2500 && permintaan === 3 && hasil[2499].i === 2499, `${hasil.length} baris, ${permintaan} permintaan`);
permintaan = 0;
cek("ambilSemua pada kelipatan tepat 1000 berhenti dengan benar", (await ambilSemua(() => ({ range: async (a, b) => (permintaan++, { data: semua.slice(a, Math.min(b + 1, 2000)), error: null }) }))).length === 2000 && permintaan === 3);
let galatTertangkap = false;
try {
  await ambilSemua(() => ({ range: async () => ({ data: null, error: { code: "42501", message: "denied" } }) }));
} catch (e) {
  galatTertangkap = e.code === "42501";
}
cek("ambilSemua meneruskan galat (mis. izin ditolak)", galatTertangkap);

console.log(gagal ? `\n${gagal} uji GAGAL.` : "\nSemua uji lulus.");
process.exit(gagal ? 1 : 0);
