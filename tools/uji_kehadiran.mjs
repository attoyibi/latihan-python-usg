// Menguji logika murni kehadiran dan keaktifan (site/js/kehadiran.js). Jalankan: node tools/uji_kehadiran.mjs
import * as K from "../site/js/kehadiran.js";

let total = 0;
let gagal = 0;
const cek = (nama, kondisi, detail = "") => {
  total++;
  if (!kondisi) {
    gagal++;
    console.log("GAGAL " + nama + (detail ? "  -> " + detail : ""));
  } else console.log("OK    " + nama);
};
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Rabu 7 Okt 2026 pukul 08:00 WIB (01:00 UTC); Rabu pekan lalu 30 Sep.
const RABU7 = Date.parse("2026-10-07T01:00:00Z");
const RABU7_SELESAI = Date.parse("2026-10-07T03:00:00Z");
const JAM = 3600000;
const MNT = 60000;

console.log("== waktu WIB ==");
cek("tanggal dan jam WIB dari UTC", K.tanggalWib(RABU7) === "2026-10-07" && K.jamWib(RABU7) === "08:00");
cek("lewat tengah malam UTC jatuh ke hari berikutnya di WIB", K.tanggalWib(Date.parse("2026-10-06T18:30:00Z")) === "2026-10-07" && K.jamWib(Date.parse("2026-10-06T18:30:00Z")) === "01:30");
cek("pukul 23.30 WIB tetap hari itu (bukan hari berikutnya)", K.tanggalWib(Date.parse("2026-10-06T16:30:00Z")) === "2026-10-06");
cek("teks tanggal berbahasa Indonesia", K.teksTanggal(RABU7) === "Rab 7 Okt");
cek("dariWib mengembalikan epoch yang sama", K.dariWib("2026-10-07", "08:00") === RABU7);
cek("dariWib menolak format salah", Number.isNaN(K.dariWib("7-10-2026", "08:00")) && Number.isNaN(K.dariWib("2026-10-07", "pagi")));
cek("awal minggu = Senin 00:00 WIB", K.tanggalWib(K.awalMinggu(RABU7)) === "2026-10-05" && K.jamWib(K.awalMinggu(RABU7)) === "00:00");
cek("hari Minggu masih termasuk minggu yang berakhir di situ", K.tanggalWib(K.awalMinggu(K.dariWib("2026-10-11", "10:00"))) === "2026-10-05");
cek("sisa waktu dalam teks", K.sisaTeks(14 * JAM + 30 * MNT) === "14 jam 30 menit" && K.sisaTeks(40 * JAM) === "1 hari 16 jam" && K.sisaTeks(5 * MNT) === "5 menit");

console.log("\n== jam server dan jam perangkat ==");
cek("jam server dipakai bila ada", K.waktuBaris({ dibuat_pada: "2026-10-01T00:00:00Z", diterima_pada: "2026-10-02T00:00:00Z" }) === Date.parse("2026-10-02T00:00:00Z"));
cek("tanpa jam server (data lama) dipakai jam perangkat", K.waktuBaris({ dibuat_pada: "2026-10-01T00:00:00Z", diterima_pada: null }) === Date.parse("2026-10-01T00:00:00Z"));
cek("selisih kecil dianggap wajar", K.selisihJam({ dibuat_pada: "2026-10-01T00:00:00Z", diterima_pada: "2026-10-01T00:03:00Z" }) === null);
cek("jam perangkat menyimpang jauh ditandai (menit)", K.selisihJam({ dibuat_pada: "2026-09-25T00:00:00Z", diterima_pada: "2026-10-01T00:00:00Z" }) === -8640);
cek("data lama tanpa jam server tidak ditandai janggal", K.selisihJam({ dibuat_pada: "2026-09-25T00:00:00Z" }) === null);

