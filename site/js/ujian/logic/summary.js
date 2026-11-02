import { cbmCalibration } from './cbm.js';
import { computeS2 } from './scoring.js';
import { isFlag, quadrant } from './flag.js';
import { computeS1 } from './s1.js';
import { ITEM_TYPES } from './items.js';

// Ringkasan satu peserta dari hasil Tahap 2 (semua butir pilihan ganda, dinilai otomatis).
// student.stage2 = { trace, bugline, concept, transfer: [{ correct, confidence }] }  (digabung dari semua percobaan)
// overrides = nilai timpaan dosen untuk soal teori Tahap 1 (lihat s1.js); S1 digabung dari praktik (tes) dan teori.
export function summarize(student, exam, overrides = {}) {
  const { weights, flag, cbm } = exam.config;
  const s1 = computeS1(student, exam, overrides);
  const rows = ITEM_TYPES.flatMap((t) => student.stage2[t] || []);
  const items = ITEM_TYPES.flatMap((t) => (student.stage2[t] || []).map((r) => ({ type: t, score: r.correct ? 1 : 0 })));
  const correct = Object.fromEntries(ITEM_TYPES.map((t) => [t, (student.stage2[t] || []).filter((r) => r.correct).length]));
  const count = Object.fromEntries(ITEM_TYPES.map((t) => [t, (student.stage2[t] || []).length]));
  const c = cbmCalibration(rows, cbm);
  const r = computeS2(items, weights, flag.ciZ);
  return {
    id: student.id, status: 'complete', s1, s2: r.s2, lower: r.lower, upper: r.upper,
    c, g: s1 - r.s2, correct, count, byType: r.byType, n: items.length,
    quadrant: quadrant(s1, r.s2, flag),
    flag: isFlag(s1, r.s2, r.upper, flag),
  };
}
