import * as store from '../store.js';
import { getExam, demoStudent, attempts, ensureAttempt, s1For, theoryOverrides, finalOverrides, peserta, isLatihan } from '../data.js';
import { summarize } from '../logic/summary.js';
import { cbmPoints } from '../logic/cbm.js';
import { theoryResults } from '../logic/s1.js';
import { computeGrade, retestAdvice, studentGrade, EVIDENCE_LABEL } from '../logic/grade.js';
import { codeViewer } from '../codetools.js';
import { numbered } from '../ui.js';
import { html, show, $, fmt, pt, TYPE_LABEL, ask } from '../ui.js';

const CORRECT_LABEL = { trace: 'hasil kodemu', bugline: 'baris yang diubah', concept: 'pernyataan benar', transfer: 'keluaran ketentuan baru' };

export function render(root, ctx) {
  const exam = getExam();
  const cfg = exam.config;
  const demo = store.get().demo || {};
  const student = demoStudent();
  const sub = demo.stage1.submitted;
  const atts = attempts();
  const r = summarize(student, exam, theoryOverrides());
  const grade = computeGrade(r, cfg);
  const final = studentGrade(grade, finalOverrides().DEMO);
  const advice = retestAdvice(r, cfg, atts.length);
  const s1 = s1For(student);
  const tr = theoryResults(student, exam, theoryOverrides());
  const nCorrect = Object.values(r.correct).reduce((a, b) => a + b, 0);

  const retest = advice.available ? html`
    <section class="card">
      <h2>Uji ulang</h2>
      ${advice.recommended
        ? html`<div class="callout warn"><strong>Kamu ditawari uji ulang.</strong> Hasil Tahap 2 jauh di bawah Tahap 1. Ini bukan sanksi: kamu mendapat satu kesempatan lagi dengan butir baru dari kodemu, dan semua butir (lama dan baru) dihitung bersama.</div>`
        : html`<p class="small muted">Merasa Tahap 2 tadi tidak mencerminkan pemahamanmu (terganggu, salah klik)? Kamu boleh meminta satu kali uji ulang dengan butir baru. Semua butir dihitung bersama.</p>`}
      <button class="btn ${advice.recommended ? 'btn-primary' : ''}" id="retest" type="button">Mulai uji ulang sekarang</button>
    </section>` : (atts.length > 1 ? html`<p class="small muted">Uji ulang sudah dipakai (${atts.length} percobaan, semua butir dihitung bersama).</p>` : '');

  const itemCards = atts.map((att) => html`
    <h3 style="margin:14px 0 6px">${att.n > 1 ? 'Uji ulang' : 'Percobaan utama'}</h3>
    <div class="stack">${att.items.map((it, i) => {
      const a = att.answers[it.id] || {};
      const correct = !!it.options.find((o) => o.id === a.optionId)?.correct;
      const pts = cbmPoints(correct, a.confidence || 1, cfg.cbm);
      return html`<div class="card" style="margin:0">
        <div><span class="badge info">${TYPE_LABEL[it.type]}</span> <strong>Butir ${i + 1}</strong></div><p>${it.text}</p>
        ${it.input ? html`<div class="small muted">Masukan</div><pre class="block">${it.input.join('\n')}</pre>` : ''}
        ${it.type === 'bugline' ? codeViewer(numbered(it.startCode), 'Kode dengan nomor baris') : ''}
        <div class="opts">${it.options.map((o) => html`<div class="opt ${o.correct ? 'right' : a.optionId === o.id ? 'wrong' : ''}"><span class="key">${o.key}</span><div style="flex:1;min-width:0"><pre class="block" style="margin:0">${o.text}</pre>${a.optionId === o.id || o.correct ? html`<div style="margin-top:4px">${a.optionId === o.id ? html`<span class="badge">pilihanmu</span> ` : ''}${o.correct ? html`<span class="badge ok">${CORRECT_LABEL[it.type]}</span>` : ''}</div>` : ''}</div></div>`)}</div>
        <p class="small">${a.optionId ? (correct ? 'Benar' : 'Salah') : 'Tidak dijawab (waktu habis)'} · keyakinan ${a.confidence || '–'} · <strong>${pts >= 0 ? '+' : ''}${pts} poin CBM</strong></p></div>`;
    })}</div>`);

  const stage1Detail = html`<section class="card">
    <h2>Jawaban Tahap 1</h2>
    <p class="small muted">Dikunci pada ${new Date(sub.submittedAt).toLocaleString('id-ID')}${sub.auto ? ' (otomatis, waktu habis)' : ''} · <span class="mono">${sub.hash.slice(0, 16)}…</span></p>
    <div class="stack">
      ${exam.theory.map((q, k) => html`<div class="card" style="margin:0"><div class="task-head"><strong>${q.title}</strong><span class="badge ${tr[k].score >= 1 ? 'ok' : 'warn'}">${tr[k].overridden ? 'nilai dosen' : 'otomatis'} · ${pt(tr[k].score)}</span></div><div class="quote">${sub.theory[q.id] || '(kosong)'}</div></div>`)}
      ${exam.tasks.map((t) => {
        const x = sub.taskResults[t.id];
        return html`<div class="card" style="margin:0"><div class="task-head"><strong>${t.title}</strong><span class="badge ${x.passed === x.total ? 'ok' : 'bad'}">${x.passed}/${x.total} tes lulus</span></div>${codeViewer(sub.code[t.id], t.title)}</div>`;
      })}
    </div></section>`;

  const appeal = demo.appeal;
  show(root, html`
    ${isLatihan() ? html`<div class="callout ok"><strong>Ini hasil simulasi.</strong> Nilainya tidak dihitung. Lihat butir yang salah di bawah, lalu ulangi bila ingin mencoba lagi. <div class="row" style="margin-top:8px"><button class="btn btn-primary btn-sm" id="ulangi" type="button">Ulangi simulasi dari awal</button></div></div>` : ''}
    <div class="page-head"><h1>Hasil saya${isLatihan() ? ' · simulasi' : ''}</h1><p>Peserta: ${peserta().nama} (${peserta().nim} · ${peserta().kelas}). Nilai dihitung otomatis dengan rumus yang diumumkan di bawah; kamu boleh banding.</p></div>
    <div class="grid g4">
      <div class="card stat"><div class="v num">${final.value}</div><div class="l">Nilai akhir (skala 100) · ${final.note}</div></div>
      <div class="card stat"><div class="v num">${pt(s1)}</div><div class="l">S1 · Tahap 1 (praktik ${pt(student.s1Practice)} · teori ${pt(tr.reduce((s, x) => s + x.score, 0) / tr.length)})</div></div>
      <div class="card stat"><div class="v num">${pt(r.s2)}</div><div class="l">S2 · pemahaman (rentang ${pt(r.lower)}–${pt(r.upper)})</div></div>
      <div class="card stat"><div class="v num">${nCorrect}/${r.n}</div><div class="l">Butir Tahap 2 benar · kalibrasi C ${fmt(r.c)}</div></div>
    </div>
    <section class="card">
      <h2>Bagaimana nilai ini dihitung <span class="badge ${grade.evidence === 'dikurangi' ? 'warn' : 'ok'}">${EVIDENCE_LABEL[grade.evidence]}</span></h2>
      <ul class="small">${grade.reasons.map((x) => html`<li>${x}</li>`)}</ul>
    </section>
    ${retest}
    <section class="card">
      <h2>Rumus nilai (diumumkan sejak awal)</h2>
      <ul class="small">
        <li><strong>S1</strong> = ${Math.round(cfg.s1.practice * 100)}% praktik (proporsi tes lulus) + ${Math.round(cfg.s1.theory * 100)}% teori (poin kunci).</li>
        <li><strong>S2</strong> = rata-rata tertimbang butir Tahap 2: tebak keluaran ${fmt(cfg.weights.trace)}, cari baris salah ${fmt(cfg.weights.bugline)}, konsep teori ${fmt(cfg.weights.concept)}, ketentuan berubah ${fmt(cfg.weights.transfer)}.</li>
        <li><strong>Nilai</strong> tidak pernah melebihi S1. Rumus plafon: S2' = S2 + toleransi ${pt(cfg.grade.tolerance)} poin (paling tinggi S1); plafon = ${pt(cfg.grade.w)}% × S2' + ${pt(1 - cfg.grade.w)}% × min(S1, S2' + ${pt(cfg.grade.delta)}). Selisih kecil tidak dikurangi; pengurangan paling banyak ${pt(cfg.grade.maxCut)} poin.</li>
        <li><strong>Kalibrasi C</strong> dari keyakinanmu: benar +1/+2/+3, salah ${cfg.cbm.wrong['1']}/${cfg.cbm.wrong['2']}/${cfg.cbm.wrong['3']}. Dilaporkan terpisah dan tidak masuk nilai.</li>
        <li>Dosen dapat meninjau dan menimpa nilai bila perlu, tetapi sistem tidak bergantung pada itu.</li>
      </ul>
    </section>
    <section class="card"><h2>Butir Tahap 2 dan jawabanmu</h2><p class="muted small">Kamu berhak melihat butir dan jawabanmu setelah ujian.</p>${itemCards}</section>
    ${stage1Detail}
    <section class="card">
      <h2>Banding</h2>
      ${appeal ? html`<div class="callout ok">Banding tercatat ${new Date(appeal.at).toLocaleString('id-ID')}: "${appeal.text}". Dosen akan menanggapi.</div>` : html`
        <p class="small muted">Jika menurutmu penilaian atau butir tidak adil, jelaskan di sini.</p>
        <textarea id="appeal-text" rows="3" placeholder="Alasan banding"></textarea>
        <div class="row" style="margin-top:8px"><button class="btn" id="appeal-send" type="button">Ajukan banding</button></div>`}
    </section>
  `);

  $('#ulangi', root)?.addEventListener('click', async () => {
    if (!(await ask('Hapus hasil simulasi ini dan mulai lagi dari awal?', 'Ulangi'))) return;
    store.reset();
    ctx.rerender();
  });
  $('#retest', root)?.addEventListener('click', () => {
    ensureAttempt(atts.length + 1);
    ctx.rerender();
  });
  $('#appeal-send', root)?.addEventListener('click', () => {
    const text = $('#appeal-text', root).value.trim();
    if (!text) return;
    store.update((s) => { s.demo.appeal = { text, at: new Date().toISOString() }; });
    ctx.rerender();
  });
}
