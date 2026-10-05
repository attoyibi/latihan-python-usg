#!/usr/bin/env python3
"""Memeriksa berkas isi sebelum diterbitkan:
  site/data/matakuliah.json                       daftar mata kuliah
  site/data/kuliah/<id>/materi.json               daftar bab per mata kuliah
  site/data/kuliah/<id>/challenges/bab-NN.json    soal per bab

Jalankan dari akar repositori:  python tools/validasi_konten.py
Keluar dengan kode 1 bila ada kesalahan, sehingga cocok dipakai di CI.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"
KULIAH = DATA / "kuliah"
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
errors = []


def err(msg):
    errors.append(msg)


def rel(path):
    return str(path.relative_to(ROOT)).replace("\\", "/")


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf8"))
    except FileNotFoundError:
        err(f"{rel(path)}: berkas tidak ada")
    except Exception as e:  # noqa: BLE001
        err(f"{rel(path)}: bukan JSON valid ({e})")
    return None


def cek_daftar_matakuliah():
    daftar = load(DATA / "matakuliah.json")
    if daftar is None:
        return []
    if not isinstance(daftar, list) or not daftar:
        err("matakuliah.json harus berupa daftar yang tidak kosong")
        return []
    ids = set()
    ok = []
    for i, c in enumerate(daftar):
        w = f"matakuliah.json[{i}]"
        cid = c.get("id", "")
        if not isinstance(cid, str) or not ID_RE.match(cid) or len(cid) > 60:
            err(f"{w}: id harus huruf kecil, angka, dan strip (mis. 'pbo-java'), maksimal 60 karakter (ada {cid!r})")
            continue
        if cid in ids:
            err(f"{w}: id ganda: {cid}")
        ids.add(cid)
        w = f"matakuliah.json[{cid}]"
        nama = c.get("nama")
        if not isinstance(nama, str) or not (2 <= len(nama) <= 120):
            err(f"{w}: nama harus 2 sampai 120 karakter")
        d = c.get("deskripsi")
        if d is not None and (not isinstance(d, str) or len(d) > 600):
            err(f"{w}: deskripsi maksimal 600 karakter")
        if c.get("jenis") not in ("kode", "teks", "campuran"):
            err(f"{w}: jenis harus 'kode', 'teks', atau 'campuran'")
        b = c.get("bahasa")
        if b is not None and (not isinstance(b, str) or not (1 <= len(b) <= 30)):
            err(f"{w}: bahasa harus teks 1 sampai 30 karakter, atau null")
        if c.get("jenis") in ("kode", "campuran") and not b:
            err(f"{w}: jenis '{c.get('jenis')}' memerlukan bahasa")
        if not isinstance(c.get("aktif"), bool):
            err(f"{w}: aktif harus true atau false")
        if not isinstance(c.get("urutan"), int):
            err(f"{w}: urutan harus angka bulat")
        ok.append(c)
    if KULIAH.exists():
        for d in sorted(p for p in KULIAH.iterdir() if p.is_dir()):
            if d.name not in ids:
                err(f"folder {rel(d)} tidak ada di matakuliah.json")
    return ok


def cek_materi(c):
    cid = c["id"]
    materi = load(KULIAH / cid / "materi.json")
    if materi is None:
        return
    pre = f"kuliah/{cid}/materi.json"
    if not isinstance(materi, list):
        err(f"{pre}: harus berupa daftar")
        return
    if c.get("aktif") and not materi:
        err(f"{pre}: mata kuliah aktif harus punya minimal satu bab (atau set aktif ke false)")
    babs = []
    for i, m in enumerate(materi):
        w = f"{pre}[{i}]"
        for k in ("bab", "judul", "ringkasan", "video", "jenis"):
            if k not in m:
                err(f"{w}: kolom '{k}' tidak ada")
        if m.get("jenis") not in ("kode", "unggah"):
            err(f"{w}: 'jenis' harus 'kode' atau 'unggah'")
        if m.get("jenis") == "kode" and not c.get("bahasa"):
            err(f"{w}: bab berjenis kode, tetapi mata kuliah tidak punya bahasa")
        babs.append(m.get("bab"))
        b = m.get("buku")
        if b is not None and "halaman" in b and not isinstance(b["halaman"], int):
            err(f"{w}: buku.halaman harus angka")
        if not m.get("video") and m.get("jenis") != "unggah":
            err(f"{w}: minimal satu video (bab berjenis unggah boleh tanpa video)")
        for v in m.get("video", []):
            if not re.fullmatch(r"[A-Za-z0-9_-]{11}", v.get("id", "")):
                err(f"{w}: id video YouTube tidak valid: {v.get('id')!r}")
            if v.get("sumber") not in ("playlist", "lain"):
                err(f"{w}: video.sumber harus 'playlist' atau 'lain'")
    if babs and babs != list(range(1, len(babs) + 1)):
        err(f"{pre}: nomor bab harus berurutan 1..N, ditemukan {babs}")
    for m in materi:
        if m.get("challenge"):
            cek_challenge(cid, m["bab"])


def cek_challenge(cid, bab):
    path = KULIAH / cid / "challenges" / f"bab-{bab:02d}.json"
    if not path.exists():
        err(f"kuliah/{cid}: bab {bab} bertanda challenge tetapi {path.name} tidak ada")
        return
    ch = load(path)
    if ch is None:
        return
    w = f"kuliah/{cid}/challenges/{path.name}"
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
    ruj = ch.get("rujukan")
    if not isinstance(ruj, list) or not ruj or not all(isinstance(x, str) and x.strip() for x in ruj):
        err(f"{w}: 'rujukan' (catatan tempat belajar) wajib berupa daftar teks tidak kosong")


def main():
    for c in cek_daftar_matakuliah():
        cek_materi(c)
    if errors:
        print("Ditemukan masalah pada isi:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("Isi valid.")


if __name__ == "__main__":
    main()
