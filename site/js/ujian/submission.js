import { runTests, passCount, s1Of } from './logic/tests.js';
import { traceKey } from './logic/trace.js';
import { findDebugCandidates } from './logic/mutate.js';
import { normalize } from './logic/normalize.js';

const CHANGE_ROWS = 4;

// Mengevaluasi kode peserta saat Tahap 1 dikunci:
//  1. menjalankan tes contoh + tersembunyi -> S1 bagian praktik (otomatis);
//  2. menjalankan kode peserta dan varian bug pada masukan butir "Tebak keluaran" -> kunci dan pilihan salah;
//  3. bila kode lulus semua tes, mencari bug sejati hasil mutasi kecil kode itu -> kandidat butir "Temukan baris yang salah";
//  4. menjalankan kode peserta pada tes ketentuan baru -> kandidat butir "Ketentuan berubah" (keluaran lama vs kunci baru).
// onProgress(teks) dipanggil untuk indikator kemajuan.
export async function evaluateSubmission({ tasks, codes, run, language = 'python', terbuka = false, onProgress = () => {} }) {
  const taskResults = {};
  const traceCandidates = {};
  const debugCandidates = {};
  const changeCandidates = {};
  const ratios = {};
  for (const [i, t] of tasks.entries()) {
    const code = codes[t.id] || '';
    onProgress(`Memeriksa ${t.title} (${i + 1} dari ${tasks.length})…`);
    const tests = [...t.visible, ...t.hidden];
    if (!code.trim()) {
      taskResults[t.id] = { passed: 0, total: tests.length, visiblePassed: 0, visibleTotal: t.visible.length, empty: true };
      ratios[t.id] = 0;
      continue;
    }
    const results = await runTests(code, tests, run);
    const passed = passCount(results);
    taskResults[t.id] = {
      passed, total: results.length,
      visiblePassed: passCount(results.slice(0, t.visible.length)), visibleTotal: t.visible.length,
      statuses: results.map((r) => r.status),
    };
    ratios[t.id] = passed / results.length;

    // Tahap 2 terbuka tidak butuh kandidat pilihan ganda (menghemat banyak penjalanan, terutama di Java).
    if (terbuka) continue;
    const rows = [];
    for (const input of t.traceInputs) {
      const res = await run(code, input);
      if (res.error || res.timeout) continue; // kode peserta galat pada masukan ini: tidak dipakai sebagai butir
      const variants = [];
      for (const v of t.variants) variants.push({ id: v.id, out: traceKey(await run(v.code, input)) });
      rows.push({ input, key: traceKey(res), variants });
    }
    if (rows.length) traceCandidates[t.id] = rows;

    // Butir "ketentuan berubah": masukan uji ketentuan baru yang keluaran kode peserta (aturan lama) berbeda dari kuncinya.
    for (const ch of t.changes || []) {
      const diff = [];
      for (const test of [...ch.visible, ...ch.hidden]) {
        if (diff.length >= CHANGE_ROWS) break;
        const res = await run(code, test.input);
        if (res.timeout) continue; // galat boleh: "[Galat: ...]" justru pengecoh yang wajar bagi kode yang belum mengenal aturan baru
        const own = traceKey(res);
        const expected = normalize(test.expected);
        if (own !== expected) diff.push({ input: test.input, own, expected });
      }
      if (diff.length) ((changeCandidates[t.id] ||= {})[ch.id] = diff);
    }

    if (passed === results.length) {
      onProgress(`Menyiapkan butir Tahap 2 dari ${t.title}…`);
      const found = await findDebugCandidates({ code, tests, run, runTestsFn: runTests, seed: `mut|${t.id}|${code.length}`, want: 2, language });
      if (found.length) debugCandidates[t.id] = found;
    }
  }
  return { taskResults, traceCandidates, debugCandidates, changeCandidates, s1Practice: s1Of(ratios) };
}
