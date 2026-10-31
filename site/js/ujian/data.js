// Data ujian: definisi dari berkas JSON situs (data/kuliah/<mk>/ujian/) dan keadaan peserta (store.js, per akun).
// Mata kuliah tanpa tanda "ujian": true di matakuliah.json tidak mengambil apa pun.
// Diadaptasi dari prototype double-check-exam (js/data.js); bagian dosen dan kohort contoh tidak dibawa.
import * as store from './store.js';
import { buildItems, ITEM_TYPES } from './logic/items.js';
import { summarize } from './logic/summary.js';
import { computeS1 } from './logic/s1.js';
import { computeGrade } from './logic/grade.js';
import { accommodationFactor, stage1Deadline } from './logic/session.js';

async function ambilJson(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Gagal memuat ${path} (${r.status})`);
  return r.json();
}

// ---- definisi ----
const cacheIdx = new Map();
// Daftar ujian satu mata kuliah: [{ id, judul, babDari, babSampai }]. Kosong bila tidak ada atau tidak bertanda.
export function muatIndeks(mk, ada = true) {
  if (!ada) return Promise.resolve([]);
  if (!cacheIdx.has(mk)) {
    cacheIdx.set(mk, ambilJson(`data/kuliah/${mk}/ujian/index.json`).then(
      (j) => (Array.isArray(j.ujian) ? j.ujian.filter((u) => u && typeof u.id === 'string' && /^[a-z0-9-]+$/.test(u.id)) : []),
      () => [],
    ));
  }
  return cacheIdx.get(mk);
}

let base = null; // { exam, tasks, theory, templates }
let ctx = { mk: null, ujianId: null, peserta: null, meta: {} };

// Memuat definisi satu ujian dan memilih penyimpanan untuk akun ini. peserta = { id, nama, nim, kelas }.
// meta = baris index.json ujian ini (judul, jenis, latihan: true untuk simulasi yang boleh diulang).
export async function pakaiUjian(mk, ujianId, peserta, meta = {}) {
  const dir = `data/kuliah/${mk}/ujian/${ujianId}/`;
  const [exam, tasks, theory, templates] = await Promise.all(['exam', 'tasks', 'theory', 'templates'].map((f) => ambilJson(`${dir}${f}.json`)));
  base = { exam, tasks, theory, templates };
  ctx = { mk, ujianId, peserta, meta };
  store.pakai(peserta.id, mk, ujianId);
}

export const peserta = () => ctx.peserta;
// Simulasi: nilai tidak dihitung dan boleh diulang dari awal.
export const isLatihan = () => ctx.meta.latihan === true;
export const templates = () => base.templates;

export function getExam() {
  const exam = structuredClone(base.exam);
  // Soal praktik yang dipakai ujian ini (sisanya cadangan) dan soal teori.
  exam.allTasks = structuredClone(base.tasks.tasks);
  exam.tasks = exam.allTasks.filter((t) => exam.config.activeTasks.includes(t.id));
  exam.theory = structuredClone(base.theory.questions);
  return exam;
}

// ---- sesi ujian satu kali jalan ----
export const demo = () => store.get().demo || {};
export const examSession = () => demo().exam || null;

// Akomodasi waktu: daftar NIM di config.accommodations (diisi dosen).
export function startExam() {
  const cfg = getExam().config;
  store.update((s) => {
    (s.demo ||= {}).exam = { startedAt: Date.now(), speed: 1, factor: accommodationFactor(cfg, ctx.peserta.nim) };
  });
}

export function stage1EndsAt() {
  const ses = examSession();
  return stage1Deadline(ses.startedAt, getExam().config, ses.factor, ses.speed);
}

// 'belum' | 'stage1' | 'stage2' | 'selesai'
export function examStage() {
  const d = demo();
  if (!d.exam) return 'belum';
  if (!d.stage1?.submitted) return 'stage1';
  const atts = d.stage2?.attempts || [];
  if (!atts.length || atts.some((a) => !a.finishedAt)) return 'stage2';
  return 'selesai';
}

export const attempts = () => demo().stage2?.attempts || [];

function studentBase() {
  const sub = demo().stage1.submitted;
  return {
    id: ctx.peserta.id, label: ctx.peserta.nama, ai: sub.ai.level, group: 'peserta',
    s1Practice: sub.s1Practice, theory: sub.theory, code: sub.code,
    traceCandidates: sub.traceCandidates, debugCandidates: sub.debugCandidates || {}, changeCandidates: sub.changeCandidates || {},
  };
}

// Membuat percobaan Tahap 2 ke-n (1 = utama, 2 = uji ulang) bila belum ada. Mulai otomatis setelah jeda singkat.
export function ensureAttempt(n = 1) {
  if (attempts().some((a) => a.n === n)) return;
  const exam = getExam();
  const ses = examSession();
  const items = buildItems(studentBase(), { exam, templates: base.templates, rerolls: {}, attempt: n });
  const delay = (exam.config.stage2.beginDelaySec * 1000) / ses.speed;
  const from = n === 1 ? Date.parse(demo().stage1.submitted.submittedAt) : Date.now();
  const beginAt = from + delay;
  store.update((s) => {
    const st = (s.demo.stage2 ||= { attempts: [] });
    st.attempts.push({ n, items, answers: {}, idx: 0, shownAt: beginAt, beginAt, skipped: [], finishedAt: null });
  });
}

export function demoStudent() {
  const sub = demo().stage1?.submitted;
  if (!sub) return null;
  const student = studentBase();
  const done = attempts().filter((a) => a.finishedAt);
  if (done.length) {
    const row = (i, a) => ({ taskId: i.taskId, correct: !!i.options.find((o) => o.id === a?.optionId)?.correct, confidence: a?.confidence || 1, latencySec: a?.latencySec ?? null });
    student.stage2 = Object.fromEntries(ITEM_TYPES.map((t) => [t, done.flatMap((att) => att.items.filter((i) => i.type === t).map((i) => row(i, att.answers[i.id])))]));
  }
  return student;
}

// Timpaan dosen (nilai teori dan nilai akhir) baru ada setelah tersambung ke server; untuk sekarang kosong.
export const theoryOverrides = () => ({});
export const finalOverrides = () => ({});
export const s1For = (student) => computeS1(student, getExam(), theoryOverrides());
export const gradeFor = (student) => computeGrade(summarize(student, getExam(), theoryOverrides()), getExam().config);
