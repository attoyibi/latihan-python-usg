import { scoreTheory } from './theory.js';

// Nilai tiap soal teori seorang peserta: otomatis dari poin kunci, atau nilai timpaan dosen bila ada.
// overrides = { "<studentId>:<questionId>": 0..1 }
export function theoryResults(student, exam, overrides = {}) {
  const minWords = exam.config.theory?.minWords ?? 25;
  return exam.theory.map((q) => {
    const auto = scoreTheory(student.theory?.[q.id] || '', q, { minWords });
    const o = overrides[`${student.id}:${q.id}`];
    return { id: q.id, auto, score: typeof o === 'number' ? o : auto.score, overridden: typeof o === 'number' };
  });
}

// S1 = bobot praktik x rata-rata proporsi tes lulus + bobot teori x rata-rata nilai soal teori.
// Peserta dummy lama (tanpa jawaban teori) memakai s1 tetap.
export function computeS1(student, exam, overrides = {}) {
  if (!student.theory) return student.s1;
  const { practice, theory } = exam.config.s1;
  const res = theoryResults(student, exam, overrides);
  const t = res.reduce((s, r) => s + r.score, 0) / res.length;
  return (practice * (student.s1Practice ?? 0) + theory * t) / (practice + theory);
}
