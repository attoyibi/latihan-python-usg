"""Memisahkan soal ujian menjadi bagian PUBLIK (situs) dan bagian RAHASIA (tabel ujian_kunci di Supabase).

Sumber: kunci/ujian/<id>/tasks.json dan theory.json (versi lengkap, diabaikan git).
Hasil:
  site/data/kuliah/<mk>/ujian/<id>/tasks.json dan theory.json   hanya soal, contoh terlihat, kode awal (terbit ke publik)
  kunci/ujian/<id>.json                                          isi rahasia (dipakai server uji lokal)
  kunci/ujian_kunci.sql                                          tempel di Supabase SQL Editor (atau jalankan lewat MCP)

Rahasia = tes tersembunyi, masukan dan varian untuk butir Tahap 2, ketentuan berubah beserta tesnya, poin kunci teori,
dan butir konsep (pilihan ganda dengan jawaban benar). Semuanya baru turun ke browser setelah Tahap 1 dikunci.
Pakai (dari akar repo):  python tools/ujian/buat_kunci_ujian.py [mata-kuliah ...]
Tanpa argumen: semua mata kuliah yang punya kunci. Tiap mata kuliah punya berkas SQL sendiri, jadi menambah mata kuliah
tidak menyentuh baris mata kuliah lain di Supabase:
  algoritma-python  kunci/ujian/<id>/...        -> kunci/ujian_kunci.sql                (nama lama)
  mata kuliah lain  kunci/ujian/<mk>/<id>/...   -> kunci/ujian_kunci_<mk>.sql, isi rahasia di kunci/ujian/<mk>/<id>.json
"""
import json
import pathlib
import sys

AKAR = pathlib.Path(__file__).resolve().parents[2]
MK_LAMA = "algoritma-python"
PUBLIK_TUGAS = ("id", "title", "topic", "statement", "starter", "visible")
PUBLIK_TEORI = ("id", "title", "topic", "prompt", "need")  # ditambah "probe" (pertanyaan Tahap 2) bila ada


def baca(p):
    return json.loads(p.read_text(encoding="utf8"))


