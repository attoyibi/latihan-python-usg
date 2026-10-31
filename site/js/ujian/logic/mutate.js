import { makeRng, shuffle } from './rng.js';

// Pembuat bug untuk butir "Perbaiki bug": mengubah SATU hal kecil di kode peserta sendiri (operator, batas, nilai awal).
// Hanya menyentuh kode asli, bukan isi string atau komentar.

// Mengganti isi string dan komentar dengan spasi (panjang sama), supaya pencarian hanya mengenai kode.
export function maskCode(code) {
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

const word = (re, to, note) => ({ re, to, note });
const COMPARE = { '>=': '>', '>': '>=', '<=': '<', '<': '<=', '==': '!=', '!=': '==' };

export const MUTATION_RULES = [
  { id: 'compare', note: 'operator pembanding dibalik batasnya (>= jadi >, < jadi <=, == jadi !=)' },
  { id: 'boundary', note: 'angka batas pada perbandingan bergeser 1 (mis. >= 20 jadi >= 21)' },
  { id: 'plus-minus', note: 'tanda + dan - tertukar (juga += dan -=)' },
  { id: 'and-or', note: 'and dan or tertukar' },
  { id: 'floor-div', note: '// (pembagian bulat) menjadi /' },
  { id: 'loop-flow', note: 'break dan continue tertukar' },
  { id: 'range-start', note: 'awal range bergeser (range(1, n) jadi range(0, n) dan sebaliknya)' },
  { id: 'init', note: 'nilai awal 0 menjadi 1' },
  { id: 'case', note: '.upper() menjadi .lower()' },
];

// Semua kemungkinan mutasi: [{ start, end, text, rule, note, line, before, after }].
export function findMutations(code) {
  const masked = maskCode(code);
  const found = [];
  const add = (rule, start, end, text, note) => found.push({ rule, start, end, text, note });

  for (const m of masked.matchAll(/>=|<=|==|!=|>|</g)) add('compare', m.index, m.index + m[0].length, COMPARE[m[0]], `${m[0]} diganti ${COMPARE[m[0]]}`);
  for (const m of masked.matchAll(/(>=|<=|==|!=|>|<)(\s*)(\d+)/g)) {
    const start = m.index + m[1].length + m[2].length;
    add('boundary', start, m.index + m[0].length, String(Number(m[3]) + 1), `batas ${m[3]} menjadi ${Number(m[3]) + 1}`);
  }
  for (const m of masked.matchAll(/\+=|-=| \+ | - /g)) {
    const to = { '+=': '-=', '-=': '+=', ' + ': ' - ', ' - ': ' + ' }[m[0]];
    add('plus-minus', m.index, m.index + m[0].length, to, `${m[0].trim()} diganti ${to.trim()}`);
  }
  for (const m of masked.matchAll(/\b(and|or)\b/g)) add('and-or', m.index, m.index + m[0].length, m[0] === 'and' ? 'or' : 'and', `${m[0]} diganti ${m[0] === 'and' ? 'or' : 'and'}`);
  for (const m of masked.matchAll(/\/\//g)) add('floor-div', m.index, m.index + 2, '/', '// diganti /');
  for (const m of masked.matchAll(/\b(break|continue)\b/g)) add('loop-flow', m.index, m.index + m[0].length, m[0] === 'break' ? 'continue' : 'break', `${m[0]} diganti ${m[0] === 'break' ? 'continue' : 'break'}`);
  for (const m of masked.matchAll(/range\((0|1),/g)) add('range-start', m.index + 6, m.index + 7, m[1] === '0' ? '1' : '0', `awal range ${m[1]} menjadi ${m[1] === '0' ? '1' : '0'}`);
  for (const m of masked.matchAll(/^(\s*\w+ = )0$/gm)) add('init', m.index + m[1].length, m.index + m[0].length, '1', 'nilai awal 0 menjadi 1');
  for (const m of masked.matchAll(/\.upper\(\)/g)) add('case', m.index, m.index + m[0].length, '.lower()', '.upper() diganti .lower()');

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
export function mutationOrder(code, seed) {
  const rng = makeRng(seed);
  const all = shuffle(findMutations(code), rng);
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
export async function findDebugCandidates({ code, tests, run, runTestsFn, seed, want = 2, maxTrials = 10 }) {
  const accepted = [];
  for (const mu of mutationOrder(code, seed).slice(0, maxTrials)) {
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
