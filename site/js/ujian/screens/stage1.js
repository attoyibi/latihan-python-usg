import * as store from '../store.js';
import { getExam, examSession, stage1EndsAt } from '../data.js';
import * as Anticopas from '../../anticopas.js';
import { getRunner } from '../runner.js';
import { workbenchMarkup, examplesMarkup, mountWorkbench, renderResults } from '../workbench.js';
import { runTests, passCount, s1Of } from '../logic/tests.js';
import { scoreTheory } from '../logic/theory.js';
import { evaluateSubmission } from '../submission.js';
import { html, show, $, $$, sha256, ask, wordCount, mmss } from '../ui.js';

// Tahap 1 = empat soal, satu per layar (maju/mundur bebas, satu batas waktu untuk seluruh tahap): soal teori (esai singkat) dan soal praktik (koding).
//  - Praktik: dinilai tes. BENAR bila semua tes (contoh + tersembunyi) lulus.
//  - Teori: dinilai otomatis dari poin kunci (kata kunci); skor = poin tertangkap / need. Dosen bisa menimpa.
// Peserta boleh memeriksa dan memperbaiki berulang kali sebelum mengunci.

const draft = () => store.get().demo?.stage1?.draft || {};
function saveDraft(fn) {
  store.update((s) => {
    const d = ((s.demo ||= {}).stage1 ||= {});
    fn((d.draft ||= { code: {}, theory: {}, checks: {}, ai: {}, idx: 0 }));
  });
}
const timers = {};
const debounce = (key, fn, ms = 300) => { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); };

// Urutan soal dari konfigurasi: id "Qn" = teori, selain itu = praktik.
function stepsOf(exam) {
  return exam.config.tahap1Order.map((id) => {
    const q = exam.theory.find((x) => x.id === id);
    return q ? { kind: 'theory', id, q } : { kind: 'task', id, t: exam.tasks.find((x) => x.id === id) };
  });
}

const verdictBadge = (c) => {
  if (!c) return html`<span class="badge">belum diperiksa</span>`;
  if (c.kind === 'theory') return c.correct ? html`<span class="badge ok">✓ Lengkap</span>` : html`<span class="badge bad">✗ ${c.count}/${c.need} poin</span>`;
  return c.correct ? html`<span class="badge ok">✓ Benar</span>` : html`<span class="badge bad">✗ ${c.passed}/${c.total} tes lulus</span>`;
};

function verdictCard(c, stale, q) {
  const staleNote = stale ? html`<br><span class="small">Jawabanmu sudah berubah sejak diperiksa. Periksa lagi untuk hasil terbaru.</span>` : '';
  if (c.kind === 'theory') {
    if (c.tooShort) return html`<div class="callout warn" role="status"><strong>Jawaban terlalu pendek.</strong> Tulis minimal ${c.minWords} kata dengan penjelasanmu sendiri.${staleNote}</div>`;
    return html`<div class="callout ${c.correct ? 'ok' : 'warn'}" role="status">
      <strong>${c.correct ? '✓ Cakupan lengkap' : '✗ Belum lengkap'}</strong> · ${c.count} poin kunci tertangkap (nilai penuh bila minimal ${c.need}).
      ${c.matched.length ? html`<ul class="small" style="margin:6px 0 0">${c.matched.map((id) => html`<li>✓ ${q.keyPoints.find((k) => k.id === id).label}</li>`)}</ul>` : ''}
      ${c.correct ? '' : html`<span class="small">Masih ada poin yang belum tertangkap: lengkapi jawabanmu lalu periksa lagi.</span>`}
      <br><span class="small muted">Penilaian otomatis berdasarkan kata kunci; dosen dapat menimpa nilainya. Diperiksa ${c.attempts}×.</span>${staleNote}</div>`;
  }
  return html`<div class="callout ${c.correct ? 'ok' : 'warn'}" role="status">
    <strong>${c.correct ? '✓ Benar' : '✗ Belum tepat'}</strong> · ${c.passed} dari ${c.total} tes lulus${c.correct ? '.' : ' (tes tersembunyi tidak dirinci).'}
    <span class="small muted"> · diperiksa ${c.attempts}×</span>${staleNote}</div>`;
}

