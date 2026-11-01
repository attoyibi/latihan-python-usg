import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRng, shuffle } from '../../site/js/ujian/logic/rng.js';
import { cbmPoints, cbmCalibration } from '../../site/js/ujian/logic/cbm.js';
import { computeS2 } from '../../site/js/ujian/logic/scoring.js';
import { isFlag, quadrant } from '../../site/js/ujian/logic/flag.js';
import { computeGrade, retestAdvice, studentGrade } from '../../site/js/ujian/logic/grade.js';
import { accommodationFactor, stage1Deadline, itemLimitMs, catchUp, stage2TotalSec } from '../../site/js/ujian/logic/session.js';
import { auditSample } from '../../site/js/ujian/logic/audit.js';
import { toCsv } from '../../site/js/ujian/logic/csv.js';
import { buildItems, renderTemplate, codeLines, ITEM_TYPES } from '../../site/js/ujian/logic/items.js';
import { summarize } from '../../site/js/ujian/logic/summary.js';
import { normalize } from '../../site/js/ujian/logic/normalize.js';
import { errorName, traceKey, perturb, buildAlts, markDiff } from '../../site/js/ujian/logic/trace.js';
import { runTests, passCount, s1Of } from '../../site/js/ujian/logic/tests.js';
import { maskCode, findMutations, applyMutation, findDebugCandidates, MUTATION_RULES } from '../../site/js/ujian/logic/mutate.js';
import { scoreTheory, hasKeyword } from '../../site/js/ujian/logic/theory.js';
import { computeS1, theoryResults } from '../../site/js/ujian/logic/s1.js';
import { sha256Fallback } from '../../site/js/ujian/ui.js';
import { clampFont, parsePrefs, FONT_MIN, FONT_MAX } from '../../site/js/ujian/codetools.js';
import { numbered } from '../../site/js/ujian/ui.js';

const data = (f) => JSON.parse(readFileSync(new URL(f === 'cohort.json' ? './cohort.json' : `./data/${f}`, import.meta.url), 'utf8'));
const examJson = data('exam.json');
const allTasks = data('tasks.json').tasks;
const exam = { ...examJson, allTasks, tasks: allTasks.filter((t) => examJson.config.activeTasks.includes(t.id)), theory: data('theory.json').questions };
const templates = data('templates.json');
const cohort = data('cohort.json');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('rng: seed sama => urutan sama, seed beda => beda', () => {
  const a = makeRng('x'), b = makeRng('x'), c = makeRng('y');
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.notDeepEqual(xs, [c(), c(), c()]);
  assert.ok(xs.every((v) => v >= 0 && v < 1));
});

test('shuffle: permutasi, tidak mengubah input', () => {
  const src = [1, 2, 3, 4, 5, 6];
  const out = shuffle(src, makeRng('s'));
  assert.deepEqual([...out].sort(), src);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6]);
});

test('cbm: poin sesuai skema dan rating tidak valid ditolak', () => {
  const s = exam.config.cbm;
  assert.equal(cbmPoints(true, 3, s), 3);
  assert.equal(cbmPoints(false, 3, s), -6);
  assert.equal(cbmPoints(false, 1, s), 0);
  assert.throws(() => cbmPoints(true, 4, s));
});

test('cbm: kalibrasi 1 untuk benar+yakin, 0 untuk salah+yakin', () => {
  const s = exam.config.cbm;
  near(cbmCalibration([{ correct: true, confidence: 3 }], s), 1);
  near(cbmCalibration([{ correct: false, confidence: 3 }], s), 0);
  assert.equal(cbmCalibration([], s), null);
});

test('S2: semua skor sama => S2 sama, bobot dinormalisasi bila jenis hilang', () => {
  const w = exam.config.weights;
  near(computeS2([{ type: 'trace', score: 0.5 }, { type: 'bugline', score: 0.5 }, { type: 'transfer', score: 0.5 }], w).s2, 0.5);
  near(computeS2([{ type: 'trace', score: 1 }, { type: 'bugline', score: 0 }], w).s2, w.trace / (w.trace + w.bugline));
});

test('S2: bobot sama => galat baku = s/sqrt(n)', () => {
  const xs = [0.2, 0.4, 0.6, 0.8];
  const r = computeS2(xs.map((score) => ({ type: 'a', score })), { a: 1 }, 1);
  const s = Math.sqrt(xs.reduce((a, x) => a + (x - 0.5) ** 2, 0) / 3);
  near(r.se, s / Math.sqrt(4));
});

test('S2: bobot jenis tertimbang ke butir, bukan ke jumlah butir (empat jenis)', () => {
  const w = exam.config.weights;
  const items = [
    ...Array(2).fill({ type: 'trace', score: 1 }), { type: 'bugline', score: 1 }, ...Array(2).fill({ type: 'concept', score: 1 }),
    ...Array(3).fill({ type: 'transfer', score: 0 }),
  ];
  near(computeS2(items, w).s2, w.trace + w.bugline + w.concept);
});

test('flag: butuh gap > ambang DAN batas atas S2 di bawah ambang lulus', () => {
  const cfg = { gap: 0.3, pass: 0.6, highS1: 0.7 };
  assert.equal(isFlag(0.9, 0.3, 0.4, cfg), true);
  assert.equal(isFlag(0.9, 0.3, 0.65, cfg), false);
  assert.equal(isFlag(0.8, 0.55, 0.5, cfg), false);
  assert.equal(isFlag(0.9, 0.6, 0.5, cfg), false); // gap tepat 0,3 tidak cukup
});

test('quadrant: empat kuadran', () => {
  const cfg = { gap: 0.3, pass: 0.6, highS1: 0.7 };
  assert.equal(quadrant(0.9, 0.9, cfg), 'both-high');
  assert.equal(quadrant(0.9, 0.2, cfg), 's1-high-s2-low');
  assert.equal(quadrant(0.4, 0.9, cfg), 's1-low-s2-high');
  assert.equal(quadrant(0.4, 0.2, cfg), 'both-low');
});

const R = (s1, s2, upper, flag = false) => ({ s1, s2, lower: Math.max(0, s2 - (upper - s2)), upper, flag });
const G = exam.config.grade;

