"""Memeriksa soal praktik ujian dengan penjalan sungguhan (Python atau JDK, sesuai bahasa mata kuliah).

Pakai (dari akar repo):  python tools/ujian/periksa_ujian.py [mata-kuliah [ujian]]     (bawaan: pbo-java)
Untuk tiap soal praktik:
  1. kunci jawaban (solutions.json) LULUS semua tes contoh dan tersembunyi;
  2. kode awal (starter di berkas publik) GAGAL di sebagian besar tes (soal tidak lulus tanpa dikerjakan);
  3. tiap varian bug salah di minimal satu tes; kunci lama gagal di tes tiap perubahan ketentuan;
  4. berkas publik tidak memuat tes tersembunyi, varian, atau perubahan ketentuan.
Butuh kunci/ujian/... (rahasia, tidak ada di repositori); keluar dengan kode 1 bila ada yang gagal.
"""
import json
import pathlib
import sys

AKAR = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from buat_ujian import MK_LAMA, bahasa_dari  # noqa: E402

DILARANG_PUBLIK = ("hidden", "variants", "changes", "traceInputs", "keyPoints", "concepts")


def baca(p):
    return json.loads(p.read_text(encoding="utf8"))


def periksa(mk, uid, run, trace_key, norm):
    kunci = AKAR / "kunci" / "ujian" / (uid if mk == MK_LAMA else f"{mk}/{uid}")
    publik = AKAR / "site" / "data" / "kuliah" / mk / "ujian" / uid
    lengkap = {t["id"]: t for t in baca(kunci / "tasks.json")["tasks"]}
    solusi = baca(kunci / "solutions.json")["code"]
    umum = {t["id"]: t for t in baca(publik / "tasks.json")["tasks"]}
    aktif = baca(publik / "exam.json")["config"]["activeTasks"]
    gagal = []

    def cek(ok, pesan):
        print(("  ok   " if ok else "  GAGAL ") + pesan)
        if not ok:
            gagal.append(f"{uid}: {pesan}")

    for tid in aktif:
        t, u = lengkap[tid], umum[tid]
        tes = t["visible"] + t["hidden"]
        lulus = sum(norm(run(solusi[tid], x["input"])["stdout"]) == x["expected"] and not run(solusi[tid], x["input"])["error"] for x in tes)
        cek(lulus == len(tes), f"{uid}/{tid} kunci lulus {lulus}/{len(tes)} tes")
        awal = sum(norm(run(u["starter"], x["input"])["stdout"]) == x["expected"] for x in tes)
        cek(awal <= len(tes) // 3, f"{uid}/{tid} kode awal lulus {awal}/{len(tes)} tes (harus sedikit)")
        for v in t["variants"]:
            salah = sum(trace_key(run(v["code"], x["input"])) != x["expected"] for x in tes)
            cek(salah > 0, f"{uid}/{tid} varian {v['id']} salah di {salah} tes")
        for c in t["changes"]:
            lama = sum(norm(run(solusi[tid], x["input"])["stdout"]) != x["expected"] for x in c["visible"] + c["hidden"])
            cek(lama > 0, f"{uid}/{tid} perubahan {c['id']}: kunci lama salah di {lama} tes")
        bocor = [k for k in DILARANG_PUBLIK if k in u]
        cek(not bocor, f"{uid}/{tid} berkas publik tanpa rahasia")
        cek(all(x in u["visible"] for x in t["visible"]), f"{uid}/{tid} contoh publik = contoh kunci")
    teks = (publik / "tasks.json").read_text(encoding="utf8") + (publik / "theory.json").read_text(encoding="utf8")
    cek(not any(k in teks for k in ('"keyPoints"', '"concepts"', '"hidden"', '"variants"')), f"{uid} berkas publik (tasks, theory) tanpa rahasia")
    latihan = {u["id"]: u.get("latihan") is True for u in baca(publik.parent / "index.json")["ujian"]}[uid]
    cek(latihan or not (publik / "contoh.json").exists(), f"{uid} " + ("simulasi boleh punya contoh.json" if latihan else "bukan simulasi: tanpa contoh.json publik"))
    return gagal


def main():
    mk = sys.argv[1] if len(sys.argv) > 1 else "pbo-java"
    if bahasa_dari(mk) == "java":
        from javarun import run, trace_key, normalize
    else:
        from pyrun import run, trace_key, normalize
    indeks = baca(AKAR / "site" / "data" / "kuliah" / mk / "ujian" / "index.json")["ujian"]
    ids = [sys.argv[2]] if len(sys.argv) > 2 else [u["id"] for u in indeks]
    semua = []
    for uid in ids:
        print(f"{mk}/{uid}")
        semua += periksa(mk, uid, run, trace_key, normalize)
    if semua:
        print(f"\n{len(semua)} pemeriksaan gagal:\n" + "\n".join(semua))
        sys.exit(1)
    print("\nSemua pemeriksaan lulus.")


if __name__ == "__main__":
    main()
