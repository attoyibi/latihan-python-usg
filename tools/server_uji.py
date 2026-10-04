#!/usr/bin/env python3
"""Server uji: menyajikan folder site/ dengan login TIRUAN (tanpa Supabase sungguhan).

Berkas /config.js diganti dengan tools/klien-tiruan.js, jadi alur masuk, data awal, dan profil
bisa dicoba di komputer sendiri (masuk dengan email dan kata sandi, daftar, lupa kata sandi). Akun contoh ada di docs/DAFTARKAN-PESERTA.md.
Setiap kali situs "mengirim email", kotak "Email tiruan" muncul di pojok kanan bawah; tombolnya meniru klik tautan di email.
Data tiruan tersimpan di localStorage browser, bukan di server. Folder site/ tidak diubah.

Jalankan dari akar repositori:  python tools/server_uji.py [port]
"""
import http.server
import socketserver
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
FAKE = ROOT / "tools" / "klien-tiruan.js"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8124


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def do_GET(self):
        if self.path.split("?")[0] == "/config.js":
            data = FAKE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Server uji (login tiruan) di http://127.0.0.1:{PORT}  | akun contoh: lihat docs/DAFTARKAN-PESERTA.md | hentikan dengan Ctrl+C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nBerhenti.")
