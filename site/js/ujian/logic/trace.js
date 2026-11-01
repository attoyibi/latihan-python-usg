import { normalize } from './normalize.js';

// Nama galat dari teks traceback Python (baris terakhir "ValueError: ...") atau galat Java (nama kelas eksepsi).
export function errorName(err) {
  const s = String(err);
  // Java: "Galat kompilasi:" dari penjalan, atau jejak tumpukan "Exception in thread "main" java.lang.XxxException: pesan".
  if (s.startsWith('Galat kompilasi')) return 'CompileError';
  const j = /Exception in thread "[^"]*" ([\w.$]+)/.exec(s);
  if (j) return j[1].split('.').pop();
  const last = s.trim().split('\n').filter((l) => l.trim()).pop() || '';
  return (/^([A-Za-z_][A-Za-z0-9_]*)/.exec(last) || [])[1] || 'Error';
}

// Kunci butir "tebak keluaran": keluaran ternormalisasi, ditambah "[Galat: Nama]" bila program berhenti karena galat.
// res = { stdout, error, timeout }. Format sama dengan tools/pyrun.py (trace_key).
export function traceKey(res) {
  let out = normalize(res.stdout || '');
  const name = res.timeout ? 'TimeoutError' : res.error ? errorName(res.error) : null;
  if (name) out = `${out ? `${out}\n` : ''}[Galat: ${name}]`;
  return out;
}

// Mengubah angka pertama pada baris terakhir yang memuat angka: dasar distraktor cadangan bila varian bug kurang.
function numericVariants(line) {
  const m = /-?\d+(\.\d+)?/.exec(line);
  if (!m) return [];
  const dec = (m[1] || '').length ? m[1].length - 1 : 0;
  const n = Number(m[0]);
  const step = Math.max(1, Math.round(Math.abs(n) * 0.1));
  return [n + step, n - step, n * 2]
    .filter((v) => v !== n)
    .map((v) => line.slice(0, m.index) + v.toFixed(dec) + line.slice(m.index + m[0].length));
}

export function perturb(key) {
  const lines = key.split('\n');
  const out = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const vs = numericVariants(lines[i]);
    if (vs.length) {
      vs.forEach((v) => out.push(lines.map((l, k) => (k === i ? v : l)).join('\n')));
      break;
    }
  }
  if (lines.length >= 2 && lines[0] !== lines[1]) out.push([lines[1], lines[0], ...lines.slice(2)].join('\n'));
  return [...new Set(out)].filter((o) => o !== key);
}

// Kandidat jawaban salah: keluaran varian bug lebih dulu (lebih masuk akal), lalu perturbasi.
// variantOutputs: [{ id, out }]. Hasil: [{ text, source }] tanpa duplikat dan tanpa kunci.
export function buildAlts(key, variantOutputs) {
  const seen = new Set([key]);
  const alts = [];
  const add = (text, source) => { if (!seen.has(text)) { seen.add(text); alts.push({ text, source }); } };
  variantOutputs.forEach((v) => add(v.out, v.id));
  perturb(key).forEach((t, i) => add(t, `p${i + 1}`));
  return alts;
}

// Menandai baris keluaran yang BERBEDA antar pilihan (dibandingkan per nomor baris). Dipakai untuk menyorot bagian yang
// perlu ditelusuri peserta: baris yang sama di semua pilihan tidak perlu dihitung. Hasil: untuk tiap teks, [{ text, differs }].
export function markDiff(texts) {
  const rows = texts.map((t) => t.split('\n'));
  const len = Math.max(...rows.map((r) => r.length));
  const differs = Array.from({ length: len }, (_, i) => new Set(rows.map((r) => r[i])).size > 1);
  return rows.map((r) => r.map((text, i) => ({ text, differs: differs[i] })));
}
