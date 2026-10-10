#!/usr/bin/env python3
"""Menguji praktik per bab (site/data/kuliah/*/praktik/bab-NN.json) dengan Python sungguhan.

Memakai penguji yang SAMA dengan yang dijalankan di browser (site/js/praktikum_harness.py). Untuk tiap praktik:
  1. contoh jawaban meluluskan SEMUA kasus. Contoh TIDAK ada di situs (publik); ia dibaca dari kunci/<mata kuliah>/praktik-NN.py
     (diabaikan git, hanya ada di komputer pemilik). Bila folder kunci/ tidak ada (mis. di CI), pemeriksaan ini dilewati;
  2. kerangka awal (dengan ____) tidak meluluskan semua kasus, supaya kasusnya benar-benar menguji;
  3. tanpa berkas sama sekali, kasus tidak lulus semua;
  4. kerangka awal memuat tanda ____ (peserta tahu apa yang harus diganti) dan contoh tidak;
  5. struktur: bab sesuai nama berkas, nama kasus unik, ada kasus tersembunyi hanya sebagian, petunjuk sah.
Jalankan:  python tools/uji_praktik.py
"""
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

RAKAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
HARNESS = os.path.join(RAKAR, "site", "js", "praktikum_harness.py")
total = 0
gagal = 0


def cek(nama, kondisi, detail=""):
    global total, gagal
    total += 1
    if not kondisi:
        gagal += 1
        print("GAGAL " + nama + (("  -> " + str(detail)) if detail else ""))
    else:
        print("OK    " + nama)


PEMANGGIL = (
    "import importlib.util, json, sys\n"
    "spec = importlib.util.spec_from_file_location('praktikum_harness', %r)\n"
    "m = importlib.util.module_from_spec(spec)\n"
    "spec.loader.exec_module(m)\n"
    "print(m.praktikum_jalankan(sys.stdin.read()))\n"
) % HARNESS


def jalankan(berkas, perintah):
    with tempfile.TemporaryDirectory() as d:
        for nama, isi in berkas.items():
            with open(os.path.join(d, nama), "w", encoding="utf8", newline="\n") as f:
                f.write(isi)
        p = subprocess.run([sys.executable, "-c", PEMANGGIL], input=json.dumps(dict(perintah, dir=d)), capture_output=True, text=True, timeout=60)
        if p.returncode != 0:
            raise RuntimeError(p.stderr[-800:])
        return json.loads(p.stdout)


def kasus(berkas, daftar):
    return jalankan(berkas, {"aksi": "kasus", "kasus": daftar})["kasus"]


