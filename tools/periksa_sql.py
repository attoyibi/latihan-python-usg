#!/usr/bin/env python3
"""Memeriksa sintaks seluruh berkas SQL di supabase/ memakai parser PostgreSQL asli (pglast).

Memerlukan:  pip install pglast
Jalankan dari akar repositori:  python tools/periksa_sql.py
"""
import sys
from pathlib import Path

import pglast

ROOT = Path(__file__).resolve().parent.parent
gagal = 0
for f in sorted((ROOT / "supabase").rglob("*.sql")):
    try:
        n = len(pglast.parse_sql(f.read_text(encoding="utf8")))
        print(f"OK     {f.relative_to(ROOT)} ({n} pernyataan)")
    except Exception as e:  # noqa: BLE001
        gagal += 1
        print(f"GAGAL  {f.relative_to(ROOT)}: {e}")
sys.exit(1 if gagal else 0)
