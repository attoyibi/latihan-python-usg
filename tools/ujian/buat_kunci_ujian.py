"""Memisahkan soal ujian menjadi bagian PUBLIK (situs) dan bagian RAHASIA (tabel ujian_kunci di Supabase).

Sumber: kunci/ujian/<id>/tasks.json dan theory.json (versi lengkap, diabaikan git).
Hasil:
  site/data/kuliah/<mk>/ujian/<id>/tasks.json dan theory.json   hanya soal, contoh terlihat, kode awal (terbit ke publik)
  kunci/ujian/<id>.json                                          isi rahasia (dipakai server uji lokal)
  kunci/ujian_kunci.sql                                          tempel di Supabase SQL Editor (atau jalankan lewat MCP)

Rahasia = tes tersembunyi, masukan dan varian untuk butir Tahap 2, ketentuan berubah beserta tesnya, poin kunci teori,
dan butir konsep (pilihan ganda dengan jawaban benar). Semuanya baru turun ke browser setelah Tahap 1 dikunci.
Pakai (dari akar repo):  python tools/ujian/buat_kunci_ujian.py
"""
import json
import pathlib
import sys

AKAR = pathlib.Path(__file__).resolve().parents[2]
MK = "algoritma-python"
PUBLIK_TUGAS = ("id", "title", "topic", "statement", "starter", "visible")
PUBLIK_TEORI = ("id", "title", "topic", "prompt", "need")


def baca(p):
    return json.loads(p.read_text(encoding="utf8"))


def tulis(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def sql_teks(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    sumber = AKAR / "kunci" / "ujian"
    baris = []
    for d in sorted(p for p in sumber.iterdir() if p.is_dir()):
        if not (d / "tasks.json").exists() or not (d / "theory.json").exists():
            continue
        uid = d.name
        tasks, theory = baca(d / "tasks.json")["tasks"], baca(d / "theory.json")
        publik = AKAR / "site" / "data" / "kuliah" / MK / "ujian" / uid
        if not (publik / "exam.json").exists():
            print(f"lewati {uid}: tidak ada {publik / 'exam.json'}", file=sys.stderr)
            continue
        tulis(publik / "tasks.json", {"tasks": [{k: t[k] for k in PUBLIK_TUGAS} for t in tasks]})
        tulis(publik / "theory.json", {"note": theory.get("note", ""), "questions": [{k: q[k] for k in PUBLIK_TEORI} for q in theory["questions"]]})
        isi = {
            "tasks": {t["id"]: {"hidden": t["hidden"], "traceInputs": t["traceInputs"], "variants": t["variants"], "changes": t["changes"]} for t in tasks},
            "theory": {q["id"]: {"keyPoints": q["keyPoints"], "concepts": q["concepts"]} for q in theory["questions"]},
        }
        tulis(sumber / f"{uid}.json", isi)
        baris.append(f"({sql_teks(MK)}, {sql_teks(uid)}, {sql_teks(json.dumps(isi, ensure_ascii=False))}::jsonb)")
        print(f"{uid}: {len(tasks)} soal praktik, {len(theory['questions'])} soal teori -> publik dan kunci dipisah")
    if not baris:
        sys.exit("Tidak ada ujian di kunci/ujian/<id>/ (butuh tasks.json dan theory.json lengkap).")
    sql = (
        "-- Dibuat otomatis oleh tools/ujian/buat_kunci_ujian.py. RAHASIA: jangan dimasukkan ke repositori.\n"
        "-- Tempel di Supabase > SQL Editor > Run (setelah migrasi 0010). Aman dijalankan ulang.\n"
        "insert into public.ujian_kunci (matakuliah_id, ujian_id, isi) values\n  "
        + ",\n  ".join(baris)
        + "\non conflict (matakuliah_id, ujian_id) do update set isi = excluded.isi, diperbarui_pada = now();\n"
    )
    (sumber.parent / "ujian_kunci.sql").write_text(sql, encoding="utf8")
    print(f"ditulis: {sumber.parent / 'ujian_kunci.sql'}")


if __name__ == "__main__":
    main()
