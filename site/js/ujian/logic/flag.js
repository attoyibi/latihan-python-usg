// Flag = triase, bukan vonis. cfg = { gap, pass, highS1 }.
export function isFlag(s1, s2, s2Upper, cfg) {
  // Toleransi 1e-9 agar selisih tepat di ambang (mis. 0,9 - 0,6) tidak lolos karena galat desimal.
  return s1 - s2 - cfg.gap > 1e-9 && s2Upper < cfg.pass;
}

export function quadrant(s1, s2, cfg) {
  const hiS1 = s1 >= cfg.highS1;
  const hiS2 = s2 >= cfg.pass;
  if (hiS1 && hiS2) return 'both-high';
  if (hiS1) return 's1-high-s2-low';
  if (hiS2) return 's1-low-s2-high';
  return 'both-low';
}

export const QUADRANT_LABEL = {
  'both-high': 'Paham, produk baik',
  's1-high-s2-low': 'S1 tinggi, S2 rendah',
  's1-low-s2-high': 'Paham, produk lemah',
  'both-low': 'Belum paham',
};
