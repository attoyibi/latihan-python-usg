// Merekam cara peserta menulis kode di editor latihan: kapan, di mana, dan berapa banyak perubahan.
// Dari rekaman dihitung ringkasan angka (`pola`) dan disimpan urutan perubahannya (`rekaman`) untuk diputar ulang
// instruktur. Yang direkam hanya perubahan di dalam editor latihan, bukan tombol lain atau isi halaman lain.
// Isi yang ditempel tidak ada, karena menempel diblokir (anticopas.js).

const JEDA_AKTIF_MAKS = 20000; // jeda lebih lama dari ini dianggap berhenti, tidak dihitung sebagai waktu mengetik
const BESAR = 25; // sisipan sebesar ini dalam satu perubahan dianggap potongan besar, bukan ketikan
const median = (a) => {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const bulat = (x, d = 2) => (x === null || x === undefined || !isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

/**
 * Menghitung pola dari peristiwa mentah.
 * @param {{t:number, off:number, del:number, ins:string, origin?:string, panjang:number}[]} ev  t dalam ms; panjang = panjang dokumen sebelum perubahan
 * @param {{waktuMuat?:number, jalankan?:number[], waktuKirim?:number, panjangAkhir?:number}} opsi
 */
export function hitungPola(ev, opsi = {}) {
  const { waktuMuat = null, jalankan = [], waktuKirim = null, panjangAkhir = null } = opsi;
  const isi = ev.filter((e) => e.origin !== "undo" && e.origin !== "redo");
  const kecil = isi.filter((e) => e.ins.length >= 1 && e.ins.length <= 3);
  const sisip = isi.filter((e) => e.ins.length > 0);

  let aktif = 0;
  for (let i = 1; i < ev.length; i++) {
    const g = ev[i].t - ev[i - 1].t;
    if (g <= JEDA_AKTIF_MAKS) aktif += g;
  }
  const diketik = kecil.reduce((a, e) => a + e.ins.length, 0);
  const insTotal = sisip.reduce((a, e) => a + e.ins.length, 0);
  const hapusTotal = ev.reduce((a, e) => a + e.del, 0);

  // Menulis lurus: tiap sisipan ada di ujung dokumen. Lompat: kembali ke bagian yang lebih atas dari terakhir diedit.
  const diUjung = sisip.filter((e) => e.off >= e.panjang - 1).length;
  let lompat = 0;
  let akhirTerakhir = null;
  for (const e of ev) {
    if (akhirTerakhir !== null && e.off < akhirTerakhir - 15) lompat++;
    akhirTerakhir = e.off + e.ins.length;
  }

  // Kecepatan puncak (huruf per detik): jendela geser 10 detik, dibagi lamanya jendela itu atau 4 detik bila lebih pendek,
  // supaya letupan singkat tidak tampak lambat dan satu-dua ketukan cepat tidak tampak seperti mesin.
  let puncak = 0;
  const ketuk = kecil.map((e) => ({ t: e.t, n: e.ins.length }));
  for (let i = 0, j = 0, jum = 0; i < ketuk.length; i++) {
    jum += ketuk[i].n;
    while (ketuk[i].t - ketuk[j].t > 10000) jum -= ketuk[j++].n;
    puncak = Math.max(puncak, jum / Math.max((ketuk[i].t - ketuk[j].t) / 1000, 4));
  }

  // Ritme: keragaman jarak antar-ketukan dalam satu rentetan mengetik (manusia tidak pernah serata mesin).
  const jarak = [];
  for (let i = 1; i < kecil.length; i++) {
    const g = kecil[i].t - kecil[i - 1].t;
    if (g > 0 && g < 2000) jarak.push(g);
  }
  let cv = null;
  if (jarak.length >= 15) {
    const rata = jarak.reduce((a, b) => a + b, 0) / jarak.length;
    const sd = Math.sqrt(jarak.reduce((a, b) => a + (b - rata) ** 2, 0) / jarak.length);
    cv = rata ? sd / rata : null;
  }

  const jedaPikir = [];
  for (let i = 1; i < ev.length; i++) {
    const g = ev[i].t - ev[i - 1].t;
    if (g > 2000 && g <= 120000) jedaPikir.push(g / 1000);
  }

  const mulai = ev.length ? ev[0].t : null;
  const selesai = ev.length ? ev[ev.length - 1].t : null;
  const sebelumKirim = jalankan.filter((t) => waktuKirim === null || t <= waktuKirim);
  return {
    kejadian: ev.length,
    ketuk: kecil.length,
    diketik,
    dihapus: hapusTotal,
    rasio_hapus: bulat(insTotal ? hapusTotal / insTotal : 0),
    besar_maks: sisip.reduce((a, e) => Math.max(a, e.ins.length), 0),
    jumlah_besar: sisip.filter((e) => e.ins.length >= BESAR).length,
    linier: bulat(sisip.length ? diUjung / sisip.length : null),
    lompat,
    cps: bulat(aktif > 0 ? diketik / (aktif / 1000) : null),
    cps_puncak: bulat(puncak),
    cv_ketuk: bulat(cv),
    jeda_pertama_s: bulat(waktuMuat !== null && mulai !== null ? (mulai - waktuMuat) / 1000 : null, 1),
    jeda_median_s: bulat(median(jedaPikir), 1),
    aktif_s: bulat(aktif / 1000, 1),
    rentang_s: bulat(mulai !== null ? (selesai - mulai) / 1000 : null, 1),
    undo: ev.length - isi.length,
    jalankan: sebelumKirim.length,
    jalankan_ke_kirim_s: bulat(sebelumKirim.length && waktuKirim !== null ? (waktuKirim - sebelumKirim[sebelumKirim.length - 1]) / 1000 : null, 1),
    panjang_akhir: panjangAkhir,
  };
}

/**
 * Memadatkan peristiwa untuk disimpan: ketikan berurutan yang berdekatan digabung menjadi satu "semburan".
 * Bentuk: ["e", dt, offset, hapus, teks, jumlahKetukan, durasi] dan ["j", dt] untuk tombol Jalankan.
 * dt = ms sejak awal peristiwa sebelumnya.
 */
export function padatkan(ev, jalankan = [], jedaGabung = 600) {
  const gabungan = ev.map((e) => ({ jenis: "e", t: e.t, off: e.off, del: e.del, ins: e.ins })).concat(jalankan.map((t) => ({ jenis: "j", t }))).sort((a, b) => a.t - b.t);
  const hasil = [];
  let prev = null; // item hasil terakhir yang masih bisa digabung (struktur kerja)
  let prevT = 0;
  for (const e of gabungan) {
    if (e.jenis === "j") {
      hasil.push({ j: true, dt: Math.max(0, Math.round(e.t - prevT)), t: e.t });
      prevT = e.t;
      prev = null;
      continue;
    }
    const kecil = e.ins.length >= 1 && e.ins.length <= 3 && e.del === 0;
    if (prev && kecil && e.t - prev.akhirT <= jedaGabung && e.off === prev.off + prev.ins.length) {
      prev.ins += e.ins;
      prev.n++;
      prev.akhirT = e.t;
      continue;
    }
    prev = { dt: Math.max(0, Math.round(e.t - prevT)), t: e.t, off: e.off, del: e.del, ins: e.ins, n: 1, akhirT: e.t, bisaGabung: kecil };
    if (!kecil) prev.bisaGabung = false;
    hasil.push(prev);
    prevT = e.t;
    if (!kecil) prev = null;
  }
  return hasil.map((x) => (x.j ? ["j", x.dt] : ["e", x.dt, x.off, x.del, x.ins, x.n, Math.round(x.akhirT - x.t)]));
}

/** Memutar ulang: menerapkan rekaman ({awal, e}) dan mengembalikan daftar langkah {t, teks, jalankan}. */
export function susunUlang({ awal, e: rekaman }) {
  const langkah = [{ t: 0, teks: awal, jalankan: false }];
  let teks = awal;
  let t = 0;
  for (const r of rekaman) {
    t += r[1];
    if (r[0] === "j") {
      langkah.push({ t, teks, jalankan: true });
      continue;
    }
    const [, , off, hapus, tambah, n, d] = r;
    // Semburan diputar huruf demi huruf agar terasa seperti mengetik.
    if (n > 1 && tambah.length > 1) {
      for (let i = 1; i <= tambah.length; i++) {
        langkah.push({ t: t + Math.round((d * i) / tambah.length), teks: teks.slice(0, off) + tambah.slice(0, i) + teks.slice(off + hapus), jalankan: false, sisipan: true });
      }
      teks = teks.slice(0, off) + tambah + teks.slice(off + hapus);
      t += d;
    } else {
      teks = teks.slice(0, off) + tambah + teks.slice(off + hapus);
      langkah.push({ t, teks, jalankan: false });
    }
  }
  return langkah;
}

// Menjaga ukuran rekaman: coba gabung lebih longgar, lalu menyerah (pola tetap tersimpan, rekaman dibuang).
export const MAKS_REKAMAN = 100000;
export function rekamanAman(awal, ev, jalankan, maks = MAKS_REKAMAN) {
  for (const jeda of [600, 2000, 8000]) {
    const e = padatkan(ev, jalankan, jeda);
    const r = { awal, e };
    if (JSON.stringify(r).length <= maks) return r;
  }
  return null;
}
// Rekaman yang disimpan di setiap baris Jalankan lebih kecil daripada milik Kirim, supaya database tidak menggembung.
export const MAKS_REKAMAN_JALANKAN = 20000;

/**
 * Menggabungkan rekaman berantai (tiap rekaman dimulai dari kode akhir rekaman sebelumnya) menjadi satu rekaman utuh
 * supaya bisa diputar dari awal bab. Bila kode awal sebuah rekaman tidak sama dengan hasil akhir sebelumnya (kode diganti
 * di luar rekaman, mis. "Kembalikan kode awal"), disisipkan satu penggantian utuh. Elemen kosong (rekaman hilang) dilewati.
 */
export function gabungRekaman(daftar) {
  const ada = daftar.filter((r) => r && Array.isArray(r.e));
  if (!ada.length) return null;
  const awal = ada[0].awal;
  let teks = awal;
  const e = [];
  ada.forEach((r, i) => {
    if (i > 0 && r.awal !== teks) {
      e.push(["e", 600, 0, teks.length, r.awal, 1, 0]);
      teks = r.awal;
    }
    for (const x of r.e) {
      e.push(x);
      if (x[0] === "e") teks = teks.slice(0, x[2]) + x[4] + teks.slice(x[2] + x[3]);
    }
  });
  return { awal, e };
}

/**
 * Memasang perekam pada instance CodeMirror 5. Mengembalikan:
 *  jalankan()      mencatat penekanan tombol Jalankan
 *  ambil(waktu)    {awal, pola, rekaman} untuk perubahan sejak kirim terakhir, lalu mulai catatan baru
 *  setAwal(teks)   mengatur ulang catatan (mis. tombol "kembalikan kode awal")
 */
export function pasangRekam(editor, awal, { sekarang = () => performance.now() } = {}) {
  let ev = [];
  let jalan = [];
  let kodeAwal = awal;
  let panjang = awal.length;
  const waktuMuat = sekarang();

  editor.on("change", (cm, c) => {
    const ins = c.text.join("\n");
    const del = c.removed.join("\n").length;
    if (c.origin === "setValue") {
      ev = [];
      jalan = [];
      kodeAwal = cm.getValue();
      panjang = kodeAwal.length;
      return;
    }
    ev.push({ t: sekarang(), off: cm.indexFromPos(c.from), del, ins, origin: c.origin, panjang });
    panjang += ins.length - del;
  });

  return {
    jalankan: () => jalan.push(sekarang()),
    ambil() {
      const waktuKirim = sekarang();
      const hasil = {
        awal: kodeAwal,
        pola: hitungPola(ev, { waktuMuat, jalankan: jalan, waktuKirim, panjangAkhir: panjang }),
        rekaman: rekamanAman(kodeAwal, ev, jalan),
      };
      // Rantai berikutnya dimulai dari kode sekarang: rekaman tiap kirim bisa diputar sendiri.
      kodeAwal = editor.getValue();
      ev = [];
      jalan = [];
      panjang = kodeAwal.length;
      return hasil;
    },
    /** Seperti ambil() tetapi TIDAK memulai catatan baru: dipakai saat tombol Jalankan agar rantai rekaman Kirim tidak berubah. */
    lihat() {
      return {
        awal: kodeAwal,
        pola: hitungPola(ev, { waktuMuat, jalankan: jalan, waktuKirim: sekarang(), panjangAkhir: panjang }),
        rekaman: rekamanAman(kodeAwal, ev, jalan, MAKS_REKAMAN_JALANKAN),
      };
    },
    setAwal(teks) {
      ev = [];
      jalan = [];
      kodeAwal = teks;
      panjang = teks.length;
    },
  };
}
