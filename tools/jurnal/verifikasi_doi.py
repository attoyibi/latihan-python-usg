"""Memeriksa setiap DOI di daftar pustaka naskah: harus terdaftar, resolve, dan cocok dengan judul/tahun yang ditulis.

Pakai:  python tools/jurnal/verifikasi_doi.py docs/jurnal/naskah/<berkas>.docx
Untuk tiap DOI di daftar pustaka:
  1. api Handle doi.org: responseCode 1 = DOI terdaftar;
  2. tautan https://doi.org/<doi> diikuti sampai halaman akhir (curl -L). 200, 202 atau 403 (penerbit menolak bot) dianggap hidup;
  3. metadata Crossref dibandingkan dengan teks referensi: tahun dan sebagian besar kata judul harus sama.
Keluar dengan kode 1 bila ada yang gagal. Tidak ada DOI yang ditebak: semua berasal dari Crossref.
"""
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request

from docx import Document


def ambil(url):
    r = urllib.request.Request(url, headers={"User-Agent": "verifikasi-doi/1.0"})
    return json.load(urllib.request.urlopen(r, timeout=40))


def kata(s):
    return set(w for w in re.findall(r"[a-z0-9]{4,}", re.sub(r"<[^>]+>", " ", s.lower())))


def main(berkas):
    doc = Document(berkas)
    teks = [p.text for p in doc.paragraphs]
    mulai = next(i for i, t in enumerate(teks) if t.strip().upper() == "DAFTAR PUSTAKA")
    refs = [t for t in teks[mulai + 1:] if t.strip()]
    gagal = 0
    for t in refs:
        m = re.search(r"https://doi\.org/(\S+?)\.?$", t.strip())
        if not m:
            print("TANPA DOI :", t[:90]); continue
        doi = m.group(1)
        masalah = []
        try:
            if ambil("https://doi.org/api/handles/" + urllib.parse.quote(doi)).get("responseCode") != 1:
                masalah.append("DOI tidak terdaftar")
        except Exception as e:
            masalah.append("handle: " + str(e)[:50])
        try:
            kode = subprocess.run(["curl", "-s", "-L", "-o", "NUL" if sys.platform == "win32" else "/dev/null", "-m", "40", "-A", "Mozilla/5.0", "-w", "%{http_code}", "https://doi.org/" + doi], capture_output=True, text=True, timeout=60).stdout.strip()
            if kode not in ("200", "202", "403"):
                masalah.append("HTTP " + kode)
        except Exception as e:
            masalah.append("curl: " + str(e)[:40])
        try:
            m2 = ambil("https://api.crossref.org/works/" + urllib.parse.quote(doi))["message"]
            judul = (m2.get("title") or [""])[0]
            tahun = str((m2.get("issued", {}).get("date-parts") or [[None]])[0][0])
            kb, ka = kata(judul), kata(t)
            cocok = len(kb & ka) / max(1, len(kb))
            if "(" + tahun + ")" not in t:
                masalah.append("tahun %s tidak sama" % tahun)
            if cocok < 0.8:
                masalah.append("judul tidak cocok (%.0f%%)" % (cocok * 100))
        except Exception as e:
            masalah.append("crossref: " + str(e)[:50])
        print(("GAGAL     : " if masalah else "OK        : ") + doi + ("  " + "; ".join(masalah) if masalah else ""))
        gagal += bool(masalah)
    print("\n%d referensi, %d bermasalah" % (len(refs), gagal))
    sys.exit(1 if gagal else 0)


if __name__ == "__main__":
    main(sys.argv[1])
