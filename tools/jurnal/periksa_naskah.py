"""Memeriksa naskah DOCX terhadap aturan template (docs/jurnal/STANDAR-JURNAL.md). Keluar 1 bila ada yang gagal.

Pakai:  python tools/jurnal/periksa_naskah.py docs/jurnal/naskah/<berkas>.docx [jumlah_halaman_pdf]
Yang diperiksa: ukuran kertas dan margin, huruf Times New Roman 11 pt, panjang judul (maks 20 kata), abstrak Inggris dan
Indonesia (maks 250 kata) beserta 3-5 kata kunci urut abjad, porsi Pendahuluan (maks 20%) dan Metode (maks 15%),
jumlah referensi (min 20, semua 2021 ke atas), setiap referensi dikutip di teks dan setiap kutipan ada di daftar pustaka,
tabel tanpa garis vertikal, urutan nomor tabel dan gambar.
"""
import re
import sys

from docx import Document
from docx.shared import Cm


def kata(t):
    return len(re.findall(r"\S+", t))


def main(berkas, halaman=None):
    d = Document(berkas)
    P = [p.text.strip() for p in d.paragraphs]
    gagal = []

    def cek(nama, ok, info=""):
        print(("OK     " if ok else "GAGAL  ") + nama + (" — " + info if info else ""))
        if not ok:
            gagal.append(nama)

    s = d.sections[0]
    cek("A4", abs(s.page_width.cm - 21.0) < 0.1 and abs(s.page_height.cm - 29.7) < 0.1, "%.1f x %.1f cm" % (s.page_width.cm, s.page_height.cm))
    cek("margin 4 / 2,5 / 3 / 2,5 cm", all(abs(a - b) < 0.05 for a, b in zip((s.top_margin.cm, s.bottom_margin.cm, s.left_margin.cm, s.right_margin.cm), (4, 2.5, 3, 2.5))))
    huruf = {(r.font.name, r.font.size.pt if r.font.size else None) for p in d.paragraphs for r in p.runs if r.text.strip()}
    cek("huruf Times New Roman", all(n == "Times New Roman" for n, _ in huruf), str(sorted(huruf, key=str)))
    judul = next(t for t in P if t)
    cek("judul maks 20 kata", kata(judul) <= 20, "%d kata" % kata(judul))

    i_abs, i_abk = P.index("ABSTRACT"), P.index("ABSTRAK")
    ab_en = next(t for t in P[i_abs + 1:i_abk] if t and not t.startswith("Keywords"))
    kk_en = next(t for t in P[i_abs + 1:i_abk] if t.startswith("Keywords:"))
    i_pen = P.index("PENDAHULUAN")
    ab_id = next(t for t in P[i_abk + 1:i_pen] if t and not t.startswith("Kata Kunci"))
    kk_id = next(t for t in P[i_abk + 1:i_pen] if t.startswith("Kata Kunci:"))
    cek("abstrak Inggris maks 250 kata", kata(ab_en) <= 250, "%d kata" % kata(ab_en))
    cek("abstrak Indonesia maks 250 kata", kata(ab_id) <= 250, "%d kata" % kata(ab_id))
    for nama, kk in (("Inggris", kk_en), ("Indonesia", kk_id)):
        daftar = [k.strip().rstrip(".") for k in kk.split(":", 1)[1].split(",")]
        cek("kata kunci %s 3-5 dan urut abjad" % nama, 3 <= len(daftar) <= 5 and daftar == sorted(daftar, key=str.lower), "; ".join(daftar))
    cek("abstrak tanpa angka statistik", not re.search(r"\d", ab_en + ab_id), "abstrak tidak boleh memuat data statistik")

    i_met, i_has, i_kes, i_pus = P.index("METODE"), P.index("HASIL DAN PEMBAHASAN"), P.index("KESIMPULAN"), P.index("DAFTAR PUSTAKA")
    total = kata(" ".join(P[i_pen:i_pus]))
    pen, met = kata(" ".join(P[i_pen:i_met])), kata(" ".join(P[i_met:i_has]))
    cek("Pendahuluan maks 20%% isi", pen / total <= 0.20, "%.1f%%" % (pen / total * 100))
    cek("Metode maks 15%% isi", met / total <= 0.15, "%.1f%%" % (met / total * 100))

    refs = [t for t in P[i_pus + 1:] if t]
    tahun = [int(re.search(r"\((20\d\d)\)", r).group(1)) for r in refs]
    cek("referensi minimal 20", len(refs) >= 20, "%d referensi" % len(refs))
    cek("semua referensi 2021 atau lebih baru", min(tahun) >= 2021, "tahun %d-%d" % (min(tahun), max(tahun)))
    cek("setiap referensi punya DOI", all("https://doi.org/" in r for r in refs))
    cek("daftar pustaka urut abjad", [r.lower() for r in refs] == sorted(r.lower() for r in refs))
    isi = " ".join(P[i_pen:i_pus])
    kunci_ref = []
    for r in refs:
        nama = r.split(",")[0]
        kunci_ref.append((nama, int(re.search(r"\((20\d\d)\)", r).group(1))))
    belum = [f"{n} {y}" for n, y in kunci_ref if not re.search(r"%s[^()]{0,80}?,? \(?%d" % (re.escape(n.split()[-1]), y), isi)]
    cek("setiap referensi dikutip di teks", not belum, ", ".join(belum))
    token = set(re.findall(r"([A-Z][\wÀ-ſ\-]+)(?: & [A-Z][\wÀ-ſ\-]+| et al\.)?, (20\d\d)", isi))
    asing = [f"{n} {y}" for n, y in token if not any(int(y) == ry and n in rn for rn, ry in kunci_ref)]
    cek("setiap kutipan ada di daftar pustaka", not asing, ", ".join(asing))

    for t in d.tables:
        xml = t._tbl.xml
        cek("tabel tanpa garis vertikal", '<w:left w:val="nil"' in xml and '<w:insideV w:val="nil"' in xml)
    nt = [int(x) for p in P for x in re.findall(r"^Tabel (\d+)$", p)]
    ng = [int(x) for p in P for x in re.findall(r"^Gambar (\d+)\.", p)]
    cek("nomor tabel berurutan", nt == list(range(1, len(nt) + 1)), str(nt))
    cek("nomor gambar berurutan", ng == list(range(1, len(ng) + 1)), str(ng))
    if halaman:
        cek("8-15 halaman", 8 <= int(halaman) <= 15, "%s halaman" % halaman)
    print("\n%d pemeriksaan gagal" % len(gagal))
    sys.exit(1 if gagal else 0)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
