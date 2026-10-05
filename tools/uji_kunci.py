#!/usr/bin/env python3
"""Menjalankan kunci jawaban terhadap test case tiap soal.

  kunci/<mata-kuliah>/bab-NN.py   <->   site/data/kuliah/<mata-kuliah>/challenges/bab-NN.json

Folder kunci/ tidak ikut diterbitkan (ada di .gitignore). Alat ini dipakai penulis soal untuk
memastikan setiap expected output benar-benar dihasilkan oleh kunci. Kunci Python (bab-NN.py)
dijalankan dengan python; kunci Java (bab-NN.java, satu berkas dengan kelas Main) dikompilasi
dengan javac lalu dijalankan dengan java. Bahasa lain dilewati.

Jalankan dari akar repositori:  python tools/uji_kunci.py
"""
import json
import shutil
import subprocess
import sys
import tempfile
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
        bahasa = bahasa_matakuliah(cid)
        if bahasa not in ("python", "java"):
            print(f"{cid}: bahasa {bahasa} belum didukung alat ini, dilewati")
            continue
        if bahasa == "java" and not (shutil.which("javac") and shutil.which("java")):
            print(f"{cid}: javac/java tidak ditemukan di PATH, dilewati")
            continue
        for kunci in sorted(dk.glob("bab-*.py" if bahasa == "python" else "bab-*.java")):
            cj = KULIAH / cid / "challenges" / kunci.with_suffix(".json").name
            if not cj.exists():
                print(f"{cid}/{kunci.name}: tidak ada berkas soal {cj.name}, dilewati")
                continue
            tests = json.loads(cj.read_text(encoding="utf8"))["tests"]
            kerja = Path(tempfile.mkdtemp())
            perintah = [sys.executable, str(kunci)]
            if bahasa == "java":
                (kerja / "Main.java").write_text(kunci.read_text(encoding="utf8"), encoding="utf8")
                c = subprocess.run(["javac", "--release", "21", "-d", str(kerja), str(kerja / "Main.java")], capture_output=True, text=True, cwd=str(kerja))
                if c.returncode != 0:
                    gagal += len(tests)
                    diuji += len(tests)
                    print(f"GAGAL {cid}/{kunci.name}: tidak terkompilasi: {c.stderr.strip()}")
                    continue
                perintah = ["java", "-cp", str(kerja), "Main"]
            for i, t in enumerate(tests, 1):
                r = subprocess.run(
                    perintah,
                    input="\n".join(t["input"]) + "\n",
                    capture_output=True,
                    text=True,
                    timeout=20,
                    cwd=str(kerja),
                )
                diuji += 1
                if r.returncode != 0 or norm(r.stdout) != norm(t["expected"]):
                    gagal += 1
                    print(f"GAGAL {cid}/{cj.name} kasus {i}: harapan {t['expected']!r}, kunci menghasilkan {r.stdout.strip()!r} {r.stderr.strip()}")
    print(f"{diuji - gagal} dari {diuji} kasus cocok.")
    sys.exit(1 if gagal else 0)


if __name__ == "__main__":
    main()
