// Editor kode ramah ponsel. Memakai CodeMirror 5 bila tersedia (dimuat dari CDN di index.html, sama seperti situs
// latihan-python-usg); bila gagal dimuat, jatuh ke <textarea> biasa dengan perilaku yang sama.
// API: { getValue, setValue, insert(text), focus, undo }
import { getPrefs } from './codetools.js';

export function createEditor(host, { value = '', onChange = () => {}, readOnly = false, minLines = 10 } = {}) {
  if (window.CodeMirror) {
    const cm = window.CodeMirror(host, {
      value, mode: 'python', lineNumbers: true, indentUnit: 4, indentWithTabs: false, smartIndent: true,
      lineWrapping: getPrefs().wrap, viewportMargin: Infinity, readOnly, tabSize: 4,
      autocorrect: false, autocapitalize: false, spellcheck: false,
      extraKeys: { Tab: (c) => c.execCommand('insertSoftTab'), 'Shift-Tab': (c) => c.execCommand('indentLess') },
    });
    cm.on('change', () => onChange(cm.getValue()));
    return {
      getValue: () => cm.getValue(),
      setValue: (v) => { cm.setValue(v); },
      insert: (text) => { cm.replaceSelection(text, 'end'); cm.focus(); },
      focus: () => cm.focus(),
      undo: () => { cm.undo(); cm.focus(); },
      refresh: () => cm.refresh(),
      cm,
    };
  }

  const ta = Object.assign(document.createElement('textarea'), { value, readOnly, className: 'code-fallback' });
  ta.rows = minLines;
  ta.spellcheck = false;
  ta.setAttribute('autocapitalize', 'off');
  ta.setAttribute('autocorrect', 'off');
  ta.setAttribute('autocomplete', 'off');
  ta.wrap = 'off';
  ta.addEventListener('input', () => onChange(ta.value));
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); insertAt('    '); }
    else if (e.key === 'Enter') { // pertahankan indentasi baris sebelumnya, tambah 4 spasi setelah ":"
      const before = ta.value.slice(0, ta.selectionStart);
      const line = before.slice(before.lastIndexOf('\n') + 1);
      const indent = /^ */.exec(line)[0] + (/:\s*$/.test(line) ? '    ' : '');
      e.preventDefault();
      insertAt(`\n${indent}`);
    }
  });
  function insertAt(text) {
    const { selectionStart: s, selectionEnd: en } = ta;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(en);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    onChange(ta.value);
  }
  host.append(ta);
  return {
    getValue: () => ta.value,
    setValue: (v) => { ta.value = v; onChange(v); },
    insert: (t) => { ta.focus(); insertAt(t); },
    focus: () => ta.focus(),
    undo: () => document.execCommand?.('undo'),
    refresh: () => {},
  };
}

// Tombol simbol di atas keyboard ponsel (keyboard bawaan menyembunyikan simbol yang sering dipakai di Python).
export const SYMBOLS = ['    ', ':', '(', ')', '[', ']', '{', '}', '"', "'", '=', '==', '!=', '<', '>', '+', '-', '*', '/', '//', '%', '_', '#', '.', ','];
export const symbolLabel = (s) => (s === '    ' ? '⇥ Tab' : s);
