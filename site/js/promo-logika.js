// Aturan kapan promo silang boleh muncul dan promo mana yang dipilih. Murni (tanpa DOM) supaya bisa diuji.
//
// Dasar aturan (praktik umum toast/notifikasi dan standar iklan yang tidak mengganggu):
//  - pesan singkat yang bisa diklik tampil beberapa detik saja (toast biasa 4-5 detik, batas atas sekitar 10 detik);
//    di sini 9 detik karena ada animasi masuk dan satu kalimat ajakan, dan timer berhenti saat disentuh atau difokus
//  - satu per satu, tidak ditumpuk, dan hanya menutup sebagian kecil layar
//  - tidak muncul saat pengguna sedang mengetik atau mengerjakan sesuatu, dan jumlahnya dibatasi per sesi
//  - selalu ada tombol tutup, dan pengguna bisa mematikannya
//  - kunjungan pertama dalam sehari (per browser) selalu menampilkan satu promo di awal; sesudah itu berlaku undian di bawah
export const ATURAN = {
  tundaAwalDetik: [120, 240], // jeda sebelum kemunculan acak pertama (selama tab terlihat, di halaman mana pun)
  jedaDetik: [300, 600], // jeda antar kemunculan
  maksPerSesi: 3,
  peluang: 0.5, // tiap pemeriksaan yang lolos syarat: kadang muncul, kadang tidak
  diamMinDetik: 5, // tidak ada ketikan atau sentuhan selama sekian detik
  tampilMs: 9000,
  periksaMs: 15000,
};

const antara = ([a, b], rnd) => Math.round(a + (b - a) * rnd());
export const tundaAwal = (rnd = Math.random) => antara(ATURAN.tundaAwalDetik, rnd) * 1000;
export const jedaBerikut = (rnd = Math.random) => antara(ATURAN.jedaDetik, rnd) * 1000;

// Promo yang ikut diundi, tanpa yang sudah tampil di sesi ini. Bila semua sudah tampil, undian diulang dari awal.
export function pilihPromo(daftar, sudahId, rnd = Math.random) {
  const ikut = daftar.filter((p) => !p.lewati);
  if (!ikut.length) return null;
  const sudah = new Set(sudahId);
  let calon = ikut.filter((p) => !sudah.has(p.id));
  if (!calon.length) calon = ikut;
  return calon[Math.min(calon.length - 1, Math.floor(rnd() * calon.length))];
}

// s: { terlihat, mati, jumlah, sedangTampil, menunggu (ms), diamMs, adaDialog }
export function layak(s) {
  return !!s.terlihat && !s.mati && !s.sedangTampil && !s.adaDialog && s.jumlah < ATURAN.maksPerSesi && s.menunggu <= 0 && s.diamMs >= ATURAN.diamMinDetik * 1000;
}

export const undi = (s, rnd = Math.random) => layak(s) && rnd() < ATURAN.peluang;

// Tanggal lokal browser, mis. "2026-10-10". Dipakai sebagai penanda "promo hari ini sudah muncul".
export const tanggalLokal = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

// Benar bila promo belum pernah muncul hari ini di browser ini (penanda kosong, rusak, atau tanggal lain).
export const pertamaHariIni = (tersimpan, sekarang = new Date()) => tersimpan !== tanggalLokal(sekarang);
