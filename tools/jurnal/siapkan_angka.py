"""Menyiapkan angka naskah: docs/jurnal/naskah/angka-naskah.json.

Sumber: (1) fakta sistem dibaca dari repositori ini (jumlah bab, soal, kasus uji, migrasi, berkas), (2) data agregat anonim
docs/jurnal/data/agregat-supabase.json (hasil SELECT agregat dari Supabase situs; berkas ini TIDAK di-commit).
Hasilnya hanya memuat angka yang tampil di naskah; sel kecil (n < 5) tetap "<5", dan angkatan 2024 digabung ke
"angkatan 2025 dan sebelumnya" supaya sel kecil tidak terbuka lewat selisih.

Pakai:  python tools/jurnal/siapkan_angka.py
"""
import glob
import json
import pathlib
import re

AKAR = pathlib.Path(__file__).resolve().parents[2]
KULIAH = AKAR / "site" / "data" / "kuliah"


def kecil(x):
    return isinstance(x, str) and x.startswith("<")


def fakta_matakuliah(mk):
    materi = json.loads((KULIAH / mk / "materi.json").read_text(encoding="utf8"))
    kode = [b for b in materi if b.get("jenis", "kode") == "kode"]
    tes = 0
    for b in kode:
        f = KULIAH / mk / "challenges" / ("bab-%02d.json" % b["bab"])
        if f.exists():
            tes += len(json.loads(f.read_text(encoding="utf8")).get("tests", []))
    return {"bab": len(materi), "soal_koding": len(kode), "soal_konsep": len(materi) - len(kode), "kasus_uji": tes,
            "praktik": len(glob.glob(str(KULIAH / mk / "praktik" / "*.json")))}