test('grade: selisih kecil (dalam toleransi) => tanpa pengurangan, nilai = S1 skala 100', () => {
  const x = computeGrade(R(0.8, 0.75, 0.85), exam.config);
  assert.equal(x.evidence, 'sejalan');
  assert.equal(x.cut, 0);
  assert.equal(x.value, 80);
  assert.ok(x.reasons.some((t) => t.includes('tidak ada pengurangan')));
});

test('grade: S2 lebih tinggi dari S1 tidak menambah nilai', () => {
  const x = computeGrade(R(0.5, 0.8, 0.9), exam.config);
  assert.equal(x.value, 50);
  assert.equal(x.evidence, 's2-lebih-tinggi');
  assert.ok(x.reasons.some((t) => t.includes('lebih tinggi')));
});

test('grade: rumus plafon dengan toleransi, nilai tidak pernah di atas S1 dan menurun saat S2 turun', () => {
  const s1 = 0.9;
  let prev = 101;
  for (const s2 of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]) {
    const x = computeGrade(R(s1, s2, s2), exam.config);
    assert.ok(x.value <= 90 && x.value <= prev, `S2 ${s2} -> ${x.value}`);
    prev = x.value;
  }
  const x = computeGrade(R(0.9, 0.5, 0.6), exam.config);
  const s2e = Math.min(0.9, 0.5 + G.tolerance);
  const plafon = G.w * s2e + (1 - G.w) * Math.min(0.9, s2e + G.delta);
  assert.equal(x.value, Math.round(Math.max(Math.min(0.9, plafon), 0.9 - G.maxCut) * 100));
  assert.equal(x.evidence, 'dikurangi');
  assert.equal(x.base - x.value, x.cut);
});

test('grade: pengurangan tidak melebihi maksimum dan tiap hasil punya alasan', () => {
  const x = computeGrade(R(1, 0, 0.1, true), exam.config);
  assert.equal(x.cut, Math.round(G.maxCut * 100));
  assert.equal(x.capped, true);
  assert.ok(x.reasons.length >= 3);
});

test('studentGrade: nilai timpaan dosen didahulukan, selain itu nilai otomatis', () => {
  const x = computeGrade(R(0.9, 0.3, 0.4, true), exam.config);
  assert.equal(studentGrade(x).value, x.value);
  assert.ok(studentGrade(x).note.startsWith('Otomatis'));
  assert.equal(studentGrade(x, 78).value, 78);
  assert.equal(studentGrade(x, 78).note, 'Ditetapkan dosen');
});

test('retestAdvice: ditawarkan bila jatah ada; dianjurkan hanya bila ter-flag', () => {
  assert.deepEqual(retestAdvice({ flag: true }, exam.config, 1), { available: true, recommended: true });
  assert.deepEqual(retestAdvice({ flag: false }, exam.config, 1), { available: true, recommended: false });
  assert.deepEqual(retestAdvice({ flag: true }, exam.config, exam.config.stage2.maxAttempts), { available: false, recommended: false });
});

// ---- jadwal ujian satu kali jalan ----
test('session: tenggat Tahap 1, akomodasi per peserta (bukan centang), dan percepatan demo', () => {
  const cfg = { ...exam.config, accommodations: ['u1'] };
  assert.equal(accommodationFactor(cfg, 'u1'), cfg.accommodationFactor);
  assert.equal(accommodationFactor(cfg, 'u2'), 1);
  assert.equal(stage1Deadline(1000, cfg), 1000 + cfg.tahap1Minutes * 60000);
  assert.equal(stage1Deadline(1000, cfg, 1.5), 1000 + cfg.tahap1Minutes * 60000 * 1.5);
  assert.equal(stage1Deadline(1000, cfg, 1, 10), 1000 + (cfg.tahap1Minutes * 60000) / 10);
  assert.equal(itemLimitMs({ type: 'trace' }, cfg), cfg.stage2.limitSec.trace * 1000);
});

test('catchUp: tetap di butir bila waktunya belum habis, melewati butir yang habis, selesai di akhir', () => {
  const cfg = exam.config;
  const items = [{ id: 'a', type: 'trace' }, { id: 'b', type: 'concept' }, { id: 'c', type: 'trace' }];
  const lim = (t) => cfg.stage2.limitSec[t] * 1000;
  const att = { idx: 0, shownAt: 10000, skipped: [] };
  const same = catchUp(att, items, 10000 + lim('trace') - 1, cfg);
  assert.deepEqual([same.idx, same.finished, same.skipped], [0, false, []]);
  const moved = catchUp(att, items, 10000 + lim('trace') + 5, cfg);
  assert.deepEqual([moved.idx, moved.skipped], [1, ['a']]);
  assert.equal(moved.shownAt, 10000 + lim('trace'));
  const done = catchUp(att, items, 10000 + stage2TotalSec(items, cfg) * 1000 + 1, cfg);
  assert.equal(done.finished, true);
  assert.equal(done.finishedAt, 10000 + stage2TotalSec(items, cfg) * 1000);
  assert.deepEqual(done.skipped, ['a', 'b', 'c']);
  assert.deepEqual(att, { idx: 0, shownAt: 10000, skipped: [] }, 'input tidak berubah');
  const fast = catchUp(att, items, 10000 + lim('trace') / 10 + 1, cfg, 1, 10);
  assert.equal(fast.idx, 1);
});

test('audit: sampel acak berbenih, ukuran sesuai persen, tanpa duplikat', () => {
  const ids = Array.from({ length: 80 }, (_, i) => `S${i}`);
  const a = auditSample(ids, 10, 'x');
  assert.equal(a.length, 8);
  assert.equal(new Set(a).size, 8);
  assert.deepEqual(a, auditSample([...ids].reverse(), 10, 'x'));
  assert.notDeepEqual(a, auditSample(ids, 10, 'y'));
  assert.deepEqual(auditSample(ids, 0, 'x'), []);
  assert.equal(auditSample(['a', 'b'], 10, 'x').length, 1);
});

test('csv: escape koma, tanda kutip, baris baru', () => {
  const out = toCsv([{ a: 'x,y', b: 'say "hi"', c: null }], [
    { label: 'A', get: (r) => r.a }, { label: 'B', get: (r) => r.b }, { label: 'C', get: (r) => r.c },
  ]);
  assert.equal(out, 'A,B,C\n"x,y","say ""hi""",');
});