def tulis(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def sql_teks(s):
    return "'" + s.replace("'", "''") + "'"


def ujian_mk(mk):
    """Folder kunci mata kuliah, folder keluaran rahasia, dan nama berkas SQL."""
    if mk == MK_LAMA:
        return AKAR / "kunci" / "ujian", AKAR / "kunci" / "ujian", AKAR / "kunci" / "ujian_kunci.sql"
    d = AKAR / "kunci" / "ujian" / mk
    return d, d, AKAR / "kunci" / f"ujian_kunci_{mk}.sql"


def daftar_mk():
    akar = AKAR / "kunci" / "ujian"
    lain = sorted(p.name for p in akar.iterdir() if p.is_dir() and not (p / "tasks.json").exists())
    return [MK_LAMA] + lain


def buat(mk):
    sumber, keluar, berkas_sql = ujian_mk(mk)
    baris = []
    contoh_baris = []
    for d in sorted(p for p in sumber.iterdir() if p.is_dir()):
        if not (d / "tasks.json").exists() or not (d / "theory.json").exists():
            continue
        uid = d.name
        tasks, theory = baca(d / "tasks.json")["tasks"], baca(d / "theory.json")
        publik = AKAR / "site" / "data" / "kuliah" / mk / "ujian" / uid
        if not (publik / "exam.json").exists():
            print(f"lewati {mk}/{uid}: tidak ada {publik / 'exam.json'}", file=sys.stderr)
            continue
        tulis(publik / "tasks.json", {"tasks": [{k: t[k] for k in PUBLIK_TUGAS} for t in tasks]})
        tulis(publik / "theory.json", {"note": theory.get("note", ""), "questions": [{k: q[k] for k in PUBLIK_TEORI + (("probe",) if "probe" in q else ())} for q in theory["questions"]]})
        isi = {
            "tasks": {t["id"]: {"hidden": t["hidden"], "traceInputs": t["traceInputs"], "variants": t["variants"], "changes": t["changes"]} for t in tasks},
            "theory": {q["id"]: {"keyPoints": q["keyPoints"], "concepts": q["concepts"]} for q in theory["questions"]},
        }
        tulis(keluar / f"{uid}.json", isi)
        # Simulasi (latihan: true di index.json) mendapat contoh jawaban PUBLIK supaya peserta tahu bentuk jawaban benar.
        # UTS dan UAS tidak pernah: contoh.json hanya dibuat bila ujiannya simulasi, dan dihapus bila bukan.
        meta = {u["id"]: u for u in baca(publik.parent / "index.json")["ujian"]}.get(uid, {})
        solusi = baca(d / "solutions.json")["code"]
        contoh = {"code": {t["id"]: solusi[t["id"]] for t in tasks}, "theory": {q["id"]: q["sample"] for q in theory["questions"]}}
        if meta.get("latihan") is True:
            tulis(publik / "contoh.json", contoh)
        elif (publik / "contoh.json").exists():
            (publik / "contoh.json").unlink()
        baris.append(f"({sql_teks(mk)}, {sql_teks(uid)}, {sql_teks(json.dumps(isi, ensure_ascii=False))}::jsonb)")
        # Contoh jawaban UTS/UAS (hanya untuk dosen lewat ujian_contoh_dosen, migrasi 0012); simulasi sudah publik (contoh.json).
        if meta.get("latihan") is not True:
            contoh_baris.append(f"({sql_teks(mk)}, {sql_teks(uid)}, {sql_teks(json.dumps(contoh, ensure_ascii=False))}::jsonb)")
            tulis(keluar / f"{uid}.contoh.json", contoh)  # dibaca server uji lokal
        print(f"{mk}/{uid}: {len(tasks)} soal praktik, {len(theory['questions'])} soal teori -> publik dan kunci dipisah")
    if not baris:
        return False
    sql = (
        "-- Dibuat otomatis oleh tools/ujian/buat_kunci_ujian.py. RAHASIA: jangan dimasukkan ke repositori.\n"
        f"-- Mata kuliah: {mk}. Tempel di Supabase > SQL Editor > Run (setelah migrasi 0010). Hanya menyentuh baris {mk}; aman dijalankan ulang.\n"
        "insert into public.ujian_kunci (matakuliah_id, ujian_id, isi) values\n  "
        + ",\n  ".join(baris)
        + "\non conflict (matakuliah_id, ujian_id) do update set isi = excluded.isi, diperbarui_pada = now();\n"
    )
    berkas_sql.write_text(sql, encoding="utf8")
    if contoh_baris:
        sql_c = (
            "-- Dibuat otomatis oleh tools/ujian/buat_kunci_ujian.py. RAHASIA: jangan dimasukkan ke repositori." + chr(10)
            + f"-- Contoh jawaban UTS/UAS {mk} untuk dosen (setelah migrasi 0012). Hanya menyentuh baris {mk}; aman dijalankan ulang." + chr(10)
            + "insert into public.ujian_contoh (matakuliah_id, ujian_id, isi) values" + chr(10) + "  "
            + ("," + chr(10) + "  ").join(contoh_baris)
            + chr(10) + "on conflict (matakuliah_id, ujian_id) do update set isi = excluded.isi, diperbarui_pada = now();" + chr(10)
        )
        berkas_c = berkas_sql.with_name(berkas_sql.name.replace("ujian_kunci", "ujian_contoh"))
        berkas_c.write_text(sql_c, encoding="utf8")
        print(f"ditulis: {berkas_c}")
    print(f"ditulis: {berkas_sql}")
    return True


def main():
    daftar = sys.argv[1:] or daftar_mk()
    if not any([buat(mk) for mk in daftar]):
        sys.exit("Tidak ada ujian di kunci/ujian/ (butuh <id>/tasks.json dan <id>/theory.json lengkap).")


if __name__ == "__main__":
    main()
