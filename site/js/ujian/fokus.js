// Mencatat peserta yang meninggalkan halaman ujian selama Tahap 1 atau Tahap 2: pindah tab, minimalkan jendela, atau
// berpindah ke jendela/aplikasi lain. Halaman web tidak bisa mencegahnya (dan tidak bisa melihat isi tab lain), jadi
// yang dicatat hanya jumlah, lama, dan jam kejadiannya; dosen melihatnya bersama jawaban. Ini petunjuk, bukan bukti:
// tujuannya mendorong penggunaan AI yang bertanggung jawab (jawaban diramu sendiri, bukan disalin dari AI).
import * as store from './store.js';
import { tampilkanPesan } from '../anticopas.js';

const MAKS_KEJADIAN = 60;

// aktif() -> true bila ujian sedang di tahap yang dijaga. Mengembalikan fungsi pelepas.
export function pasangPenjagaFokus(aktif) {
  let mulai = null; // { at, jenis } saat peserta sedang pergi
  const pergi = (jenis) => {
    if (mulai || !aktif()) return;
    mulai = { at: Date.now(), jenis };
  };
  const kembali = () => {
    if (!mulai) return;
    const { at, jenis } = mulai;
    mulai = null;
    if (!aktif()) return;
    const detik = Math.max(1, Math.round((Date.now() - at) / 1000));
    store.update((s) => {
      const f = ((s.demo ||= {}).fokus ||= { n: 0, detik: 0, kejadian: [] });
      f.n += 1;
      f.detik += detik;
      if (f.kejadian.length < MAKS_KEJADIAN) f.kejadian.push({ at: new Date(at).toISOString(), detik, jenis, tahap: s.demo.stage1?.submitted ? 2 : 1 });
    });
    tampilkanPesan(`Kamu meninggalkan halaman ujian selama ${detik} detik. Ini tercatat dan dilihat dosen. Gunakan AI sebagai teman berpikir, lalu tulis jawabanmu sendiri.`);
  };
  const onVisibility = () => (document.visibilityState === 'hidden' ? pergi('tab') : kembali());
  // Fokus pindah ke jendela lain tanpa tab tersembunyi (mis. dua jendela berdampingan): dicatat sebagai 'jendela'.
  const onBlur = () => setTimeout(() => { if (document.visibilityState === 'visible' && !document.hasFocus()) pergi('jendela'); }, 150);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', kembali);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', kembali);
  };
}