test('renderTemplate: variabel hilang melempar error', () => {
  assert.equal(renderTemplate('a {x} b', { x: 1 }), 'a 1 b');
  assert.throws(() => renderTemplate('a {y}', {}));
});

test('sha256 cadangan sama dengan SHA-256 standar', async () => {
  const { createHash } = await import('node:crypto');
  for (const t of ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'kode: print("é")\n'.repeat(20)]) {
    assert.equal(sha256Fallback(t), createHash('sha256').update(t).digest('hex'));
  }
});

test('codetools: ukuran huruf dibatasi dan preferensi rusak jatuh ke bawaan', () => {
  assert.equal(clampFont(5), FONT_MIN);
  assert.equal(clampFont(99), FONT_MAX);
  assert.equal(clampFont('18.4'), 18);
  assert.equal(clampFont('abc', 15), 15);
  assert.deepEqual(parsePrefs('{"fs":20,"wrap":true}'), { fs: 20, wrap: true });
  assert.deepEqual(parsePrefs('bukan json', 16), { fs: 16, wrap: false });
});

// ---- penjalan: tes, kunci tebak-keluaran ----
test('normalize: buang spasi ujung baris dan baris kosong di akhir', () => {
  assert.equal(normalize('a  \r\nb\t\n\n'), 'a\nb');
});

test('traceKey: keluaran ternormalisasi + penanda galat', () => {
  assert.equal(traceKey({ stdout: '5 \n', error: null }), '5');
  assert.equal(traceKey({ stdout: 'x\n', error: 'Traceback...\nValueError: invalid literal' }), 'x\n[Galat: ValueError]');
  assert.equal(traceKey({ stdout: '', error: null, timeout: true }), '[Galat: TimeoutError]');
  assert.equal(errorName(''), 'Error');
});

test('perturb dan buildAlts: jawaban salah berbeda dari kunci, varian bug didahulukan', () => {
  const key = 'Subtotal: Rp 500000\nDiskon: Rp 25000\nTotal bayar: Rp 475000';
  const ps = perturb(key);
  assert.ok(ps.length >= 3 && ps.every((p) => p !== key) && new Set(ps).size === ps.length);
  const alts = buildAlts('Total: 10', [{ id: 'v1', out: 'Total: 10' }, { id: 'v2', out: 'Total: 12' }, { id: 'v3', out: 'Total: 12' }]);
  assert.equal(alts[0].source, 'v2');
  assert.ok(!alts.some((a) => a.text === 'Total: 10'));
  assert.equal(new Set(alts.map((a) => a.text)).size, alts.length);
});

test('runTests: status lulus/salah/galat/timeout dan dilewati setelah timeout', async () => {
  const tests = [{ input: ['1'], expected: 'a' }, { input: ['2'], expected: 'a' }, { input: ['3'], expected: 'a' }, { input: ['4'], expected: 'a' }, { input: ['5'], expected: 'a' }];
  const fake = async (_c, input) => ({
    '1': { stdout: 'a \n' }, '2': { stdout: 'b' }, '3': { stdout: '', error: 'ValueError: x' }, '4': { stdout: '', timeout: true },
  }[input[0]] || { stdout: 'a' });
  const res = await runTests('', tests, fake);
  assert.deepEqual(res.map((r) => r.status), ['pass', 'fail', 'error', 'timeout', 'skipped']);
  assert.equal(passCount(res), 1);
  near(s1Of({ T1: 1, T2: 0.5, T3: 0 }), 0.5);
});

// ---- pembuat bug (mutasi) ----
const SAMPLE = 'jumlah = int(input())\nif jumlah >= 20:\n    persen = 5  # ambang >= 20\nelse:\n    print("sisa >= 5")\ntotal = 0\n';

test('mutate: isi string dan komentar tidak pernah dimutasi', () => {
  const masked = maskCode(SAMPLE);
  assert.equal(masked.length, SAMPLE.length);
  assert.ok(!masked.includes('ambang') && !masked.includes('sisa'));
  const muts = findMutations(SAMPLE);
  assert.ok(muts.length > 0);
  for (const m of muts) assert.ok(!SAMPLE.slice(m.start, m.end).includes('ambang'), m.note);
  // satu-satunya ">=" di kode asli ada di baris 2 (yang di komentar dan string diabaikan)
  assert.deepEqual([...new Set(muts.filter((m) => m.rule === 'compare' && SAMPLE.slice(m.start, m.end) === '>=').map((m) => m.line))], [2]);
});

test('mutate: tiap mutasi mengubah tepat satu tempat dan hasilnya berbeda', () => {
  for (const m of findMutations(SAMPLE)) {
    const out = applyMutation(SAMPLE, m);
    assert.notEqual(out, SAMPLE);
    assert.equal(out.split('\n').length, SAMPLE.split('\n').length);
    const diffLines = out.split('\n').filter((l, i) => l !== SAMPLE.split('\n')[i]);
    assert.equal(diffLines.length, 1, m.note);
  }
  assert.ok(MUTATION_RULES.length >= 8);
});

test('mutate: findDebugCandidates hanya menerima bug sejati (lulus sebagian, gagal sebagian)', async () => {
  const tests = [{ input: [], expected: 'a' }, { input: [], expected: 'b' }, { input: [], expected: 'c' }];
  // Kode asli lulus semua. Mutasi pada baris 2 gagal di tes ke-2 saja (bug sejati); mutasi di tempat lain
  // dianggap merusak semua tes (ditolak); mutasi yang tidak mengubah hasil (lulus semua) juga ditolak.
  const runTestsFn = async (code) => {
    const line2 = code.split('\n')[1];
    const status = (i) => (line2 !== 'if jumlah >= 20:' ? (i === 1 ? 'fail' : 'pass') : code === SAMPLE ? 'pass' : 'fail');
    const broken = code.split('\n')[1] === 'if jumlah >= 20:' && code !== SAMPLE;
    return tests.map((t, i) => ({ test: t, status: broken ? 'fail' : status(i) }));
  };
  const found = await findDebugCandidates({ code: SAMPLE, tests, run: async () => ({}), runTestsFn, seed: 's', want: 5, maxTrials: 50 });
  assert.ok(found.length > 0);
  for (const f of found) {
    assert.equal(f.failing, 1);
    assert.equal(f.line, 2);
    assert.notEqual(f.code, SAMPLE);
  }
});

