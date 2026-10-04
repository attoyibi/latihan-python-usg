#!/usr/bin/env python3
"""Menjalankan kunci jawaban (kunci/bab-NN.py) terhadap test case di data/challenges/bab-NN.json.

Folder kunci/ tidak ikut diterbitkan (ada di .gitignore). Alat ini dipakai penulis
soal untuk memastikan setiap expected output benar-benar dihasilkan oleh kunci.

Jalankan dari akar repositori:  python tools/uji_kunci.py
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data" / "challenges"
KUNCI = ROOT / "kunci"


def norm(s):
    return "\n".join(line.rstrip() for line in s.replace("\r", "").split("\n")).rstrip("\n")


def main():
    if not KUNCI.exists():
        print("Folder kunci/ tidak ada; tidak ada yang diuji.")
        return
    gagal = 0
    diuji = 0
    for cj in sorted(DATA.glob("bab-*.json")):
        kunci = KUNCI / cj.with_suffix(".py").name
        if not kunci.exists():
            print(f"{cj.name}: tidak ada kunci, dilewati")
            continue
        tests = json.loads(cj.read_text(encoding="utf8"))["tests"]
        for i, t in enumerate(tests, 1):
            r = subprocess.run(
                [sys.executable, str(kunci)],
                input="\n".join(t["input"]) + "\n",
                capture_output=True,
                text=True,
                timeout=10,
            )
            diuji += 1
            if r.returncode != 0 or norm(r.stdout) != norm(t["expected"]):
                gagal += 1
                print(f"GAGAL {cj.name} kasus {i}: harapan {t['expected']!r}, kunci menghasilkan {r.stdout.strip()!r} {r.stderr.strip()}")
    print(f"{diuji - gagal} dari {diuji} kasus cocok.")
    sys.exit(1 if gagal else 0)


if __name__ == "__main__":
    main()
