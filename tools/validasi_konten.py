#!/usr/bin/env python3
"""Memeriksa berkas isi (data/materi.json dan data/challenges/*.json) sebelum diterbitkan.

Jalankan dari akar repositori:  python tools/validasi_konten.py
Keluar dengan kode 1 bila ada kesalahan, sehingga cocok dipakai di CI.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"
errors = []


def err(msg):
    errors.append(msg)


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf8"))
    except Exception as e:  # noqa: BLE001
        err(f"{path.relative_to(ROOT)}: bukan JSON valid ({e})")
        return None


def cek_materi():
    materi = load(DATA / "materi.json")
    if materi is None:
        return set()
    if not isinstance(materi, list) or not materi:
        err("materi.json harus berupa daftar yang tidak kosong")
        return set()
    babs = []
    for i, m in enumerate(materi):
        w = f"materi.json[{i}]"
        for k in ("bab", "judul", "ringkasan", "buku", "video", "jenis"):
            if k not in m:
                err(f"{w}: kolom '{k}' tidak ada")
        if m.get("jenis") not in ("kode", "unggah"):
            err(f"{w}: 'jenis' harus 'kode' atau 'unggah'")
        babs.append(m.get("bab"))
        b = m.get("buku", {})
        if not isinstance(b.get("halaman"), int):
            err(f"{w}: buku.halaman harus angka")
        if not m.get("video"):
            err(f"{w}: minimal satu video")
        for v in m.get("video", []):
            if not re.fullmatch(r"[A-Za-z0-9_-]{11}", v.get("id", "")):
                err(f"{w}: id video YouTube tidak valid: {v.get('id')!r}")
            if v.get("sumber") not in ("playlist", "lain"):
                err(f"{w}: video.sumber harus 'playlist' atau 'lain'")
    if babs != list(range(1, len(babs) + 1)):
        err(f"nomor bab harus berurutan 1..N, ditemukan {babs}")
    return {m["bab"] for m in materi if m.get("challenge")}


def cek_challenge(bab):
    path = DATA / "challenges" / f"bab-{bab:02d}.json"
    if not path.exists():
        err(f"bab {bab} bertanda challenge tetapi {path.name} tidak ada")
        return
    ch = load(path)
    if ch is None:
        return
    w = path.name
    if ch.get("bab") != bab:
        err(f"{w}: kolom 'bab' harus {bab}")
    for k in ("judul", "soal", "starter", "petunjuk", "tests"):
        if k not in ch:
            err(f"{w}: kolom '{k}' tidak ada")
    tests = ch.get("tests", [])
    if len(tests) < 3:
        err(f"{w}: minimal 3 test case (ada {len(tests)})")
    if not any(t.get("hidden") for t in tests):
        err(f"{w}: sebaiknya ada test case tersembunyi")
    for i, t in enumerate(tests):
        if not isinstance(t.get("input"), list) or not all(isinstance(x, str) for x in t["input"]):
            err(f"{w}: tests[{i}].input harus daftar string")
        if not isinstance(t.get("expected"), str) or not t["expected"].strip():
            err(f"{w}: tests[{i}].expected harus string tidak kosong")
    jenis = [p.get("jenis") for p in ch.get("petunjuk", [])]
    if jenis != ["teks", "buku", "video"]:
        err(f"{w}: petunjuk harus berurutan teks, buku, video (ada {jenis})")


def main():
    for bab in sorted(cek_materi()):
        cek_challenge(bab)
    if errors:
        print("Ditemukan masalah pada isi:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("Isi valid.")


if __name__ == "__main__":
    main()
