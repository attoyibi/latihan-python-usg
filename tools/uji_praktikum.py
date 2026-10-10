#!/usr/bin/env python3
"""Menguji isi praktikum (site/data/kuliah/*/praktikum/*.json) dengan Python sungguhan.

Memakai penguji yang SAMA dengan yang dijalankan di browser (site/js/praktikum_harness.py), jadi yang lulus di sini
berperilaku sama di Pyodide. Untuk tiap tahap diperiksa:
  1. berkas contoh (tahap ini dan semua tahap sebelumnya) meluluskan SEMUA kasus;
  2. berkas awal (kerangka) tidak meluluskan semua kasus, supaya kasusnya benar-benar menguji;
  3. tanpa berkas tahap ini sama sekali, kasus tidak lulus semua;
  4. struktur: id unik, nama kasus unik, berkas yang diminta ada di contoh, petunjuk sah, bab berupa angka.
Jalankan:  python tools/uji_praktikum.py
"""
import glob
import json
import os
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


def jalankan_kasus(berkas, kasus):
    with tempfile.TemporaryDirectory() as d:
        for nama, isi in berkas.items():
            with open(os.path.join(d, nama), "w", encoding="utf8", newline="\n") as f:
                f.write(isi)
        perintah = json.dumps({"aksi": "kasus", "dir": d, "kasus": kasus})
        p = subprocess.run([sys.executable, "-c", PEMANGGIL], input=perintah, capture_output=True, text=True, timeout=60)
        if p.returncode != 0:
            raise RuntimeError(p.stderr[-800:])
        return json.loads(p.stdout)["kasus"]


def jalankan_berkas(berkas, entri, masukan):
    with tempfile.TemporaryDirectory() as d:
        for nama, isi in berkas.items():
            with open(os.path.join(d, nama), "w", encoding="utf8", newline="\n") as f:
                f.write(isi)
        perintah = json.dumps({"aksi": "jalankan", "dir": d, "entri": entri, "masukan": masukan})
        p = subprocess.run([sys.executable, "-c", PEMANGGIL], input=perintah, capture_output=True, text=True, timeout=60)
        if p.returncode != 0:
            raise RuntimeError(p.stderr[-800:])
        return json.loads(p.stdout)


def gabung(tahap_list, sampai, awal_terakhir=False):
    """Berkas contoh tahap 0..sampai-1; bila awal_terakhir, tahap `sampai` memakai berkas awalnya (kerangka)."""
    berkas = {}
    for t in tahap_list[:sampai]:
        berkas.update(t["contoh"])
    if awal_terakhir:
        berkas.update(tahap_list[sampai].get("awal", {}))
    return berkas


