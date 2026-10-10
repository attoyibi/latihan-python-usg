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
        if m.get("jenis") not in ("kode", "konsep", "unggah"):
            err(f"{w}: 'jenis' harus 'kode', 'konsep', atau 'unggah'")
        if m.get("jenis") == "kode" and not c.get("bahasa"):
            err(f"{w}: bab berjenis kode, tetapi mata kuliah tidak punya bahasa")
        babs.append(m.get("bab"))
        b = m.get("buku")
        if b is not None and "halaman" in b and not isinstance(b["halaman"], int):
            err(f"{w}: buku.halaman harus angka")
        if not m.get("video") and m.get("jenis") == "kode":
            err(f"{w}: minimal satu video (bab berjenis konsep atau unggah boleh tanpa video)")
        if "pertanyaanKonsep" in m and (not isinstance(m["pertanyaanKonsep"], str) or len(m["pertanyaanKonsep"].strip()) < 20):
            err(f"{w}: pertanyaanKonsep harus teks (pertanyaan untuk kolom konsep laporan)")
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
    cek_praktik(c, materi)


NAMA_BERKAS_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}\.py$")
NAMA_JAVA_RE = re.compile(r"^Main\.java$")  # praktik Java: satu berkas Main.java (kelas bantu boleh di dalamnya, kelas publiknya Main)


def cek_praktik(c, materi):
    """Praktik per bab bersifat opsional: tanpa folder praktik/ dan tanda "praktik": true tidak ada yang diperiksa."""
    cid = c["id"]
    folder = KULIAH / cid / "praktik"
    bendera = c.get("praktik") is True
    if folder.exists() and not bendera:
        err(f'matakuliah.json[{cid}]: ada folder praktik/, tambahkan "praktik": true agar situs memuatnya')
    if bendera and not folder.exists():
        err(f'matakuliah.json[{cid}]: "praktik": true, tetapi folder kuliah/{cid}/praktik/ tidak ada')
    if not folder.exists():
        return
    pre = f"kuliah/{cid}/praktik"
    if c.get("bahasa") not in ("python", "java"):
        err(f"{pre}: praktik hanya didukung untuk mata kuliah berbahasa python atau java")
    babs_kode = {m.get("bab") for m in materi if m.get("jenis") == "kode"}
    indeks = load(folder / "index.json")
    daftar = []
    if indeks is not None:
        daftar = indeks.get("bab") if isinstance(indeks, dict) else None
        if not isinstance(daftar, list) or not daftar or not all(isinstance(b, int) for b in daftar):
            err(f'{pre}/index.json: harus berbentuk {{"bab": [nomor, ...]}} berisi minimal satu nomor bab')
            daftar = []
    ada = sorted(int(f.name[4:6]) for f in folder.glob("bab-[0-9][0-9].json"))
    if daftar and sorted(daftar) != ada:
        err(f"{pre}/index.json: daftar bab {sorted(daftar)} tidak sama dengan berkas bab-NN.json yang ada {ada}")
    for b in ada:
        w = f"{pre}/bab-{b:02d}.json"
        pk = load(folder / f"bab-{b:02d}.json")
        if pk is not None:
            cek_satu_praktik(b, pk, babs_kode, w, c.get("bahasa"))


def cek_satu_praktik(bab, pk, babs_kode, w, bahasa="python"):
    if pk.get("bab") != bab:
        err(f"{w}: kolom bab ({pk.get('bab')!r}) harus sama dengan nomor pada nama berkas ({bab})")
    if bab not in babs_kode:
        err(f"{w}: bab {bab} tidak ada di materi.json atau bukan bab berjenis kode")
    for k in ("judul", "tujuan", "langkah", "berkas", "awal", "petunjuk", "kasus"):
        if not pk.get(k):
            err(f"{w}: kolom '{k}' tidak ada atau kosong")
    if "contoh" in pk:
        err(f"{w}: contoh jawaban tidak boleh ada di situs (publik); simpan di kunci/<mata kuliah>/praktik-{bab:02d}.{'java' if bahasa == 'java' else 'py'}")
    pola = NAMA_JAVA_RE if bahasa == "java" else NAMA_BERKAS_RE
    if not isinstance(pk.get("berkas"), str) or not pola.fullmatch(pk.get("berkas", "")):
        err(f"{w}: 'berkas' harus " + ("Main.java" if bahasa == "java" else "nama berkas .py yang sah (huruf, angka, titik, strip, garis bawah)"))
    if not isinstance(pk.get("awal"), str) or "____" not in pk.get("awal", "") or len(pk.get("awal", "")) > 8000:
        err(f"{w}: 'awal' harus kerangka kode (teks, maksimal 8000 karakter) yang memuat tanda ____")
    if not isinstance(pk.get("masukanContoh", ""), str):
        err(f"{w}: 'masukanContoh' harus teks")
    if not isinstance(pk.get("langkah"), list) or not all(isinstance(l, str) and l.strip() for l in pk.get("langkah", [])):
        err(f"{w}: 'langkah' harus daftar teks tidak kosong")
    pj = pk.get("petunjuk") or []
    if len(pj) < 2 or any(p.get("jenis") not in ("soal", "buku", "video") or not p.get("isi") for p in pj):
        err(f"{w}: 'petunjuk' harus minimal dua butir berisi jenis (soal, buku, video) dan isi")
    nama_kasus = [k.get("nama") for k in pk.get("kasus", [])]
    if len(nama_kasus) < 3 or len(set(nama_kasus)) != len(nama_kasus) or not all(nama_kasus):
        err(f"{w}: minimal tiga kasus dengan nama unik")
    if all(k.get("tersembunyi") for k in pk.get("kasus", [])):
        err(f"{w}: harus ada kasus yang tidak tersembunyi")
    for j, k in enumerate(pk.get("kasus", [])):
        y = f"{w}.kasus[{j}]"
        if ("kode" in k) == ("jalankan" in k):
            err(f"{y}: isi tepat salah satu dari 'kode' atau 'jalankan'")
        alvo = "Main" if bahasa == "java" else pk.get("berkas")
        if "jalankan" in k and k["jalankan"] != alvo:
            err(f"{y}: 'jalankan' harus {alvo}")