// ---- butir ----
const student = (id) => cohort.students.find((s) => s.id === id);
const ctx = { exam, templates };
const withCode = cohort.students.filter((s) => s.code);

test('items: deterministik untuk seed yang sama', () => {
  assert.deepEqual(buildItems(student('M13'), ctx), buildItems(student('M13'), ctx));
});

test('items: jumlah dan urutan jenis sesuai konfigurasi', () => {
  const items = buildItems(student('M13'), ctx);
  const n = exam.config.stage2.itemsPerType;
  const want = ITEM_TYPES.flatMap((t) => Array(n[t]).fill(t));
  assert.deepEqual(items.map((i) => i.type), want);
  assert.deepEqual(buildItems(student('M15'), ctx).map((i) => i.type), want);
});

test('items: pilihan ganda punya tepat satu opsi benar dan opsi tidak kembar', () => {
  for (const s of withCode) {
    for (const it of buildItems(s, ctx).filter((i) => i.options)) {
      assert.equal(it.options.length, exam.config.stage2.optionsPerItem);
      assert.equal(it.options.filter((o) => o.correct).length, 1);
      assert.equal(new Set(it.options.map((o) => o.text)).size, it.options.length, `opsi kembar di ${it.id}`);
    }
  }
});

test('items: tebak keluaran memakai kunci hasil eksekusi kode peserta', () => {
  for (const s of withCode) {
    const traces = buildItems(s, ctx).filter((i) => i.type === 'trace');
    assert.equal(new Set(traces.map((t) => JSON.stringify(t.input))).size, traces.length, 'masukan tebak keluaran tidak boleh kembar');
    for (const it of traces) {
      const cand = s.traceCandidates[it.taskId].find((c) => JSON.stringify(c.input) === JSON.stringify(it.input));
      assert.ok(cand, `masukan ${it.id} bukan kandidat`);
      assert.equal(it.options.find((o) => o.correct).text, cand.key);
    }
  }
});

test('items: cari baris salah — kunci = baris yang diubah, dan baris itu memang berbeda dari kode asli', () => {
  for (const s of withCode) {
    for (const it of buildItems(s, ctx).filter((i) => i.type === 'bugline')) {
      const key = it.options.find((o) => o.correct);
      assert.equal(key.id, `L${it.mutation.line}`);
      const orig = s.code[it.taskId].split('\n');
      const mut = it.startCode.split('\n');
      assert.notEqual(orig[it.mutation.line - 1], mut[it.mutation.line - 1]);
      assert.deepEqual(mut.filter((l, i) => l !== orig[i]).length, 1);
      for (const o of it.options) assert.ok(o.text.startsWith(`${o.id.slice(1)} · `));
    }
  }
});

test('items: tanpa kandidat bug/keluaran, butir itu dilewati tanpa galat', () => {
  const bare = { id: 'X', code: student('M13').code };
  const items = buildItems(bare, ctx);
  assert.deepEqual(items.map((i) => i.type), ['concept', 'concept']);
});

test('items: ketentuan berubah — kunci = keluaran ketentuan baru, pengecoh utama = keluaran kode peserta sendiri', () => {
  for (const st of withCode) {
    const ts = buildItems(st, ctx).filter((i) => i.type === 'transfer');
    assert.equal(ts.length, exam.config.stage2.itemsPerType.transfer, st.id);
    assert.equal(new Set(ts.map((t) => `${t.taskId}:${t.changeId}:${JSON.stringify(t.input)}`)).size, ts.length);
    for (const it of ts) {
      const row = st.changeCandidates[it.taskId][it.changeId].find((r) => JSON.stringify(r.input) === JSON.stringify(it.input));
      assert.ok(row, `${it.id} bukan kandidat`);
      assert.equal(it.options.find((o) => o.correct).text, row.expected);
      assert.ok(it.options.some((o) => o.text === row.own && !o.correct) || row.own === row.expected, 'keluaran aturan lama harus jadi pengecoh');
      assert.ok(it.text.includes(exam.tasks.find((t) => t.id === it.taskId).changes.find((c) => c.id === it.changeId).text));
    }
  }
});

test('items: uji ulang (attempt 2) memakai id dan seed berbeda, butir tetap valid', () => {
  const a1 = buildItems(student('M15'), ctx);
  const a2 = buildItems(student('M15'), { ...ctx, attempt: 2 });
  assert.equal(a2.length, a1.length);
  assert.ok(a2.every((i) => i.id.startsWith('M15~2:') && i.attempt === 2));
  assert.equal(new Set([...a1, ...a2].map((i) => i.id)).size, a1.length + a2.length);
  assert.notDeepEqual(a2.map((i) => i.seed), a1.map((i) => i.seed));
  for (const it of a2) assert.equal(it.options.filter((o) => o.correct).length, 1);
});

test('items: konsep teori — satu butir per soal teori, kunci = pernyataan benar dari bank', () => {
  for (const st of withCode) {
    const cs = buildItems(st, ctx).filter((i) => i.type === 'concept');
    assert.deepEqual(cs.map((c) => c.questionId), exam.theory.map((q) => q.id));
    for (const c of cs) {
      const q = exam.theory.find((x) => x.id === c.questionId);
      const set = q.concepts.find((x) => x.id === c.conceptId);
      assert.equal(c.options.find((o) => o.correct).text, set.correct);
      for (const o of c.options.filter((x) => !x.correct)) assert.ok(set.wrong.includes(o.text));
    }
  }
});

test('items: reroll mengubah seed butir itu; jenis lain tidak berubah, jenis sama tetap tanpa kembar', () => {
  const base = buildItems(student('M13'), ctx);
  const id = base.find((i) => i.type === 'trace').id;
  const re = buildItems(student('M13'), { ...ctx, rerolls: { [id]: 1 } });
  assert.notEqual(re.find((i) => i.id === id).seed, base.find((i) => i.id === id).seed);
  assert.deepEqual(re.filter((i) => i.type !== 'trace'), base.filter((i) => i.type !== 'trace'));
  const traces = re.filter((i) => i.type === 'trace');
  assert.equal(new Set(traces.map((t) => JSON.stringify(t.input))).size, traces.length);
});

