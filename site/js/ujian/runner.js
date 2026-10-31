// Pembungkus penjalan Python situs (js/runner.js) dengan bentuk yang dipakai layar ujian:
// { status, subscribe, start, retry, whenReady, run(code, inputs) -> { stdout, error, timeout } }.
// Satu worker Pyodide dipakai bersama dengan halaman bab, jadi tidak ada unduhan kedua.
import { start, run, onReadyChange, pythonSiap, pythonGagal, ulangiPython } from '../runner.js';

const status = () => {
  const failed = pythonGagal();
  return { ready: pythonSiap(), failed: failed ? (failed.pesan || String(failed)) : null };
};

const runner = {
  status,
  subscribe(cb) {
    const off = onReadyChange(() => cb(status()));
    cb(status());
    return typeof off === 'function' ? off : () => {};
  },
  start: () => start(),
  retry: () => ulangiPython(),
  whenReady() {
    start();
    const s = status();
    if (s.ready) return Promise.resolve();
    if (s.failed) return Promise.reject(new Error(s.failed));
    return new Promise((resolve, reject) => {
      let off = () => {};
      off = runner.subscribe((x) => {
        if (x.ready) { queueMicrotask(() => off()); resolve(); } else if (x.failed) { queueMicrotask(() => off()); reject(new Error(x.failed)); }
      });
    });
  },
  // Tanpa gema prompt: keluaran harus sama persis dengan cara tes menilai (seperti tombol Kirim di latihan).
  run: async (code, inputs = []) => {
    const r = await run(code, inputs, false, 'python');
    return { stdout: r.stdout || '', error: r.error || null, timeout: !!r.timeout };
  },
};

export const getRunner = () => runner;
