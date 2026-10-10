importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

const CAP = 20000;
let py = null;
let out = [];
let outLen = 0;

function push(s) {
  if (outLen > CAP) return;
  out.push(s);
  outLen += s.length + 1;
  if (outLen > CAP) out.push("... (keluaran dipotong)");
}

const SETUP = `
import builtins
_q = list(_INPUTS)
def _input(prompt=""):
    if not _q:
        raise EOFError("EOF when reading a line")
    v = _q.pop(0)
    if _ECHO:
        print(str(prompt) + v)
    return v
builtins.input = _input
`;

function cleanError(msg) {
  const lines = msg.split("\n");
  const i = lines.findIndex((l) => l.includes('File "<exec>"'));
  if (i < 0) return msg.trim();
  return ["Traceback (most recent call last):"].concat(lines.slice(i)).join("\n").trim();
}

const ready = (async () => {
  py = await loadPyodide();
  py.setStdout({ batched: push });
  py.setStderr({ batched: push });
  postMessage({ type: "ready" });
})();

// Praktikum: proyek berisi beberapa berkas. Berkas ditulis ke sistem berkas virtual Pyodide lalu diuji atau dijalankan oleh
// praktikum_harness.py (berkas yang sama dipakai tools/uji_praktikum.py dengan Python biasa).
const DIR_PROYEK = "/home/pyodide/proyek";
let harness = null;
function muatHarness() {
  if (!harness) {
    harness = (async () => {
      const r = await fetch(new URL("praktikum_harness.py", self.location.href).href, { cache: "no-cache" });
      if (!r.ok) throw new Error("Penguji praktikum tidak bisa dimuat (" + r.status + ").");
      py.runPython(await r.text(), { globals: py.globals });
    })().catch((err) => {
      harness = null;
      throw err;
    });
  }
  return harness;
}
function tulisProyek(berkas) {
  const FS = py.FS;
  try {
    FS.mkdir(DIR_PROYEK);
  } catch (err) {}
  for (const nama of FS.readdir(DIR_PROYEK)) {
    if (nama === "." || nama === "..") continue;
    try {
      FS.unlink(DIR_PROYEK + "/" + nama);
    } catch (err) {}
  }
  for (const [nama, isi] of Object.entries(berkas || {})) {
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}$/.test(nama)) continue; // nama tidak aman dilewati (tidak boleh keluar dari folder proyek)
    FS.writeFile(DIR_PROYEK + "/" + nama, String(isi));
  }
}

onmessage = async (e) => {
  await ready;
  if (e.data && e.data.mode === "proyek") {
    const { id } = e.data;
    postMessage({ type: "started", id });
    try {
      await muatHarness();
      tulisProyek(e.data.berkas);
      const jalan = py.globals.get("praktikum_jalankan");
      const hasil = jalan(JSON.stringify(Object.assign({ dir: DIR_PROYEK }, e.data.perintah)));
      jalan.destroy();
      postMessage({ type: "done", id, stdout: "", error: null, proyek: JSON.parse(hasil) });
    } catch (err) {
      postMessage({ type: "done", id, stdout: "", error: cleanError(String((err && err.message) || err)), proyek: null });
    }
    return;
  }
  const { id, code, inputs, echo } = e.data;
  out = [];
  outLen = 0;
  postMessage({ type: "started", id });
  let error = null;
  let g = null;
  try {
    g = py.globals.get("dict")();
    g.set("__name__", "__main__");
    g.set("_INPUTS", py.toPy(inputs));
    g.set("_ECHO", echo);
    py.runPython(SETUP, { globals: g });
    py.runPython(code, { globals: g });
  } catch (err) {
    error = cleanError(String((err && err.message) || err));
  } finally {
    if (g) g.destroy();
  }
  postMessage({ type: "done", id, stdout: out.join("\n"), error });
};
