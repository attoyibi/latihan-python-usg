#!/usr/bin/env python3
"""Membangun site/vendor/javarun.jar dari JavaRun.java (butuh JDK 17 atau lebih baru).

JavaRun mengompilasi dan menjalankan satu berkas Main.java di dalam CheerpJ memakai ECJ
(site/vendor/ecj.jar). Jalankan dari akar repositori:  python tools/java-runner/build.py
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "tools" / "java-runner" / "JavaRun.java"
ECJ = ROOT / "site" / "vendor" / "ecj.jar"
OUT = ROOT / "site" / "vendor" / "javarun.jar"

kerja = Path(tempfile.mkdtemp())
try:
    subprocess.run(["javac", "--release", "17", "-cp", str(ECJ), "-d", str(kerja), str(SRC)], check=True)
    subprocess.run(["jar", "--create", "--file", str(OUT), "--date", "2026-01-01T00:00:00Z", "-C", str(kerja), "."], check=True)
finally:
    shutil.rmtree(kerja, ignore_errors=True)
print(f"Dibuat: {OUT} ({OUT.stat().st_size} bita)")
