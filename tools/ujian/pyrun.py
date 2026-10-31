"""Menjalankan program Python dengan masukan baris-baris, meniru penjalan di browser (js/pyworker.js).

Keluaran dinormalisasi seperti js/grader.js: spasi di ujung baris dan baris kosong di ujung dibuang.
Kunci butir "tebak keluaran" = keluaran ternormalisasi, ditambah baris "[Galat: NamaGalat]" bila program berhenti karena galat.
"""
import re
import subprocess
import sys


def normalize(s: str) -> str:
    lines = [ln.rstrip() for ln in s.replace("\r", "").split("\n")]
    return "\n".join(lines).rstrip("\n")


def run(code: str, inputs: list[str], timeout: float = 5.0) -> dict:
    try:
        p = subprocess.run(
            [sys.executable, "-I", "-c", code],
            input="\n".join(inputs) + ("\n" if inputs else ""),
            capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return {"stdout": "", "error": "TimeoutError", "timeout": True}
    err = None
    if p.returncode != 0:
        last = [ln for ln in p.stderr.strip().split("\n") if ln.strip()][-1]
        err = re.match(r"([A-Za-z_][A-Za-z0-9_]*)", last).group(1)
    return {"stdout": p.stdout, "error": err, "timeout": False}


def trace_key(res: dict) -> str:
    out = normalize(res["stdout"])
    if res["error"]:
        out = (out + "\n" if out else "") + f"[Galat: {res['error']}]"
    return out