def periksa(p, nama, babs_materi, contoh):
    pre = nama + ": "
    b = p["berkas"]
    cek(pre + "punya bab, judul, tujuan, langkah, dan kasus", all(p.get(k) for k in ("bab", "judul", "tujuan", "langkah", "kasus")))
    cek(pre + "nama berkas aman dan berakhiran .py", re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}\.py", b) is not None, b)
    cek(pre + "bab ada di materi dan berjenis kode", p["bab"] in babs_materi, p["bab"])
    nama_kasus = [k["nama"] for k in p["kasus"]]
    cek(pre + "nama kasus unik dan minimal tiga kasus", len(set(nama_kasus)) == len(nama_kasus) and len(nama_kasus) >= 3, nama_kasus)
    cek(pre + "tiap kasus punya kode atau jalankan", all(("kode" in k) != ("jalankan" in k) for k in p["kasus"]))
    cek(pre + "kasus jalankan menunjuk berkas praktik ini", all(k.get("jalankan", b) == b for k in p["kasus"]))
    cek(pre + "ada kasus yang tidak tersembunyi", any(not k.get("tersembunyi") for k in p["kasus"]))
    cek(pre + "petunjuk sah dan bertahap (minimal dua)", len(p["petunjuk"]) >= 2 and all(h.get("jenis") in ("soal", "buku", "video") and h.get("isi") for h in p["petunjuk"]))
    cek(pre + "kerangka memuat tanda ____", "____" in p["awal"])
    cek(pre + "situs tidak memuat contoh jawaban (publik)", "contoh" not in p)
    cek(pre + "ukuran wajar", len(p["awal"]) <= 8000)
    if contoh is None:
        print("LEWAT " + pre + "contoh jawaban (kunci/ tidak ada di komputer ini)")
    else:
        cek(pre + "contoh tidak memuat tanda ____", "____" not in contoh)
        hasil = kasus({b: contoh}, p["kasus"])
        cek(pre + "contoh jawaban meluluskan semua %d kasus" % len(p["kasus"]), all(h["lulus"] for h in hasil), [h["nama"] + " -> " + h["pesan"] for h in hasil if not h["lulus"]])
    hasil = kasus({b: p["awal"]}, p["kasus"])
    cek(pre + "kerangka awal tidak meluluskan semua kasus", any(not h["lulus"] for h in hasil))
    cek(pre + "kerangka awal tidak meluluskan satu pun kasus yang bukan kebetulan (paling banyak separuh lulus)", sum(1 for h in hasil if h["lulus"]) <= len(hasil) // 2, [h["nama"] for h in hasil if h["lulus"]])
    hasil = kasus({}, p["kasus"])
    cek(pre + "tanpa berkas, kasus tidak lulus semua", any(not h["lulus"] for h in hasil))
    if contoh is not None and p.get("masukanContoh") is not None and any("jalankan" in k for k in p["kasus"]):
        r = jalankan({b: contoh}, {"aksi": "jalankan", "entri": b, "masukan": p["masukanContoh"].split("\n")})
        cek(pre + "contoh berjalan dengan masukan contoh tanpa galat", r["galat"] is None and r["keluaran"].strip() != "", r)


def main():
    global gagal
    daftar = sorted(glob.glob(os.path.join(RAKAR, "site", "data", "kuliah", "*", "praktik", "bab-*.json")))
    cek("ada minimal satu praktik untuk diuji", len(daftar) >= 1)
    per_kuliah = {}
    for f in daftar:
        kuliah = os.path.basename(os.path.dirname(os.path.dirname(f)))
        daftar_mk = json.load(open(os.path.join(RAKAR, "site", "data", "matakuliah.json"), encoding="utf8"))
        if next((c.get("bahasa") for c in daftar_mk if c["id"] == kuliah), None) != "python":
            continue  # praktik Java diuji dengan JVM: tools/uji_praktik_java.mjs
        materi = json.load(open(os.path.join(RAKAR, "site", "data", "kuliah", kuliah, "materi.json"), encoding="utf8"))
        babs_kode = {m["bab"] for m in materi if m.get("jenis") == "kode"}
        p = json.load(open(f, encoding="utf8"))
        nama = kuliah + "/" + os.path.basename(f)
        print("\n== " + nama + " ==")
        cek(nama + ": nomor bab sama dengan nama berkas", "bab-%02d.json" % p["bab"] == os.path.basename(f))
        berkas_contoh = os.path.join(RAKAR, "kunci", kuliah, "praktik-%02d.py" % p["bab"])
        contoh = open(berkas_contoh, encoding="utf8").read() if os.path.exists(berkas_contoh) else None
        periksa(p, nama, babs_kode, contoh)
        per_kuliah.setdefault(kuliah, []).append(p["bab"])
    for idx in glob.glob(os.path.join(RAKAR, "site", "data", "kuliah", "*", "praktik", "index.json")):
        kuliah = os.path.basename(os.path.dirname(os.path.dirname(idx)))
        if kuliah not in per_kuliah:
            continue  # bukan Python (Java diuji tools/uji_praktik_java.mjs)
        data = json.load(open(idx, encoding="utf8"))
        cek(kuliah + "/praktik/index.json cocok dengan berkas bab-NN.json yang ada", sorted(data.get("bab", [])) == sorted(per_kuliah.get(kuliah, [])), (data, per_kuliah.get(kuliah)))
    print(("\n%d dari %d uji GAGAL." % (gagal, total)) if gagal else "\nSemua %d uji lulus." % total)
    sys.exit(1 if gagal else 0)


if __name__ == "__main__":
    main()
