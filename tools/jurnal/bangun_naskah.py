"""Membangun naskah jurnal (DOCX) di atas template Jurnal Abdi Guna (docs/jurnal/standar/).

Template dipakai sebagai dasar (header, footer, gaya huruf, ukuran kertas), isi badan diganti. Aturan format diambil dari
teks template dan dirangkum di docs/jurnal/STANDAR-JURNAL.md:
  A4, satu kolom, margin atas 4 cm / bawah 2,5 / kiri 3 / kanan 2,5; Times New Roman 11 pt, satu spasi;
  judul bagian KAPITAL tebal rata tengah; judul subbagian tebal, huruf kapital di awal kata, tanpa indentasi;
  judul tabel di atas (10 pt, tengah), tabel tanpa garis vertikal; judul gambar di bawah (10 pt, tengah).

Pakai:  python tools/jurnal/bangun_naskah.py            (membaca isi dari isi_naskah.py, menulis DOCX)
"""
import copy
import pathlib
import re
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

AKAR = pathlib.Path(__file__).resolve().parents[2]
TEMPLATE = AKAR / "docs" / "jurnal" / "standar" / "Template jurnal PKM_abdi guna_acc direksi.docx"
FONT = "Times New Roman"


def _font(run, size=11, bold=False, italic=False, color=None):
    run.font.name = FONT
    rpr = run._element.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts")
        rpr.insert(0, rf)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(a), FONT)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        from docx.shared import RGBColor
        run.font.color.rgb = RGBColor.from_string(color)


def _fmt(p, align="both", before=0, after=0, left=0.0, first=0.0, hanging=0.0, keep_next=False, line=1.0):
    pf = p.paragraph_format
    pf.alignment = {"both": WD_ALIGN_PARAGRAPH.JUSTIFY, "center": WD_ALIGN_PARAGRAPH.CENTER, "left": WD_ALIGN_PARAGRAPH.LEFT}[align]
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    pf.left_indent = Cm(left + hanging)
    pf.first_line_indent = Cm(first - hanging) if (first or hanging) else Cm(0)
    pf.keep_with_next = keep_next
    pf.widow_control = True


def _runs(p, teks, size=11, bold=False, italic=False):
    """Teks dengan penanda sederhana: *miring*, **tebal**. Istilah asing dicetak miring sesuai template."""
    for bagian in re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*)", teks):
        if not bagian:
            continue
        if bagian.startswith("**"):
            r = p.add_run(bagian[2:-2]); _font(r, size, True, italic)
        elif bagian.startswith("*"):
            r = p.add_run(bagian[1:-1]); _font(r, size, bold, True)
        else:
            r = p.add_run(bagian); _font(r, size, bold, italic)