console.log("\n== menyusun kejadian ==");
const U = "u1";
const kej = K.susunKejadian({
  percobaan: [
    { user_id: U, bab: 5, lulus: false, dibuat_pada: "2026-10-05T12:00:00Z", diterima_pada: "2026-10-05T12:00:30Z" },
    { user_id: U, bab: 5, lulus: true, dibuat_pada: "2026-10-05T12:20:00Z", diterima_pada: "2026-10-05T12:20:10Z" },
    { user_id: "u2", bab: 5, lulus: true, dibuat_pada: "2026-09-25T00:00:00Z", diterima_pada: "2026-10-05T12:00:00Z" },
  ],
  progres: [
    { user_id: U, bab: 5, status: "selesai", lulus_pada: "2026-10-05T12:20:05Z" },
    { user_id: U, bab: 6, status: "selesai", lulus_pada: "2026-10-04T10:00:00Z" },
    { user_id: U, bab: 7, status: "sedang", lulus_pada: null },
  ],
  sesi: [{ user_id: U, mulai: "2026-10-05T12:00:00Z", terakhir: "2026-10-05T12:40:00Z", aktif_detik: 1500, bab_dibuka: [5] }],
});
const k1 = kej.get(U);
cek("pengerjaan dan lulus digabung terurut", k1.kerja.length === 3 && k1.kerja[0].bab === 6 && k1.kerja.every((x, i, a) => i === 0 || a[i - 1].t <= x.t), JSON.stringify(k1.kerja));
cek("lulus yang sudah ada di percobaan tidak dihitung dua kali dari progres", k1.kerja.filter((x) => x.bab === 5 && x.lulus).length === 1);
cek("lulus yang hanya ada di progres tetap dihitung (data hasil sinkron lama)", k1.kerja.some((x) => x.bab === 6 && x.lulus));
cek("bab yang masih dikerjakan bukan lulus", !k1.kerja.some((x) => x.bab === 7));
cek("sesi tersusun dengan lama aktif", k1.sesi.length === 1 && k1.sesi[0].aktif === 1500);
cek("jam server mencegah jam perangkat palsu mengubah waktu", kej.get("u2").kerja[0].t === Date.parse("2026-10-05T12:00:00Z") && kej.get("u2").janggal === 1);
cek("sesiMulaiGlobal mengambil sesi paling awal", K.sesiMulaiGlobal([{ mulai: "2026-10-05T00:00:00Z" }, { mulai: "2026-10-03T00:00:00Z" }]) === Date.parse("2026-10-03T00:00:00Z") && K.sesiMulaiGlobal([]) === null);

