// Menguji pencatat sesi belajar (site/js/pencatat.js) dengan jam dan pengirim tiruan. Jalankan: node tools/uji_sesi.mjs
import { Pencatat, IDLE_MS, DENYUT_MS, SESI_BARU_MS } from "../site/js/pencatat.js";

let total = 0;
let gagal = 0;
const cek = (nama, kondisi, detail = "") => {
  total++;
  if (!kondisi) {
    gagal++;
    console.log("GAGAL " + nama + (detail ? "  -> " + detail : ""));
  } else console.log("OK    " + nama);
};

function buat(opsi = {}) {
  const jam = { t: 1_000_000 };
  const kirim = [];
  let ok = true;
  let n = 0;
  const penyimpan = { nilai: null };
  const p = new Pencatat({
    sekarang: () => jam.t,
    kirim: async (x) => {
      kirim.push(x);
      return ok;
    },
    idBaru: () => "sesi-" + ++n,
    simpan: { ambil: () => penyimpan.nilai, tulis: (v) => (penyimpan.nilai = v) },
    ...opsi,
  });
  return { p, jam, kirim, penyimpan, gagalkan: (v) => (ok = !v) };
}
const maju = (c, ms, terlihat = true, tiapMs = 5000) => {
  for (let i = 0; i < ms / tiapMs; i++) {
    c.jam.t += tiapMs;
    c.p.tik(terlihat);
  }
};

console.log("== waktu aktif ==");
let c = buat();
c.p.konteks("algoritma-python", 4);
c.p.ketuk();
maju(c, 60000);
cek("tab terlihat dan ada gerakan: menit aktif bertambah", Math.round(c.p.sisa) === 60, String(c.p.sisa));
c = buat();
c.p.konteks("algoritma-python", 4);
maju(c, 60000, false);
cek("tab tersembunyi tidak dihitung aktif", c.p.sisa === 0);
c = buat();
c.p.konteks("algoritma-python", 4);
c.p.ketuk();
maju(c, IDLE_MS + 60000);
cek("tanpa gerakan melewati batas idle, berhenti dihitung", c.p.sisa > 0 && c.p.sisa <= IDLE_MS / 1000 + 5, String(c.p.sisa));
c = buat();
c.p.konteks("algoritma-python", 4);
c.p.ketuk();
c.jam.t += 3_600_000;
c.p.tik(true);
cek("perangkat tidur sejam tidak menambah waktu aktif sebanyak itu", c.p.sisa <= 10, String(c.p.sisa));
c = buat();
maju(c, 30000);
cek("sebelum membuka mata kuliah apa pun tidak ada yang dihitung", c.p.sisa === 0);

