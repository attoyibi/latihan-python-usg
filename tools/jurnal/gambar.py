"""Gambar untuk naskah (matplotlib, Times New Roman, 300 dpi, hitam-putih ramah cetak).

Gambar 1 (arsitektur) dan Gambar 2 (tahapan kegiatan) tidak bergantung data. Grafik data dibuat dari angka agregat
(docs/jurnal/naskah/angka-naskah.json) oleh fungsi grafik_*.
"""
import pathlib

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

plt.rcParams.update({"font.family": "serif", "font.serif": ["Times New Roman", "DejaVu Serif"], "font.size": 9})
DPI = 300
ABU = "#eeeeee"
ABU2 = "#d9d9d9"


def kotak(ax, x, y, w, h, judul, isi=(), fc=ABU, tebal=True):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.08", fc=fc, ec="black", lw=0.9))
    ax.text(x + w / 2, y + h - 0.16, judul, ha="center", va="top", fontsize=9, fontweight="bold" if tebal else "normal")
    for i, t in enumerate(isi):
        ax.text(x + w / 2, y + h - 0.5 - i * 0.3, t, ha="center", va="top", fontsize=8)


def panah(ax, x1, y1, x2, y2, label="", dx=0.0, dy=0.12, dua=False):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle="<->" if dua else "->", lw=0.9, color="black"))
    if label:
        ax.text((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, label, ha="center", va="bottom", fontsize=7, style="italic", bbox=dict(fc="white", ec="none", pad=0.6))


def arsitektur(jalur):
    fig, ax = plt.subplots(figsize=(6.2, 3.3))
    ax.set_xlim(0, 10.6); ax.set_ylim(0, 5.6); ax.axis("off")
    kotak(ax, 0.1, 1.9, 4.2, 3.6, "Browser mahasiswa", ["Antarmuka HTML, CSS, JavaScript", "Editor kode (CodeMirror)", "Pyodide: Python di WebAssembly", "(Web Worker, batas 5 detik)", "Penilai: keluaran vs kasus uji"], fc=ABU)
    kotak(ax, 0.1, 0.1, 4.2, 1.3, "Dasbor dosen", ["Rekap, jejak peserta, ekspor anonim"], fc="white")
    kotak(ax, 6.3, 3.9, 4.2, 1.6, "Hosting statis", ["Berkas situs dan materi bab", "(tanpa server eksekusi kode)"], fc="white")
    kotak(ax, 6.3, 0.1, 4.2, 3.3, "Supabase", ["Autentikasi email dan kata sandi", "PostgreSQL + aturan akses per baris", "progres, percobaan, sesi belajar,", "laporan, persetujuan riset"], fc=ABU2)
    panah(ax, 6.3, 4.7, 4.3, 4.7, "memuat situs", dy=0.08)
    panah(ax, 4.3, 2.7, 6.3, 2.7, "simpan dan baca", dua=True, dy=0.08)
    panah(ax, 6.3, 0.75, 4.3, 0.75, "data diolah", dy=0.08)
    fig.savefig(jalur, dpi=DPI, bbox_inches="tight"); plt.close(fig)


def tahapan(jalur, kapsul):
    """kapsul: empat (judul, [baris]) untuk tahap kegiatan."""
    fig, ax = plt.subplots(figsize=(6.2, 2.5))
    ax.set_xlim(0, 12.4); ax.set_ylim(0, 4); ax.axis("off")
    for i, (j, isi) in enumerate(kapsul):
        x = 0.1 + i * 3.1
        kotak(ax, x, 0.3, 2.8, 3.4, "%d. %s" % (i + 1, j), isi, fc=ABU if i % 2 == 0 else ABU2)
        if i < len(kapsul) - 1:
            ax.annotate("", xy=(x + 3.1, 2.0), xytext=(x + 2.8, 2.0), arrowprops=dict(arrowstyle="->", lw=1.0))
    fig.savefig(jalur, dpi=DPI, bbox_inches="tight"); plt.close(fig)


def grafik_bar(jalur, label, nilai, judul_y, horizontal=False, ukuran=(6.2, 2.6), anotasi=True):
    fig, ax = plt.subplots(figsize=ukuran)
    if horizontal:
        ax.barh(label[::-1], nilai[::-1], color="#7f7f7f", edgecolor="black", lw=0.6)
        ax.set_xlabel(judul_y)
        if anotasi:
            for i, v in enumerate(nilai[::-1]):
                ax.text(v, i, " %s" % (("%.0f" % v) if float(v).is_integer() else ("%.1f" % v)), va="center", fontsize=8)
    else:
        ax.bar(label, nilai, color="#7f7f7f", edgecolor="black", lw=0.6)
        ax.set_ylabel(judul_y)
        if anotasi:
            for i, v in enumerate(nilai):
                ax.text(i, v, ("%.0f" % v) if float(v).is_integer() else ("%.1f" % v), ha="center", va="bottom", fontsize=8)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.tight_layout(); fig.savefig(jalur, dpi=DPI); plt.close(fig)


if __name__ == "__main__":
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".") if (sys := __import__("sys")) else None
    arsitektur(out / "gambar-arsitektur.png")
    tahapan(out / "gambar-tahapan.png", [("Analisis", ["kebutuhan belajar", "kendala perangkat"]), ("Rancangan", ["platform dan materi", "aturan privasi"]), ("Implementasi", ["pendampingan kelas", "latihan mandiri"]), ("Evaluasi", ["rekaman anonim", "analisis deskriptif"])])
