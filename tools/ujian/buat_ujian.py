"""Membangun tasks.json satu ujian dengan MENJALANKAN kunci (tes tidak pernah diketik tangan).

Pakai (dari akar repo):  python tools/ujian/buat_ujian.py simulasi
Membaca tools/ujian/<id>_def.py (TASKS, CHANGES), menulis versi lengkap ke kunci/ujian/<id>/tasks.json dan contoh
jawaban ke kunci/ujian/<id>/solutions.json (tidak ikut terbit). Sesudahnya jalankan buat_kunci_ujian.py.
Diadaptasi dari prototype double-check-exam.
"""
import importlib
import json
import pathlib
import sys

from pyrun import normalize, run, trace_key

AKAR = pathlib.Path(__file__).resolve().parents[2]


def expected(code, inputs):
    r = run(code, inputs)
    assert not r["error"], f"Kunci galat pada {inputs}: {r['error']}"
    return normalize(r["stdout"])


def tests_of(code, ins):
    return [{"input": i, "expected": expected(code, i)} for i in ins]


def main(ujian_id, mk="algoritma-python"):
    d = importlib.import_module(f"{ujian_id}_def")
    tasks, solutions = [], {}
    for t in d.TASKS:
        visible, hidden = tests_of(t["ref"], t["visible"]), tests_of(t["ref"], t["hidden"])
        # Varian bug (sumber pilihan salah butir "tebak keluaran") harus salah di minimal satu tes dan satu masukan trace.
        for v in t["variants"]:
            wrong_tests = sum(1 for x in visible + hidden if trace_key(run(v["code"], x["input"])) != x["expected"])
            wrong_trace = sum(1 for ins in t["trace_inputs"] if trace_key(run(v["code"], ins)) != trace_key(run(t["ref"], ins)))
            assert wrong_tests and wrong_trace, f"Varian {t['id']}/{v['id']} tidak membedakan (tes={wrong_tests}, trace={wrong_trace})"
        # Perubahan ketentuan (sumber butir transfer): kode kunci lama harus GAGAL di tes perubahan, kalau tidak butirnya sepele.
        changes = []
        for c in d.CHANGES[t["id"]]:
            cv, ch = tests_of(c["ref"], c["visible"]), tests_of(c["ref"], c["hidden"])
            old = [normalize(run(t["ref"], x["input"])["stdout"]) == x["expected"] for x in cv + ch]
            assert not all(old), f"{c['id']}: kode lama sudah lulus semua tes perubahan"
            changes.append({"id": c["id"], "title": c["title"], "text": c["text"], "visible": cv, "hidden": ch})
        print(f"{t['id']}: {len(visible)} contoh, {len(hidden)} tersembunyi, {len(t['variants'])} varian bug, {len(changes)} perubahan ketentuan")
        tasks.append({
            "id": t["id"], "title": t["title"], "topic": t["topic"], "statement": t["statement"], "starter": t["starter"],
            "visible": visible, "hidden": hidden, "traceInputs": t["trace_inputs"],
            "variants": [{"id": v["id"], "note": v["note"], "code": v["code"]} for v in t["variants"]],
            "changes": changes,
        })
        solutions[t["id"]] = t["ref"]
    # Versi LENGKAP (dengan tes tersembunyi dan varian) hanya di kunci/ (diabaikan git). Berkas publik situs dan SQL
    # tabel ujian_kunci dibuat dari sini oleh buat_kunci_ujian.py.
    kunci = AKAR / "kunci" / "ujian" / ujian_id
    kunci.mkdir(parents=True, exist_ok=True)
    (kunci / "tasks.json").write_text(json.dumps({"tasks": tasks}, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    (kunci / "solutions.json").write_text(json.dumps({"code": solutions}, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"ditulis: {kunci / 'tasks.json'} dan {kunci / 'solutions.json'}")
    print("lanjutkan: python tools/ujian/buat_kunci_ujian.py")


if __name__ == "__main__":
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    main(sys.argv[1] if len(sys.argv) > 1 else "simulasi")
