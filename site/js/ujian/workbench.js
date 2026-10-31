// Blok kerja koding bersama (Tahap 1 dan Tahap 2): editor, tombol simbol, jalankan contoh, coba masukan sendiri, hasil tes.
// Markup: workbenchMarkup(id, title, opts). Perilaku: mountWorkbench(root, id, opts).
import { createEditor, SYMBOLS, symbolLabel } from './editor.js';
import { codeBar } from './codetools.js';
import { runTests, passCount } from './logic/tests.js';
import { html, show, $, $$, ask } from './ui.js';

const statusBadge = { pass: ['ok', '✓ lulus'], fail: ['bad', '✗ salah'], error: ['bad', '✗ galat'], timeout: ['bad', '✗ terlalu lama'], skipped: ['', 'dilewati'] };

export function renderResults(results) {
  const pass = passCount(results);
  return html`
    <div class="callout ${pass === results.length ? 'ok' : 'warn'}" role="status">
      <strong>${pass} dari ${results.length} contoh lulus.</strong> ${pass === results.length ? 'Tes tersembunyi diperiksa lewat tombol Periksa jawaban.' : 'Buka yang ✗ untuk melihat selisihnya.'}
    </div>
    <div class="tests">${results.map((r, i) => {
      const [cls, label] = statusBadge[r.status];
      return html`<details ${r.status === 'pass' ? '' : 'open'}><summary><span class="badge ${cls}">${label}</span> Contoh ${i + 1}</summary>
        <div class="stack" style="margin-top:8px">
          <div><div class="small muted">Masukan</div><pre class="block">${r.test.input.join('\n')}</pre></div>
          <div><div class="small muted">Keluaran yang diharapkan</div><pre class="block good">${r.test.expected}</pre></div>
          <div><div class="small muted">Keluaran programmu</div><pre class="block ${r.status === 'pass' ? '' : 'bad'}">${r.status === 'timeout' ? 'Program berjalan lebih dari 5 detik (kemungkinan perulangan tanpa henti).' : r.error || r.actual || '(tidak ada keluaran)'}</pre></div>
        </div></details>`;
    })}</div>`;
}

export const examplesMarkup = (tests) => html`${tests.map((v, k) => html`<div class="example"><div><h4>Masukan ${k + 1}</h4><pre class="block">${v.input.join('\n')}</pre></div><div><h4>Keluaran</h4><pre class="block">${v.expected}</pre></div></div>`)}`;

// brief: html yang tampil di panel "Soal" saat layar penuh. runLabel: teks tombol jalankan.
export function workbenchMarkup(id, title, { brief = '', runLabel = '▶ Jalankan contoh', resetLabel = 'Kode awal' } = {}) {
  return html`
  <div class="workbench" data-wb="${id}">
    ${codeBar(title, { brief: !!brief })}
    <div class="wb-main">
      <div class="codebox" data-editor></div>
      <div class="symbols" aria-label="Simbol cepat">${SYMBOLS.map((s) => html`<button type="button" data-sym="${s}" aria-label="${s === '    ' ? 'Tab' : s}">${symbolLabel(s)}</button>`)}</div>
      <div class="row">
        <button class="btn btn-primary" type="button" data-act="run" title="Ctrl+Enter">${runLabel}</button>
        <button class="btn" type="button" data-act="undo">↶ Urungkan</button>
        <button class="btn btn-ghost" type="button" data-act="reset">${resetLabel}</button>
      </div>
    </div>
    <div class="wb-side">
      ${brief ? html`<div class="wb-brief">${brief}</div>` : ''}
      <div data-results></div>
      <details style="margin-top:10px"><summary>Coba dengan masukanmu sendiri</summary>
        <label class="field" style="margin-top:8px"><span>Masukan <span class="hint">(satu baris untuk tiap input())</span></span><textarea rows="3" data-custom></textarea></label>
        <div class="row" style="margin:8px 0"><button class="btn" type="button" data-act="run-custom">Jalankan</button></div>
        <div data-custom-out></div>
      </details>
    </div>
  </div>`;
}

// opts: { runner, tests (contoh yang dijalankan tombol ▶), value, resetValue, runLabel, onChange(v), onRun(results) }
export function mountWorkbench(root, id, { runner, tests, value, resetValue, runLabel = '▶ Jalankan contoh', onChange = () => {}, onRun = () => {} }) {
  const wb = $(`[data-wb="${id}"]`, root);
  const editor = createEditor($('[data-editor]', wb), { value, onChange });
  editor.refresh?.();

  $$('[data-sym]', wb).forEach((b) => {
    b.addEventListener('mousedown', (e) => e.preventDefault()); // jangan mencuri fokus dari editor (penting di ponsel)
    b.addEventListener('click', () => editor.insert(b.dataset.sym));
  });
  $('[data-act="undo"]', wb).addEventListener('click', () => editor.undo());
  $('[data-act="reset"]', wb).addEventListener('click', async () => {
    if (await ask('Kembalikan kode awal? Perubahanmu di soal ini akan terhapus.', 'Kembalikan')) editor.setValue(resetValue);
  });

  const runBtn = $('[data-act="run"]', wb);
  runBtn.addEventListener('click', async () => {
    const out = $('[data-results]', wb);
    runBtn.disabled = true;
    runBtn.textContent = 'Menjalankan…';
    show(out, html`<p class="muted small" role="status">Menjalankan ${tests.length} contoh…</p>`);
    const results = await runTests(editor.getValue(), tests, (c, input) => runner.run(c, input));
    show(out, renderResults(results));
    runBtn.disabled = false;
    runBtn.textContent = runLabel;
    onRun(results);
  });

  const customBtn = $('[data-act="run-custom"]', wb);
  customBtn.addEventListener('click', async () => {
    const out = $('[data-custom-out]', wb);
    customBtn.disabled = true;
    const r = await runner.run(editor.getValue(), $('[data-custom]', wb).value.split('\n'));
    show(out, html`<div class="small muted">Keluaran</div><pre class="block ${r.error || r.timeout ? 'bad' : ''}">${r.timeout ? 'Program berjalan lebih dari 5 detik.' : r.error || r.stdout || '(tidak ada keluaran)'}</pre>${r.error && r.stdout ? html`<div class="small muted" style="margin-top:6px">Keluaran sebelum galat</div><pre class="block">${r.stdout}</pre>` : ''}`);
    customBtn.disabled = false;
  });

  return { editor, wb };
}
