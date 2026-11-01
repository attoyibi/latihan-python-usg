// Pembungkus penjalan situs dengan bentuk yang dipakai layar ujian:
// { status, subscribe, start, retry, whenReady, run(code, inputs) -> { stdout, error, timeout } }.
// Python memakai js/runner.js, Java memakai js/javarunner.js (CheerpJ + ECJ); pilihannya mengikuti bahasa mata kuliah
// (bahasa.js). Satu worker dipakai bersama dengan halaman bab, jadi tidak ada unduhan kedua.
import { start, run, onReadyChange, pythonSiap, pythonGagal, ulangiPython } from '../runner.js';
import { startJava, runJava, onJavaReadyChange, javaSiap, javaGagal, ulangiJava } from '../javarunner.js';
import { bahasa } from './bahasa.js';

// d = { siap(), gagal(), langgan(cb), mulai(), ulangi(), jalankan(code, inputs) }
function buat(d) {
  const status = () => {
    const failed = d.gagal();
    return { ready: d.siap(), failed: failed ? (failed.pesan || String(failed)) : null };
  };
  const runner = {
    status,
    subscribe(cb) {
      const off = d.langgan(() => cb(status()));
      cb(status());
      return typeof off === 'function' ? off : () => {};
    },
    start: () => d.mulai(),
    retry: () => d.ulangi(),
    whenReady() {
      d.mulai();
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
    run: async (code, inputs = []) => {
      const r = await d.jalankan(code, inputs);
      return { stdout: r.stdout || '', error: r.error || null, timeout: !!r.timeout };
    },
  };
  return runner;
}

const PYTHON = buat({
  siap: pythonSiap, gagal: pythonGagal, langgan: onReadyChange, mulai: start, ulangi: ulangiPython,
  // Tanpa gema prompt: keluaran harus sama persis dengan cara tes menilai (seperti tombol Kirim di latihan).
  jalankan: (code, inputs) => run(code, inputs, false, 'python'),
});

const JAVA = buat({ siap: javaSiap, gagal: javaGagal, langgan: onJavaReadyChange, mulai: startJava, ulangi: ulangiJava, jalankan: runJava });

export const getRunner = () => (bahasa().id === 'java' ? JAVA : PYTHON);