def cek_konsep(w, ch):
    """Tantangan konsep: tiap butir harus konsisten (kunci ada di pilihan, pasangan unik, wadah ada, dst.)."""
    for k in ("judul", "soal", "petunjuk", "butir", "rujukan"):
        if k not in ch:
            err(f"{w}: kolom '{k}' tidak ada")
    jenis = [p.get("jenis") for p in ch.get("petunjuk", [])]
    if jenis != ["teks", "buku", "video"]:
        err(f"{w}: petunjuk harus berurutan teks, buku, video (ada {jenis})")
    ruj = ch.get("rujukan")
    if not isinstance(ruj, list) or not ruj or not all(isinstance(x, str) and x.strip() for x in ruj):
        err(f"{w}: 'rujukan' wajib berupa daftar teks tidak kosong")
    lulus = ch.get("lulus", 0.7)
    if not isinstance(lulus, (int, float)) or not (0 < lulus <= 1):
        err(f"{w}: 'lulus' harus antara 0 dan 1")
    butir = ch.get("butir", [])
    if len(butir) < 4:
        err(f"{w}: minimal 4 butir (ada {len(butir)})")
    for i, b in enumerate(butir, 1):
        x = f"{w}: butir {i}"
        t = b.get("tipe")
        if not isinstance(b.get("tanya"), str) or not b["tanya"].strip():
            err(f"{x}: 'tanya' kosong")
        if t == "pilgan":
            op = b.get("opsi", [])
            if len(op) < 2 or len(set(op)) != len(op):
                err(f"{x}: opsi harus minimal 2 dan unik")
            if not isinstance(b.get("benar"), int) or not (0 <= b["benar"] < len(op)):
                err(f"{x}: 'benar' harus indeks opsi")
        elif t == "banyak":
            op = b.get("opsi", [])
            br = b.get("benar", [])
            if len(op) < 3 or len(set(op)) != len(op):
                err(f"{x}: opsi harus minimal 3 dan unik")
            if not br or not all(isinstance(k, int) and 0 <= k < len(op) for k in br) or len(set(br)) != len(br):
                err(f"{x}: 'benar' harus daftar indeks opsi yang unik dan tidak kosong")
            if len(br) == len(op):
                err(f"{x}: semua opsi benar, tidak ada yang menguji")
        elif t == "urutkan":
            lg = b.get("langkah", [])
            if len(lg) < 3 or len(set(lg)) != len(lg):
                err(f"{x}: langkah minimal 3 dan unik")
        elif t == "cocokkan":
            ps = b.get("pasangan", [])
            if len(ps) < 3 or any(not isinstance(p, list) or len(p) != 2 for p in ps):
                err(f"{x}: pasangan minimal 3, masing-masing [kiri, kanan]")
            else:
                if len({p[0] for p in ps}) != len(ps) or len({p[1] for p in ps}) != len(ps):
                    err(f"{x}: sisi kiri dan kanan pasangan harus unik")
        elif t == "seret":
            wd = {k.get("id") for k in b.get("wadah", [])}
            br = b.get("butir", [])
            if len(wd) < 2:
                err(f"{x}: minimal 2 wadah")
            if len(br) < 3 or len({k.get("teks") for k in br}) != len(br):
                err(f"{x}: butir minimal 3 dan teksnya unik")
            for k in br:
                if k.get("wadah") not in wd:
                    err(f"{x}: butir '{k.get('teks')}' menunjuk wadah yang tidak ada")
            if len({k.get("wadah") for k in br}) < 2:
                err(f"{x}: butir harus tersebar ke minimal 2 wadah")
        elif t == "isian":
            if not b.get("jawaban") or not all(isinstance(a, str) and a.strip() for a in b["jawaban"]):
                err(f"{x}: 'jawaban' harus daftar teks tidak kosong")
        elif t == "tabel":
            kol = b.get("kolom", [])
            for br in b.get("baris", []):
                if len(br.get("sel", [])) != len(kol):
                    err(f"{x}: jumlah sel baris '{br.get('label')}' tidak sama dengan jumlah kolom")
            if not b.get("baris"):
                err(f"{x}: baris kosong")
        elif t == "relasi":
            if not b.get("relasi") or not b.get("multiplisitas") or not b.get("pasangan"):
                err(f"{x}: relasi, multiplisitas, dan pasangan wajib ada")
            for p in b.get("pasangan", []):
                if p.get("benar") not in b.get("relasi", []):
                    err(f"{x}: relasi benar '{p.get('benar')}' tidak ada di daftar relasi")
                for sisi in ("a", "b"):
                    if sisi in p and p[sisi] not in b.get("multiplisitas", []):
                        err(f"{x}: multiplisitas '{p[sisi]}' tidak ada di daftar")
        else:
            err(f"{x}: tipe tidak dikenal: {t!r}")


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
    if ch.get("jenis") == "konsep":
        cek_konsep(w, ch)
        return
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