export function render(root, ctx) {
  const exam = getExam();
  const runner = getRunner();
  runner.start();
  const endsAt = stage1EndsAt();
  const totalMs = endsAt - examSession().startedAt;
  const dr = draft();
  const steps = stepsOf(exam);
  const n = steps.length;
  const idx = Math.min(Math.max(dr.idx ?? 0, 0), n);
  const minWords = exam.config.theory.minWords;
  const [wMin, wMax] = exam.config.theory.wordRange;
  const goto = (i) => { saveDraft((d) => { d.idx = i; }); ctx.rerender(); };
  const titleOf = (st) => (st.kind === 'theory' ? st.q.title : st.t.title);

  const dots = html`<div class="dots" role="tablist" aria-label="Soal">${steps.map((st, i) => {
    const c = dr.checks?.[st.id];
    return html`<button type="button" class="dot ${i === idx ? 'cur' : ''} ${c ? (c.correct ? 'ok' : 'warn') : ''}" data-goto="${i}" role="tab" aria-selected="${String(i === idx)}" aria-label="${titleOf(st)}">${i + 1}</button>`;
  })}<button type="button" class="dot ${idx === n ? 'cur' : ''}" data-goto="${n}" role="tab" aria-selected="${String(idx === n)}" aria-label="Ringkasan dan kumpulkan">✓</button></div>`;

  const head = html`
    <div class="timerbar" id="timerbar" role="timer" aria-live="off"><span>Sisa waktu Tahap 1</span><span class="clock" id="clock">--:--</span></div>
    <div class="page-head">
      <h1>Tahap 1 · ${exam.title}</h1>
      <p>${exam.intro}</p>
      <div class="row"><span class="runner-chip" id="runner-chip"><i></i><span>Penjalan Python: memuat…</span></span><button class="btn btn-sm" id="runner-retry" type="button" hidden>Coba lagi</button></div>
    </div>
    ${dots}`;

  const nav = (i) => html`<div class="row between">
    ${i > 0 ? html`<button class="btn" type="button" data-goto="${i - 1}">← Soal ${i}</button>` : html`<span></span>`}
    <button class="btn btn-primary" type="button" data-goto="${i + 1}">${i + 1 < n ? `Soal ${i + 2} →` : 'Ringkasan →'}</button></div>`;

  let body;
  if (idx < n && steps[idx].kind === 'theory') {
    const { q, id } = steps[idx];
    const c = dr.checks?.[id];
    const text = dr.theory?.[id] ?? '';
    const stale = c && text !== c.text;
    body = html`
      <section class="card task" data-step="${id}">
        <div class="task-head"><div><span class="badge info">Soal ${idx + 1} dari ${n}</span> <span class="badge warn">Teori</span> <h2 style="display:inline">${q.title}</h2> <span class="badge">${q.topic}</span></div><span id="verdict-badge">${verdictBadge(c)}</span></div>
        ${q.prompt.map((p) => html`<p>${p}</p>`)}
        <label class="field"><span>Jawabanmu <span class="hint">(${wMin}–${wMax} kata)</span></span>
          <textarea rows="11" id="theory-text" placeholder="Tulis dengan kata-katamu sendiri.">${text}</textarea></label>
        <div class="small muted" id="theory-wc">${wordCount(text)} kata</div>
        <div class="row" style="margin-top:10px">
          <button class="btn btn-primary" type="button" id="check">✓ Periksa jawaban</button>
          <span class="small muted">Menampilkan poin kunci yang tertangkap. Boleh diulang setelah melengkapi jawaban.</span>
        </div>
        <div id="verdict">${c ? verdictCard(c, stale, q) : ''}</div>
      </section>
      ${nav(idx)}`;
  } else if (idx < n) {
    const { t, id } = steps[idx];
    const c = dr.checks?.[id];
    const stale = c && (dr.code?.[id] ?? t.starter) !== c.code;
    body = html`
      <section class="card task" data-task="${id}">
        <div class="task-head"><div><span class="badge info">Soal ${idx + 1} dari ${n}</span> <span class="badge ok">Praktik</span> <h2 style="display:inline">${t.title}</h2> <span class="badge">${t.topic}</span></div><span id="verdict-badge">${verdictBadge(c)}</span></div>
        ${t.statement.map((p) => html`<p>${p}</p>`)}
        <h3>Contoh</h3>
        ${examplesMarkup(t.visible)}
        <h3 style="margin-top:14px">Kodemu</h3>
        ${workbenchMarkup(id, `Kode · ${t.title}`, { brief: html`<h3>${t.title}</h3>${t.statement.map((p) => html`<p>${p}</p>`)}${examplesMarkup(t.visible)}`, resetLabel: 'Kode awal' })}
        <div class="row" style="margin-top:10px">
          <button class="btn btn-primary" type="button" id="check">✓ Periksa jawaban</button>
          <span class="small muted">Menjalankan semua tes (contoh + tersembunyi). Boleh diulang setelah memperbaiki.</span>
        </div>
        <div id="verdict">${c ? verdictCard(c, stale) : ''}</div>
      </section>
      ${nav(idx)}`;
  } else {
    const ai = dr.ai || {};
    body = html`
      <section class="card">
        <h2>Ringkasan jawabanmu</h2>
        <div class="tablewrap"><table><tbody>${steps.map((st, i) => {
          const c = dr.checks?.[st.id];
          return html`<tr><td><strong>${titleOf(st)}</strong> <span class="badge ${st.kind === 'theory' ? 'warn' : 'ok'}">${st.kind === 'theory' ? 'Teori' : 'Praktik'}</span></td><td>${verdictBadge(c)}</td><td><button class="btn btn-sm" type="button" data-goto="${i}">${c ? 'Buka lagi' : 'Kerjakan'}</button></td></tr>`;
        })}</tbody></table></div>
        <p class="small muted">Nilai Tahap 1 (S1) = ${Math.round(exam.config.s1.practice * 100)}% praktik (tes) + ${Math.round(exam.config.s1.theory * 100)}% teori (poin kunci, boleh ditimpa dosen). Soal yang belum benar tetap boleh dikumpulkan, tetapi kembali dulu bila masih ingin memperbaikinya.</p>
      </section>
      <form id="s1form" novalidate>
        <section class="card">
          <h2>Deklarasi penggunaan AI</h2>
          <p class="small muted">AI boleh dipakai asal dideklarasikan di sini; mengaku memakai AI tidak mengurangi nilai Tahap 1.</p>
          <div class="opts">${exam.aiDeclarationOptions.map((o) => html`
            <label class="opt ${ai.level === o.id ? 'checked' : ''}"><input type="radio" name="ai-level" value="${o.id}" ${ai.level === o.id ? 'checked' : ''}> <span>${o.label}</span></label>`)}</div>
          <div class="grid g2">
            <label class="field"><span>Alat yang dipakai <span class="hint">(opsional)</span></span><input type="text" name="ai-tools" value="${ai.tools || ''}"></label>
            <label class="field"><span>Bagian mana dan bagaimana <span class="hint">(opsional)</span></span><input type="text" name="ai-how" value="${ai.how || ''}"></label>
          </div>
        </section>
        <div id="s1errors"></div>
        <div class="row">
          <button class="btn btn-primary" type="submit">Kumpulkan dan kunci jawaban</button>
          <button class="btn btn-ghost" type="button" data-goto="${n - 1}">← Kembali ke soal</button>
        </div>
        <p class="muted small">Draf tersimpan otomatis di perangkat ini. Setelah dikumpulkan, jawaban dikunci dan tidak bisa diubah.</p>
      </form>`;
  }

  show(root, html`${head}${body}`);

  // Salin dan tempel dimatikan seperti di halaman latihan; jumlah percobaan tempel dicatat (bukan isinya).
  const jagaTempel = { lokasi: 'ujian', saatTempel: () => saveDraft((d) => { d.tempel = (d.tempel || 0) + 1; }) };
  ctx.onLeave(Anticopas.blokirSalinTempel(root, jagaTempel));

  // ---- status penjalan ----
  const chip = $('#runner-chip', root);
  const retry = $('#runner-retry', root);
  const unsub = runner.subscribe(({ ready, failed }) => {
    chip.className = `runner-chip ${ready ? 'ready' : failed ? 'fail' : ''}`;
    chip.lastElementChild.textContent = ready ? 'Penjalan Python: siap' : failed ? `Penjalan gagal: ${failed}` : 'Penjalan Python: memuat (sekali, ±10 MB; berikutnya lebih cepat)…';
    retry.hidden = !failed;
  });
  ctx.onLeave(unsub);
  retry.addEventListener('click', () => runner.retry());

  let flush = () => {};

  // ---- hitung mundur; saat habis, jawaban terkunci otomatis ----
  const bar = $('#timerbar', root);
  const clock = $('#clock', root);
  const tick = () => {
    const left = endsAt - Date.now();
    clock.textContent = mmss(left / 1000);
    bar.classList.toggle('low', left < totalMs * 0.2 && left >= totalMs * 0.07);
    bar.classList.toggle('crit', left < totalMs * 0.07);
    if (left <= 0 && !locking) {
      // Interval tidak dihentikan di sini: bila penguncian gagal (mis. penjalan belum siap), dicoba lagi tiap detik.
      flush();
      lockStage1({ exam, runner, ctx, auto: true }).catch((err) => console.error('Penguncian otomatis gagal:', err));
    }
  };
  const iv = setInterval(tick, 1000);
  ctx.onLeave(() => clearInterval(iv));
  tick();

  $$('[data-goto]', root).forEach((b) => b.addEventListener('click', () => { flush(); goto(Number(b.dataset.goto)); }));

  if (idx < n && steps[idx].kind === 'theory') {
    const { q, id } = steps[idx];
    const ta = $('#theory-text', root);
    flush = () => saveDraft((d) => { (d.theory ||= {})[id] = ta.value; });
    ta.addEventListener('input', () => {
      $('#theory-wc', root).textContent = `${wordCount(ta.value)} kata`;
      debounce(`theory-${id}`, flush);
      const c = draft().checks?.[id];
      if (c) show($('#verdict', root), verdictCard(c, ta.value !== c.text, q));
    });
    $('#check', root).addEventListener('click', () => {
      flush();
      const text = ta.value;
      const r = scoreTheory(text, q, { minWords });
      saveDraft((d) => {
        const prev = d.checks?.[id];
        (d.checks ||= {})[id] = { kind: 'theory', correct: r.score >= 1, score: r.score, count: r.count, need: r.need, matched: r.matched, tooShort: r.tooShort, minWords, text, attempts: (prev?.attempts || 0) + 1 };
      });
      const c = draft().checks[id];
      show($('#verdict', root), verdictCard(c, false, q));
      show($('#verdict-badge', root), verdictBadge(c));
    });
  } else if (idx < n) {
    const { t, id } = steps[idx];
    const editor = mountWorkbench(root, id, {
      runner, tests: t.visible, value: dr.code?.[id] ?? t.starter, resetValue: t.starter,
      onChange: (v) => {
        debounce(`code-${id}`, () => saveDraft((d) => { (d.code ||= {})[id] = v; }));
        const c = draft().checks?.[id];
        if (c) show($('#verdict', root), verdictCard(c, v !== c.code));
      },
    }).editor;
    if (editor.cm) Anticopas.blokirDiCodeMirror(editor.cm, jagaTempel);
    flush = () => saveDraft((d) => { (d.code ||= {})[id] = editor.getValue(); });

    const checkBtn = $('#check', root);
    checkBtn.addEventListener('click', async () => {
      const code = editor.getValue();
      checkBtn.disabled = true;
      checkBtn.textContent = 'Memeriksa…';
      const tests = [...t.visible, ...t.hidden];
      const results = await runTests(code, tests, (c, i) => runner.run(c, i));
      const passed = passCount(results);
      saveDraft((d) => {
        (d.code ||= {})[id] = code;
        const prev = d.checks?.[id];
        (d.checks ||= {})[id] = { kind: 'task', passed, total: tests.length, correct: passed === tests.length, code, attempts: (prev?.attempts || 0) + 1 };
      });
      const c = draft().checks[id];
      show($('#verdict', root), html`${verdictCard(c, false)}${c.correct ? '' : html`<details open style="margin-top:8px"><summary>Selisih pada contoh yang terlihat</summary>${renderResults(results.slice(0, t.visible.length))}</details>`}`);
      show($('#verdict-badge', root), verdictBadge(c));
      checkBtn.disabled = false;
      checkBtn.textContent = '✓ Periksa jawaban';
    });
  } else {
    const form = $('#s1form', root);
    form.addEventListener('input', (e) => {
      const { name, value } = e.target;
      if (name === 'ai-tools') saveDraft((d) => { d.ai.tools = value; });
      else if (name === 'ai-how') saveDraft((d) => { d.ai.how = value; });
    });
    form.addEventListener('change', (e) => {
      if (e.target.name !== 'ai-level') return;
      saveDraft((d) => { d.ai.level = e.target.value; });
      $$('input[name="ai-level"]', form).forEach((r) => r.closest('.opt').classList.toggle('checked', r.checked));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dr2 = draft();
      const { codes, theory } = collect(exam, dr2);
      const problems = [];
      exam.tasks.forEach((t) => { if (!codes[t.id].trim() || codes[t.id].trim() === t.starter.trim()) problems.push(`${t.title}: kode belum ditulis.`); });
      exam.theory.forEach((q) => { if (wordCount(theory[q.id]) < minWords) problems.push(`${q.title}: jawaban minimal ${minWords} kata.`); });
      if (!dr2.ai?.level) problems.push('Pilih salah satu deklarasi penggunaan AI.');
      const box = $('#s1errors', root);
      if (problems.length) {
        show(box, html`<div class="callout bad" role="alert"><strong>Belum lengkap:</strong><ul>${problems.map((p) => html`<li>${p}</li>`)}</ul></div>`);
        box.scrollIntoView({ block: 'center' });
        return;
      }
      show(box, html``);
      if (!(await ask('Kumpulkan dan kunci jawaban Tahap 1? Setelah ini jawaban tidak bisa diubah.', 'Kumpulkan'))) return;

      try { await lockStage1({ exam, runner, ctx, auto: false }); } catch (err) {
        show(box, html`<div class="callout bad" role="alert"><strong>Tidak bisa memeriksa kodemu.</strong> ${err.message} Jawaban belum dikunci; coba lagi setelah penjalan siap.</div>`);
      }
    });
  }
}