test('codeLines dan numbered: nomor baris mulai 1, komentar dan baris kosong tidak jadi pilihan', () => {
  assert.deepEqual(codeLines('# c\nx = 1\n\ny = 2').map((l) => l.n), [2, 4]);
  assert.equal(numbered('a\nb'), ' 1  a\n 2  b');
});

// ---- konsistensi data ----
test('data: soal praktik aktif, soal teori, dan bank konsep lengkap', () => {
  assert.deepEqual(exam.tasks.map((t) => t.id), examJson.config.activeTasks);
  assert.equal(exam.theory.length, 2);
  for (const t of allTasks) {
    assert.ok(t.visible.length >= 2 && t.hidden.length >= 4 && t.traceInputs.length >= 4 && t.variants.length >= 3 && t.changes.length >= 2, t.id);
    for (const x of [...t.visible, ...t.hidden]) assert.ok(x.expected.length > 0, `${t.id} expected kosong`);
  }
  for (const q of exam.theory) {
    assert.ok(q.keyPoints.length >= q.need && q.concepts.length >= 1 && q.sample.length > 100, q.id);
    for (const c of q.concepts) assert.ok(c.wrong.length >= exam.config.stage2.optionsPerItem - 1, c.id);
    // jawaban contoh harus mendapat nilai penuh
    assert.equal(scoreTheory(q.sample, q, { minWords: 25 }).score, 1, `${q.id} sample`);
  }
  assert.equal(exam.decisions, undefined, 'form keputusan (pilihan ganda) sudah dihapus dari Tahap 1');
  assert.deepEqual(exam.config.tahap1Order.slice().sort(), [...exam.theory.map((q) => q.id), ...exam.tasks.map((t) => t.id)].sort());
});

test('data: peserta dummy yang sudah selesai punya hasil sesuai rencana seed; semua butir pilihan ganda', () => {
  const n = exam.config.stage2.itemsPerType;
  for (const s of cohort.students.filter((x) => x.stage2)) {
    assert.equal(s.stage2.open, undefined, `${s.id}: tidak ada jawaban terbuka`);
    for (const t of ITEM_TYPES) assert.equal(s.stage2[t].length, n[t], `${s.id} ${t}`);
  }
  for (const s of cohort.students.filter((x) => x.code && x.stage2)) {
    const items = buildItems(s, ctx);
    for (const t of ['trace', 'bugline', 'transfer']) {
      assert.deepEqual(s.stage2[t].map((r) => r.taskId).sort(), items.filter((i) => i.type === t).map((i) => i.taskId).sort(), `${s.id} ${t}`);
    }
  }
});

// ---- ringkasan ----
test('summary: lengkap begitu semua butir otomatis terjawab, tanpa langkah dosen', () => {
  const m13 = student('M13');
  const r = summarize(m13, exam);
  assert.equal(r.status, 'complete');
  assert.equal(r.n, 9);
  assert.ok(r.s2 > 0.65 && r.s2 <= 1);
  assert.deepEqual(r, summarize(m13, exam, {}));
});

