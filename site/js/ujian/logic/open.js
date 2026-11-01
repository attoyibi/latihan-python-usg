import { makeRng } from './rng.js';
import { codeLines, renderTemplate } from './items.js';

// Tahap 2 "terbuka": pertanyaan kecil yang dijawab dengan satu kalimat, tidak dinilai otomatis. Jawabannya disimpan bersama
// pembandingnya (jawaban Tahap 1, kode, hasil tes) lalu diekspor untuk dianalisis; kalau jawaban Tahap 2 bertentangan dengan
// Tahap 1, itu petunjuk bahwa Tahap 1 bukan murni pemahaman peserta. Dipilih lewat exam.config.stage2.mode = 'open'.
export const isOpen = (exam) => exam.config.stage2.mode === 'open';
export const OPEN_TYPES = ['probe', 'line', 'change'];
export const OPEN_LABEL = { probe: 'Pertanyaan konsep', line: 'Jelaskan barismu', change: 'Ketentuan berubah' };

const pick = (seed, len) => Math.floor(makeRng(seed)() * len);

// Baris yang layak ditanyakan: bukan sekadar kurung/import/deklarasi kosong, cukup panjang untuk punya makna.
const worthAsking = (l) => l.text.trim().length >= 8 && /[=(+\-*/<>]|return|print|if|for|while/.test(l.text);

// student = { id, code: {taskId: kode} }; exam.tasks[].changes dan exam.theory[].probe berasal dari berkas soal.
// Urutannya mengikuti urutan soal Tahap 1: soal teori -> satu pertanyaan konsep; soal praktik -> jelaskan baris + ketentuan berubah.
export function buildOpenItems(student, { exam, templates, attempt = 1 }) {
  const { seedSalt } = exam.config.stage2;
  const key = attempt > 1 ? `${student.id}~${attempt}` : student.id;
  const base = (type, slot, taskId, extra) => {
    const id = `${key}:${type}:${slot}`;
    return { id, studentId: student.id, attempt, type, slot, taskId, seed: `${seedSalt}|${id}`, source: 'template', sourceVersion: templates.version, ...extra };
  };
  const items = [];
  for (const sid of exam.config.tahap1Order) {
    const q = exam.theory.find((x) => x.id === sid);
    if (q) {
      if (q.probe) items.push(base('probe', items.length + 1, null, { questionId: q.id, text: renderTemplate(templates.probe.text, { pertanyaan: q.probe }) }));
      continue;
    }
    const t = exam.tasks.find((x) => x.id === sid);
    const code = (student.code || {})[sid] || '';
    if (!t || !code.trim()) continue; // tanpa kode, tidak ada yang bisa dibandingkan
    const lines = codeLines(code, exam.language).filter(worthAsking);
    if (lines.length) {
      const l = lines[pick(`${seedSalt}|${key}:line:${sid}`, lines.length)];
      items.push(base('line', items.length + 1, sid, { line: l.n, lineText: l.text.trim(), text: renderTemplate(templates.line.text, { tugas: t.title, baris: l.n }) }));
    }
    const ch = (t.changes || [])[pick(`${seedSalt}|${key}:change:${sid}`, (t.changes || []).length || 1)];
    if (ch) items.push(base('change', items.length + 1, sid, { changeId: ch.id, text: renderTemplate(templates.change.text, { tugas: t.title, perubahan: ch.text }) }));
  }
  return items;
}

const words = (s) => (String(s || '').trim() ? String(s).trim().split(/\s+/).length : 0);

// Salinan lengkap pekerjaan satu peserta untuk satu ujian: dipakai PDF peserta, PDF dan CSV dosen, serta tampilan dosen.
// keadaan = isi kolom ujian_sesi.keadaan; exam = definisi publik (exam, tasks, theory) yang sudah digabung.
export function salinan({ keadaan, exam, peserta, ujian }) {
  const demo = (keadaan || {}).demo || {};
  const sub = demo.stage1?.submitted || null;
  const atts = demo.stage2?.attempts || [];
  const s2 = atts.flatMap((att) => att.items.map((it) => {
    const a = att.answers[it.id] || {};
    const teori = it.questionId ? exam.theory.find((q) => q.id === it.questionId) : null;
    const tugas = it.taskId ? exam.tasks.find((t) => t.id === it.taskId) : null;
    return {
      id: it.id, jenis: it.type, pertanyaan: it.text, taskId: it.taskId || '', questionId: it.questionId || '',
      konteks: it.type === 'line' ? `baris ${it.line}: ${it.lineText}` : '',
      jawaban: a.text || '', kata: words(a.text), detik: a.latencySec ?? '', tempel: a.tempel || 0, kosong: !String(a.text || '').trim(),
      // pembanding dari Tahap 1
      soalS1: teori ? teori.prompt.join(' ') : tugas ? `${tugas.title}. ${tugas.statement.join(' ')}` : '',
      jawabanS1: teori ? (sub?.theory?.[teori.id] || '') : '',
      kodeS1: tugas ? (sub?.code?.[tugas.id] || '') : '',
      tesS1: tugas && sub?.taskResults?.[tugas.id] ? `${sub.taskResults[tugas.id].passed}/${sub.taskResults[tugas.id].total}` : '',
    };
  }));
  return {
    peserta, ujian,
    kode: sub?.hash ? sub.hash.slice(0, 16) : '',
    terkunci: sub?.submittedAt || '', otomatis: !!sub?.auto, tempelS1: sub?.tempelDiblokir || 0, ai: sub?.ai || null, contohDiisi: sub?.contohDiisi || [],
    teori: exam.theory.map((q) => ({ id: q.id, judul: q.title, soal: q.prompt.join(' '), jawaban: sub?.theory?.[q.id] || '' })),
    praktik: exam.tasks.map((t) => ({ id: t.id, judul: t.title, soal: t.statement.join(' '), kode: sub?.code?.[t.id] || '', tes: sub?.taskResults?.[t.id] ? `${sub.taskResults[t.id].passed}/${sub.taskResults[t.id].total}` : '' })),
    s2,
  };
}

// ---- CSV untuk dianalisis ----
export const KOLOM_ANALISIS = [
  { label: 'id_baris', get: (r) => r.idBaris },
  { label: 'peserta_id', get: (r) => r.pesertaId },
  { label: 'nama', get: (r) => r.nama }, { label: 'nim', get: (r) => r.nim }, { label: 'kelas', get: (r) => r.kelas },
  { label: 'ujian', get: (r) => r.ujian }, { label: 'jenis', get: (r) => r.jenis },
  { label: 'pertanyaan_s2', get: (r) => r.pertanyaan }, { label: 'konteks_baris', get: (r) => r.konteks },
  { label: 'jawaban_s2', get: (r) => r.jawaban }, { label: 'kata_s2', get: (r) => r.kata }, { label: 'detik_s2', get: (r) => r.detik }, { label: 'tempel_s2', get: (r) => r.tempel },
  { label: 'soal_s1', get: (r) => r.soalS1 }, { label: 'jawaban_s1_teori', get: (r) => r.jawabanS1 }, { label: 'kode_s1', get: (r) => r.kodeS1 }, { label: 'tes_s1_lulus', get: (r) => r.tesS1 },
  { label: 'tempel_s1', get: (r) => r.tempelS1 }, { label: 'deklarasi_ai', get: (r) => r.ai },
];
// Kolom yang diisi AI/dosen lalu diunggah kembali; id_baris dan peserta_id menautkannya ke baris di atas.
export const KOLOM_HASIL = ['id_baris', 'peserta_id', 'konsistensi', 'skor', 'catatan'];
export const KONSISTENSI = ['konsisten', 'sebagian', 'tidak_konsisten', 'tidak_jelas'];

// Satu baris per pertanyaan Tahap 2 per peserta.
export function barisAnalisis(salinanList) {
  return salinanList.flatMap((s) => s.s2.map((x) => ({
    ...x, idBaris: x.id, pesertaId: s.peserta.id, nama: s.peserta.nama, nim: s.peserta.nim, kelas: s.peserta.kelas, ujian: s.ujian,
    tempelS1: s.tempelS1, ai: s.ai ? [s.ai.level, s.ai.tools, s.ai.how].filter(Boolean).join(' / ') : '',
  })));
}

// Mengurai CSV hasil analisis. Mengembalikan { rows: [{id_baris, peserta_id, konsistensi, skor, catatan}], galat: [teks] }.
export function uraikanHasil(teks, parseCsv) {
  const t = parseCsv(teks);
  const galat = [];
  if (!t.length) return { rows: [], galat: ['Berkas kosong.'] };
  const head = t[0].map((h) => h.trim().toLowerCase());
  for (const k of ['id_baris', 'peserta_id']) if (!head.includes(k)) galat.push(`Kolom "${k}" tidak ada.`);
  if (!head.includes('konsistensi') && !head.includes('skor') && !head.includes('catatan')) galat.push('Perlu minimal salah satu kolom: konsistensi, skor, catatan.');
  if (galat.length) return { rows: [], galat };
  const rows = [];
  t.slice(1).forEach((r, i) => {
    if (!r.some((c) => c.trim())) return;
    const o = Object.fromEntries(head.map((h, k) => [h, (r[k] ?? '').trim()]));
    if (!o.id_baris || !o.peserta_id) { galat.push(`Baris ${i + 2}: id_baris atau peserta_id kosong.`); return; }
    if (o.konsistensi && !KONSISTENSI.includes(o.konsistensi.toLowerCase())) { galat.push(`Baris ${i + 2}: konsistensi "${o.konsistensi}" tidak dikenal (pakai ${KONSISTENSI.join(', ')}).`); return; }
    const skor = o.skor === '' || o.skor === undefined ? null : Number(o.skor.replace(',', '.'));
    if (skor !== null && !(skor >= 0 && skor <= 100)) { galat.push(`Baris ${i + 2}: skor harus 0-100.`); return; }
    rows.push({ id_baris: o.id_baris, peserta_id: o.peserta_id, konsistensi: (o.konsistensi || '').toLowerCase(), skor, catatan: o.catatan || '' });
  });
  return { rows, galat };
}

// ---- PDF ----
const WAKTU = (iso) => (iso ? new Date(iso).toLocaleString('id-ID') : '-');
// Blok untuk pdf.js (gambarPdf): satu peserta satu ujian. withJudul=false untuk digabung ke PDF banyak peserta.
export function blokPdf(s, { judul = true } = {}) {
  const b = [];
  if (judul) b.push({ t: 'judul', teks: s.ujian });
  else b.push({ t: 'bagian', teks: `${s.peserta.nama} (${s.peserta.nim || '-'}, ${s.peserta.kelas || '-'})` });
  b.push({ t: 'kv', baris: [['Nama', s.peserta.nama || '-'], ['NIM', s.peserta.nim || '-'], ['Kelas', s.peserta.kelas || '-'], ['Dikunci', WAKTU(s.terkunci) + (s.otomatis ? ' (otomatis)' : '')], ['Kode', s.kode || '-']] });
  b.push({ t: 'catatan', teks: 'Salinan jawaban Tahap 1 dan Tahap 2. Jawaban sudah dikunci di server dan tidak bisa diubah.' });
  if (s.contohDiisi.length) b.push({ t: 'catatan', teks: `Sebagian jawaban simulasi diisi dari contoh: ${s.contohDiisi.join(', ')}.` });
  b.push({ t: 'bagian', teks: 'Tahap 1 - Teori' });
  for (const q of s.teori) { b.push({ t: 'paragraf', teks: `${q.judul}: ${q.soal}` }); b.push({ t: 'paragraf', teks: q.jawaban || '(kosong)', kosong: !q.jawaban }); }
  b.push({ t: 'bagian', teks: 'Tahap 1 - Praktik' });
  for (const p of s.praktik) { b.push({ t: 'paragraf', teks: `${p.judul}${p.tes ? ` (tes lulus ${p.tes})` : ''}` }); b.push({ t: 'kode', teks: p.kode || '(kosong)' }); }
  b.push({ t: 'bagian', teks: 'Tahap 2 - Pertanyaan terbuka' });
  for (const x of s.s2) {
    b.push({ t: 'paragraf', teks: `${OPEN_LABEL[x.jenis] || x.jenis}: ${x.pertanyaan}` });
    b.push({ t: 'paragraf', teks: x.jawaban || '(tidak dijawab)', kosong: x.kosong });
  }
  return b;
}