def main():
    A = json.loads((AKAR / "docs" / "jurnal" / "data" / "agregat-supabase.json").read_text(encoding="utf8"))
    py, jv = fakta_matakuliah("algoritma-python"), fakta_matakuliah("pbo-java")
    js = [pathlib.Path(p).read_text(encoding="utf8") for p in glob.glob(str(AKAR / "site" / "js" / "*.js"))]
    worker = (AKAR / "site" / "js" / "pyworker.js").read_text(encoding="utf8")
    runner = (AKAR / "site" / "js" / "runner.js").read_text(encoding="utf8")
    sistem = {
        "pyodide": re.search(r"pyodide/v([0-9.]+)", worker).group(1),
        "batas_detik": int(re.search(r"TIMEOUT_MS = (\d+)", runner).group(1)) // 1000,
        "berkas_js": len(js), "baris_js": sum(t.count("\n") for t in js),
        "migrasi": len(glob.glob(str(AKAR / "supabase" / "migrations" / "*.sql"))),
        "python": py, "java": jv,
    }
    p1 = A["bagian_1_populasi"]
    pop = {
        "peserta": p1["peserta"], "setuju": p1["persetujuan_riset"]["setuju"], "menolak": p1["persetujuan_riset"]["menolak"],
        "belum": p1["persetujuan_riset"]["belum_menjawab"],
        "angk_2026": p1["peserta_per_angkatan"]["2026"],
        "angk_2025_ke_bawah": p1["peserta_per_angkatan"]["2025"] + (1 if kecil(p1["peserta_per_angkatan"]["2024"]) else p1["peserta_per_angkatan"]["2024"]),
        "aktif_python": p1["peserta_per_matakuliah_ada_aktivitas"]["algoritma-python"], "aktif_java": p1["peserta_per_matakuliah_ada_aktivitas"]["pbo-java"],
    }
    assert pop["angk_2026"] + pop["angk_2025_ke_bawah"] == pop["peserta"]

    def bab(mk):
        keluar = []
        for r in A["bagian_2_progres_per_bab"][mk]["semua"]:
            if isinstance(r["bab"], int) and not kecil(r["membuka"]) and not kecil(r["lulus"]) and r.get("kirim"):
                keluar.append({"bab": r["bab"], "membuka": r["membuka"], "lulus": r["lulus"], "kirim": r["kirim"],
                               "langsung": r["langsung"], "bantuan": r["bantuan"]})
        return keluar
    babs = {"python": bab("algoritma-python"), "java": bab("pbo-java")}
    # bab 1 dan 2 Python: ada yang lulus tetapi tanpa statistik kirim; ambil apa adanya dari tabel semua
    for r in A["bagian_2_progres_per_bab"]["algoritma-python"]["semua"]:
        if r["bab"] in (1, 2) and not any(b["bab"] == r["bab"] for b in babs["python"]):
            babs["python"].insert(r["bab"] - 1, {"bab": r["bab"], "membuka": r["membuka"], "lulus": r["lulus"], "kirim": r.get("kirim"), "langsung": r.get("langsung"), "bantuan": r.get("bantuan")})

    def jalur(daftar, dari, sampai):
        lulus = sum(b["lulus"] for b in daftar if dari <= b["bab"] <= sampai)
        lang = sum(b["langsung"] for b in daftar if dari <= b["bab"] <= sampai and not kecil(b["langsung"]))
        return lulus, lulus - lang
    lp, bp = jalur(babs["python"], 3, 6)
    lj, bj = jalur(babs["java"], 1, 9)
    pc = A["bagian_3_percobaan"]
    semua, setuju = pc["semua"], pc["setuju"]
    galat = [(k, v) for k, v in semua["galat_jenis_10_terbanyak"].items()]
    galat.sort(key=lambda x: -x[1])
    asal = {"CannotResolve": "Java", "GalatKompilasi": "Java", "TypeMismatch": "Java", "NumberFormatException": "Java", "Timeout": "Python dan Java"}
    ph = semua["sebaran_petunjuk"]
    ph_total = sum(v for k, v in ph.items() if k != "kosong")
    pola_s = A["bagian_4_perilaku_menulis"]["setuju"]
    ss = A["bagian_5_sesi_belajar"]["semua"]
    jam = {int(k): v for k, v in ss["sebaran_jam_mulai_wib"].items()}
    lap, prk = A["bagian_6_laporan"], A["bagian_7_praktikum"]["praktikum_tahap"]
    out = {
        "sistem": sistem,
        "periode": {"mulai": A["bagian_1_populasi"]["rentang_waktu_data"]["percobaan"][0], "akhir": A["bagian_1_populasi"]["rentang_waktu_data"]["percobaan"][1], "diambil": A["meta"]["diambil_pada"]},
        "populasi": pop,
        "bab": babs,
        "jalur": {"py_3_6_lulus": lp, "py_3_6_bantuan": bp, "jv_1_9_lulus": lj, "jv_1_9_bantuan": bj},
        "percobaan": {
            "baris": semua["baris"], "peserta": semua["peserta_dengan_min_1_percobaan"], "jalankan": semua["per_jenis"]["jalankan"], "kirim": semua["per_jenis"]["kirim"],
            "py_jalankan": semua["per_matakuliah_jenis"]["algoritma-python/jalankan"], "py_kirim": semua["per_matakuliah_jenis"]["algoritma-python/kirim"],
            "jv_jalankan": semua["per_matakuliah_jenis"]["pbo-java/jalankan"], "jv_kirim": semua["per_matakuliah_jenis"]["pbo-java/kirim"],
            "kirim_lulus": semua["kirim_lulus_vs_gagal"]["lulus"], "kirim_gagal": semua["kirim_lulus_vs_gagal"]["gagal"], "prop_lulus": semua["kirim_lulus_vs_gagal"]["proporsi_lulus"],
            "prop_lulus_setuju": setuju["kirim_lulus_vs_gagal"]["proporsi_lulus"], "baris_setuju": setuju["baris"],
            "rasio_kasus": semua["rasio_kasus_lulus_pada_kirim_q1_med_q3"],
            "hasil": semua["per_hasil"],
        },
        "galat": {"daftar": [[k, v, asal.get(k, "Python")] for k, v in galat], "dasar": semua["per_hasil"]["galat"] + semua["per_hasil"]["timeout"]},
        "petunjuk": {"sebaran": {k: v for k, v in ph.items() if k != "kosong"}, "total": ph_total},
        "pola": {k: pola_s[k]["q"] for k in ("diketik", "dihapus", "rasio_hapus", "cps", "lompat", "jalankan")},
        "pola_n": pola_s["diketik"]["n"],
        "sesi": {"sesi": ss["sesi"], "nol": ss["sesi_aktif_detik_nol"], "total_jam": ss["total_jam_aktif"], "per_peserta": ss["sesi_per_peserta_q1_med_q3"], "jam_per_peserta": ss["jam_aktif_per_peserta_q1_med_q3"], "per_jam": [jam[h] for h in range(24)]},
        "laporan": {"baris": lap["laporan_bab"]["baris_peserta"], "draf": lap["laporan_bab"]["per_status"]["draf"], "dikumpulkan": lap["laporan_bab"]["per_status"]["dikumpulkan"],
                    "dengan_tempel": lap["laporan_bab"]["laporan_dengan_percobaan_tempel"]["dengan_tempel"], "dari": lap["laporan_bab"]["laporan_dengan_percobaan_tempel"]["dari"],
                    "dinilai": lap["penilaian_laporan"]["baris"]},
        "praktikum": {"baris": prk["baris"], "peserta": prk["peserta"], "lulus": prk["lulus"], "prop": prk["proporsi_lulus"], "kirim": prk["jumlah_kirim_saat_lulus_q1_med_q3"]},
    }
    jalur_out = AKAR / "docs" / "jurnal" / "naskah" / "angka-naskah.json"
    jalur_out.parent.mkdir(parents=True, exist_ok=True)
    jalur_out.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    print("ditulis:", jalur_out)


if __name__ == "__main__":
    main()