test('summary: pola dummy kohort sesuai skenario (flag M07, M09, M14; M08 dan M10 jarak besar tetapi tidak ter-flag)', () => {
  const r = Object.fromEntries(cohort.students.filter((s) => s.stage2).map((s) => [s.id, summarize(s, exam)]));
  for (const id of ['M07', 'M09', 'M14']) assert.equal(r[id].flag, true, id);
  for (const id of ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M08', 'M10', 'M11', 'M12', 'M13']) assert.equal(r[id].flag, false, id);
  assert.ok(r.M10.g > 0.3, 'M10 harus mencontohkan interval kepercayaan yang mencegah flag');
});

test('grade: kohort dummy — nilai tidak melebihi S1, flag mendapat pengurangan, yang sejalan tidak', () => {
  for (const s of cohort.students.filter((x) => x.stage2)) {
    const r = summarize(s, exam);
    const g = computeGrade(r, exam.config);
    assert.ok(g.value <= Math.round(r.s1 * 100), s.id);
    assert.ok(g.cut <= Math.round(exam.config.grade.maxCut * 100), s.id);
    if (r.flag) assert.ok(g.cut > 0, `${s.id} ter-flag tetapi tidak dikurangi`);
  }
  assert.equal(computeGrade(summarize(student('M03'), exam), exam.config).cut, 0);
});

// ---- soal teori dan S1 gabungan ----
test('theory: kata pendek cocok utuh, kata panjang cocok sebagai awalan kata', () => {
  assert.equal(hasKeyword('perulangan for dipakai', 'for'), true);
  assert.equal(hasKeyword('format informasi', 'for'), false);
  assert.equal(hasKeyword('masalahnya rumit', 'masalah'), true);
  assert.equal(hasKeyword('permasalahan', 'masalah'), false);
  assert.equal(hasKeyword('nilai[0] = 5', '0'), true);
});

test('theory: jawaban lengkap bernilai 1, jawaban umum rendah, jawaban pendek nol', () => {
  const [q1, q2] = exam.theory;
  const full = cohort.students.find((x) => x.id === 'M13').theory;
  assert.equal(scoreTheory(full.Q1, q1).score, 1);
  assert.equal(scoreTheory(full.Q2, q2).score, 1);
  const vague = cohort.students.find((x) => x.id === 'M14').theory;
  assert.ok(scoreTheory(vague.Q1, q1).score < 0.7);
  assert.ok(scoreTheory(vague.Q2, q2).score < 0.5);
  const short = scoreTheory('algoritma urutan langkah masalah masukan keluaran pasti berhenti', q1);
  assert.equal(short.tooShort, true);
  assert.equal(short.score, 0);
  assert.equal(scoreTheory('', q1).score, 0);
});

test('S1: gabungan praktik dan teori sesuai bobot; nilai timpaan dosen dipakai; peserta lama tetap s1', () => {
  const m13 = cohort.students.find((x) => x.id === 'M13');
  const w = exam.config.s1;
  near(computeS1(m13, exam), (w.practice * m13.s1Practice + w.theory * 1) / (w.practice + w.theory));
  const over = computeS1(m13, exam, { 'M13:Q1': 0, 'M13:Q2': 0 });
  near(over, (w.practice * m13.s1Practice) / (w.practice + w.theory));
  assert.ok(theoryResults(m13, exam, { 'M13:Q1': 0 })[0].overridden);
  assert.equal(computeS1({ id: 'M01', s1: 0.88 }, exam), 0.88);
});

test('markDiff: hanya baris yang berbeda antar pilihan yang ditandai', () => {
  const m = markDiff(['a\nb\nc', 'a\nX\nc', 'a\nb\nc\nd']);
  assert.deepEqual(m[0].map((l) => l.differs), [false, true, false]);
  assert.deepEqual(m[2].map((l) => l.differs), [false, true, false, true]);
  assert.deepEqual(markDiff(['x', 'x'])[0], [{ text: 'x', differs: false }]);
});

test('items: tebak keluaran mengutamakan masukan pendek', () => {
  for (const s of withCode) {
    for (const it of buildItems(s, ctx).filter((i) => i.type === 'trace')) {
      const all = s.traceCandidates[it.taskId].map((c) => c.input.join(' ').length).sort((a, b) => a - b);
      const used = it.input.join(' ').length;
      assert.ok(all.length < 3 || used <= all[Math.max(2, Math.ceil(all.length * 0.6)) - 1], `${it.id} memakai masukan panjang`);
    }
  }
});

// ---- Java (mata kuliah pbo-java): mutasi bug, nama galat, dan pilihan baris ----
test('java: maskCode membuang komentar //, /* */, string, dan karakter', () => {
  const code = 'int a = 1; // a >= 2\nString s = "x >= 3"; /* b == 4\n */ char c = \'>\';';
  const m = maskCode(code, 'java');
  assert.equal(m.length, code.length);
  assert.equal(m.split('\n').length, code.split('\n').length);
  assert.ok(!/[>=]/.test(m.replace(/=/g, '')) && !m.includes('x') && !m.includes('b =='));
});

test('java: findMutations memakai aturan Java dan tidak menyentuh isi string', () => {
  const code = 'if (a >= 10 && b < 5) {\n    total = harga * jumlah - 1;\n    System.out.println("a >= 3 || b");\n}\nint n = 0;\nfor (int i = 1; i <= n; i++) {}\n';
  const rules = new Set(findMutations(code, 'java').map((m) => m.rule));
  for (const r of ['compare', 'boundary', 'and-or', 'times-div', 'plus-minus', 'init', 'range-start']) assert.ok(rules.has(r), r);
  assert.ok(!rules.has('loop-flow') && !rules.has('floor-div'));
  assert.ok(findMutations(code, 'java').every((m) => m.line !== 3), 'tidak ada mutasi di dalam string');
  const orEx = findMutations(code, 'java').find((m) => m.rule === 'and-or');
  assert.ok(applyMutation(code, orEx).includes('a >= 10 || b < 5'));
  // Python tetap sama: tanpa argumen bahasa, && tidak dikenal dan "and" dikenal
  assert.ok(findMutations('if a and b:\n    pass').some((m) => m.rule === 'and-or'));
  assert.ok(!findMutations(code).some((m) => m.rule === 'times-div'));
});

test('java: errorName dan traceKey mengenali eksepsi dan galat kompilasi', () => {
  assert.equal(errorName('Exception in thread "main" java.lang.ArithmeticException: / by zero\n\tat Main.main(Main.java:5)'), 'ArithmeticException');
  assert.equal(errorName('Exception in thread "main" NilaiException: terlalu besar\n\tat Main.main(Main.java:5)'), 'NilaiException');
  assert.equal(errorName('Galat kompilasi:\nMain.java:3: cannot find symbol'), 'CompileError');
  assert.equal(errorName('Traceback (most recent call last):\n  File "<x>", line 1\nValueError: x'), 'ValueError');
  assert.equal(traceKey({ stdout: 'a\n', error: 'Exception in thread "main" java.lang.NumberFormatException: For input string: "x"\n\tat X', timeout: false }), 'a\n[Galat: NumberFormatException]');
});

test('java: codeLines melewati kurung kurawal, import, komentar, dan anotasi', () => {
  const code = 'import java.util.*;\n\n// komentar\nclass A {\n    @Override\n    int f() {\n        return 1;\n    }\n}\n';
  assert.deepEqual(codeLines(code, 'java').map((l) => l.n), [4, 6, 7]);
  assert.equal(codeLines('# c\nx = 1\n\ny = 2').length, 2); // Python tidak berubah
});

// ---- Tahap 2 terbuka: butir, salinan jawaban, CSV analisis ----
import { buildOpenItems, isOpen, salinan, barisAnalisis, uraikanHasil, blokPdf, KOLOM_ANALISIS } from '../../site/js/ujian/logic/open.js';
import { parseCsv } from '../../site/js/ujian/logic/csv.js';

const examOpen = {
  title: 'Ujian X', language: 'python',
  config: { stage2: { mode: 'open', seedSalt: 'S' }, tahap1Order: ['Q1', 'T1', 'T2'] },
  theory: [{ id: 'Q1', title: 'Teori 1', prompt: ['Jelaskan variabel.'], probe: 'Apa itu variabel?' }],
  tasks: [
    { id: 'T1', title: 'Praktik 1', statement: ['Hitung total.'], changes: [{ id: 'C1', text: 'Harga naik.' }] },
    { id: 'T2', title: 'Praktik 2', statement: ['Cetak.'], changes: [] },
  ],
};
const tplOpen = { version: 'v1', probe: { text: '{pertanyaan}' }, line: { text: 'Di {tugas}, apa fungsi baris {baris}?' }, change: { text: '{tugas} berubah: {perubahan}' } };
const siswa = { id: 'u1', code: { T1: 'total = harga * jumlah\nprint(total)\n', T2: '' } };

test('terbuka: butir mengikuti urutan Tahap 1, soal tanpa kode dilewati', () => {
  assert.ok(isOpen(examOpen) && !isOpen({ config: { stage2: {} } }));
  const items = buildOpenItems(siswa, { exam: examOpen, templates: tplOpen });
  assert.deepEqual(items.map((i) => i.type), ['probe', 'line', 'change']);
  assert.equal(items[0].text, 'Apa itu variabel?');
  assert.equal(items[0].questionId, 'Q1');
  assert.match(items[1].text, /Praktik 1.*baris \d/);
  assert.ok(['total = harga * jumlah', 'print(total)'].includes(items[1].lineText));
  assert.match(items[2].text, /Praktik 1 berubah: Harga naik\./);
  assert.equal(new Set(items.map((i) => i.id)).size, 3);
});

test('terbuka: butir deterministik per peserta dan berbeda antar percobaan', () => {
  const a = buildOpenItems(siswa, { exam: examOpen, templates: tplOpen });
  const b = buildOpenItems(siswa, { exam: examOpen, templates: tplOpen });
  const c = buildOpenItems(siswa, { exam: examOpen, templates: tplOpen, attempt: 2 });
  assert.deepEqual(a, b);
  assert.notEqual(a[0].id, c[0].id);
});

const keadaan = (jawab) => ({ demo: { stage1: { submitted: { code: { T1: siswa.code.T1, T2: '' }, theory: { Q1: 'Variabel adalah wadah nilai.' }, taskResults: { T1: { passed: 3, total: 4 }, T2: { passed: 0, total: 4 } }, hash: 'ab'.repeat(32), tempelDiblokir: 2, ai: { level: 'none' }, submittedAt: '2026-11-01T10:00:00Z' } }, stage2: { attempts: [{ n: 1, items: buildOpenItems(siswa, { exam: examOpen, templates: tplOpen }), answers: jawab }] } } });

test('terbuka: salinan memuat jawaban S2 beserta pembanding S1', () => {
  const items = buildOpenItems(siswa, { exam: examOpen, templates: tplOpen });
  const sal = salinan({ keadaan: keadaan({ [items[0].id]: { text: 'Tempat menyimpan nilai', latencySec: 12, tempel: 1 }, [items[1].id]: { text: '' } }), exam: examOpen, peserta: { id: 'u1', nama: 'Ani', nim: '1', kelas: 'A' }, ujian: 'Ujian X' });
  assert.equal(sal.s2.length, 3);
  assert.equal(sal.s2[0].jawaban, 'Tempat menyimpan nilai');
  assert.equal(sal.s2[0].jawabanS1, 'Variabel adalah wadah nilai.');
  assert.equal(sal.s2[0].tempel, 1);
  assert.equal(sal.s2[1].kosong, true);
  assert.equal(sal.s2[1].tesS1, '3/4');
  assert.match(sal.s2[1].kodeS1, /harga \* jumlah/);
  assert.equal(sal.kode, 'ab'.repeat(8));
  assert.equal(sal.tempelS1, 2);
  const txt = JSON.stringify(blokPdf(sal));
  assert.ok(txt.includes('Tempat menyimpan nilai') && txt.includes('(tidak dijawab)') && txt.includes('Ani'));
});

test('terbuka: CSV analisis satu baris per pertanyaan dan dapat dibaca kembali', () => {
  const items = buildOpenItems(siswa, { exam: examOpen, templates: tplOpen });
  const sal = salinan({ keadaan: keadaan({ [items[0].id]: { text: 'Teks, dengan "koma"\ndan baris baru' } }), exam: examOpen, peserta: { id: 'u1', nama: 'Ani', nim: '1', kelas: 'A' }, ujian: 'Ujian X' });
  const rows = barisAnalisis([sal]);
  assert.equal(rows.length, 3);
  const csv = toCsv(rows, KOLOM_ANALISIS);
  const t = parseCsv(csv);
  assert.equal(t.length, 4);
  assert.equal(t[0][0], 'id_baris');
  assert.equal(t[1][t[0].indexOf('jawaban_s2')], 'Teks, dengan "koma"\ndan baris baru');
  assert.equal(t[1][t[0].indexOf('peserta_id')], 'u1');
});

test('terbuka: unggah hasil analisis divalidasi', () => {
  const ok = uraikanHasil('id_baris,peserta_id,konsistensi,skor,catatan\nu1:probe:1,u1,konsisten,"85,5","bagus, jelas"\nu1:line:2,u1,tidak_konsisten,20,beda dari kode\n,,,,\n', parseCsv);
  assert.deepEqual(ok.galat, []);
  assert.equal(ok.rows.length, 2);
  assert.equal(ok.rows[0].skor, 85.5);
  assert.equal(ok.rows[0].catatan, 'bagus, jelas');
  const buruk = uraikanHasil('id_baris,peserta_id,konsistensi,skor\nx,u1,mungkin,50\ny,u1,konsisten,150\n', parseCsv);
  assert.equal(buruk.rows.length, 0);
  assert.equal(buruk.galat.length, 2);
  assert.ok(uraikanHasil('nama,nilai\na,1\n', parseCsv).galat.length >= 2);
  assert.ok(uraikanHasil('', parseCsv).galat.length === 1);
});

test('csv: parseCsv menangani CRLF, kutipan ganda, dan BOM', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"x ""y""",\r\n1,2'), [['a', 'b'], ['x "y"', ''], ['1', '2']]);
});

