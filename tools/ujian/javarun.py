"""Menjalankan program Java satu berkas (kelas Main) dengan masukan baris-baris, meniru penjalan di browser (js/javaworker.js).

Dikompilasi dengan `javac --release 8` (situs memakai ECJ tingkat Java 8) dan dijalankan dengan JDK sungguhan. Bentuk hasil dan
normalisasi sama dengan pyrun.py, jadi buat_ujian.py dan periksa_ujian.py bisa memakai keduanya bergantian.
Kunci butir "tebak keluaran" = keluaran ternormalisasi + baris "[Galat: NamaEksepsi]" bila program berhenti karena eksepsi.
"""
import hashlib
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from pyrun import normalize  # noqa: F401  (diekspor ulang: aturan normalisasi sama)

_KERJA = Path(tempfile.gettempdir()) / "ujian-java-cache"
_SUDAH = {}


def _kompilasi(code: str) -> tuple[Path | None, str]:
    kunci = hashlib.sha256(code.encode("utf8")).hexdigest()[:20]
    if kunci in _SUDAH:
        return _SUDAH[kunci]
    d = _KERJA / kunci
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)
    d.mkdir(parents=True)
    (d / "Main.java").write_text(code, encoding="utf8")
    p = subprocess.run(["javac", "--release", "8", "-Xlint:-options", "-encoding", "UTF-8", "-d", str(d), str(d / "Main.java")],
                       capture_output=True, text=True)
    _SUDAH[kunci] = (d, "") if p.returncode == 0 else (None, p.stderr.strip())
    return _SUDAH[kunci]


def run(code: str, inputs: list[str], timeout: float = 8.0) -> dict:
    d, galat = _kompilasi(code)
    if d is None:
        return {"stdout": "", "error": "CompileError", "detail": galat, "timeout": False}
    try:
        p = subprocess.run(["java", "-Xss8m", "-Dfile.encoding=UTF-8", "-cp", str(d), "Main"],
                           input="\n".join(inputs) + ("\n" if inputs else ""), capture_output=True, text=True,
                           encoding="utf8", timeout=timeout)
    except subprocess.TimeoutExpired:
        return {"stdout": "", "error": "TimeoutError", "timeout": True}
    err = None
    if p.returncode != 0:
        m = re.search(r'Exception in thread "[^"]*" ([\w.$]+)', p.stderr)
        err = m.group(1).split(".")[-1] if m else "Error"
    return {"stdout": p.stdout, "error": err, "stderr": p.stderr, "timeout": False}


def trace_key(res: dict) -> str:
    out = normalize(res["stdout"])
    if res["error"]:
        out = (out + "\n" if out else "") + f"[Galat: {res['error']}]"
    return out
