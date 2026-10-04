# Memperbarui fork dari repositori utama

Bila Anda memasang lewat fork, pembaruan dari repositori utama bisa ditarik tanpa bentrok **selama Anda tidak mengubah berkas kode**.

## Aturan agar pembaruan selalu mulus

| Boleh Anda ubah | Jangan diubah |
|---|---|
| `site/data/` (nama situs, daftar mata kuliah, bab, soal, video) | `site/js/`, `site/css/`, `site/index.html` |
| Environment variable di Vercel/Cloudflare/Netlify | `site/config.js` (diisi otomatis saat build) |
| `kunci/` (lokal, tidak diterbitkan) | `supabase/migrations/` yang sudah dijalankan |

Bila terpaksa mengubah kode, buat di cabang sendiri dan siap menyelesaikan bentrok saat sinkronisasi.

## Cara menarik pembaruan

### Lewat web (paling mudah)
1. Buka fork Anda di GitHub.
2. Bila ada tulisan *This branch is N commits behind*, klik **Sync fork** lalu **Update branch**.
3. Vercel/Cloudflare/Netlify otomatis menayangkan hasilnya.

### Lewat terminal
```bash
gh repo sync NAMA-ANDA/latihan-python-usg --source attoyibi/latihan-python-usg
```

Atau dengan git biasa:
```bash
git remote add upstream https://github.com/attoyibi/latihan-python-usg.git
git fetch upstream
git merge upstream/main
git push
```

## Bila ada bentrok
Bentrok hanya terjadi bila Anda dan repositori utama mengubah berkas yang sama, paling sering `site/data/matakuliah.json`, `site/data/kuliah/<id>/materi.json`, atau soal yang sama. Selesaikan dengan mempertahankan isi Anda dan menerima perubahan kode dari utama. Mintalah bantuan lewat *issue* bila ragu.

## Pembaruan database
Bila rilis baru menambah berkas di `supabase/migrations/` (mis. `0004_...sql`), jalankan **hanya berkas baru** itu di SQL Editor, berurutan. Tidak perlu mengulang berkas lama (mengulangnya aman, tetapi tidak perlu). Tidak yakin migrasi mana yang sudah terpasang? Jalankan `supabase/periksa_migrasi.sql`; kolom yang bernilai `false` menunjukkan yang belum dijalankan.

## Tes sebelum memperbarui produksi
Vercel dan Cloudflare membuat alamat pratinjau untuk setiap cabang. Tarik pembaruan ke cabang `dev` dulu, cek alamat pratinjaunya, baru gabungkan ke `main`.
