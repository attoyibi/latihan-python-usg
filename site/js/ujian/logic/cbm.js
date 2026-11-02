// Certainty-based marking. scheme = { correct: {1:1,2:2,3:3}, wrong: {1:0,2:-2,3:-6} }
export function cbmPoints(correct, confidence, scheme) {
  const points = (correct ? scheme.correct : scheme.wrong)[confidence];
  if (points === undefined) throw new Error(`Rating keyakinan tidak valid: ${confidence}`);
  return points;
}

// C: total poin CBM dinormalisasi ke 0-1 (0 = semua salah dengan keyakinan tertinggi,
// 1 = semua benar dengan keyakinan tertinggi). Dilaporkan terpisah dari S2.
export function cbmCalibration(answers, scheme) {
  if (!answers.length) return null;
  const max = Math.max(...Object.values(scheme.correct));
  const min = Math.min(...Object.values(scheme.wrong));
  const total = answers.reduce((s, a) => s + cbmPoints(a.correct, a.confidence, scheme), 0);
  return (total - min * answers.length) / ((max - min) * answers.length);
}
