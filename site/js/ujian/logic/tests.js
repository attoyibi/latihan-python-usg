import { normalize } from './normalize.js';

// Menguji kode terhadap daftar tes {input, expected}. run(code, input) -> {stdout, error, timeout}.
// Berhenti di tes pertama yang timeout (sisanya ditandai "skipped") supaya tidak menunggu berulang kali.
export async function runTests(code, tests, run, onTest = () => {}) {
  const results = [];
  let stop = false;
  for (const test of tests) {
    if (stop) { results.push({ test, status: 'skipped', actual: '', error: null }); continue; }
    const r = await run(code, test.input);
    let status;
    if (r.timeout) { status = 'timeout'; stop = true; }
    else if (r.error) status = 'error';
    else status = normalize(r.stdout) === normalize(test.expected) ? 'pass' : 'fail';
    const row = { test, status, actual: r.stdout, error: r.error };
    results.push(row);
    onTest(row);
  }
  return results;
}

export const passCount = (results) => results.filter((r) => r.status === 'pass').length;

// S1 = rata-rata proporsi tes lulus (contoh + tersembunyi) di semua tugas. Tugas kosong bernilai 0.
export function s1Of(taskRatios) {
  const xs = Object.values(taskRatios);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
