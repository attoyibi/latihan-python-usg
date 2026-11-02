import { makeRng, shuffle } from './rng.js';

// Daftar tinjauan acak (OPSIONAL, boleh diabaikan): persen tertentu dari peserta, dipilih berbenih supaya
// daftar yang sama muncul tiap kali dibuka. Dipakai dosen bila ingin mengecek sebagian peserta secara langsung.
export function auditSample(ids, percent, seed) {
  if (!ids.length || percent <= 0) return [];
  const n = Math.max(1, Math.round((ids.length * percent) / 100));
  return shuffle([...ids].sort(), makeRng(`audit|${seed}`)).slice(0, n).sort();
}