console.log("\n== siap sebelum kelas ==");
const buat = (kerja = [], sesi = []) => ({ kerja, sesi, janggal: 0 });
const kerjaT = (t, lulus = false, bab = 8) => ({ t, bab, lulus });
const sesiT = (mulai, menit, bab = [8]) => ({ mulai, akhir: mulai + menit * MNT, aktif: menit * 60, bab });
const SEKARANG = RABU7 - 14 * JAM; // Selasa 6 Okt 18:00 WIB
let s = K.hitungSiap(buat([kerjaT(RABU7 - 10 * JAM)]), RABU7, { sekarang: RABU7 + JAM, sesiMulai: null });
cek("ada pengerjaan di jendela, pencatatan sesi belum aktif: siap tanpa syarat menit", s.siap && s.status === "siap" && !s.pakaiMenit && s.jamSebelum === 10);
s = K.hitungSiap(buat(), RABU7, { sekarang: RABU7 + JAM, sesiMulai: null });
cek("tanpa apa pun: belum mulai", !s.siap && s.status === "belum");
s = K.hitungSiap(buat([kerjaT(RABU7 - 7 * 24 * JAM)]), RABU7, { sekarang: RABU7 + JAM });
cek("pengerjaan 7 hari sebelumnya di luar jendela 6 hari", !s.siap);
s = K.hitungSiap(buat([kerjaT(RABU7 - 6 * 24 * JAM + MNT)]), RABU7, { sekarang: RABU7 + JAM });
cek("pengerjaan tepat di dalam jendela dihitung", s.siap);
s = K.hitungSiap(buat([kerjaT(RABU7 + 5 * MNT)]), RABU7, { sekarang: RABU7 + JAM });
cek("pengerjaan setelah kelas mulai tidak menjadi kesiapan", !s.siap);
const SESI_AKTIF = RABU7 - 30 * 24 * JAM;
s = K.hitungSiap(buat([kerjaT(RABU7 - 5 * JAM)], [sesiT(RABU7 - 5 * JAM - 10 * MNT, 8)]), RABU7, { sekarang: RABU7 + JAM, sesiMulai: SESI_AKTIF });
cek("pencatatan sesi aktif: mengerjakan tapi hanya 8 menit aktif belum cukup", !s.siap && s.status === "kurang" && s.pakaiMenit && s.menit === 8);
s = K.hitungSiap(buat([kerjaT(RABU7 - 5 * JAM)], [sesiT(RABU7 - 6 * JAM, 25)]), RABU7, { sekarang: RABU7 + JAM, sesiMulai: SESI_AKTIF });
cek("pencatatan sesi aktif: 25 menit aktif dan mengerjakan cukup", s.siap && s.menit === 25);
s = K.hitungSiap(buat([], [sesiT(RABU7 - 6 * JAM, 10)]), RABU7, { sekarang: RABU7 + JAM, sesiMulai: SESI_AKTIF });
cek("hanya membuka dan membaca tidak cukup untuk siap", !s.siap && s.status === "membaca");
s = K.hitungSiap(buat([], [sesiT(RABU7 - 6 * JAM, 1)]), RABU7, { sekarang: RABU7 + JAM, sesiMulai: SESI_AKTIF });
cek("membuka kurang dari 2 menit tidak dianggap membaca", s.status === "belum");
s = K.hitungSiap(buat([kerjaT(RABU7 - 5 * JAM)], []), RABU7, { sekarang: RABU7 + JAM, sesiMulai: RABU7 - 2 * JAM });
cek("jendela yang dimulai sebelum pencatatan sesi aktif tidak menuntut menit", s.siap && !s.pakaiMenit);
s = K.hitungSiap(buat([kerjaT(RABU7 - 2 * JAM)]), RABU7, { sekarang: RABU7 + JAM });
cek("selesai kurang dari 3 jam sebelum kelas ditandai mepet", s.mepet);
s = K.hitungSiap(buat([kerjaT(RABU7 - 20 * JAM)]), RABU7, { sekarang: RABU7 + JAM });
cek("selesai 20 jam sebelum kelas tidak mepet", !s.mepet && s.jamSebelum === 20);
s = K.hitungSiap(buat([kerjaT(RABU7 - 3 * JAM, true)]), RABU7, { sekarang: SEKARANG });
cek("sebelum kelas mulai, hanya yang sudah terjadi yang dihitung", s.lulus === 0 || RABU7 - 3 * JAM <= SEKARANG ? true : s.kerja === 0);
s = K.hitungSiap(buat([kerjaT(RABU7 - 3 * JAM, true)]), RABU7, { sekarang: SEKARANG });
cek("pengerjaan yang belum terjadi menurut jam sekarang tidak dihitung", s.kerja === 0 && !s.siap);

