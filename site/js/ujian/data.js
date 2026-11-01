// Data ujian: definisi PUBLIK dari berkas JSON situs (data/kuliah/<mk>/ujian/), keadaan peserta, dan sesi di Supabase.
// Mata kuliah tanpa tanda "ujian": true di matakuliah.json tidak mengambil apa pun.
//
// Server (migrasi 0010) memegang: jadwal per kelas, waktu mulai dan batas Tahap 1 (jam server), akomodasi waktu, dan kunci
// (tes tersembunyi, poin kunci teori, butir konsep, varian) yang baru turun setelah Tahap 1 dikunci. Pekerjaan peserta
// disimpan di browser (cadangan) dan dikirim ke kolom keadaan, jadi bisa dilanjutkan di perangkat lain dan dibaca dosen.
// Diadaptasi dari prototype double-check-exam (js/data.js).
import * as store from './store.js';
import * as server from './server.js';
import { bahasa } from './bahasa.js';
import { buildItems, ITEM_TYPES } from './logic/items.js';
import { buildOpenItems, isOpen } from './logic/open.js';
import { summarize } from './logic/summary.js';
import { computeS1 } from './logic/s1.js';
import { computeGrade, studentGrade, EVIDENCE_LABEL } from './logic/grade.js';

async function ambilJson(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Gagal memuat ${path} (${r.status})`);
  return r.json();
}

// ---- definisi ----
const cacheIdx = new Map();
// Daftar ujian satu mata kuliah: [{ id, judul, babDari, babSampai, latihan }]. Kosong bila tidak ada atau tidak bertanda.
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

let base = null; // { exam, tasks, theory, templates, contoh }
let ctx = { mk: null, ujianId: null, peserta: null, meta: {}, status: null, kunci: false };

// Kunci dari server digabung ke definisi soal (tes tersembunyi, varian, ketentuan berubah, poin kunci, butir konsep).
function gabungKunci(k) {
  if (!k) return;
  for (const t of base.tasks.tasks) Object.assign(t, (k.tasks || {})[t.id] || {});
  for (const q of base.theory.questions) Object.assign(q, (k.theory || {})[q.id] || {});
  ctx.kunci = true;
}

// Sesi server -> keadaan lokal (waktu dikonversi ke jam perangkat memakai selisih jam server).
function terapkanSesi(sesi) {
  store.update((s) => {
    const d = (s.demo ||= {});
    d.exam = { startedAt: server.keLokal(sesi.mulai_pada), endsAt: server.keLokal(sesi.batas_tahap1), speed: 1, factor: Number(sesi.faktor) || 1 };
  }, { diam: true });
}

// Memuat definisi satu ujian, status dari server, dan memilih penyimpanan untuk akun ini.
// peserta = { id, nama, nim, kelas }. meta = baris index.json (judul, jenis, latihan).
export async function pakaiUjian(mk, ujianId, peserta, meta = {}) {
  const dir = `data/kuliah/${mk}/ujian/${ujianId}/`;
  const [exam, tasks, theory, templates] = await Promise.all(['exam', 'tasks', 'theory', 'templates'].map((f) => ambilJson(`${dir}${f}.json`)));
  // Contoh jawaban benar hanya ada untuk simulasi (berkas publik contoh.json). UTS dan UAS tidak pernah memilikinya.
  const contoh = meta.latihan === true ? await ambilJson(`${dir}contoh.json`).catch(() => null) : null;
  base = { exam, tasks, theory, templates, contoh };
  ctx = { mk, ujianId, peserta, meta, status: null, kunci: false };
  store.pakai(peserta.id, mk, ujianId);
  store.onSimpan(jadwalkanSimpan);

  const st = await server.status(mk, ujianId);
  ctx.status = st;
  if (!st.sesi) {
    // Tidak ada sesi di server (belum mulai, diulang, atau dihapus dosen): sisa keadaan lama di browser dibuang.
    if (store.get().demo) store.reset();
    return;
  }
  // Pekerjaan terbaru menang: dari server (perangkat lain) atau dari browser ini (belum sempat terkirim).
  const lokal = store.get();
  const dariServer = st.sesi.keadaan || {};
  if ((dariServer._t || 0) > (lokal._t || 0)) store.ganti(dariServer);
  terapkanSesi(st.sesi);
  if (st.sesi.terkunci_pada) gabungKunci(await server.ambilKunci(mk, ujianId));
}

export const peserta = () => ctx.peserta;
export const keadaanSekarang = () => store.get();
// Menandai jawaban terkirim dan terkunci di server (migrasi 0011). Gagal diam-diam bila migrasi belum dijalankan.
export async function tandaiSelesai() {
  await simpanSekarang();
  try { await server.selesai(ctx.mk, ctx.ujianId); } catch (e) { if (e.jenis !== 'belum-siap') throw e; }
}
// Simulasi: nilai tidak dihitung dan boleh diulang dari awal (server memeriksa lewat jadwal boleh_ulang).
export const isLatihan = () => ctx.meta.latihan === true;
// { code: {idSoal: kode}, theory: {idSoal: teks} } atau null (selain simulasi).
export const contohJawaban = () => (ctx.meta.latihan === true ? base.contoh : null);
export const templates = () => base.templates;
export const jadwal = () => (ctx.status ? { info: ctx.status.jadwal, buka: !!ctx.status.buka } : { info: null, buka: false });
export const kunciTersedia = () => ctx.kunci;

export function getExam() {
  const exam = structuredClone(base.exam);
  exam.language = bahasa().id; // dipakai logika murni (mutasi bug, pilihan baris) tanpa bergantung pada layar
  // Soal praktik yang dipakai ujian ini (sisanya cadangan) dan soal teori.
  exam.allTasks = structuredClone(base.tasks.tasks);
  exam.tasks = exam.allTasks.filter((t) => exam.config.activeTasks.includes(t.id));
  exam.theory = structuredClone(base.theory.questions);
  return exam;
}

// ---- sesi ujian satu kali jalan ----
export const demo = () => store.get().demo || {};
export const examSession = () => demo().exam || null;

// Mulai: server memeriksa jadwal kelas, mencatat waktu mulai, dan menghitung batas Tahap 1 (termasuk akomodasi).
export async function startExam() {
  const st = await server.mulai(ctx.mk, ctx.ujianId, getExam().config.tahap1Minutes);
  ctx.status = st;
  terapkanSesi(st.sesi);
  await simpanSekarang();
}

export const stage1EndsAt = () => examSession().endsAt;

// Mengunci Tahap 1 di server (snapshot + hash), lalu menerima kunci untuk menilai dan menyusun Tahap 2.
export async function kunciTahap1(snapshot, hash) {
  gabungKunci(await server.kunciTahap1(ctx.mk, ctx.ujianId, snapshot, hash));
}

// Simulasi: hapus sesi di server lalu mulai lagi dari layar awal.
export async function ulangi() {
  await server.ulang(ctx.mk, ctx.ujianId);
  store.reset();
  ctx.kunci = false;
  const st = await server.status(ctx.mk, ctx.ujianId);
  ctx.status = st;
  // Definisi publik dimuat ulang supaya kunci dari percobaan sebelumnya tidak menempel.
  const dir = `data/kuliah/${ctx.mk}/ujian/${ctx.ujianId}/`;
  base.tasks = await ambilJson(`${dir}tasks.json`);
  base.theory = await ambilJson(`${dir}theory.json`);
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
  const items = isOpen(exam) ? buildOpenItems(studentBase(), { exam, templates: base.templates, attempt: n }) : buildItems(studentBase(), { exam, templates: base.templates, rerolls: {}, attempt: n });
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

// Timpaan dosen (nilai teori dan nilai akhir) belum ada; dosen membaca nilai otomatis di dashboard.
export const theoryOverrides = () => ({});
export const finalOverrides = () => ({});
export const s1For = (student) => computeS1(student, getExam(), theoryOverrides());

// Ringkasan yang dikirim ke server (kolom hasil) untuk rekap dosen. Skala 0-100.
function ringkasan() {
  const tahap = examStage();
  const sub = demo().stage1?.submitted;
  const out = { tahap };
  if (sub) out.terlambat = !!sub.auto;
  const exam = getExam();
  if (isOpen(exam)) {
    // Tahap 2 terbuka tidak dinilai otomatis; dosen melihat S1 (tes dan poin kunci) dan membaca jawaban S2 dari ekspor.
    if (!ctx.kunci || !demo().stage1?.submitted) return out;
    const atts = attempts();
    const butir = atts.flatMap((a) => a.items);
    const terjawab = atts.flatMap((a) => a.items.filter((i) => String(a.answers[i.id]?.text || '').trim()));
    return { ...out, mode: 'terbuka', s1: Math.round(s1For(demoStudent()) * 100), butir: butir.length, terjawab: terjawab.length, latihan: isLatihan() };
  }
  if (tahap !== 'selesai' || !ctx.kunci) return out;
  const student = demoStudent();
  const r = summarize(student, exam, theoryOverrides());
  const g = computeGrade(r, exam.config);
  return {
    ...out,
    nilai: studentGrade(g, undefined).value, s1: Math.round(r.s1 * 100), s2: Math.round(r.s2 * 100),
    benar: Object.values(r.correct).reduce((a, b) => a + b, 0), butir: r.n, percobaan: attempts().length,
    keterangan: EVIDENCE_LABEL[g.evidence], flag: !!r.flag, latihan: isLatihan(),
  };
}

// ---- kirim ke server (antrean sederhana: satu kiriman berjalan, sisanya digabung) ----
let timer = null;
let berjalan = null;
let statusKirim = 'diam';
const pendengarKirim = new Set();
export const onStatusKirim = (cb) => { pendengarKirim.add(cb); cb(statusKirim); return () => pendengarKirim.delete(cb); };
const setStatus = (s) => { statusKirim = s; pendengarKirim.forEach((cb) => cb(s)); };

function jadwalkanSimpan() {
  if (!examSession()) return;
  clearTimeout(timer);
  timer = setTimeout(() => simpanSekarang().catch(() => {}), 1500);
}

export async function simpanSekarang() {
  clearTimeout(timer);
  if (!examSession()) return;
  if (berjalan) { await berjalan.catch(() => {}); }
  setStatus('menyimpan');
  berjalan = server.simpan(ctx.mk, ctx.ujianId, store.get(), ringkasan());
  try {
    await berjalan;
    setStatus('tersimpan');
  } catch (e) {
    if (e.jenis === 'terkunci') { setStatus('tersimpan'); return; } // jawaban sudah dikumpulkan dan dikunci di server
    setStatus('gagal');
    clearTimeout(timer);
    timer = setTimeout(() => simpanSekarang().catch(() => {}), 10000);
    throw e;
  } finally {
    berjalan = null;
  }
}
