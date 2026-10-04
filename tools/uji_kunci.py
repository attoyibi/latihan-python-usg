#!/usr/bin/env python3
"""Menjalankan kunci jawaban terhadap test case tiap soal.

  kunci/<mata-kuliah>/bab-NN.py   <->   site/data/kuliah/<mata-kuliah>/challenges/bab-NN.json

Folder kunci/ tidak ikut diterbitkan (ada di .gitignore). Alat ini dipakai penulis soal untuk
memastikan setiap expected output benar-benar dihasilkan oleh kunci. Saat ini hanya kunci
Python yang bisa dijalankan; kunci bahasa lain dilewati.

Jalankan dari akar repositori:  python tools/uji_kunci.py
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KULIAH = ROOT / "site" / "data" / "kuliah"
KUNCI = ROOT / "kunci"


def norm(s):
    return "\n".join(line.rstrip() for line in s.replace("\r", "").split("\n")).rstrip("\n")


def bahasa_matakuliah(cid):
    try:
        daftar = json.loads((ROOT / "site" / "data" / "matakuliah.json").read_text(encoding="utf8"))
        return next((c.get("bahasa") for c in daftar if c["id"] == cid), None)
    except Exception:  # noqa: BLE001
        return None


def main():
    if not KUNCI.exists():
        print("Folder kunci/ tidak ada; tidak ada yang diuji.")
        return
    gagal = 0
    diuji = 0
    for dk in sorted(p for p in KUNCI.iterdir() if p.is_dir()):
        cid = dk.name
        if bahasa_matakuliah(cid) != "python":
            print(f"{cid}: bahasa bukan Python, dilewati")
            continue
        for kunci in sorted(dk.glob("bab-*.py")):
            cj = KULIAH / cid / "challenges" / kunci.with_suffix(".json").name
            if not cj.exists():
                print(f"{cid}/{kunci.name}: tidak ada berkas soal {cj.name}, dilewati")
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
                    print(f"GAGAL {cid}/{cj.name} kasus {i}: harapan {t['expected']!r}, kunci menghasilkan {r.stdout.strip()!r} {r.stderr.strip()}")
    print(f"{diuji - gagal} dari {diuji} kasus cocok.")
    sys.exit(1 if gagal else 0)


if __name__ == "__main__":
    main()
