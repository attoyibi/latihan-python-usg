// Uji ujung ke ujung logika ujian untuk mata kuliah berbahasa Java, memakai JDK sungguhan (tanpa browser):
//   1. contoh jawaban teori (sample) mencetak skor penuh dengan penilai poin kunci;
//   2. kunci jawaban dievaluasi seperti saat Tahap 1 dikunci (submission.js): semua tes lulus, kandidat butir Tahap 2 terbentuk;
//   3. butir Tahap 2 disusun (items.js) dan jumlahnya sesuai config.itemsPerType; bug hasil mutasi memang bug sungguhan;
//   4. kode awal (belum dikerjakan) tidak membuat evaluasi atau penyusunan butir galat.
// Pakai (dari akar repo):  node tools/ujian/uji_ujian_java.mjs [mata-kuliah] [ujian]      (bawaan: pbo-java, semua ujian)
// Butuh kunci/ujian/<mk>/ (rahasia, tidak ada di repositori) dan JDK (javac, java) di PATH.
import { readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateSubmission } from '../../site/js/ujian/submission.js';
import { buildItems } from '../../site/js/ujian/logic/items.js';
import { scoreTheory } from '../../site/js/ujian/logic/theory.js';

const akar = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mk = process.argv[2] || 'pbo-java';
const baca = (p) => JSON.parse(readFileSync(p, 'utf8'));
const publik = (u, f) => baca(join(akar, 'site/data/kuliah', mk, 'ujian', u, f));
const kunciDir = join(akar, 'kunci/ujian', mk);
const indeks = baca(join(akar, 'site/data/kuliah', mk, 'ujian/index.json')).ujian.map((u) => u.id);
const daftar = process.argv[3] ? [process.argv[3]] : indeks;

// ---- penjalan: javac --release 8 lalu java, dengan cache kompilasi ----
const kerja = join(tmpdir(), 'uji-ujian-java');
rmSync(kerja, { recursive: true, force: true });
mkdirSync(kerja, { recursive: true });
const cache = new Map();
function kompilasi(code) {
  const k = createHash('sha256').update(code).digest('hex').slice(0, 20);
  if (!cache.has(k)) {
    const d = join(kerja, k);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'Main.java'), code);
    const p = spawnSync('javac', ['--release', '8', '-Xlint:-options', '-d', d, join(d, 'Main.java')], { encoding: 'utf8' });
    cache.set(k, p.status === 0 ? { d } : { galat: p.stderr });
  }
  return cache.get(k);
}
// Bentuk sama dengan penjalan situs: galat kompilasi diawali "Galat kompilasi", eksepsi memuat "Exception in thread".
async function run(code, input) {
  const c = kompilasi(code);
  if (c.galat) return { stdout: '', error: `Galat kompilasi:\n${c.galat}`, timeout: false };
  const p = spawnSync('java', ['-cp', c.d, 'Main'], { input: input.join('\n') + (input.length ? '\n' : ''), encoding: 'utf8', timeout: 8000 });
  if (p.error && p.error.code === 'ETIMEDOUT') return { stdout: '', error: null, timeout: true };
  const m = p.stderr.indexOf('Exception in thread "main"');
  return { stdout: p.stdout, error: p.status === 0 ? null : (m < 0 ? p.stderr : p.stderr.slice(m)).trim(), timeout: false };
}

let gagal = 0;
const cek = (ok, pesan) => { console.log(`${ok ? '  ok   ' : '  GAGAL '}${pesan}`); if (!ok) gagal++; };

