# Penguji praktikum. Dipakai oleh pyworker.js (Pyodide di browser) DAN oleh tools/uji_praktikum.py (Python biasa),
# sehingga isi praktikum bisa diuji dengan Python sungguhan sebelum sampai ke peserta.
#
# Satu fungsi masuk: praktikum_jalankan(json_teks) -> json_teks.
#   {"aksi": "kasus",    "dir": "...", "kasus": [ ... ]}                 menguji tiap kasus, hasil per kasus
#   {"aksi": "jalankan", "dir": "...", "entri": "kasir.py", "masukan": []}  menjalankan satu berkas, mengembalikan keluaran
#
# Jenis kasus:
#   {"nama": "...", "kode": "from x import f\nassert f(1) == 2"}                 lulus bila kode tidak melempar galat
#   {"nama": "...", "jalankan": "menu.py", "masukan": ["2", "3"], "memuat": ["Total"]}   keluaran harus memuat semua teks
# Tambahan: "tersembunyi": true (rincian gagal tidak ditampilkan).
import contextlib
import importlib
import io
import json
import linecache
import os
import runpy
import sys
import traceback
import builtins

BATAS_KELUARAN = 20000


def _bersihkan_modul(dir_):
    for nama in list(sys.modules):
        berkas = getattr(sys.modules[nama], "__file__", None)
        if berkas and str(berkas).startswith(dir_):
            del sys.modules[nama]
    importlib.invalidate_caches()


def _foto_builtins():
    return dict(vars(builtins))


def _pulihkan_builtins(foto):
    # Kode peserta boleh mengubah builtins (mis. menimpa sorted); pulihkan agar tidak memengaruhi kasus atau berkas berikutnya.
    for k in list(vars(builtins)):
        if k not in foto:
            delattr(builtins, k)
    for k, v in foto.items():
        if getattr(builtins, k, None) is not v:
            setattr(builtins, k, v)


def _siapkan(dir_):
    os.chdir(dir_)
    if dir_ not in sys.path:
        sys.path.insert(0, dir_)
    _bersihkan_modul(dir_)


def _pasang_input(masukan, echo):
    antrean = list(masukan or [])

    def _input(prompt=""):
        if not antrean:
            raise EOFError("EOF when reading a line")
        nilai = antrean.pop(0)
        if echo:
            print(str(prompt) + nilai)
        return nilai

    builtins.input = _input


def _pesan_galat(e, dir_):
    jenis = type(e).__name__
    isi = str(e)
    letak = ""
    teks_baris = ""
    for bingkai in reversed(traceback.extract_tb(e.__traceback__)):
        nama = bingkai.filename or ""
        if nama == "<kasus>" or nama.startswith(dir_):
            letak = (" (baris %s di %s)" % (bingkai.lineno, os.path.basename(nama))) if nama != "<kasus>" else ""
            teks_baris = (bingkai.line or "").strip()
            break
    if isinstance(e, AssertionError) and not isi and teks_baris:
        return "Tidak cocok: %s" % teks_baris
    if isi:
        return "%s: %s%s" % (jenis, isi, letak)
    return "%s%s" % (jenis, letak)


def _jalankan_kode_kasus(dir_, kode, masukan):
    linecache.cache["<kasus>"] = (len(kode), None, kode.splitlines(True), "<kasus>")
    ruang = {"__name__": "__kasus__"}
    _pasang_input(masukan, False)
    exec(compile(kode, "<kasus>", "exec"), ruang)


def _satu_kasus(dir_, kasus):
    hasil = {"nama": kasus.get("nama", "kasus"), "tersembunyi": bool(kasus.get("tersembunyi")), "lulus": False, "pesan": "", "keluaran": ""}
    keluar = io.StringIO()
    foto = _foto_builtins()
    try:
        _siapkan(dir_)
        with contextlib.redirect_stdout(keluar), contextlib.redirect_stderr(keluar):
            if kasus.get("jalankan"):
                _pasang_input(kasus.get("masukan"), True)
                runpy.run_path(os.path.join(dir_, kasus["jalankan"]), run_name="__main__")
            else:
                _jalankan_kode_kasus(dir_, kasus.get("kode", ""), kasus.get("masukan"))
        teks = keluar.getvalue()
        hasil["keluaran"] = teks[:BATAS_KELUARAN]
        wajib = kasus.get("memuat") or []
        hilang = [w for w in wajib if w not in teks]
        if hilang:
            hasil["pesan"] = "Keluaran belum memuat: " + "; ".join(repr(h) for h in hilang)
        else:
            hasil["lulus"] = True
    except SystemExit:
        hasil["keluaran"] = keluar.getvalue()[:BATAS_KELUARAN]
        hasil["pesan"] = "Program berhenti sebelum selesai."
    except BaseException as e:  # noqa: BLE001 - galat apa pun milik peserta harus dilaporkan, bukan menghentikan penguji
        hasil["keluaran"] = keluar.getvalue()[:BATAS_KELUARAN]
        hasil["pesan"] = _pesan_galat(e, dir_)
    finally:
        _pulihkan_builtins(foto)
        _bersihkan_modul(dir_)
    return hasil


def _jalankan_berkas(dir_, entri, masukan):
    keluar = io.StringIO()
    galat = None
    foto = _foto_builtins()
    try:
        _siapkan(dir_)
        _pasang_input(masukan, True)
        with contextlib.redirect_stdout(keluar), contextlib.redirect_stderr(keluar):
            runpy.run_path(os.path.join(dir_, entri), run_name="__main__")
    except SystemExit:
        pass
    except BaseException as e:  # noqa: BLE001
        galat = _pesan_galat(e, dir_)
    finally:
        _pulihkan_builtins(foto)
        _bersihkan_modul(dir_)
    return {"keluaran": keluar.getvalue()[:BATAS_KELUARAN], "galat": galat}


def praktikum_jalankan(teks):
    perintah = json.loads(teks)
    dir_ = perintah["dir"]
    asli_input = builtins.input
    try:
        if perintah["aksi"] == "kasus":
            return json.dumps({"kasus": [_satu_kasus(dir_, k) for k in perintah["kasus"]]})
        return json.dumps(_jalankan_berkas(dir_, perintah["entri"], perintah.get("masukan")))
    finally:
        builtins.input = asli_input