const collect = (exam, dr) => ({
  codes: Object.fromEntries(exam.tasks.map((t) => [t.id, ((dr.code?.[t.id] ?? t.starter) || '').trimEnd() + '\n'])),
  theory: Object.fromEntries(exam.theory.map((q) => [q.id, (dr.theory?.[q.id] || '').trim()])),
});

let locking = false;
// Mengunci Tahap 1: snapshot + hash, memeriksa kode (tes + kandidat butir Tahap 2), lalu pindah ke Tahap 2.
// auto = waktu habis: tidak ada validasi atau konfirmasi, dan yang belum diisi dinilai apa adanya.
async function lockStage1({ exam, runner, ctx, auto }) {
  if (locking) return;
  locking = true;
  const dr = draft();
  const { codes, theory } = collect(exam, dr);
  const overlay = document.createElement('div');
  overlay.className = 'uj-overlay';
  overlay.innerHTML = `<div role="status"><div class="spinner"></div><div id="ov-text">${auto ? 'Waktu Tahap 1 habis. ' : ''}Menyiapkan penjalan Python…</div></div>`;
  document.body.append(overlay);
  try {
    let ev;
    try {
      await runner.whenReady();
      ev = await evaluateSubmission({
        tasks: exam.tasks, codes, run: (c, i) => runner.run(c, i),
        onProgress: (t) => { overlay.querySelector('#ov-text').textContent = t; },
      });
    } catch (err) {
      if (!auto) throw err;
      // Waktu sudah habis dan penjalan tidak tersedia: pakai hasil pemeriksaan terakhir di draf, tanpa butir dari kodenya.
      const ratios = Object.fromEntries(exam.tasks.map((t) => { const c = dr.checks?.[t.id]; return [t.id, c ? c.passed / c.total : 0]; }));
      ev = { taskResults: Object.fromEntries(exam.tasks.map((t) => { const c = dr.checks?.[t.id]; return [t.id, { passed: c?.passed ?? 0, total: c?.total ?? t.visible.length + t.hidden.length }]; })), traceCandidates: {}, debugCandidates: {}, changeCandidates: {}, s1Practice: s1Of(ratios), evalFailed: true };
    }
    const snapshot = { code: codes, theory, ai: { level: dr.ai?.level || 'tidak-diisi', tools: dr.ai?.tools || '', how: dr.ai?.how || '' }, submittedAt: new Date().toISOString(), auto, tempelDiblokir: dr.tempel || 0 };
    const hash = await sha256(JSON.stringify(snapshot));
    store.update((s) => { (((s.demo ||= {}).stage1 ||= {})).submitted = { ...snapshot, hash, ...ev }; });
    ctx.rerender();
  } finally {
    overlay.remove();
    locking = false;
  }
}
