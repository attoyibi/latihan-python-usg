#!/usr/bin/env python3
"""Server uji: menyajikan folder site/ dengan login TIRUAN (tanpa Supabase sungguhan).

Berkas /config.js diganti dengan tools/klien-tiruan.js, jadi alur masuk, data awal, dan profil
bisa dicoba di komputer sendiri (masuk dengan email dan kata sandi, daftar, lupa kata sandi). Akun contoh ada di docs/DAFTARKAN-PESERTA.md.
Setiap kali situs "mengirim email", kotak "Email tiruan" muncul di pojok kanan bawah; tombolnya meniru klik tautan di email.
Data tiruan tersimpan di localStorage browser, bukan di server. Folder site/ tidak diubah.

Jalankan dari akar repositori:  python tools/server_uji.py [port]
"""
import http.server
import json
import socketserver
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
FAKE = ROOT / "tools" / "klien-tiruan.js"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8124


# Penyuntikan kegagalan untuk menguji pemulihan penjalan: buka /__gagal/java/mati, /__gagal/java/diam, atau
# /__gagal/java/normal (juga untuk python). "mati" = skrip worker gagal dimuat (galat langsung), "diam" = worker tidak pernah siap.
GAGAL = {"java": "normal", "python": "normal"}
WORKER = {"/js/javaworker.js": "java", "/js/pyworker.js": "python"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def kirim_skrip(self, isi):
        data = isi.encode("utf8")
        self.send_response(200)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        jalur = self.path.split("?")[0]
        if jalur.startswith("/__gagal/"):
            _, _, bahasa, mode = jalur.split("/")[:4]
            if bahasa in GAGAL and mode in ("mati", "diam", "normal"):
                GAGAL[bahasa] = mode
            self.kirim_skrip("ok " + json.dumps(GAGAL))
            return
        if jalur in WORKER and GAGAL[WORKER[jalur]] == "normal":
            # Skrip worker tidak boleh di-cache saat uji, supaya penyuntikan kegagalan berlaku pada muat berikutnya.
            self.kirim_skrip((SITE / jalur.lstrip("/")).read_text(encoding="utf8"))
            return
        if jalur in WORKER and GAGAL[WORKER[jalur]] != "normal":
            self.kirim_skrip('throw new Error("simulasi: skrip penjalan gagal diunduh");' if GAGAL[WORKER[jalur]] == "mati" else "self.onmessage = function () {};")
            return
        if self.path.split("?")[0] == "/config.js":
            data = FAKE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        rentang = self.headers.get("Range")
        if rentang and rentang.startswith("bytes="):
            # CheerpJ (penjalan Java) membaca berkas .jar per potongan dan butuh header Range.
            berkas = Path(self.translate_path(self.path.split("?")[0]))
            if berkas.is_file():
                data = berkas.read_bytes()
                awal, _, akhir = rentang[6:].partition("-")
                mulai = int(awal) if awal else max(0, len(data) - int(akhir))
                selesai = min(int(akhir), len(data) - 1) if akhir and awal else len(data) - 1
                bagian = data[mulai : selesai + 1]
                self.send_response(206)
                self.send_header("Content-Type", self.guess_type(str(berkas)))
                self.send_header("Content-Range", f"bytes {mulai}-{mulai + len(bagian) - 1}/{len(data)}")
                self.send_header("Content-Length", str(len(bagian)))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                self.wfile.write(bagian)
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
