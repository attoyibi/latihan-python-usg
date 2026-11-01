import { makeRng, shuffle } from './rng.js';
import { buildAlts, perturb } from './trace.js';

export function renderTemplate(text, vars) {
  return text.replace(/\{(\w+)\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`Variabel template tidak ada: ${k}`);
    return vars[k];
  });
}

// Semua butir Tahap 2 pilihan ganda (+ rating keyakinan) dan dinilai otomatis: ujiannya berbatas waktu dan
// dikerjakan tanpa pengawas, jadi butirnya harus bisa dijawab cepat oleh orang yang paham kodenya sendiri.
export const ITEM_TYPES = ['trace', 'bugline', 'concept', 'transfer'];

const pickIndex = (seed, len, reroll) => (Math.floor(makeRng(seed)() * len) + reroll) % len;
const letter = (options) => options.map((o, k) => ({ ...o, key: 'ABCDEF'[k] }));

// Memilih indeks dari daftar yang belum dipakai (supaya dua butir sejenis pada tugas yang sama tidak kembar).
function pickDistinct(len, seed, reroll, used, keyOf) {
  const start = pickIndex(seed, len, reroll);
  for (let k = 0; k < len; k++) {
    const idx = (start + k) % len;
    if (!used.has(keyOf(idx))) { used.add(keyOf(idx)); return idx; }
  }
  return start;
}

// Baris kode yang layak jadi pilihan: bukan kosong dan bukan komentar. Hasil: [{ n, text }] dengan n = nomor baris (mulai 1).
// Java: baris yang hanya kurung kurawal, import/package, komentar, atau anotasi tidak dipakai (tak bisa jadi bug).
export function codeLines(code, language = 'python') {
  const java = language === 'java';
  const skip = (t) => (java ? /^(\/\/|\/\*|\*)/.test(t) || /^[{}();]*$/.test(t) || /^(import|package)\s/.test(t) || t.startsWith('@') : t.startsWith('#'));
  return code.split('\n').map((text, i) => ({ n: i + 1, text })).filter((l) => l.text.trim() && !skip(l.text.trim()));
}

export const itemLimitSec = (item, exam) => exam.config.stage2.limitSec[item.type];

