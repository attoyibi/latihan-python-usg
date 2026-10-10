# Promo silang ke muchson.web.id

Di halaman mana pun (beranda, masuk, mata kuliah, bab, dashboard, termasuk akun instruktur), kadang muncul maskot kurir kecil di pojok kanan bawah yang mengantar amplop, lalu membuka kotak berisi satu kalimat ajakan. Sekali klik membuka halaman terkait di https://muchson.web.id/ di tab baru. Tidak ada database dan tidak ada pelacakan.

## Mengubah isi
Semua data ada di satu berkas: `site/js/promo-data.js`. Tambah satu baris `{ id, kelompok, label, url, hook }` di daftar yang sesuai; tidak ada yang lain yang perlu diubah. `lewati: true` menyimpan entri tanpa ikut diundi (dipakai untuk "Latihan Python", karena pembacanya sudah di situs ini). Setelah mengubah: `node tools/uji_promo.mjs`.

## Aturan kemunculan (`site/js/promo-logika.js`)
| Aturan | Nilai |
|---|---|
| Kunjungan pertama hari ini (per browser) | Promo PASTI muncul di awal, sekitar 2,5 detik setelah halaman terbuka (menunggu tab terlihat). Sesudah itu aturan acak di bawah berlaku |
| Kemunculan acak pertama | 2 sampai 4 menit dengan tab terlihat (acak) |
| Jeda antar kemunculan | 5 sampai 10 menit (acak) |
| Maksimal per sesi tab | 3 |
| Peluang tiap pemeriksaan (tiap 15 detik) | 50%, jadi kadang muncul dan kadang tidak |
| Tidak muncul saat | mengetik atau menyentuh layar (5 detik terakhir), tab tersembunyi, ada dialog terbuka, atau masih ada promo tampil |
| Lama tampil | 9 detik sesudah animasi masuk (sekitar 1,5 detik) |
| Berhenti menghitung | saat kursor di atas kotak atau kotak difokus; lanjut saat dilepas |
| Promo yang sama | tidak diulang dalam satu sesi sampai semua sudah tampil |

Dasarnya praktik umum toast dan notifikasi (default 4 sampai 5 detik, batas atas sekitar 10 detik, timer berhenti saat disentuh, selalu ada tombol tutup) serta standar iklan yang tidak mengganggu (satu per satu, kecil, tidak menutup konten, tidak saat peserta sedang mengerjakan).

## Penanda di browser (untuk dicek)
| Tempat | Kunci | Isi |
|---|---|---|
| localStorage | `promo:hari` | tanggal lokal terakhir promo muncul, mis. `2026-10-10`. Beda dengan hari ini = kunjungan pertama hari ini |
| localStorage | `promo:mati` | `1` bila peserta menekan "Jangan tampilkan lagi" |
| sessionStorage | `promo:sesi` | `{jumlah, sudah[], menunggu}`: berapa kali tampil di sesi tab ini, id promo yang sudah tampil, sisa jeda (ms) |

Lihat di DevTools, tab Application, Local storage atau Session storage. Untuk mengulang "pertama hari ini": `localStorage.removeItem('promo:hari')` lalu muat ulang. Untuk menyalakan kembali setelah dimatikan: `localStorage.removeItem('promo:mati')`.

## Kontrol peserta
Tombol ×, tombol Esc, dan tautan "Jangan tampilkan lagi" (disimpan di browser peserta, kunci `promo:mati`). Peserta dengan "kurangi gerakan" di sistemnya melihat kotak tanpa animasi gerak.

## Menguji cepat
Di konsol browser: `(await import('/js/promo.js')).tampilkanSekarang()`.