console.log("\n== pengiriman denyut ==");
c = buat();
c.p.konteks("algoritma-python", 4);
let ok1 = await c.p.denyut(true);
cek("denyut pertama mendaftarkan sesi walau belum ada waktu aktif", ok1 && c.kirim.length === 1 && c.kirim[0].tambah === 0 && c.kirim[0].sesi === "sesi-1" && c.kirim[0].bab === 4);
c.jam.t += 1000;
ok1 = await c.p.denyut();
cek("denyut berikutnya dalam jeda singkat tidak memanggil server", !ok1 && c.kirim.length === 1);
c.p.ketuk();
maju(c, DENYUT_MS);
ok1 = await c.p.denyut();
cek("setelah jeda dan ada waktu aktif, denyut terkirim dengan tambahan detik", ok1 && c.kirim.length === 2 && c.kirim[1].tambah >= 25 && c.kirim[1].tambah <= 31, JSON.stringify(c.kirim[1]));
cek("detik yang terkirim dikurangkan dari sisa (tidak dihitung dua kali)", c.p.sisa < 1);
maju(c, DENYUT_MS, true);
c.p.ketuk();
c.jam.t += 1;
await c.p.denyut();
cek("tanpa waktu aktif baru tidak memanggil server (hemat)", c.kirim.length >= 2);
c = buat();
c.p.konteks("algoritma-python", 4);
await c.p.denyut(true);
c.p.ketuk();
maju(c, DENYUT_MS + 5000);
c.gagalkan(true);
cek("pengiriman gagal mengembalikan false tanpa melempar galat", (await c.p.denyut()) === false);
const sisaGagal = c.p.sisa;
cek("waktu yang gagal terkirim disimpan, bukan dibuang", sisaGagal >= 30);
c.gagalkan(false);
c.p.ketuk();
maju(c, 5000);
cek("dicoba lagi di denyut berikutnya dan berhasil", (await c.p.denyut(true)) === true && c.kirim[c.kirim.length - 1].tambah >= sisaGagal - 1);
let galat = false;
c = buat({ kirim: async () => { throw new Error("jaringan putus"); } });
c.p.konteks("algoritma-python", 4);
try { await c.p.denyut(true); } catch (e) { galat = true; }
cek("galat jaringan tidak pernah sampai ke peserta", !galat);
c = buat();
c.p.konteks("algoritma-python", 4);
c.p.ketuk();
maju(c, 20000);
const p1 = c.p.denyut(true);
const p2 = c.p.denyut(true);
await Promise.all([p1, p2]);
cek("dua denyut bersamaan tidak mengirim dobel", c.kirim.length === 1);
c = buat();
c.p.konteks("algoritma-python", 4);
c.p.ketuk();
maju(c, 20000);
await c.p.denyut(true);
const ke = c.kirim.length;
c.p.konteks("algoritma-python", 5);
cek("berpindah bab dikirim secepatnya (bab baru tercatat)", (await c.p.denyut()) === true && c.kirim.length === ke + 1 && c.kirim[ke].bab === 5);

console.log("\n== sesi baru dan lanjut ==");
c = buat();
c.p.konteks("algoritma-python", 4);
await c.p.denyut(true);
const awal = c.p.sesi;
c.jam.t += 10 * 60000;
c.p.ketuk();
c.p.konteks("algoritma-python", 5);
cek("jeda 10 menit masih sesi yang sama", c.p.sesi === awal);
c.jam.t += SESI_BARU_MS + 60000;
c.p.ketuk();
c.p.konteks("algoritma-python", 6);
cek("jeda lebih dari 30 menit membuka sesi baru", c.p.sesi !== awal && c.p.sesi === "sesi-2");
await c.p.denyut(true);
cek("sesi baru dikirim dengan id baru", c.kirim[c.kirim.length - 1].sesi === "sesi-2");
c = buat();
c.p.konteks("algoritma-python", 4);
await c.p.denyut(true);
const lama = c.penyimpan.nilai;
const c2 = buat();
c2.penyimpan.nilai = { id: lama.id, terakhir: c2.jam.t - 60000 };
const p3 = new Pencatat({ sekarang: () => c2.jam.t, kirim: async () => true, idBaru: () => "baru", simpan: { ambil: () => c2.penyimpan.nilai, tulis: (v) => (c2.penyimpan.nilai = v) } });
p3.konteks("algoritma-python", 4);
cek("muat ulang halaman dalam 30 menit melanjutkan sesi yang tersimpan", p3.sesi === lama.id);
const c3 = buat();
c3.penyimpan.nilai = { id: "usang", terakhir: c3.jam.t - SESI_BARU_MS - 1000 };
const p4 = new Pencatat({ sekarang: () => c3.jam.t, kirim: async () => true, idBaru: () => "segar", simpan: { ambil: () => c3.penyimpan.nilai, tulis: (v) => (c3.penyimpan.nilai = v) } });
p4.konteks("algoritma-python", 4);
cek("sesi tersimpan yang sudah usang tidak dipakai", p4.sesi === "segar");
c = buat();
c.p.konteks("algoritma-python", 4);
await c.p.denyut(true);
c.p.reset();
cek("reset (keluar) melupakan sesi sehingga akun berikutnya di perangkat ini mulai bersih", c.p.sesi === null && c.penyimpan.nilai === null && c.p.sisa === 0);

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