// ---- Pantauan dosen dan peserta dummy ----
import { statusPeserta, barisPantau, saringPantau, urutkanPantau, ringkasPantau, teksSisa } from '../../site/js/ujian/logic/pantau.js';
import { buatDummy } from '../../site/js/ujian/dummy.js';

const NOW = Date.parse('2026-11-01T10:00:00Z');
const prof = [
  { id: 'a', nama: 'Ani', nim: '2024001', kelas: 'SI-2024-A', prodi: 'SI', angkatan: 2024, rombel: 'A' },
  { id: 'b', nama: 'Budi', nim: '2023002', kelas: 'SI-2023-B', prodi: 'SI', angkatan: 2023, rombel: 'B' },
  { id: 'c', nama: 'Citra', nim: '2024003', kelas: 'SI-2024-B', prodi: 'SI', angkatan: 2024, rombel: 'B' },
  { id: 'd', nama: 'Dewi', nim: '2024004', kelas: 'SI-2024-A', prodi: 'SI', angkatan: 2024, rombel: 'A' },
];
const iso = (ms) => new Date(NOW + ms).toISOString();
const sesiP = [
  { user_id: 'a', mulai_pada: iso(-600000), batas_tahap1: iso(1800000), terkunci_pada: null, hasil: {} },
  { user_id: 'b', mulai_pada: iso(-5400000), batas_tahap1: iso(-1800000), terkunci_pada: null, hasil: {} },
  { user_id: 'c', mulai_pada: iso(-3000000), batas_tahap1: iso(0), terkunci_pada: iso(-1000000), hasil: { tahap: 'stage2', keluar: 5 } },
];

