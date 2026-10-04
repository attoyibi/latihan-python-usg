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

onmessage = async (e) => {
  await ready;
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