for (const uid of daftar) {
  console.log(`${mk}/${uid}`);
  const exam = publik(uid, 'exam.json');
  const templates = publik(uid, 'templates.json');
  const kunci = baca(join(kunciDir, `${uid}.json`));
  const sol = baca(join(kunciDir, uid, 'solutions.json')).code;
  const teoriKunci = baca(join(kunciDir, uid, 'theory.json'));
  const lengkap = publik(uid, 'tasks.json').tasks.map((t) => ({ ...t, ...(kunci.tasks[t.id] || {}) }));
  const aktif = lengkap.filter((t) => exam.config.activeTasks.includes(t.id));
  const teori = publik(uid, 'theory.json').questions.map((q) => ({ ...q, ...(kunci.theory[q.id] || {}) }));
  const ujian = { ...exam, language: 'java', allTasks: lengkap, tasks: aktif, theory: teori };

  for (const q of teoriKunci.questions) {
    const s = scoreTheory(q.sample, teori.find((x) => x.id === q.id), { minWords: exam.config.theory.minWords });
    cek(s.score === 1 && !s.tooShort, `${q.id} contoh jawaban: ${s.count}/${s.need} poin, ${s.words} kata`);
    const [lo, hi] = exam.config.theory.wordRange;
    cek(s.words >= lo && s.words <= hi * 1.3, `${q.id} contoh jawaban ${s.words} kata (rentang ${lo}-${hi})`);
  }

  const awal = Object.fromEntries(aktif.map((t) => [t.id, t.starter]));
  for (const [nama, codes] of [['kunci', sol], ['kode awal', awal]]) {
    const ev = await evaluateSubmission({ tasks: aktif, codes, run, language: 'java' });
    if (nama === 'kunci') {
      for (const t of aktif) cek(ev.taskResults[t.id].passed === ev.taskResults[t.id].total, `${t.id} kunci lulus ${ev.taskResults[t.id].passed}/${ev.taskResults[t.id].total}`);
      cek(aktif.some((t) => (ev.debugCandidates[t.id] || []).some((x) => x.wrongOutput)), 'ada soal dengan bug sejati untuk butir "temukan baris"');
      for (const t of aktif) {
        const d = ev.debugCandidates[t.id] || [];
        // Soal yang semua mutasinya membuat SEMUA tes gagal (mis. hanya satu rumus) wajar tanpa kandidat; cukup ada di salah satu soal.
        console.log(`  info ${t.id} kandidat "temukan baris": ${d.length} (${d.map((x) => `${x.rule}@${x.line}`).join(', ')})`);
        cek((ev.traceCandidates[t.id] || []).length >= 3, `${t.id} butir "tebak keluaran": ${(ev.traceCandidates[t.id] || []).length} masukan`);
        cek(Object.keys(ev.changeCandidates[t.id] || {}).length >= 1, `${t.id} butir "ketentuan berubah": ${Object.keys(ev.changeCandidates[t.id] || {}).join(', ')}`);
      }
    } else {
      cek(aktif.every((t) => ev.taskResults[t.id].passed < ev.taskResults[t.id].total), 'kode awal tidak lulus semua tes');
    }
    const items = buildItems({ id: `peserta-${nama}`, traceCandidates: ev.traceCandidates, debugCandidates: ev.debugCandidates, changeCandidates: ev.changeCandidates }, { exam: ujian, templates });
    if (nama === 'kunci') {
      const n = exam.config.stage2.itemsPerType;
      for (const tipe of Object.keys(n)) cek(items.filter((i) => i.type === tipe).length === n[tipe], `butir ${tipe}: ${items.filter((i) => i.type === tipe).length} dari ${n[tipe]}`);
      cek(items.every((i) => i.options.length === exam.config.stage2.optionsPerItem && i.options.filter((o) => o.correct).length === 1), 'tiap butir punya satu jawaban benar dan jumlah pilihan sesuai');
      for (const i of items.filter((x) => x.type === 'bugline')) {
        const b = i.options.find((o) => o.correct);
        cek(!/^\d+ · [{}]*$/.test(b.text), `bugline ${i.taskId}: baris kunci "${b.text}"`);
      }
    } else {
      cek(Array.isArray(items), `kode awal: ${items.length} butir tersusun tanpa galat`);
    }
  }
}
console.log(gagal ? `\n${gagal} pemeriksaan gagal` : '\nSemua pemeriksaan lulus.');
process.exit(gagal ? 1 : 0);
