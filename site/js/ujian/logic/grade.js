// Nilai akhir skala 100, dihitung OTOMATIS dengan rumus "plafon pemahaman" (SPEC bagian 5), tanpa langkah manual.
//
//   S2' = min(S1, S2 + toleransi)            (selisih kecil dianggap wajar, bukan bukti)
//   plafon = w·S2' + (1−w)·min(S1, S2' + δ)
//   nilai  = min(S1, plafon), tetapi tidak kurang dari S1 − maxCut
//
// Artinya: nilai tidak pernah melebihi S1 (pemahaman tinggi tidak menambah nilai, produk yang lemah hanya diberi umpan balik);
// bila S2 jauh di bawah S1, nilai turun mengikuti S2, dengan batas pengurangan maxCut supaya satu sesi yang buruk tidak
// menghancurkan nilai. Peserta yang S1 dan S2-nya sejalan (selisih ≤ toleransi) tidak dikurangi sama sekali.
// Dosen boleh menimpa nilai (opsional); sistem tidak membutuhkannya.

const pt = (x) => Math.round(x * 100);

export function computeGrade(r, cfg) {
  const { w, delta, maxCut, tolerance = 0 } = cfg.grade;
  const s2e = Math.min(r.s1, r.s2 + tolerance);
  const plafon = w * s2e + (1 - w) * Math.min(r.s1, s2e + delta);
  const value = Math.max(Math.min(r.s1, plafon), r.s1 - maxCut);
  const base = pt(r.s1);
  const final = pt(value);
  const cut = base - final;
  const s2 = pt(r.s2);
  const capped = r.s1 - plafon > maxCut;

  const reasons = [`Nilai Tahap 1 (S1): ${base} dari 100.`, `Pemahaman Tahap 2 (S2): ${s2} (rentang kepastian ${pt(r.lower)}–${pt(r.upper)}).`];
  let evidence;
  if (r.s2 > r.s1 + 0.15) {
    evidence = 's2-lebih-tinggi';
    reasons.push(`S2 lebih tinggi dari S1. Nilai tidak ditambah; produk Tahap 1 perlu umpan balik.`);
  } else if (cut <= 0) {
    evidence = 'sejalan';
    reasons.push('Pemahaman sejalan dengan hasil Tahap 1: tidak ada pengurangan.');
  } else {
    evidence = 'dikurangi';
    reasons.push(`Rumus plafon pemahaman (S2 diberi toleransi ${pt(tolerance)} poin): ${pt(w)}% × S2' + ${pt(1 - w)}% × min(S1, S2' + ${pt(delta)}) = ${pt(plafon)}.`);
    reasons.push(capped
      ? `Pengurangan dibatasi maksimum ${pt(maxCut)} poin: nilai ${final} (S1 ${base} − ${cut}).`
      : `Karena S2 lebih rendah dari S1, nilai menjadi ${final} (pengurangan ${cut} poin).`);
  }
  return { base, s2, value: final, cut, evidence, plafon: pt(plafon), capped, reasons };
}

// Uji ulang otomatis: ditawarkan bila hasil Tahap 2 ter-flag dan masih ada jatah percobaan.
export function retestAdvice(r, cfg, attemptsUsed) {
  const left = cfg.stage2.maxAttempts - attemptsUsed;
  return { available: left > 0, recommended: left > 0 && !!r.flag };
}

// Nilai yang dilihat peserta: nilai timpaan dosen bila ada, selain itu nilai otomatis.
export function studentGrade(grade, override) {
  if (typeof override === 'number') return { value: override, note: 'Ditetapkan dosen' };
  return { value: grade.value, note: grade.cut > 0 ? `Otomatis (dikurangi ${grade.cut} poin)` : 'Otomatis' };
}

export const EVIDENCE_LABEL = {
  sejalan: 'Sejalan',
  dikurangi: 'Dikurangi',
  's2-lebih-tinggi': 'S2 lebih tinggi',
};
