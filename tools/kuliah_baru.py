#!/usr/bin/env python3
"""Membuat kerangka mata kuliah baru dan mencetak SQL untuk Supabase.

Contoh:
  python tools/kuliah_baru.py jaringan-komputer "Jaringan Komputer" --bahasa none --jenis teks
  python tools/kuliah_baru.py basis-data "Basis Data" --bahasa sql --deskripsi "Dasar SQL."

Yang dikerjakan:
  1. membuat site/data/kuliah/<id>/materi.json (kosong) dan folder challenges/;
  2. menambah baris ke site/data/matakuliah.json (aktif=false sampai Anda siap, atau pakai --aktif);
  3. mencetak perintah SQL yang perlu dijalankan sekali di Supabase SQL Editor
     supaya mata kuliah itu dikenal database (diperlukan agar progres bisa disimpan).

Tidak menimpa apa pun: bila id sudah ada, alat berhenti dengan pesan galat.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def sql_kutip(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id", help="id unik: huruf kecil, angka, strip (mis. pbo-java)")
    ap.add_argument("nama", help="nama mata kuliah")
    ap.add_argument("--bahasa", default="none", help="python, java, javascript, ... atau 'none' untuk mata kuliah tanpa kode")
    ap.add_argument("--jenis", choices=["kode", "teks", "campuran"], help="bawaan: kode bila ada bahasa, teks bila tidak")
    ap.add_argument("--deskripsi", default="")
    ap.add_argument("--urutan", type=int, help="urutan tampil (bawaan: setelah yang terakhir)")
    ap.add_argument("--aktif", action="store_true", help="langsung tampilkan sebagai aktif (hanya bila sudah ada bab)")
    ap.add_argument("--akar", default=str(Path(__file__).resolve().parent.parent), help="akar repositori (untuk pengujian)")
    a = ap.parse_args()

    if not ID_RE.match(a.id) or len(a.id) > 60:
        sys.exit("Galat: id harus huruf kecil, angka, dan strip (mis. 'pbo-java'), maksimal 60 karakter.")
    if not (2 <= len(a.nama) <= 120):
        sys.exit("Galat: nama harus 2 sampai 120 karakter.")
    if len(a.deskripsi) > 600:
        sys.exit("Galat: deskripsi maksimal 600 karakter.")

    root = Path(a.akar)
    data = root / "site" / "data"
    daftar_path = data / "matakuliah.json"
    daftar = json.loads(daftar_path.read_text(encoding="utf8"))
    if any(c["id"] == a.id for c in daftar):
        sys.exit(f"Galat: mata kuliah '{a.id}' sudah ada di matakuliah.json.")
    folder = data / "kuliah" / a.id
    if folder.exists():
        sys.exit(f"Galat: folder {folder} sudah ada.")

    bahasa = None if a.bahasa.lower() == "none" else a.bahasa.lower()
    if bahasa and not re.fullmatch(r"[a-z0-9+#.-]{1,30}", bahasa):
        sys.exit("Galat: nama bahasa tidak valid.")
    jenis = a.jenis or ("kode" if bahasa else "teks")
    if jenis in ("kode", "campuran") and not bahasa:
        sys.exit(f"Galat: jenis '{jenis}' memerlukan --bahasa.")
    urutan = a.urutan if a.urutan is not None else (max([c.get("urutan", 0) for c in daftar] + [0]) + 10)

    entri = {
        "id": a.id,
        "nama": a.nama,
        "deskripsi": a.deskripsi,
        "bahasa": bahasa,
        "jenis": jenis,
        "aktif": bool(a.aktif),
        "urutan": urutan,
    }
    (folder / "challenges").mkdir(parents=True)
    (folder / "materi.json").write_text("[]\n", encoding="utf8")
    (folder / "challenges" / ".gitkeep").write_text("", encoding="utf8")
    daftar.append(entri)
    daftar_path.write_text(json.dumps(daftar, ensure_ascii=False, indent=2) + "\n", encoding="utf8")

    print(f"Dibuat: {folder.relative_to(root)}/materi.json dan challenges/")
    print(f"Ditambahkan ke site/data/matakuliah.json (aktif={entri['aktif']}).")
    print()
    print("Jalankan SQL ini SEKALI di Supabase > SQL Editor:")
    print()
    print("insert into public.matakuliah (id, nama, deskripsi, jenis, bahasa, aktif, urutan)")
    print(
        f"values ({sql_kutip(a.id)}, {sql_kutip(a.nama)}, {sql_kutip(a.deskripsi) if a.deskripsi else 'null'}, "
        f"{sql_kutip(jenis)}, {sql_kutip(bahasa) if bahasa else 'null'}, {'true' if a.aktif else 'false'}, {urutan})"
    )
    print("on conflict (id) do update set nama = excluded.nama, deskripsi = excluded.deskripsi,")
    print("  jenis = excluded.jenis, bahasa = excluded.bahasa, urutan = excluded.urutan;")
    print()
    print("Langkah berikutnya: isi materi.json dan soal (docs/MENAMBAH-BAB.md), lalu set \"aktif\": true")
    print("di matakuliah.json dan jalankan 'update public.matakuliah set aktif = true where id = ...' di SQL Editor.")
    print("Periksa dengan: python tools/validasi_konten.py")


if __name__ == "__main__":
    main()
