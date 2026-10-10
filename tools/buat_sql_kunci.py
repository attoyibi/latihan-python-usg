#!/usr/bin/env python3
"""Membuat SQL untuk memasukkan kunci jawaban ke tabel kunci_jawaban (migrasi 0009).

  kunci/<mata-kuliah>/bab-NN.py|java   ->   kunci/kunci_jawaban.sql
  kunci/<mata-kuliah>/tugas-akhir.json ->   baris bab 99 (contoh jawaban tugas akhir: peta nama berkas -> isi, untuk tombol
                                            Jawab otomatis instruktur; harus JSON objek berisi nama berkas Java/Markdown)

Berkas hasilnya ada di folder kunci/ (diabaikan git, tidak ikut terbit). Tempel isinya di Supabase SQL Editor dan Run.
Aman dijalankan ulang: kunci yang sudah ada diperbarui. Sebelum membuat SQL, kunci diuji dulu dengan tools/uji_kunci.py
(jalankan terpisah). Jalankan dari akar repositori:  python tools/buat_sql_kunci.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KUNCI = ROOT / "kunci"
DATA = ROOT / "site" / "data"
POLA = re.compile(r"^bab-(\d{2})\.(py|java)$")
BAB_TUGAS_AKHIR = 99
NAMA_BERKAS = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}$")


def kutip_dolar(teks, indeks):
    """Dollar-quoting dengan penanda yang dijamin tidak muncul di dalam teks."""
    n = 0
    while True:
        tag = f"$kunci{indeks}x{n}$"
        if tag not in teks:
            return f"{tag}{teks}{tag}"
        n += 1


def main():
    if not KUNCI.exists():
        print("Folder kunci/ tidak ada.")
        sys.exit(1)
    mk = {c["id"]: c.get("bahasa") for c in json.loads((DATA / "matakuliah.json").read_text(encoding="utf8"))}
    baris = []
    for folder in sorted(p for p in KUNCI.iterdir() if p.is_dir()):
        if folder.name not in mk:
            print(f"lewati {folder.name}: tidak ada di matakuliah.json")
            continue
        for f in sorted(folder.iterdir()):
            if f.name == "tugas-akhir.json":
                isi = f.read_text(encoding="utf8").replace("\r\n", "\n")
                try:
                    peta = json.loads(isi)
                    assert isinstance(peta, dict) and peta and all(NAMA_BERKAS.match(n) and isinstance(v, str) for n, v in peta.items())
                except Exception:  # noqa: BLE001
                    print(f"lewati {folder.name}/{f.name}: harus JSON objek nama berkas -> isi")
                    continue
                if len(isi) > 50000:
                    print(f"lewati {folder.name}/{f.name}: lebih dari 50000 karakter")
                    continue
                baris.append(
                    "insert into public.kunci_jawaban (matakuliah_id, bab, bahasa, isi) values "
                    f"('{folder.name}', {BAB_TUGAS_AKHIR}, 'berkas', {kutip_dolar(isi, len(baris))})\n"
                    "on conflict (matakuliah_id, bab) do update set bahasa = excluded.bahasa, isi = excluded.isi, diperbarui_pada = now();"
                )
                continue
            m = POLA.match(f.name)
            if not m:
                continue
            bab = int(m.group(1))
            if not (DATA / "kuliah" / folder.name / "challenges" / f"bab-{m.group(1)}.json").exists():
                print(f"lewati {folder.name}/{f.name}: soalnya tidak ada")
                continue
            isi = f.read_text(encoding="utf8").replace("\r\n", "\n")
            if len(isi) > 50000:
                print(f"lewati {folder.name}/{f.name}: lebih dari 50000 karakter")
                continue
            bahasa = "python" if m.group(2) == "py" else "java"
            baris.append(
                "insert into public.kunci_jawaban (matakuliah_id, bab, bahasa, isi) values "
                f"('{folder.name}', {bab}, '{bahasa}', {kutip_dolar(isi, len(baris))})\n"
                "on conflict (matakuliah_id, bab) do update set bahasa = excluded.bahasa, isi = excluded.isi, diperbarui_pada = now();"
            )
    if not baris:
        print("Tidak ada kunci.")
        sys.exit(1)
    keluar = KUNCI / "kunci_jawaban.sql"
    kepala = "-- Dibuat oleh tools/buat_sql_kunci.py. RAHASIA: jangan diterbitkan. Jalankan SETELAH migrasi 0009.\n\n"
    keluar.write_text(kepala + "\n\n".join(baris) + "\n", encoding="utf8")
    print(f"{len(baris)} kunci ditulis ke {keluar.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