console.log("\n== saat kelas ==");
let sk = K.hitungSaatKelas(buat([], [sesiT(RABU7 + 5 * MNT, 60)]), RABU7, RABU7_SELESAI, { sekarang: RABU7_SELESAI + JAM, sesiMulai: SESI_AKTIF });
cek("sesi di dalam jam kuliah dihitung penuh", sk.aktif && sk.menit === 60 && sk.selesai && sk.tersedia);
sk = K.hitungSaatKelas(buat([], [sesiT(RABU7 - 30 * MNT, 60)]), RABU7, RABU7_SELESAI, { sekarang: RABU7_SELESAI + JAM, sesiMulai: SESI_AKTIF });
cek("sesi yang separuhnya di luar jam kuliah dihitung sebagian", sk.menit === 30, String(sk.menit));
sk = K.hitungSaatKelas(buat([], [sesiT(RABU7 - 120 * MNT, 60)]), RABU7, RABU7_SELESAI, { sekarang: RABU7_SELESAI + JAM, sesiMulai: SESI_AKTIF });
cek("sesi sebelum kelas tidak dihitung saat kelas", sk.menit === 0 && !sk.aktif);
sk = K.hitungSaatKelas(buat([kerjaT(RABU7 + 30 * MNT)], []), RABU7, RABU7_SELESAI, { sekarang: RABU7_SELESAI + JAM, sesiMulai: SESI_AKTIF });
cek("mengirim jawaban saat kelas dihitung aktif walau menit kecil", sk.aktif && sk.kerja === 1);
sk = K.hitungSaatKelas(buat(), RABU7, RABU7_SELESAI, { sekarang: RABU7 - JAM });
cek("kelas yang belum mulai belum bisa disimpulkan", !sk.mulaiKelas && !sk.aktif);
sk = K.hitungSaatKelas(buat([], [sesiT(RABU7 + 5 * MNT, 60)]), RABU7, RABU7_SELESAI, { sekarang: RABU7 + 30 * MNT, sesiMulai: SESI_AKTIF });
cek("kelas yang sedang berlangsung hanya menghitung sampai sekarang", sk.jalan && !sk.selesai && sk.menit <= 30);
sk = K.hitungSaatKelas(buat(), RABU7, RABU7_SELESAI, { sekarang: RABU7_SELESAI + JAM, sesiMulai: null });
cek("tanpa pencatatan sesi, saat kelas ditandai tidak tersedia", !sk.tersedia);
cek("grafik kelas menghitung peserta aktif tiap 10 menit", sama(K.grafikKelas([buat([], [sesiT(RABU7, 25)]), buat([], [sesiT(RABU7 + 10 * MNT, 30)])], RABU7, RABU7 + 60 * MNT), [1, 2, 2, 1, 0, 0]), JSON.stringify(K.grafikKelas([buat([], [sesiT(RABU7, 25)]), buat([], [sesiT(RABU7 + 10 * MNT, 30)])], RABU7, RABU7 + 60 * MNT)));
cek("aktif sekarang: denyut dalam 2 menit", K.aktifSekarang(buat([], [sesiT(RABU7 - 5 * MNT, 4)]), RABU7) && !K.aktifSekarang(buat([], [sesiT(RABU7 - 20 * MNT, 4)]), RABU7));

console.log("\n== status pertemuan dan pola ==");
const J = { mulai: RABU7, selesai: RABU7_SELESAI, libur: false };
cek("kelas belum mulai: belum", K.statusPertemuan({ jadwal: J, siap: true, sekarang: RABU7 - JAM }) === "belum");
cek("kelas sudah mulai dan siap: hadir", K.statusPertemuan({ jadwal: J, siap: true, sekarang: RABU7 + JAM }) === "hadir");
cek("kelas sudah mulai dan tidak siap: tidak", K.statusPertemuan({ jadwal: J, siap: false, sekarang: RABU7 + JAM }) === "tidak");
cek("libur tidak dinilai", K.statusPertemuan({ jadwal: { ...J, libur: true }, siap: false, sekarang: RABU7 + JAM }) === "libur");
cek("koreksi manual menimpa hasil otomatis", K.statusPertemuan({ jadwal: J, siap: false, koreksi: { status: "hadir" }, sekarang: RABU7 + JAM }) === "hadir" && K.statusPertemuan({ jadwal: J, siap: true, koreksi: { status: "tidak" }, sekarang: RABU7 + JAM }) === "tidak");
const adaKelas = { tersedia: true, selesai: true, aktif: true };
cek("pola lengkap", K.pola({ siap: true, saat: adaKelas })[0] === "Lengkap");
cek("pola tanpa data kelas hanya menilai kesiapan", K.pola({ siap: true, saat: { tersedia: false, selesai: true } })[0] === "Menyiapkan diri" && K.pola({ siap: false, saat: null })[0] === "Belum menyiapkan diri");
cek("pola aktif di kelas tapi belum menyiapkan diri", K.pola({ siap: false, saat: adaKelas })[0].startsWith("Aktif di kelas"));

