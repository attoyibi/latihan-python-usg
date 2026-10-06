# Pendaftaran mandiri tanpa email (untuk kelas langsung)

Cocok bila kamu tidak keberatan siapa pun bisa mendaftar dan ingin peserta langsung masuk tanpa menunggu email. Peserta mengisi email dan kata sandi di halaman **Daftar**, lalu langsung diminta mengisi nama, NIM, dan kelas.

## Mengapa pendaftaran terhenti setelah dua kali mencoba
Itu batas **pengiriman email** Supabase. Pengiriman email bawaan hanya mengizinkan beberapa email per jam untuk seluruh proyek, dan pendaftaran dengan konfirmasi email memakai satu email per orang. Solusinya bukan menunggu, tetapi **tidak mengirim email**.

## Langkah pemasangan (sekali, di Supabase)
1. **Authentication > Sign In / Providers > Email**: matikan **Confirm email**. Pendaftaran lalu langsung masuk dan tidak ada email yang dikirim, jadi batas email tidak berlaku.
2. **Authentication > Sign In / Providers**: pastikan **Allow new users to sign up** menyala.
3. Panjang kata sandi minimum: 8.
4. `PENDAFTARAN` sudah **bawaan `buka`**, jadi tombol Daftar muncul tanpa mengatur apa pun di Vercel atau Netlify (isi `tutup` hanya bila ingin kelas tertutup).

## Yang tersedia bagi peserta
- **Daftar** (email dan kata sandi, langsung masuk), lalu mengisi nama, NIM, dan kelas satu kali.
- **Masuk** dan **Lupa kata sandi** (tautan lewat email).
- **Profil**: ubah nama, NIM, dan kelas (pilihan prodi, angkatan, kelas), dan **ganti kata sandi** saat sudah masuk, tanpa email. Email tidak bisa diubah.

## Batas yang tersisa
- **Masuk dan daftar per alamat IP:** bawaan sekitar 30 per 5 menit per IP (cek angka terbarunya di **Authentication > Rate Limits**, dan naikkan bila perlu). Satu kelas 20 orang di satu Wi-Fi aman; kelas 80 orang yang mendaftar serentak di Wi-Fi yang sama bisa terkena. Kalau terkena, peserta diminta menunggu beberapa menit atau memakai data seluler; situs menampilkan pesannya.
- **Lupa kata sandi lewat email** tetap memakai email, jadi kena batas email bawaan Supabase. Itu sebabnya peserta dianjurkan memakai **Ganti kata sandi di Profil** selagi masih bisa masuk. Cadangan bila lupa total dan email tidak datang: atur ulang kata sandi lewat `tools/impor_peserta.mjs --reset-sandi`. Untuk pengiriman email yang lebih longgar, pasang SMTP sendiri (lihat PEMASANGAN).
- Tanpa konfirmasi email, **email yang diketik tidak terbukti milik peserta**. Selama latihan ini bukan penilaian resmi, itu bisa diterima. NIM tetap unik (satu NIM satu akun).

## Yang tidak ada (dan konsekuensinya)
- Tidak ada kode kelas dan tidak ada captcha, jadi orang luar atau bot bisa membuat akun. Akun tanpa profil tidak bisa menyimpan apa pun, dan jumlah pengguna jauh di bawah batas paket gratis (50.000 pengguna aktif per bulan). Bila nanti terganggu bot, nyalakan Cloudflare Turnstile di **Authentication > Bot and Abuse Protection** (layar Masuk dan Daftar harus menampilkan widgetnya; belum dibuat).
- Pelacakan perangkat dan pola menulis (Dashboard instruktur) tetap berlaku sebagai lapisan pengaman.

## Mencoba tanpa Supabase
`python tools/server_uji.py`, buka `http://127.0.0.1:8124/?tanpakonfirmasi=1#daftar`. Server uji meniru Supabase dengan konfirmasi email dimatikan: daftar langsung masuk, tidak ada kotak "Email tiruan".
