import { makeRng, shuffle } from './rng.js';

// Pembuat bug untuk butir "Perbaiki bug": mengubah SATU hal kecil di kode peserta sendiri (operator, batas, nilai awal).
// Hanya menyentuh kode asli, bukan isi string atau komentar. language: 'python' (bawaan) atau 'java'.

// Java: komentar // dan /* */, string "..." dan karakter '...' diganti spasi (panjang dan baris baru dipertahankan).
function maskJava(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    if (code.startsWith('//', i)) {
      while (i < n && code[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      out += code.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    const c = code[i];
    if (c === '"' || c === "'") {
      out += ' ';
      i++;
      while (i < n && code[i] !== c && code[i] !== '\n') {
        if (code[i] === '\\') { out += '  '; i += 2; continue; }
        out += ' ';
        i++;
      }
      if (code[i] === c) { out += ' '; i++; }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Mengganti isi string dan komentar dengan spasi (panjang sama), supaya pencarian hanya mengenai kode.
export function maskCode(code, language = 'python') {
  if (language === 'java') return maskJava(code);
  let out = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === '#') {
      while (i < n && code[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '"' || c === "'") {
      const q = code.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
      out += ' '.repeat(q.length);
      i += q.length;
      while (i < n && !code.startsWith(q, i)) {
        if (code[i] === '\\') { out += '  '; i += 2; continue; }
        if (q.length === 1 && code[i] === '\n') break; // string tidak tertutup: berhenti di akhir baris
        out += code[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (code.startsWith(q, i)) { out += ' '.repeat(q.length); i += q.length; }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const COMPARE = { '>=': '>', '>': '>=', '<=': '<', '<': '<=', '==': '!=', '!=': '==' };

export const MUTATION_RULES = [
  { id: 'compare', note: 'operator pembanding dibalik batasnya (>= jadi >, < jadi <=, == jadi !=)' },
  { id: 'boundary', note: 'angka batas pada perbandingan bergeser 1 (mis. >= 20 jadi >= 21)' },
  { id: 'plus-minus', note: 'tanda + dan - tertukar (Python juga += dan -=)' },
  { id: 'and-or', note: 'and dan or tertukar (Java: && dan ||)' },
  { id: 'floor-div', note: '// (pembagian bulat) menjadi / (khusus Python)' },
  { id: 'loop-flow', note: 'break dan continue tertukar (khusus Python)' },
  { id: 'range-start', note: 'awal range bergeser (Python) atau awal perulangan for (Java) antara 0 dan 1' },
  { id: 'init', note: 'nilai awal 0 menjadi 1' },
  { id: 'case', note: '.upper() menjadi .lower() (Java: toUpperCase menjadi toLowerCase)' },
  { id: 'times-div', note: '* menjadi + dan / menjadi * (khusus Java)' },
  { id: 'equals', note: '.equals() menjadi .equalsIgnoreCase() (khusus Java)' },
  { id: 'max-min', note: 'Math.max dan Math.min tertukar (khusus Java)' },
];

// Semua kemungkinan mutasi: [{ start, end, text, rule, note, line, before, after }].
// Java sengaja tanpa += / -= dan break/continue: salah satunya mudah membuat perulangan tanpa henti, dan penjalan Java
// yang kena batas waktu harus dimulai ulang (pemanasan puluhan detik).
export function findMutations(code, language = 'python') {
  const java = language === 'java';
  const masked = maskCode(code, language);
  const found = [];
  const add = (rule, start, end, text, note) => found.push({ rule, start, end, text, note });

  for (const m of masked.matchAll(/>=|<=|==|!=|>|</g)) add('compare', m.index, m.index + m[0].length, COMPARE[m[0]], `${m[0]} diganti ${COMPARE[m[0]]}`);
  for (const m of masked.matchAll(/(>=|<=|==|!=|>|<)(\s*)(\d+)/g)) {
    const start = m.index + m[1].length + m[2].length;
    add('boundary', start, m.index + m[0].length, String(Number(m[3]) + 1), `batas ${m[3]} menjadi ${Number(m[3]) + 1}`);
  }
  for (const m of masked.matchAll(java ? / \+ | - /g : /\+=|-=| \+ | - /g)) {
    const to = { '+=': '-=', '-=': '+=', ' + ': ' - ', ' - ': ' + ' }[m[0]];
    add('plus-minus', m.index, m.index + m[0].length, to, `${m[0].trim()} diganti ${to.trim()}`);
  }
  if (java) {
    for (const m of masked.matchAll(/ \* | \/ /g)) add('times-div', m.index, m.index + 3, m[0] === ' * ' ? ' + ' : ' * ', `${m[0].trim()} diganti ${m[0] === ' * ' ? '+' : '*'}`);
    for (const m of masked.matchAll(/&&|\|\|/g)) add('and-or', m.index, m.index + 2, m[0] === '&&' ? '||' : '&&', `${m[0]} diganti ${m[0] === '&&' ? '||' : '&&'}`);
    for (const m of masked.matchAll(/for \(int \w+ = (0|1);/g)) add('range-start', m.index + m[0].length - 2, m.index + m[0].length - 1, m[1] === '0' ? '1' : '0', `awal perulangan ${m[1]} menjadi ${m[1] === '0' ? '1' : '0'}`);
    for (const m of masked.matchAll(/^(\s*(?:int|long|double) \w+ = )0;$/gm)) add('init', m.index + m[1].length, m.index + m[0].length - 1, '1', 'nilai awal 0 menjadi 1');
    for (const m of masked.matchAll(/\.toUpperCase\(\)/g)) add('case', m.index, m.index + m[0].length, '.toLowerCase()', '.toUpperCase() diganti .toLowerCase()');
    for (const m of masked.matchAll(/\.equals\(/g)) add('equals', m.index, m.index + m[0].length, '.equalsIgnoreCase(', '.equals() diganti .equalsIgnoreCase()');
    for (const m of masked.matchAll(/\bMath\.(max|min)\(/g)) add('max-min', m.index + 5, m.index + 5 + m[1].length, m[1] === 'max' ? 'min' : 'max', `Math.${m[1]} diganti Math.${m[1] === 'max' ? 'min' : 'max'}`);
  } else {
    for (const m of masked.matchAll(/\b(and|or)\b/g)) add('and-or', m.index, m.index + m[0].length, m[0] === 'and' ? 'or' : 'and', `${m[0]} diganti ${m[0] === 'and' ? 'or' : 'and'}`);
    for (const m of masked.matchAll(/\/\//g)) add('floor-div', m.index, m.index + 2, '/', '// diganti /');
    for (const m of masked.matchAll(/\b(break|continue)\b/g)) add('loop-flow', m.index, m.index + m[0].length, m[0] === 'break' ? 'continue' : 'break', `${m[0]} diganti ${m[0] === 'break' ? 'continue' : 'break'}`);
    for (const m of masked.matchAll(/range\((0|1),/g)) add('range-start', m.index + 6, m.index + 7, m[1] === '0' ? '1' : '0', `awal range ${m[1]} menjadi ${m[1] === '0' ? '1' : '0'}`);
    for (const m of masked.matchAll(/^(\s*\w+ = )0$/gm)) add('init', m.index + m[1].length, m.index + m[0].length, '1', 'nilai awal 0 menjadi 1');
    for (const m of masked.matchAll(/\.upper\(\)/g)) add('case', m.index, m.index + m[0].length, '.lower()', '.upper() diganti .lower()');
  }

  return found.map((f) => {
    const line = code.slice(0, f.start).split('\n').length;
    const lineText = code.split('\n')[line - 1];
    return { ...f, line, before: lineText.trim(), after: applyMutation(code, f).split('\n')[line - 1].trim() };
  });
}

export function applyMutation(code, mu) {
  return code.slice(0, mu.start) + mu.text + code.slice(mu.end);
}

// Urutan percobaan: acak berbenih, aturan yang berbeda didahulukan agar bug yang disajikan beragam.
export function mutationOrder(code, seed, language = 'python') {
  const rng = makeRng(seed);
  const all = shuffle(findMutations(code, language), rng);
  const seen = new Set();
  const first = [];
  const rest = [];
  for (const m of all) {
    (seen.has(m.rule) ? rest : first).push(m);
    seen.add(m.rule);
  }
  return [...first, ...rest];
}

// Mencari mutasi yang menghasilkan bug SEJATI: lulus sebagian tes tetapi gagal di sebagian lain, tanpa timeout.
// Kode asli harus lulus semua tes (diperiksa pemanggil). run(code, input) -> {stdout, error, timeout}.
export async function findDebugCandidates({ code, tests, run, runTestsFn, seed, want = 2, maxTrials = 10, language = 'python' }) {
  const accepted = [];
  for (const mu of mutationOrder(code, seed, language).slice(0, maxTrials)) {
    const mutated = applyMutation(code, mu);
    if (mutated === code) continue;
    const results = await runTestsFn(mutated, tests, run);
    const failed = results.filter((r) => r.status !== 'pass').length;
    if (!failed || failed === tests.length || results.some((r) => r.status === 'timeout')) continue;
    accepted.push({ code: mutated, line: mu.line, rule: mu.rule, note: mu.note, before: mu.before, after: mu.after, failing: failed, wrongOutput: results.some((r) => r.status === 'fail') });
    if (accepted.filter((a) => a.wrongOutput).length >= want) break;
  }
  return accepted.sort((a, b) => Number(b.wrongOutput) - Number(a.wrongOutput)).slice(0, want);
}