def periksa_struktur(p, nama_berkas):
    cek(nama_berkas + ": punya id, judul, dan tahap", bool(p.get("id")) and bool(p.get("judul")) and len(p.get("tahap", [])) > 0)
    cek(nama_berkas + ": jalur sah", set(p.get("jalur", [])) <= {"web", "laptop", "ponsel"} and len(p.get("jalur", [])) > 0)
    ids = [t["id"] for t in p["tahap"]]
    cek(nama_berkas + ": id tahap unik dan berpola", len(ids) == len(set(ids)) and all(__import__("re").fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", i) and len(i) <= 40 for i in ids), ids)
    for t in p["tahap"]:
        pre = nama_berkas + " " + t["id"] + ": "
        cek(pre + "punya judul, tujuan, dan langkah", bool(t.get("judul")) and bool(t.get("tujuan")) and len(t.get("langkah", [])) > 0)
        cek(pre + "bab berupa daftar angka", isinstance(t.get("bab", []), list) and all(isinstance(b, int) and 1 <= b <= 99 for b in t.get("bab", [])))
        nama_kasus = [k["nama"] for k in t["kasus"]]
        cek(pre + "nama kasus unik dan ada kasus", len(nama_kasus) == len(set(nama_kasus)) and len(nama_kasus) >= 3, nama_kasus)
        cek(pre + "setiap kasus punya kode atau jalankan", all(("kode" in k) != ("jalankan" in k) for k in t["kasus"]))
        cek(pre + "berkas yang diminta ada di contoh dan awal", all(b in t["contoh"] for b in t.get("diminta", [])) and len(t.get("diminta", [])) > 0)
        cek(pre + "jenis petunjuk sah", all(h.get("jenis") in ("soal", "buku", "video") and h.get("isi") for h in t.get("petunjuk", [])))
        cek(pre + "nama berkas aman dan ukuran wajar", all(__import__("re").fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}", n) and len(isi) <= 20000 for n, isi in list(t["contoh"].items()) + list(t.get("awal", {}).items())))
    if p.get("entri"):
        cek(nama_berkas + ": berkas entri ada di tahap terakhir", p["entri"] in p["tahap"][-1]["contoh"])


def periksa_tahap(p, i, nama_berkas):
    t = p["tahap"][i]
    pre = nama_berkas + " " + t["id"] + ": "
    hasil = jalankan_kasus(gabung(p["tahap"], i + 1), t["kasus"])
    gagal_contoh = [h["nama"] + " -> " + h["pesan"] for h in hasil if not h["lulus"]]
    cek(pre + "berkas contoh meluluskan semua %d kasus" % len(t["kasus"]), not gagal_contoh, gagal_contoh)
    if t.get("awal"):
        hasil = jalankan_kasus(gabung(p["tahap"], i, awal_terakhir=True), t["kasus"])
        cek(pre + "kerangka awal tidak meluluskan semua kasus (kasusnya menguji)", any(not h["lulus"] for h in hasil))
    hasil = jalankan_kasus(gabung(p["tahap"], i), t["kasus"])
    cek(pre + "tanpa berkas tahap ini, kasus tidak lulus semua", any(not h["lulus"] for h in hasil))
    cek(pre + "kasus tersembunyi hanya sebagian", any(not k.get("tersembunyi") for k in t["kasus"]))


def periksa_produk(p, nama_berkas):
    # seluruh rantai: jalankan entri dengan berkas contoh semua tahap
    entri = p.get("entri")
    if not entri:
        return
    berkas = gabung(p["tahap"], len(p["tahap"]))
    r = jalankan_berkas(berkas, entri, ["1", "K1", "2", "3", "0"])
    cek(nama_berkas + ": produk akhir berjalan dari awal sampai akhir tanpa galat", r["galat"] is None and "Terima kasih" in r["keluaran"], r)


def main():
    global gagal
    daftar = [f for f in sorted(glob.glob(os.path.join(RAKAR, "site", "data", "kuliah", "*", "praktikum", "*.json"))) if os.path.basename(f) != "index.json"]
    cek("ada minimal satu praktikum untuk diuji", len(daftar) >= 1)
    for f in daftar:
        p = json.load(open(f, encoding="utf8"))
        nama = os.path.basename(os.path.dirname(os.path.dirname(f))) + "/" + os.path.basename(f)
        if p.get("bahasa") == "java":
            continue  # praktikum Java diuji tools/uji_praktikum_java.mjs
        print("\n== " + nama + " ==")
        periksa_struktur(p, nama)
        for i in range(len(p["tahap"])):
            periksa_tahap(p, i, nama)
        periksa_produk(p, nama)
    # indeks mengarah ke berkas yang ada
    for idx in glob.glob(os.path.join(RAKAR, "site", "data", "kuliah", "*", "praktikum", "index.json")):
        data = json.load(open(idx, encoding="utf8"))
        folder = os.path.dirname(idx)
        cek(os.path.basename(os.path.dirname(folder)) + "/index.json: tiap entri menunjuk berkas yang ada", all(os.path.exists(os.path.join(folder, e["berkas"])) for e in data))
    print(("\n%d dari %d uji GAGAL." % (gagal, total)) if gagal else "\nSemua %d uji lulus." % total)
    sys.exit(1 if gagal else 0)


if __name__ == "__main__":
    main()