test('pantau: status belum masuk, Tahap 1, lewat batas, Tahap 2, selesai', () => {
  assert.equal(statusPeserta(null, NOW).kode, 'belum');
  assert.equal(statusPeserta(sesiP[0], NOW).kode, 'tahap1');
  assert.equal(statusPeserta(sesiP[1], NOW).lewat, true);
  assert.equal(statusPeserta(sesiP[2], NOW).kode, 'tahap2');
  assert.equal(statusPeserta({ ...sesiP[2], selesai_pada: iso(-1) }, NOW).kode, 'selesai');
  assert.equal(statusPeserta({ ...sesiP[2], hasil: { tahap: 'selesai' } }, NOW).kode, 'selesai');
});

test('pantau: peserta tanpa sesi tampil sebagai belum masuk, ringkasan dan sisa waktu benar', () => {
  const b = barisPantau(prof, sesiP, NOW);
  assert.equal(b.length, 4);
  assert.equal(b.find((x) => x.id === 'd').status, 'belum');
  assert.equal(b.find((x) => x.id === 'a').sisaDetik, 1800);
  assert.equal(teksSisa(1800), '30:00');
  assert.equal(teksSisa(-5), 'lewat batas');
  assert.equal(b.find((x) => x.id === 'c').keluar, 5);
  const r = ringkasPantau(b);
  assert.deepEqual([r.total, r.masuk, r.belum, r.tahap1, r.tahap2, r.selesai, r.lewat, r.keluarBanyak], [4, 3, 1, 2, 1, 0, 1, 1]);
  // sesi tanpa profil tetap terlihat
  assert.equal(barisPantau(prof.slice(0, 1), sesiP, NOW).length, 3);
});

test('pantau: saringan prodi/angkatan/kelas/status/cari dan urutan', () => {
  const b = barisPantau(prof, sesiP, NOW);
  assert.deepEqual(saringPantau(b, { angkatan: '2024' }).map((x) => x.id).sort(), ['a', 'c', 'd']);
  assert.deepEqual(saringPantau(b, { rombel: 'B' }).map((x) => x.id).sort(), ['b', 'c']);
  assert.deepEqual(saringPantau(b, { status: 'belum' }).map((x) => x.id), ['d']);
  assert.deepEqual(saringPantau(b, { cari: '2023' }).map((x) => x.id), ['b']);
  assert.deepEqual(saringPantau(b, { cari: 'cit' }).map((x) => x.id), ['c']);
  assert.deepEqual(urutkanPantau(b, 'status', 1).map((x) => x.id), ['d', 'b', 'a', 'c']);
  assert.deepEqual(urutkanPantau(b, 'status', -1)[0].id, 'c');
  assert.deepEqual(urutkanPantau(b, 'kelas', 1).map((x) => x.id), ['b', 'a', 'd', 'c']); // 2023-B, 2024-A (Ani, Dewi), 2024-B
  assert.deepEqual(urutkanPantau(b, 'angkatan', -1)[3].id, 'b');
  assert.deepEqual(urutkanPantau(b, 'nama', 1).map((x) => x.nama), ['Ani', 'Budi', 'Citra', 'Dewi']);
  assert.equal(urutkanPantau(b, 'keluar', -1)[0].id, 'c');
});

test('dummy: peserta bervariasi tahap, jawaban Tahap 2 lengkap, tidak memakai id nyata', () => {
  const exam = { config: { tahap1Minutes: 40, tahap1Order: ['Q1', 'T1'], stage2: { mode: 'open', seedSalt: 'X' } }, language: 'python',
    theory: [{ id: 'Q1', title: 'Teori', prompt: ['Jelaskan.'], probe: 'Apa itu variabel?' }],
    tasks: [{ id: 'T1', title: 'Praktik', statement: ['Hitung.'], starter: '# awal\n', visible: [{ input: ['1'], expected: '1' }], changes: [] }] };
  const contoh = { code: { T1: 'x = int(input())\nprint(x * 2)\n' }, theory: { Q1: 'Variabel adalah nama untuk menyimpan nilai. Contohnya x.' }, changes: { T1: [{ id: 'C1', text: 'Harga naik.' }] } };
  const tpl = { version: 'v', probe: { text: '{pertanyaan}' }, line: { text: '{tugas} baris {baris}' }, change: { text: '{tugas}: {perubahan}' } };
  const d = buatDummy({ exam, contoh, templates: tpl, ujianId: 'simulasi', kuliahId: 'mk', sekarang: NOW });
  assert.equal(d.profil.length, 8);
  assert.ok(d.profil.every((p) => p.id.startsWith('dummy-') && p.dummy));
  const b = barisPantau(d.profil, d.sesi, NOW);
  const hit = ringkasPantau(b);
  assert.deepEqual([hit.belum, hit.selesai, hit.tahap2], [1, 4, 1]);
  assert.ok(hit.tahap1 === 2 && hit.lewat === 1 && hit.keluarBanyak >= 1);
  const selesai = d.sesi.find((s) => s.user_id === 'dummy-1');
  const items = selesai.keadaan.demo.stage2.attempts[0].items;
  assert.deepEqual(items.map((i) => i.type), ['probe', 'line', 'change']);
  assert.ok(items.every((i) => selesai.keadaan.demo.stage2.attempts[0].answers[i.id].text));
  assert.ok(d.analisis['dummy-2'] && Object.values(d.analisis['dummy-2'].rows)[0].konsistensi === 'tidak_konsisten');
});