console.log("\n== jadwal: membuat, mengubah, menggeser ==");
const g = K.buatJadwal({ kelas: "SI-2024-A", tanggalPertama: "2026-10-07", jamMulai: "08:00", jamSelesai: "10:00", jumlah: 4 });
cek("generator membuat pertemuan mingguan", g.length === 4 && g[0].mulai === RABU7 && g[1].mulai === RABU7 + 7 * 24 * JAM && g[3].pertemuan === 4);
cek("jam WIB benar", K.jamWib(g[2].mulai) === "08:00" && K.jamWib(g[2].selesai) === "10:00" && K.hariDariWib(g[2].mulai) === 3);
const gl = K.buatJadwal({ kelas: "SI-2024-A", tanggalPertama: "2026-10-07", jamMulai: "08:00", jamSelesai: "10:00", jumlah: 3, lewati: ["2026-10-14"] });
cek("tanggal yang dilewati tidak memakai nomor pertemuan", gl.length === 3 && K.tanggalWib(gl[1].mulai) === "2026-10-21" && gl[1].pertemuan === 2);
cek("jam selesai sebelum mulai menghasilkan jadwal kosong", K.buatJadwal({ kelas: "x", tanggalPertama: "2026-10-07", jamMulai: "10:00", jamSelesai: "08:00", jumlah: 3 }).length === 0);
cek("jumlah dibatasi 40", K.buatJadwal({ kelas: "x", tanggalPertama: "2026-10-07", jamMulai: "08:00", jamSelesai: "10:00", jumlah: 999 }).length === 40);
const u = K.ubahSatu(g, 2, { tanggal: "2026-10-16", jamMulai: "10:00", jamSelesai: "12:00" });
cek("mengubah satu pertemuan: hanya itu yang berubah dan ditandai dipindah", u[1].dipindah && K.tanggalWib(u[1].mulai) === "2026-10-16" && !u[0].dipindah && u[2].mulai === g[2].mulai && g[1].dipindah === false);
cek("ubah dengan jam tidak sah ditolak", K.ubahSatu(g, 2, { tanggal: "2026-10-16", jamMulai: "12:00", jamSelesai: "10:00" }) === null && K.ubahSatu(g, 2, { tanggal: "salah", jamMulai: "10:00", jamSelesai: "12:00" }) === null);
const ge = K.geserMulai(g, 2, { hari: 5, jamMulai: "10:00", jamSelesai: "12:00" });
cek("geser: pertemuan sebelumnya tetap, yang sesudahnya pindah ke Jumat pada minggu yang sama", ge[0].mulai === g[0].mulai && ge.slice(1).every((j, i) => K.hariDariWib(j.mulai) === 5 && K.jamWib(j.mulai) === "10:00" && K.awalMinggu(j.mulai) === K.awalMinggu(g[i + 1].mulai) && j.dipindah));
cek("geser tidak menyentuh pertemuan libur", K.geserMulai(K.tandaiLibur(g, 3, true), 2, { hari: 5, jamMulai: "10:00", jamSelesai: "12:00" })[2].mulai === g[2].mulai);
cek("geser dengan masukan tidak sah ditolak", K.geserMulai(g, 2, { hari: 9, jamMulai: "10:00", jamSelesai: "12:00" }) === null && K.geserMulai(g, 2, { hari: 3, jamMulai: "12:00", jamSelesai: "10:00" }) === null);
cek("menandai libur dan mengaktifkan kembali", K.tandaiLibur(g, 1, true)[0].libur && !K.tandaiLibur(K.tandaiLibur(g, 1, true), 1, false)[0].libur && g[0].libur === false);