class Naskah:
    def __init__(self):
        self.doc = Document(str(TEMPLATE))
        self.n_tabel = 0
        self.n_gambar = 0
        body = self.doc.element.body
        for el in list(body):
            if el.tag != qn("w:sectPr"):
                body.remove(el)
        sec = self.doc.sections[0]
        sec.top_margin, sec.bottom_margin = Cm(4), Cm(2.5)
        sec.left_margin, sec.right_margin = Cm(3), Cm(2.5)

    # ---- header (diisi dari info terbitan) ----
    def isi_header(self, baris):
        """baris: daftar (teks_lama, teks_baru) untuk run di header halaman pertama."""
        for h in (self.doc.sections[0].first_page_header, self.doc.sections[0].header):
            for p in h.paragraphs:
                for r in p.runs:
                    for lama, baru in baris:
                        if lama in r.text:
                            r.text = r.text.replace(lama, baru)

    # ---- blok halaman pertama ----
    def judul(self, teks):
        p = self.doc.add_paragraph(); _fmt(p, "center", after=0); r = p.add_run(teks); _font(r, 14, True)

    def penulis(self, teks):
        p = self.doc.add_paragraph(); _fmt(p, "center", before=12, after=6)
        _runs(p, teks, 11, bold=True)

    def baris_tengah(self, teks, before=0, after=0):
        p = self.doc.add_paragraph(); _fmt(p, "center", before=before, after=after); _runs(p, teks, 11)

    def judul_abstrak(self, teks, miring=False):
        p = self.doc.add_paragraph(); _fmt(p, "center", before=12 if not miring else 6, keep_next=True)
        r = p.add_run(teks); _font(r, 11, True, miring)

    def abstrak(self, teks, kata_kunci, label_kk):
        p = self.doc.add_paragraph(); _fmt(p, "both", before=8, after=0); _runs(p, teks, 11)
        k = self.doc.add_paragraph(); _fmt(k, "both", before=4)
        r = k.add_run(label_kk + " "); _font(r, 11)
        r = k.add_run(kata_kunci); _font(r, 11)

    # ---- badan ----
    def bagian(self, teks):
        p = self.doc.add_paragraph(); _fmt(p, "center", before=14, after=6, keep_next=True)
        r = p.add_run(teks.upper()); _font(r, 11, True)

    def subbagian(self, teks):
        p = self.doc.add_paragraph(); _fmt(p, "left", before=8, after=3, keep_next=True)
        r = p.add_run(teks); _font(r, 11, True)

    def para(self, teks):
        p = self.doc.add_paragraph(); _fmt(p, "both"); _runs(p, teks, 11)

    def persamaan(self, teks, nomor):
        p = self.doc.add_paragraph(); _fmt(p, "center", before=3, after=3)
        r = p.add_run(teks + "\t(" + str(nomor) + ")"); _font(r, 11)

    def tabel(self, judul, kolom, baris, lebar_cm, sumber, rata=None):
        self.n_tabel += 1
        for t in ("Tabel %d" % self.n_tabel, judul):
            p = self.doc.add_paragraph(); _fmt(p, "center", before=6 if t.startswith("Tabel") else 0, keep_next=True)
            r = p.add_run(t); _font(r, 10, True)
        t = self.doc.add_table(rows=1 + len(baris), cols=len(kolom))
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        t.autofit = False
        tblPr = t._tbl.tblPr
        borders = OxmlElement("w:tblBorders")
        for sisi, nilai in (("top", "single"), ("bottom", "single"), ("left", "nil"), ("right", "nil"), ("insideH", "nil"), ("insideV", "nil")):
            e = OxmlElement("w:" + sisi); e.set(qn("w:val"), nilai); e.set(qn("w:sz"), "6"); e.set(qn("w:space"), "0"); e.set(qn("w:color"), "000000"); borders.append(e)
        tblPr.append(borders)
        rata = rata or ["left"] + ["center"] * (len(kolom) - 1)
        trh = t.rows[0]._tr.get_or_add_trPr(); th = OxmlElement("w:tblHeader"); trh.append(th)  # judul kolom diulang bila tabel pindah halaman
        for i, row in enumerate([kolom] + baris):
            for j, sel in enumerate(row):
                c = t.cell(i, j); c.width = Cm(lebar_cm[j])
                p = c.paragraphs[0]; _fmt(p, rata[j] if i else "center", before=1, after=1)
                _runs(p, str(sel), 10, bold=(i == 0))
                if i == 0:  # garis di bawah judul kolom
                    tcPr = c._tc.get_or_add_tcPr(); b = OxmlElement("w:tcBorders"); e = OxmlElement("w:bottom")
                    e.set(qn("w:val"), "single"); e.set(qn("w:sz"), "6"); e.set(qn("w:color"), "000000"); b.append(e); tcPr.append(b)
            trPr = t.rows[i]._tr.get_or_add_trPr(); cs = OxmlElement("w:cantSplit"); trPr.append(cs)
        p = self.doc.add_paragraph(); _fmt(p, "left", before=2, after=8); _runs(p, "Sumber: " + sumber, 10)

    def gambar(self, berkas, judul, lebar_cm):
        self.n_gambar += 1
        p = self.doc.add_paragraph(); _fmt(p, "center", before=6, keep_next=True)
        p.add_run().add_picture(str(berkas), width=Cm(lebar_cm))
        c = self.doc.add_paragraph(); _fmt(c, "center", before=2, after=8)
        r = c.add_run("Gambar %d. %s" % (self.n_gambar, judul)); _font(r, 10, False, True)

    def pustaka(self, entri):
        for e in entri:
            p = self.doc.add_paragraph(); _fmt(p, "left", hanging=1.0, after=3); _runs(p, e, 11)

    def simpan(self, jalur):
        self.doc.save(str(jalur))


def main():
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    import isi_hasil
    n = Naskah()
    isi_hasil.susun(n)
    keluar = AKAR / "docs" / "jurnal" / "naskah" / isi_hasil.NAMA_BERKAS
    keluar.parent.mkdir(parents=True, exist_ok=True)
    n.simpan(keluar)
    print("ditulis:", keluar)


if __name__ == "__main__":
    main()