// ItemSource berbasis template (MVP): aturan pemilihan ada di kode dan memakai seed, bukan LLM.
// student = { id, code, traceCandidates, debugCandidates, changeCandidates }
//   traceCandidates:  { [taskId]: [{ input, key, variants:[{id,out}] }] }
//   debugCandidates:  { [taskId]: [{ code, line, note, before, after }] }
//   changeCandidates: { [taskId]: { [changeId]: [{ input, own, expected }] } }   own = keluaran kode peserta (aturan lama)
// attempt: 1 = sesi utama, 2 = uji ulang (seed dan id berbeda, butir baru dari kode yang sama).
export function buildItems(student, { exam, templates, rerolls = {}, attempt = 1 }) {
  const { seedSalt, itemsPerType: n, optionsPerItem } = exam.config.stage2;
  const key = attempt > 1 ? `${student.id}~${attempt}` : student.id;
  const taskOf = (id) => exam.tasks.find((t) => t.id === id);
  const base = (type, slot, taskId, extra) => {
    const id = `${key}:${type}:${slot}`;
    const reroll = rerolls[id] || 0;
    return { id, studentId: student.id, attempt, type, slot, taskId, reroll, seed: `${seedSalt}|${id}|${reroll}`, source: 'template', sourceVersion: templates.version, ...extra };
  };
  const order = shuffle(exam.tasks.map((t) => t.id), makeRng(`${seedSalt}|${key}|plan`));
  const items = [];

  // 1. Tebak keluaran: kunci = hasil menjalankan kode peserta; pilihan salah = keluaran varian bug lalu perturbasi.
  const tc = student.traceCandidates || {};
  const traceTasks = order.filter((t) => (tc[t] || []).length);
  const usedTrace = new Set();
  for (let i = 0; traceTasks.length && i < (n.trace || 0); i++) {
    const taskId = traceTasks[i % traceTasks.length];
    const it = base('trace', i + 1, taskId);
    const rng = makeRng(it.seed);
    // Masukan terpendek didahulukan (lebih manusiawi ditelusuri): pilihan berbenih diambil dari ~60% masukan terpendek.
    const size = (c) => c.input.join(' ').length;
    const list = [...tc[taskId]].sort((x, y) => size(x) - size(y));
    const pool = Math.max(2, Math.ceil(list.length * 0.6));
    const first = pickDistinct(Math.min(pool, list.length), `${seedSalt}|${key}:trace:${it.slot}|0`, it.reroll, usedTrace, (k) => `${taskId}:${k}`);
    // Mulai dari masukan terpilih; masukan yang pilihan salahnya kurang (mis. kode kosong menghasilkan keluaran yang sama) dilewati.
    let cand = null;
    let distractors = [];
    for (let k = 0; k < list.length && !cand; k++) {
      const c = list[(first + k) % list.length];
      const alts = buildAlts(c.key, c.variants || []);
      const fromVariant = shuffle(alts.filter((a) => !/^p\d+$/.test(a.source)), rng);
      const fromPerturb = shuffle(alts.filter((a) => /^p\d+$/.test(a.source)), rng);
      const d = [...fromVariant, ...fromPerturb].slice(0, optionsPerItem - 1);
      if (d.length === optionsPerItem - 1) { cand = c; distractors = d; usedTrace.add(`${taskId}:${(first + k) % list.length}`); }
    }
    if (!cand) continue; // kode peserta tidak memberi cukup pilihan salah: butir dilewati, bukan menggagalkan ujian
    const options = letter(shuffle([
      { id: 'key', text: cand.key, correct: true, source: 'hasil menjalankan kode peserta' },
      ...distractors.map((a) => ({ id: a.source, text: a.text, correct: false, source: a.source.startsWith('p') ? 'perturbasi' : `varian ${a.source}` })),
    ], rng));
    items.push({ ...it, input: cand.input, text: renderTemplate(templates.trace.text, { tugas: taskOf(taskId).title }), options });
  }

  // 2. Temukan baris yang salah: kode peserta + SATU mutasi sejati; pilihan = nomor baris.
  const dc = student.debugCandidates || {};
  const bugTasks = order.filter((t) => (dc[t] || []).length);
  const usedBug = new Set();
  for (let i = 0; bugTasks.length && i < (n.bugline || 0); i++) {
    const taskId = bugTasks[i % bugTasks.length];
    const it = base('bugline', i + 1, taskId);
    const rng = makeRng(it.seed);
    const c = dc[taskId][pickDistinct(dc[taskId].length, `${seedSalt}|${key}:bugline:${it.slot}|0`, it.reroll, usedBug, (k) => `${taskId}:${k}`)];
    const lines = codeLines(c.code, exam.language);
    const others = shuffle(lines.filter((l) => l.n !== c.line), rng).slice(0, optionsPerItem - 1);
    if (others.length < optionsPerItem - 1) continue; // kode terlalu pendek untuk butir ini: dilewati
    const mine = lines.find((l) => l.n === c.line);
    const options = letter(shuffle([
      { id: `L${mine.n}`, text: `${mine.n} · ${mine.text.trim()}`, correct: true, source: 'baris hasil mutasi' },
      ...others.map((l) => ({ id: `L${l.n}`, text: `${l.n} · ${l.text.trim()}`, correct: false, source: 'baris lain' })),
    ], rng));
    items.push({ ...it, startCode: c.code, mutation: { line: c.line, note: c.note, before: c.before, after: c.after }, text: renderTemplate(templates.bugline.text, { tugas: taskOf(taskId).title }), options });
  }

  // 3. Konsep teori: satu butir per soal teori (set pernyataan dipilih berbenih): 1 pernyataan benar + distraktor miskonsepsi.
  (exam.theory || []).slice(0, n.concept || 0).forEach((q, i) => {
    const it = base('concept', i + 1, null, { questionId: q.id });
    const rng = makeRng(it.seed);
    const c = q.concepts[pickIndex(`${seedSalt}|${key}:concept:${it.slot}|0`, q.concepts.length, it.reroll)];
    const wrong = shuffle(c.wrong, rng).slice(0, optionsPerItem - 1);
    if (wrong.length < optionsPerItem - 1) throw new Error(`Konsep ${c.id} kurang distraktor`);
    const options = letter(shuffle([
      { id: 'key', text: c.correct, correct: true, source: 'pernyataan benar' },
      ...wrong.map((w, k) => ({ id: `w${k + 1}`, text: w, correct: false, source: 'miskonsepsi' })),
    ], rng));
    items.push({ ...it, conceptId: c.id, text: renderTemplate(templates.concept.text, { stem: c.stem }), options });
  });

  // 4. Ketentuan berubah: keluaran yang BENAR menurut ketentuan baru. Pengecoh utama = keluaran program peserta sendiri
  //    (aturan lama), jadi butir ini menguji apakah peserta memahami perubahannya, bukan sekadar menjalankan kodenya.
  const cc = student.changeCandidates || {};
  const usedChange = new Set();
  const transferTasks = order.filter((t) => taskOf(t).changes.some((c) => (cc[t]?.[c.id] || []).length));
  for (let i = 0; transferTasks.length && i < (n.transfer || 0); i++) {
    const taskId = transferTasks[i % transferTasks.length];
    const task = taskOf(taskId);
    const it = base('transfer', i + 1, taskId);
    const rng = makeRng(it.seed);
    const usable = task.changes.filter((c) => (cc[taskId]?.[c.id] || []).length);
    if (!usable.length) continue;
    const change = usable[pickDistinct(usable.length, `${seedSalt}|${key}:transfer:${it.slot}|0`, it.reroll, usedChange, (k) => `${taskId}:${usable[k].id}`)];
    const rows = cc[taskId][change.id];
    // Mulai dari baris terpilih; baris yang pengecohnya kurang (mis. keluaran satu baris) dilewati.
    const start = pickIndex(`${seedSalt}|${key}:transfer-in:${it.slot}|0`, rows.length, it.reroll);
    let row = null;
    let distractors = [];
    for (let r = 0; r < rows.length && !row; r++) {
      const cand = rows[(start + r) % rows.length];
      const wrong = [];
      if (cand.own !== cand.expected) wrong.push({ id: 'old', text: cand.own, source: 'keluaran programmu saat ini (aturan lama)' });
      for (const [k, t] of shuffle(perturb(cand.expected), rng).entries()) if (t !== cand.own) wrong.push({ id: `p${k + 1}`, text: t, source: 'perturbasi' });
      if (wrong.length >= optionsPerItem - 1) { row = cand; distractors = wrong.slice(0, optionsPerItem - 1); }
    }
    if (!row) continue;
    const options = letter(shuffle([
      { id: 'key', text: row.expected, correct: true, source: 'keluaran kunci untuk ketentuan baru' },
      ...distractors.map((d) => ({ ...d, correct: false })),
    ], rng));
    items.push({ ...it, changeId: change.id, input: row.input, text: renderTemplate(templates.transfer.text, { tugas: task.title, perubahan: change.text }), options });
  }

  const rank = { trace: 0, bugline: 1, concept: 2, transfer: 3 };
  return items.sort((a, b) => rank[a.type] - rank[b.type] || a.slot - b.slot);
}