console.log("\n== kehadiran seluruh kelas ==");
const jadwalBaris = g.map((j) => ({ ...j, mulai: new Date(j.mulai).toISOString(), selesai: new Date(j.selesai).toISOString() }));
const peta = K.kelompokJadwal(jadwalBaris);
cek("jadwal dikelompokkan per kelas dan terurut", peta.size === 1 && peta.get("SI-2024-A").length === 4 && peta.get("SI-2024-A")[0].mulai === RABU7);
cek("kelas dicari dengan toleran spasi dan huruf besar kecil", K.cariJadwal(peta, "si 2024 a") !== null && K.cariJadwal(peta, "SI-2025-A") === null);
const peserta = [
  { id: "a", nama: "Ani", nim: "1", kelas: "SI-2024-A" },
  { id: "b", nama: "Bimo", nim: "2", kelas: "SI-2024-A" },
  { id: "c", nama: "Cici", nim: "3", kelas: "SI 2024 A" },
  { id: "d", nama: "Dedi", nim: "4", kelas: "SI-2099-Z" },
];
const SAAT_P3 = g[2].mulai + 2 * JAM; // sesudah pertemuan 3 selesai
const kejadian = new Map([
  ["a", buat([kerjaT(g[0].mulai - 20 * JAM), kerjaT(g[1].mulai - 2 * JAM), kerjaT(g[2].mulai - 30 * JAM)])],
  ["b", buat([kerjaT(g[0].mulai - 5 * JAM)])],
]);
const hasil = K.susunKehadiran({ peserta, jadwal: peta, kejadian, koreksi: [], sekarang: SAAT_P3, sesiMulai: null });
const ani = hasil.baris[0];
cek("tiga pertemuan sudah berlangsung dinilai, yang keempat belum", ani.total === 3 && ani.pertemuan[3].status === "belum");
cek("Ani hadir di semua pertemuan yang berlangsung (100 persen)", ani.hadir === 3 && ani.persen === 100);
cek("mepet dan rata-rata jam sebelum kelas terhitung", ani.mepet === 1 && ani.rataJam === Math.round((20 + 2 + 30) / 3), JSON.stringify([ani.mepet, ani.rataJam]));
cek("Bimo hanya hadir di pertemuan pertama (33 persen)", hasil.baris[1].hadir === 1 && hasil.baris[1].persen === 33);
cek("kelas dengan tulisan berbeda tetap menemukan jadwalnya", hasil.baris[2].ada && hasil.baris[2].total === 3);
cek("peserta yang kelasnya tidak punya jadwal dilaporkan", !hasil.baris[3].ada && hasil.tanpaJadwal.length === 1 && hasil.tanpaJadwal[0].id === "d" && hasil.baris[3].persen === null);
const jadwalLibur = K.kelompokJadwal(K.tandaiLibur(g, 2, true).map((j) => ({ ...j, mulai: new Date(j.mulai).toISOString(), selesai: new Date(j.selesai).toISOString() })));
const hasilLibur = K.susunKehadiran({ peserta, jadwal: jadwalLibur, kejadian, koreksi: [], sekarang: SAAT_P3 });
cek("pertemuan libur tidak masuk persentase", hasilLibur.baris[0].total === 2 && hasilLibur.baris[1].total === 2 && hasilLibur.baris[0].pertemuan[1].status === "libur");
const hasilKor = K.susunKehadiran({ peserta, jadwal: peta, kejadian, koreksi: [{ user_id: "b", pertemuan: 2, status: "hadir", alasan: "sakit" }], sekarang: SAAT_P3 });
cek("koreksi manual menaikkan hadir dan ditandai", hasilKor.baris[1].hadir === 2 && hasilKor.baris[1].pertemuan[1].koreksi.alasan === "sakit");
const geserSetelah = K.kelompokJadwal(K.ubahSatu(g, 1, { tanggal: "2026-10-05", jamMulai: "08:00", jamSelesai: "10:00" }).map((j) => ({ ...j, mulai: new Date(j.mulai).toISOString(), selesai: new Date(j.selesai).toISOString() })));
const hasilGeser = K.susunKehadiran({ peserta, jadwal: geserSetelah, kejadian, koreksi: [], sekarang: SAAT_P3 });
cek("memindah pertemuan menghitung ulang status secara otomatis (tenggat ikut berubah)", hasilGeser.baris[1].hadir === 0 && hasil.baris[1].hadir === 1);
const brk = K.pertemuanBerikut(peta.get("SI-2024-A"), g[0].mulai + JAM);
cek("pertemuan berikutnya dan yang berlangsung", brk === 1 && K.pertemuanBerlangsung(peta.get("SI-2024-A"), g[0].mulai + 30 * MNT) === 0 && K.pertemuanBerlangsung(peta.get("SI-2024-A"), g[0].mulai + 5 * JAM) === -1);

