// S2 = rata-rata tertimbang per jenis butir. Bobot jenis yang tidak ada dinormalisasi ulang.
// items: [{ type, score }] dengan score 0-1.
export function computeS2(items, weights, ciZ = 1.28) {
  const n = items.length;
  if (!n) return null;
  const byType = {};
  for (const it of items) (byType[it.type] ||= []).push(it.score);
  const types = Object.keys(byType);
  const wSum = types.reduce((s, t) => s + (weights[t] ?? 0), 0);
  if (wSum <= 0) throw new Error('Bobot S2 untuk jenis butir yang ada bernilai 0');

  const itemWeight = {};
  const typeMeans = {};
  let s2 = 0;
  for (const t of types) {
    const xs = byType[t];
    const sum = xs.reduce((a, b) => a + b, 0);
    typeMeans[t] = { mean: sum / xs.length, n: xs.length };
    itemWeight[t] = (weights[t] ?? 0) / wSum / xs.length;
    s2 += itemWeight[t] * sum;
  }
  // Galat baku rata-rata tertimbang (bobot sama => s/sqrt(n)). Dengan n kecil interval lebar, itu disengaja.
  let se = 1;
  if (n > 1) {
    let v = 0;
    for (const it of items) v += (itemWeight[it.type] * (it.score - s2)) ** 2;
    se = Math.sqrt((v * n) / (n - 1));
  }
  return { s2, se, lower: Math.max(0, s2 - ciZ * se), upper: Math.min(1, s2 + ciZ * se), n, byType: typeMeans };
}
