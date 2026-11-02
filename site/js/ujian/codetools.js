// Alat tampilan kode ala VS Code, dipakai semua tempat yang menampilkan kode (editor dan pembaca):
//  - perbesar/perkecil huruf (tombol A−/A+, Ctrl +/−/0, Ctrl+roda mouse), diingat per perangkat
//  - bungkus baris panjang (berguna di HP)
//  - layar penuh (Esc menutup; Ctrl+Shift+F membuka/menutup; Ctrl+Enter menjalankan contoh)
// Markup memakai atribut data-ct pada tombol di dalam .workbench (editor) atau .cvw (pembaca kode).
import { html } from './ui.js';

const KEY = 'ujian:kodeprefs';
export const FONT_MIN = 11;
export const FONT_MAX = 32;

export const clampFont = (n, fallback = 15) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(FONT_MAX, Math.max(FONT_MIN, v)) : fallback;
};

// Layar sempit memakai 16 px supaya keyboard HP tidak memicu zoom otomatis.
const defaultFont = () => (typeof matchMedia === 'function' && matchMedia('(max-width: 860px)').matches ? 16 : 15);

export function parsePrefs(raw, fallbackFont = 15) {
  try {
    const p = JSON.parse(raw) || {};
    return { fs: clampFont(p.fs, fallbackFont), wrap: !!p.wrap };
  } catch {
    return { fs: fallbackFont, wrap: false };
  }
}

let prefs = { fs: 15, wrap: false };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* tanpa penyimpanan */ } };
export const getPrefs = () => ({ ...prefs });

export function refreshEditors() {
  document.querySelectorAll('.CodeMirror').forEach((el) => {
    const cm = el.CodeMirror;
    if (!cm) return;
    cm.setOption('lineWrapping', prefs.wrap);
    cm.refresh();
  });
}

function applyPrefs() {
  const root = document.documentElement;
  root.style.setProperty('--code-fs', `${prefs.fs}px`);
  root.toggleAttribute('data-wrap', prefs.wrap);
  document.querySelectorAll('[data-fs-label]').forEach((el) => { el.textContent = prefs.fs; });
  document.querySelectorAll('[data-ct="wrap"]').forEach((b) => b.setAttribute('aria-pressed', String(prefs.wrap)));
  refreshEditors();
}

const setFont = (px) => { prefs.fs = clampFont(px, prefs.fs); save(); applyPrefs(); };
const zoom = (d) => setFont(prefs.fs + d);

// Kunci scroll halaman selama ada panel layar penuh yang terbuka.
export function syncScrollLock() {
  document.body.classList.toggle('noscroll', !!document.querySelector('.workbench.fs, .cvw.fs'));
}

function toggleFs(el, force) {
  const on = force ?? !el.classList.contains('fs');
  el.classList.toggle('fs', on);
  el.querySelector('[data-ct="expand"]')?.setAttribute('aria-pressed', String(on));
  syncScrollLock();
  requestAnimationFrame(() => {
    refreshEditors();
    if (on) el.querySelector('.CodeMirror')?.CodeMirror?.focus();
  });
}

let started = false;
export function initCodeTools() {
  if (started) return;
  started = true;
  try { prefs = parsePrefs(localStorage.getItem(KEY), defaultFont()); } catch { prefs = parsePrefs(null, defaultFont()); }
  applyPrefs();

  // Tombol tidak boleh mencuri fokus dari editor (keyboard HP tetap terbuka).
  document.addEventListener('mousedown', (e) => { if (e.target.closest('[data-ct]')) e.preventDefault(); });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ct]');
    if (!b) return;
    const host = b.closest('.workbench, .cvw');
    switch (b.dataset.ct) {
      case 'font-up': zoom(1); break;
      case 'font-down': zoom(-1); break;
      case 'font-reset': setFont(defaultFont()); break;
      case 'wrap': prefs.wrap = !prefs.wrap; save(); applyPrefs(); break;
      case 'expand': if (host) toggleFs(host); break;
      case 'brief': if (host) b.setAttribute('aria-pressed', String(host.classList.toggle('brief-open'))); break;
      default:
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.workbench.fs, .cvw.fs');
      if (open) { e.preventDefault(); toggleFs(open, false); }
      return;
    }
    const host = e.target.closest?.('.workbench, .cvw');
    if (!host || !(e.ctrlKey || e.metaKey)) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(1); }
    else if (e.key === '-') { e.preventDefault(); zoom(-1); }
    else if (e.key === '0') { e.preventDefault(); setFont(defaultFont()); }
    else if (e.key === 'Enter') { host.querySelector('[data-act="run"]')?.click(); e.preventDefault(); }
    else if (e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); toggleFs(host); }
  });

  document.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey) || !e.target.closest?.('.workbench, .cvw')) return;
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
}

// Baris alat di atas editor/pembaca. brief: tombol "Soal" (hanya bermakna di layar penuh pada editor tugas).
export function codeBar(title, { brief = false } = {}) {
  const p = getPrefs();
  return html`<div class="cbar"><span class="cbar-title">${title}</span>
    <span class="cbar-btns" role="toolbar" aria-label="Tampilan kode">
      ${brief ? html`<button type="button" class="when-fs-only" data-ct="brief" aria-pressed="false" title="Tampilkan soal">📄<span class="lbl"> Soal</span></button>` : ''}
      <button type="button" data-ct="font-down" aria-label="Perkecil huruf" title="Perkecil huruf (Ctrl −)">A−</button>
      <button type="button" data-ct="font-reset" aria-label="Ukuran huruf; tekan untuk mengembalikan" title="Ukuran huruf (px). Tekan untuk atur ulang"><span data-fs-label>${p.fs}</span></button>
      <button type="button" data-ct="font-up" aria-label="Perbesar huruf" title="Perbesar huruf (Ctrl +)">A+</button>
      <button type="button" data-ct="wrap" aria-pressed="${String(p.wrap)}" title="Bungkus baris panjang">↩<span class="lbl"> Bungkus</span></button>
      <button type="button" data-ct="expand" aria-pressed="false" title="Layar penuh (Esc menutup)"><span class="when-normal">⛶ Layar penuh</span><span class="when-fs">✕ Tutup</span></button>
    </span></div>`;
}

// Pembaca kode hanya-baca dengan alat yang sama.
export function codeViewer(code, title = 'Kode') {
  return html`<div class="cvw">${codeBar(title)}<pre class="block codeview">${code}</pre></div>`;
}