console.log("\n== aktivitas harian dan mingguan ==");
const TGL = "2026-10-05";
const kk = buat([kerjaT(K.dariWib(TGL, "20:00"), true, 5), kerjaT(K.dariWib(TGL, "19:30"), false, 5)], [sesiT(K.dariWib(TGL, "19:00"), 70, [5])]);
const rh = K.ringkasHari(kk, TGL);
cek("hari dengan lulus bernilai level 3 dan mencatat jam awal akhir", rh.level === 3 && rh.menit === 70 && K.jamWib(rh.awal) === "19:00" && rh.lulus === 1);
cek("kegiatan terurut waktu dengan keterangan", rh.kegiatan.length === 3 && rh.kegiatan[0].teks.startsWith("Membuka situs (bab 5)") && rh.kegiatan[2].teks.includes("lulus"));
cek("hari tanpa catatan: tidak aktif", K.ringkasHari(kk, "2026-10-06").level === 0);
cek("hanya membuka bernilai level 1 bila minimal 2 menit", K.ringkasHari(buat([], [sesiT(K.dariWib(TGL, "10:00"), 5)]), TGL).level === 1 && K.ringkasHari(buat([], [sesiT(K.dariWib(TGL, "10:00"), 1)]), TGL).level === 0);
cek("mengerjakan tanpa lulus level 2", K.ringkasHari(buat([kerjaT(K.dariWib(TGL, "10:00"))]), TGL).level === 2);
cek("pengerjaan 23.30 WIB masuk hari itu, bukan hari berikutnya", K.ringkasHari(buat([kerjaT(K.dariWib(TGL, "23:30"))]), TGL).level === 2 && K.ringkasHari(buat([kerjaT(K.dariWib(TGL, "23:30"))]), "2026-10-06").level === 0);
const mg = K.ringkasMinggu(kk, K.awalMinggu(K.dariWib(TGL, "12:00")), K.dariWib("2026-10-07", "09:00"));
cek("ringkasan minggu: tujuh hari, hari mendatang tidak dihitung", mg.hari.length === 7 && mg.hari[3].depan && !mg.hari[0].depan && mg.hariAktif === 1 && mg.menit === 70 && mg.lulus === 1);

console.log("\n== skor keaktifan ==");
const target = { bab: 4, hari: 8, laporan: 4, menitPerMinggu: 150 };
const kerjaBanyak = buat([kerjaT(K.dariWib("2026-10-01", "10:00"), true, 1), kerjaT(K.dariWib("2026-10-02", "10:00"), true, 2), kerjaT(K.dariWib("2026-10-03", "10:00"), true, 3), kerjaT(K.dariWib("2026-10-04", "10:00"), true, 4)], [sesiT(K.dariWib("2026-10-01", "10:00"), 300)]);
const sc = K.skorKeaktifan({ k: kerjaBanyak, laporan: 4, target, tersediaWaktu: true, minggu: 2 });
cek("skor memakai empat komponen berbobot 30, 30, 20, 20", sc.babLulus === 4 && Math.round(sc.bab) === 30 && Math.round(sc.hari) === 10 && Math.round(sc.lap) === 20 && Math.round(sc.waktu) === 30 && sc.skor === 90, JSON.stringify(sc));
const scLama = K.skorKeaktifan({ k: buat(kerjaBanyak.kerja, []), laporan: 4, target, tersediaWaktu: false, minggu: 2 });
cek("tanpa data sesi, bobot waktu dibuang dan skor diskalakan (peserta lama tidak dirugikan)", scLama.waktu === null && scLama.skor === Math.round(((30 + 10 + 20) / 70) * 100));
cek("skor tidak pernah melewati 100", K.skorKeaktifan({ k: kerjaBanyak, laporan: 99, target: { bab: 1, hari: 1, laporan: 1, menitPerMinggu: 1 }, tersediaWaktu: true, minggu: 1 }).skor === 100);
cek("peserta tanpa kegiatan bernilai 0", K.skorKeaktifan({ k: buat(), laporan: 0, target, tersediaWaktu: true, minggu: 2 }).skor === 0);

console.log("\n== CSV ==");
const csv = K.csvKehadiran(hasilKor.baris.concat([{ p: { nim: "=1+1", nama: 'Di "Ki", S.', kelas: "X" }, pertemuan: [], hadir: 0, total: 0, persen: null, rataJam: null, mepet: 0 }]));
const baris = csv.split("\r\n");
cek("CSV memuat kolom pertemuan dan status H A L", baris[0].includes("P1") && baris[0].includes("P4") && baris[1].includes(",H,"));
cek("koreksi manual ditandai bintang", baris[2].includes("H*"));
cek("rumus dan tanda kutip di nama diamankan", baris[5].startsWith("'=1+1") && baris[5].includes('"Di ""Ki"", S."'));

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
