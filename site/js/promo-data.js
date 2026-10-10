// Data promo silang ke situs utama https://muchson.web.id/ (hardcode, tanpa database).
// Tambah entri di sini bila ada halaman baru; tidak ada tempat lain yang perlu diubah.
//
// Bentuk satu entri:  { id, kelompok, label, url, hook, lewati? }
//   id        unik dan stabil (dipakai untuk tidak mengulang promo yang sama dalam satu sesi)
//   kelompok  nama bagian di situs utama (tampil kecil di atas teks hook)
//   label     nama halaman/hari
//   url       alamat tujuan (selalu https://muchson.web.id/...)
//   hook      teks ajakan yang tampil di kotak (satu kalimat pendek)
//   lewati    true = ada di daftar tetapi tidak ikut diundi (mis. situs latihan ini sendiri)

export const SITUS_UTAMA = "https://muchson.web.id/";
export const PEMBUAT = "Muchson";

const dasar = SITUS_UTAMA;
const sekuen = (kelompok, jalur, daftar) =>
  daftar.map(([label, hook], i) => ({ id: jalur + "-" + i, kelompok, label, url: dasar + "#/aion/" + jalur + "/" + i, hook }));

const UTAMA = [
  { id: "beranda", kelompok: "Muchson", label: "Beranda", url: dasar, hook: "Pendidikan, teknologi, dan AI dalam satu tempat. Kenalan dengan Software Engineer dan Academic Trainer." },
  { id: "tentang", kelompok: "Muchson", label: "Tentang", url: dasar + "#about", hook: "5+ tahun di EdTech, full-stack, dan integrasi AI. Kenali orang di balik materinya." },
  { id: "belajar", kelompok: "Muchson", label: "Belajar", url: dasar + "#teaching", hook: "Website belajar gratis: dari Python sampai Customer Success, UX, dan Green IT." },
  { id: "proyek", kelompok: "Muchson", label: "Proyek", url: dasar + "#projects", hook: "Dari program pendidikan nasional sampai otomasi AI. Lihat hasil kerja nyatanya." },
  { id: "kontak", kelompok: "Muchson", label: "Kontak", url: dasar + "#contact", hook: "Punya proyek atau butuh konsultasi? Kirim pesan sekarang." },
  // Situs latihan ini sendiri: dicatat, tetapi tidak diundi karena pembacanya sudah ada di sini.
  { id: "latihan", kelompok: "Pendidikan formal", label: "Latihan Python", url: dasar + "#/latihan", hook: "Belajar Python langsung di browser. Gratis, tanpa instal, bisa dari HP. Tulis kode, lulus tantangan, lanjut bab.", lewati: true },
];

const CUSTOMER_SUCCESS = sekuen("Customer Success", "customer-success", [
  ["Day 1", "Kenapa klien B2B IT membeli, bertahan, atau pergi? Mulai dari dasarnya."],
  ["Day 2", "Dari teori ke praktik: strategi penjualan berbasis perilaku yang menahan pelanggan."],
  ["Day 3", "Apa yang membuat pelanggan setia? Bongkar psikologi di balik keputusan membeli."],
  ["Day 4", "Emosi memenangkan penjualan. Pelajari kendalinya untuk retensi jangka panjang."],
  ["Day 5", "Jangan perlakukan semua pelanggan sama. Segmentasi dan personalisasi tepat sasaran."],
  ["Day 6", "Bangun ikatan emosional pelanggan secara sistematis, bukan kebetulan."],
  ["Day 7", "Data pelanggan bicara. Kenali pola perilaku sebelum mereka pergi."],
  ["Day 8", "Pakai AI dan otomasi, lalu ukur apa yang benar-benar berhasil."],
  ["Day 9", "Retensi real-time: personalisasi, otomasi, dan optimasi saat itu juga."],
  ["Day 10", "Pengalaman pelanggan mulus di semua kanal: omnichannel, AI, sistem terpadu."],
  ["Day 11", "Cerita menjual lebih baik daripada daftar fitur. Psikologi emosional dan storytelling."],
  ["Day 12", "Membership dan referral: ubah pelanggan jadi pelanggan tetap sekaligus pemasar."],
  ["Day 13", "Poin, level, tantangan: motivasi pelanggan lewat gamification."],
  ["Day 14", "Deteksi pelanggan yang mau pergi sebelum mereka mengatakannya."],
  ["Day 15", "Pelanggan sudah pergi? Pelajari strategi menariknya kembali."],
  ["Day 16", "Jadi Chief Customer Officer sehari: kendalikan churn dengan data."],
]);

const UX = sekuen("UX", "ux", [
  ["Day 9", "Aktifkan pengguna baru lewat gamification. Coba langsung di Activation Lab."],
  ["Day 10", "Satu lagi playground UX interaktif, siap dicoba langsung."],
  ["Day 11", "Antarmuka suara untuk layanan kota. Coba CityHelp Voice."],
  ["Day 12 (a)", "Rasakan sendiri: seperti apa web yang tidak aksesibel bagi sebagian orang?"],
  ["Day 12 (b)", "Portal layanan publik untuk semua warga. Pelajari desainnya lewat studi kasus CitizenConnect."],
  ["Day 13", "Pola desain inklusif yang bisa langsung kamu pakai."],
  ["Day 14", "Teknologi imersif bertemu neurosains: dasar UX yang membuat pengalaman terasa nyata."],
  ["Day 15", "Neuro-UX Lab: bagaimana otak merespons desainmu?"],
  ["Day 16", "Prototipe imersif, strategi masa depan, dan etika dalam satu playground."],
]);

const GREEN_IT = sekuen("Green IT", "green-it", [
  ["Day 1", "Green IT bukan beban, tapi keunggulan bersaing sekaligus langkah menjaga iklim."],
  ["Day 2", "Berapa energi, bahan baku, dan limbah di balik perangkat IT-mu?"],
  ["Day 3", "Hitung jejak karbon dan limbah elektronik IT lewat latihan nyata."],
  ["Day 4", "Beli IT dengan cerdas: strategi dan pengadaan yang hijau."],
  ["Day 5", "Dari beli sampai daur ulang: siklus hidup IT yang berkelanjutan."],
  ["Day 6", "Efisiensi data center: kompromi dan tata kelola yang harus kamu kuasai."],
  ["Day 7", "Operasikan data center lebih hemat dan lebih hijau."],
  ["Day 8", "Cloud itu hijau? Ambil keputusan keberlanjutan yang siap dibawa ke direksi."],
  ["Day 9", "Kantor hijau: perpanjang umur perangkat, kurangi sampah elektronik."],
  ["Day 10", "Kode yang hemat energi: kenali prinsip green coding."],
  ["Day 11", "Ukur efisiensi software dan rancang arsitektur yang berkelanjutan."],
  ["Day 12", "Jaringan, IoT, dan 5G yang hemat energi."],
  ["Day 13", "Rancang proses digital yang berkelanjutan dari awal."],
  ["Day 14", "Berkelanjutan itu menguntungkan: terapkan secara hemat biaya dan patuh regulasi."],
  ["Day 15", "AI dan ekonomi sirkular: inovasi untuk IT hijau masa depan."],
  ["Day 16", "Ukur dan tampilkan target keberlanjutan: KPI Green IT dan pemantauan karbon."],
]);

export const PROMO = [...UTAMA, ...CUSTOMER_SUCCESS, ...UX, ...GREEN_IT];
