"""Bagian naskah yang bergantung data: abstrak, metode, hasil penggunaan, pembahasan, kesimpulan, dan penyusunan akhir.

Semua angka dibaca dari docs/jurnal/naskah/angka-naskah.json (dibuat siapkan_angka.py dari data agregat anonim).
Data ini awal (sekitar empat minggu pertama penggunaan) dan hanya dipakai untuk evaluasi penggunaan, bukan klaim dampak belajar.
"""
import pathlib

import gambar
import isi_naskah as I

AKAR = I.AKAR
GAMBAR = AKAR / "docs" / "jurnal" / "naskah" / "gambar"
BULAN = {"01": "Januari", "02": "Februari", "03": "Maret", "04": "April", "05": "Mei", "06": "Juni", "07": "Juli", "08": "Agustus", "09": "September", "10": "Oktober", "11": "November", "12": "Desember"}


def i(x):  # 5870 -> 5.870
    return format(int(x), ",").replace(",", ".")


def d(x, k=1):  # 0.607 -> 0,6
    return (("%." + str(k) + "f") % x).replace(".", ",")


def pct(a, b, k=1):
    return d(100.0 * a / b, k) + "%"


def tgl(iso):
    y, m, dd = iso.split("-")
    return "%d %s %s" % (int(dd), BULAN[m], y)


def q(v):  # [q1, med, q3] -> "med (Q1 sampai Q3)"
    f = lambda x: d(x, 0) if float(x).is_integer() else d(x, 1)
    return "%s (%s–%s)" % (f(v[1]), f(v[0]), f(v[2]))


KATA_KUNCI_EN = "Appropriate technology, Automated assessment, Browser-based learning, Digital skills, Learning analytics"
KATA_KUNCI_ID = "Analitik pembelajaran, Keterampilan digital, Pembelajaran berbasis browser, Penilaian otomatis, Teknologi tepat guna"

ABSTRACT = ("Learning to program requires frequent practice and timely feedback, yet installing development tools on every "
            "student's device can be a barrier. This community service activity aimed to assist information systems students in "
            "building programming skills through a browser-based practice platform, an appropriate technology that requires no "
            "installation, and to evaluate how the platform is used. The platform runs Python and Java inside the browser through "
            "WebAssembly, checks answers automatically against test cases, offers tiered hints, and records learning activity in a "
            "cloud database protected by row-level access rules and student consent. The activity consisted of needs analysis, "
            "platform design, classroom implementation, and a descriptive evaluation of anonymised usage records from the first "
            "weeks of use. The results show that students practised outside class hours, often late in the evening, completed most "
            "of the chapters they opened, and needed several submissions in the chapter on conditional logic. Syntax and indentation "
            "errors dominate Python attempts, whereas unresolved symbols dominate Java attempts, and about three in ten attempts "
            "take place after at least one hint is opened. Recording of active time and report submission were incomplete, which "
            "limits the evaluation. The activity shows that installation-free practice with transparent, consent-based logging is "
            "feasible in a low-cost setting operated by the instructor, while its effect on learning outcomes remains to be tested.")

ABSTRAK = ("Belajar memprogram membutuhkan latihan yang sering dan umpan balik yang cepat, tetapi pemasangan perkakas di setiap "
           "perangkat mahasiswa dapat menjadi hambatan. Kegiatan pengabdian ini bertujuan mendampingi mahasiswa sistem informasi "
           "membangun keterampilan pemrograman melalui platform latihan berbasis browser yang tidak memerlukan instalasi sebagai "
           "teknologi tepat guna, serta mengevaluasi penggunaannya. Platform menjalankan Python dan Java di dalam browser melalui "
           "WebAssembly, memeriksa jawaban secara otomatis dengan kasus uji, menyediakan petunjuk bertingkat, dan mencatat aktivitas "
           "belajar di basis data awan yang dilindungi aturan akses per baris dan persetujuan mahasiswa. Kegiatan terdiri atas analisis "
           "kebutuhan, perancangan platform, penerapan di kelas, dan evaluasi deskriptif atas rekaman penggunaan anonim pada minggu-minggu "
           "awal. Hasilnya menunjukkan bahwa mahasiswa berlatih di luar jam kuliah, sering larut malam, menyelesaikan sebagian besar bab "
           "yang dibuka, dan membutuhkan beberapa kali pengiriman pada bab percabangan. Galat sintaks dan indentasi mendominasi percobaan "
           "Python, sedangkan simbol yang tidak dikenali mendominasi percobaan Java, dan sekitar tiga dari sepuluh percobaan terjadi "
           "setelah minimal satu petunjuk dibuka. Pencatatan waktu aktif dan pengumpulan laporan belum lengkap sehingga membatasi evaluasi. "
           "Kegiatan ini menunjukkan bahwa latihan tanpa instalasi dengan pencatatan yang transparan dan berbasis persetujuan layak "
           "dijalankan dengan biaya rendah oleh dosen, sedangkan pengaruhnya terhadap capaian belajar masih perlu diuji.")


def metode(n):
    A = I.angka()
    p, pe = A["populasi"], A["periode"]
    n.bagian("Metode")
    n.para("Kegiatan dilaksanakan di Program Studi Sistem Informasi Universitas Sunan Gresik dengan sasaran mahasiswa yang mengambil mata kuliah Algoritma dan Pemrograman (Python) dan Pemrograman Berorientasi Objek (Java). Evaluasi memakai rekaman penggunaan %s sampai %s, yaitu sekitar empat minggu pertama penggunaan platform. Sebanyak %d mahasiswa memiliki akun (angkatan 2025 dan sebelumnya %d orang, angkatan 2026 %d orang); %d di antaranya aktif di Algoritma dan Pemrograman dan %d di Pemrograman Berorientasi Objek, dan sebagian mengikuti keduanya." % (tgl(pe["mulai"]), tgl(pe["akhir"]), p["peserta"], p["angk_2025_ke_bawah"], p["angk_2026"], p["aktif_python"], p["aktif_java"]))
    n.subbagian("Tahapan Kegiatan")
    n.para("Kegiatan berlangsung dalam empat tahap (Gambar 1). Analisis kebutuhan merumuskan syarat: berjalan di laptop maupun ponsel tanpa instalasi, memberi umpan balik seketika, dan memperlihatkan proses belajar kepada dosen. Perancangan menghasilkan platform dan materi (Tabel 1 dan 2). Implementasi berupa penerapan di kelas: mahasiswa masuk dengan akun, memilih bab, menulis kode, menjalankan, mengirim jawaban, membuka petunjuk bertingkat bila perlu, lalu mengerjakan praktik dan laporan. Evaluasi menganalisis rekaman penggunaan.")
    n.gambar(GAMBAR / "gambar-tahapan.png", "Tahapan kegiatan pendampingan (dibuat penulis)", 12.5)
    n.subbagian("Pengumpulan dan Analisis Data")
    n.para("Data diambil dari basis data platform dengan kueri baca-saja yang hanya mengeluarkan angka agregat pada %s. Tabel yang dipakai adalah progres per bab, percobaan (setiap penekanan Jalankan dan Kirim jawaban), sesi belajar, laporan, dan tahap praktikum. Ukuran yang dilaporkan: peserta yang membuka dan menyelesaikan bab, jumlah pengiriman hingga lulus, hasil dan jenis galat, jumlah petunjuk yang terbuka, jam mulai sesi, serta ukuran cara menulis kode seperti kecepatan mengetik dan rasio huruf yang dihapus. Analisisnya deskriptif (jumlah, persentase, median, dan kuartil); sel dengan kurang dari lima peserta tidak ditampilkan. Pengukuran cara menulis hanya memakai peserta yang menyatakan setuju." % tgl(pe["diambil"]))
    n.subbagian("Etika dan Perlindungan Data")
    n.para("Peserta diminta persetujuan penggunaan data belajarnya untuk penelitian; %d dari %d peserta menyetujui, %d menolak, dan %d belum menjawab. Persetujuan tidak memengaruhi nilai atau akses. Kode peserta di ekspor diganti kode acak, tanpa nama, NIM, kelas, atau tanggal kalender, dan keluaran program tidak disimpan. Basis data memakai aturan akses per baris sehingga peserta hanya melihat datanya sendiri. Mengikuti kajian tentang etika analitik pembelajaran (Cerratto Pargman & McGrath, 2021; Francis et al., 2023), laporan ini memisahkan temuan seluruh peserta dari temuan peserta yang setuju." % (p["setuju"], p["peserta"], p["menolak"], p["belum"]))


def hasil_data(n):
    A = I.angka()
    b, c, g, j = A["bab"], A["percobaan"], A["galat"], A["jalur"]
    n.subbagian("Penggunaan dan Penyelesaian Bab")
    n.para("Hampir seluruh peserta memakai platform: %d dari %d peserta (%s) tercatat memiliki minimal satu percobaan. Tabel 3 dan Gambar 3 memperlihatkan jumlah peserta yang membuka dan menyelesaikan bab. Pada Algoritma dan Pemrograman, Bab 3 sampai 6 dibuka sekitar 40 peserta dan sebagian besar diselesaikan, sedangkan Bab 1 dan 2 dibuka jauh lebih sedikit dan lebih jarang diselesaikan. Karena urutan bab bebas, dugaan penulis adalah mahasiswa memulai dari bab yang sedang diajarkan; dugaan ini belum diuji. Bab 7 dan seterusnya belum banyak dibuka pada saat data diambil. Pada Pemrograman Berorientasi Objek, bab yang dibuka dan diselesaikan lebih banyak dan Bab 1 sampai 9 sudah dikerjakan." % (A["percobaan"]["peserta"], A["populasi"]["peserta"], pct(A["percobaan"]["peserta"], A["populasi"]["peserta"])))
    baris = []
    for mk, nama in (("python", "Python"), ("java", "Java")):
        for r in b[mk]:
            k = r.get("kirim")
            baris.append([nama, str(r["bab"]), str(r["membuka"]), "%d (%s)" % (r["lulus"], pct(r["lulus"], r["membuka"], 0)), q(k) if k else "–"])
    n.tabel("Peserta yang Membuka dan Menyelesaikan Bab serta Pengiriman hingga Lulus",
            ["Mata kuliah", "Bab", "Membuka", "Selesai (%)", "Pengiriman hingga lulus, median (Q1–Q3)"],
            baris, [2.4, 1.4, 2.2, 3.0, 6.5], "rekaman progres platform, semua peserta, %s sampai %s; bab dengan kurang dari lima peserta tidak ditampilkan" % (tgl(A["periode"]["mulai"]), tgl(A["periode"]["akhir"])))
    gambar.grafik_bab(GAMBAR / "gambar-bab.png", b["python"], b["java"])
    n.gambar(GAMBAR / "gambar-bab.png", "Peserta yang membuka dan menyelesaikan setiap bab (rekaman progres, semua peserta)", 13.0)
    n.para("Bab yang membutuhkan paling banyak pengiriman sebelum lulus adalah Bab 3 dan 4 pada Python (median tiga pengiriman; kuartil ketiga lima dan enam) serta Bab 4 pada Java (median tiga; kuartil ketiga 7,5). Pada Python, jalur lulus dengan bantuan (petunjuk atau video) tercatat pada %s dari %d penyelesaian di Bab 3 sampai 6; pada Java %s dari %d penyelesaian di Bab 1 sampai 9." % (pct(j["py_3_6_bantuan"], j["py_3_6_lulus"]), j["py_3_6_lulus"], pct(j["jv_1_9_bantuan"], j["jv_1_9_lulus"]), j["jv_1_9_lulus"]))

    n.subbagian("Percobaan, Galat, dan Petunjuk")
    h = c["hasil"]
    n.para("Platform mencatat %s percobaan dari %d peserta: %s penekanan Jalankan dan %s pengiriman jawaban (Python: %s dan %s; Java: %s dan %s). Dari %s pengiriman, %s (%s) lulus semua kasus uji dan %s belum lulus; median proporsi kasus uji yang terpenuhi pada satu pengiriman adalah %s (Q1 %s). Di antara penekanan Jalankan, %s berakhir dengan keluaran normal, %s dengan galat, dan %s melewati batas waktu." % (i(c["baris"]), c["peserta"], i(c["jalankan"]), i(c["kirim"]), i(c["py_jalankan"]), i(c["py_kirim"]), i(c["jv_jalankan"]), i(c["jv_kirim"]), i(c["kirim"]), i(c["kirim_lulus"]), pct(c["kirim_lulus"], c["kirim"]), i(c["kirim_gagal"]), d(c["rasio_kasus"][1], 2), d(c["rasio_kasus"][0], 2), i(h["jalan"]), i(h["galat"]), i(h["timeout"])))
    gambar.grafik_bar(GAMBAR / "gambar-galat.png", [x[0] for x in g["daftar"]], [x[1] for x in g["daftar"]], "Jumlah percobaan", horizontal=True, ukuran=(6.2, 2.7))
    n.gambar(GAMBAR / "gambar-galat.png", "Sepuluh jenis galat terbanyak pada percobaan Jalankan (semua peserta)", 12.0)
    py_sx = dict((x[0], x[1]) for x in g["daftar"])
    sx = py_sx["SyntaxError"] + py_sx["IndentationError"]
    n.para("Gambar 4 menunjukkan bahwa pada Python, galat sintaks (%s) dan indentasi (%s) bersama-sama mencapai %s dari %s percobaan yang berakhir galat atau melewati batas waktu, jauh di atas galat nama (%s) atau nilai (%s). Pada Java, simbol yang tidak dikenali (*CannotResolve*, %s) adalah galat tunggal terbanyak, diikuti galat kompilasi lain (%s). Pola ini sejalan dengan temuan bahwa pemula banyak kehilangan waktu pada kesalahan dasar penulisan (Rahman et al., 2021)." % (i(py_sx["SyntaxError"]), i(py_sx["IndentationError"]), pct(sx, g["dasar"]), i(g["dasar"]), i(py_sx["NameError"]), i(py_sx["ValueError"]), i(py_sx["CannotResolve"]), i(py_sx["GalatKompilasi"])))
    pt = A["petunjuk"]
    s0, s3 = pt["sebaran"]["0"], pt["sebaran"]["3"]
    n.para("Petunjuk bertingkat dibuka pada %s dari %s percobaan yang tercatat jumlah petunjuknya. Menariknya, ketiga petunjuk sekaligus sudah terbuka pada %s percobaan (%s), jauh lebih banyak daripada yang hanya dua petunjuk (%s percobaan). Pola ini menunjukkan bahwa pada banyak percobaan petunjuk sudah dibuka sampai tingkat terakhir; apakah itu karena petunjuk awal kurang membantu atau karena mahasiswa langsung mencari jawaban perlu ditelaah lebih lanjut." % (pct(pt["total"] - s0, pt["total"]), i(pt["total"]), i(s3), pct(s3, pt["total"]), i(pt["sebaran"]["2"])))

    n.subbagian("Pola Belajar dan Cara Menulis Kode")
    s = A["sesi"]
    malam = sum(s["per_jam"][20:24])
    dini = sum(s["per_jam"][0:6])
    n.para("Platform mencatat %s sesi dari %d peserta (median %s sesi per peserta). Jumlah ini kemungkinan membesar karena banyak baris sesi hanya berisi denyut tanpa aktivitas, dan %s dari sesi tidak mencatat waktu aktif, sehingga durasi belajar tidak dapat dipakai; total %s jam aktif hanya batas bawah. Jam mulai sesi tetap informatif (Gambar 5): %s sesi dimulai pukul 20.00 sampai 23.59 dan %s pada pukul 00.00 sampai 05.59, sehingga hampir separuh sesi terjadi di luar jam kerja biasa." % (i(s["sesi"]), A["populasi"]["peserta"], d(s["per_peserta"][1], 0), pct(s["nol"], s["sesi"]), d(s["total_jam"], 1), pct(malam, s["sesi"]), pct(dini, s["sesi"])))
    gambar.grafik_jam(GAMBAR / "gambar-jam.png", s["per_jam"])
    n.gambar(GAMBAR / "gambar-jam.png", "Sebaran jam mulai sesi belajar (semua peserta)", 12.0)
    po = A["pola"]
    n.para("Pada peserta yang menyetujui (%d orang), ukuran cara menulis tercatat untuk %s percobaan (Tabel 4). Tampak bahwa sebelum satu pengiriman mahasiswa menjalankan kodenya median tiga kali, dan sekitar 30%% huruf yang diketik dihapus kembali. Nilai-nilai ini bersifat deskriptif dan belum dihubungkan dengan hasil belajar." % (A["populasi"]["setuju"], i(A["pola_n"])))
    def row(nama, v, sat=""):
        return [nama, q(v) if not isinstance(v[1], float) or v[1] >= 10 else "%s (%s–%s)" % (d(v[1], 2), d(v[0], 2), d(v[2], 2)), sat]
    n.tabel("Ukuran Cara Menulis Kode pada Peserta yang Menyetujui",
            ["Ukuran", "Median (Q1–Q3)", "Satuan"],
            [row("Jalankan per segmen pengiriman", po["jalankan"], "kali"), row("Huruf diketik per segmen", po["diketik"], "karakter"), row("Huruf dihapus per segmen", po["dihapus"], "karakter"),
             row("Rasio huruf dihapus terhadap diketik", po["rasio_hapus"], "0–1"), row("Kecepatan mengetik rata-rata", po["cps"], "karakter/detik"),
             row("Kembali ke bagian kode lebih atas", po["lompat"], "kali")],
            [7.0, 4.5, 4.0], "rekaman percobaan platform, peserta yang menyetujui; segmen = rentang sejak pengiriman sebelumnya", ["left", "center", "center"])

    n.subbagian("Praktikum dan Laporan")
    pk, lp = A["praktikum"], A["laporan"]
    n.para("Pada praktikum berkas, %s tahap tercatat dari %d peserta dan %s (%s) sudah lulus, dengan median %s pengiriman hingga lulus. Sebaliknya, %s laporan bab semuanya masih berstatus draf, tidak ada yang dikumpulkan, dan belum ada penilaian dosen, sehingga kualitas laporan belum dapat dievaluasi. Dari laporan yang ada, %s (%s) mencatat upaya menempel teks yang diblokir platform." % (i(pk["baris"]), pk["peserta"], i(pk["lulus"]), pct(pk["lulus"], pk["baris"]), d(pk["kirim"][1], 0), i(lp["baris"]), i(lp["dengan_tempel"]), pct(lp["dengan_tempel"], lp["dari"])))


def pembahasan(n):
    A = I.angka()
    n.subbagian("Pembahasan")
    n.para("Temuan utama adalah bahwa pendampingan tanpa instalasi benar-benar dipakai: hampir seluruh peserta berlatih, dan hampir separuh sesi dimulai pada malam hingga dini hari, ketika kelas tidak berlangsung. Hal ini sejalan dengan alasan memilih eksekusi di peramban: aplikasi web lebih mudah diakses dan tidak bergantung pada platform (Tushar & Mohan, 2022), dan WebAssembly dengan Pyodide memang dibahas sebagai jalan mengatasi ketergantungan platform (Fragkoudakis et al., 2025). Lingkungan berbasis browser lain pun dikembangkan karena angka kelulusan mata kuliah pemrograman di pendidikan tinggi tidak selalu memadai (Liang & Uehara, 2023). Kegiatan pelatihan Python yang dilaporkan sebelumnya umumnya berbentuk sesi terjadwal (Kurniadi Siradjuddin & Muhammad, 2022; Ramadhan et al., 2025; Wulandari et al., 2026); pola penggunaan di sini menunjukkan bahwa platform memungkinkan latihan berlanjut di luar sesi tersebut.")
    n.para("Penilaian otomatis memberi umpan balik yang dibutuhkan mahasiswa untuk mengulang: sekitar enam dari sepuluh pengiriman lulus semua kasus uji, dan pada banyak bab mahasiswa lulus dalam satu atau dua pengiriman. Ini konsisten dengan fungsi alat penilaian otomatis yang memberi umpan balik cepat dan menyorot kesalahan (Cipriano et al., 2022) serta dengan peran *online judge* dalam latihan (Bilegjargal & Hsueh, 2021). Bab percabangan pada Python (Bab 4) dan Bab 4 pada Java membutuhkan paling banyak pengiriman, sehingga dapat menjadi prioritas dosen untuk penjelasan tambahan. Contoh ini memperlihatkan nilai dasbor bagi dosen: data yang sama dapat dipakai untuk menemukan bab dan peserta yang tersangkut, sebagaimana dasbor analitik belajar dan identifikasi dini mahasiswa yang kesulitan dibahas dalam pustaka (Fu et al., 2022; Ramaswami et al., 2023; Rys-Recker & Hao, 2024).")
    n.para("Dominasi galat sintaks dan indentasi pada Python serta galat simbol pada Java memberi arah perbaikan konkret. Pesan galat mentah sering membingungkan pemula (Zhou et al., 2021), dan keefektifan pesan galat yang diperjelas telah diuji pada kelas Python pengantar. Platform ini dapat menerjemahkan jenis galat yang paling sering menjadi petunjuk berbahasa Indonesia. Penggunaan petunjuk juga perlu dipahami sebagai bagian dari perilaku mencari bantuan (Cohen et al., 2024). Banyaknya percobaan dengan ketiga petunjuk terbuka menunjukkan bahwa petunjuk perlu ditinjau ulang: apakah petunjuk pertama dan kedua cukup membantu.")
    n.para("Dari sisi keberlanjutan, platform berupa berkas statis dan satu basis data terkelola tanpa server eksekusi kode, sehingga beban operasional dosen terutama pada pemeliharaan materi, kasus uji, dan basis data (Tabel 1). Alternatif lain untuk mahasiswa yang tidak dapat memasang perkakas, seperti aplikasi seluler untuk belajar Python (Schnieder & Williams, 2023) atau kombinasi Hedy dan Python Tutor (Ayub & Karnalim, 2024), tidak dibandingkan langsung dalam kegiatan ini; perbandingan semacam itu, bersama pengukuran capaian belajar, menjadi bahan evaluasi berikutnya. Bagi pengelola program pengabdian, hasil ini juga memberi gambaran praktis: pendampingan keterampilan digital dapat dipantau secara berkelanjutan lewat rekaman penggunaan, tidak hanya lewat kehadiran pada sesi pelatihan, selama kebijakan privasi dan persetujuan peserta dijalankan dengan jelas.")
    n.para("Beberapa catatan kehati-hatian perlu ditegaskan. Pertama, ini adalah data awal dari sekitar empat minggu pertama sehingga tidak mewakili seluruh semester, dan tidak ada ukuran capaian belajar atau kelompok pembanding; karena itu hasil tidak boleh dibaca sebagai bukti peningkatan kemampuan. Kedua, pencatatan waktu aktif belum berfungsi baik, dan laporan praktikum belum dikumpulkan atau dinilai, sehingga dua ukuran penting belum tersedia dan perlu diperbaiki sebelum evaluasi berikutnya. Ketiga, hanya sebagian peserta menyetujui penggunaan data untuk penelitian, sehingga analisis cara menulis mungkin tidak mewakili semua mahasiswa; praktik persetujuan yang jelas penting (Francis et al., 2023). Keempat, alat berbantuan kecerdasan buatan dapat memengaruhi kode yang ditulis pemula (Haindl & Weinberger, 2024) dan penilaian otomatis berbasis model bahasa berkembang pesat (Emirtekin, 2025), sehingga ukuran proses seperti cara menulis dan upaya menempel dapat menjadi konteks tambahan, tetapi bukan bukti kecurangan. Terakhir, rekaman kiriman kode dari alat penilaian otomatis berpotensi menjadi data penelitian yang berharga bila dibagikan secara etis (Paiva et al., 2023); ekspor anonim platform ini disiapkan untuk keperluan tersebut.")


def kesimpulan(n):
    n.bagian("Kesimpulan")
    n.para("Platform latihan pemrograman berbasis browser berhasil diterapkan sebagai teknologi tepat guna untuk mendampingi mahasiswa Program Studi Sistem Informasi: peserta berlatih tanpa instalasi, sebagian besar bab yang dibuka diselesaikan, dan banyak latihan terjadi di luar jam kuliah. Rekaman penggunaan menunjukkan galat sintaks dan indentasi pada Python, galat simbol pada Java, dan bab percabangan pada Python sebagai titik tersangkut utama, yang dapat langsung dipakai dosen untuk menyesuaikan pengajaran. Evaluasi ini terbatas pada data awal dan belum mengukur capaian belajar. Langkah berikutnya adalah memperbaiki pencatatan waktu aktif, mendorong pengumpulan dan penilaian laporan, memperbaiki pesan galat dan petunjuk berdasarkan pola yang ditemukan, serta membandingkan capaian belajar pada satu semester penuh dengan izin etik yang sesuai.")
    n.para("Ucapan terima kasih disampaikan kepada mahasiswa Program Studi Sistem Informasi Universitas Sunan Gresik yang menggunakan platform dan menyetujui pemakaian data belajarnya.")


def susun(n):
    A = I.angka()
    GAMBAR.mkdir(parents=True, exist_ok=True)
    gambar.arsitektur(GAMBAR / "gambar-arsitektur.png")
    gambar.tahapan(GAMBAR / "gambar-tahapan.png", [("Analisis", ["kebutuhan belajar", "kendala perangkat"]), ("Rancangan", ["platform dan materi", "aturan privasi"]), ("Implementasi", ["pendampingan kelas", "latihan mandiri"]), ("Evaluasi", ["rekaman anonim", "analisis deskriptif"])])
    n.isi_header([("[Bulan] [Tahun]", "Januari 2027"), ("Vol. X", "Vol. 2"), ("No. X", "No. 1"), ("xxxx-xxxx | ISSN (e): xxxx-xxxx", "- | ISSN (e): 3163-9704")])
    n.judul(I.JUDUL)
    n.penulis("Muhammad Muchson Attoyibi¹")
    n.baris_tengah("¹Program Studi Sistem Informasi, Universitas Sunan Gresik")
    n.baris_tengah("¹muchson.project@gmail.com (penulis korespondensi)", before=4)
    n.judul_abstrak("ABSTRACT", miring=True)
    n.abstrak(ABSTRACT, KATA_KUNCI_EN, "Keywords:")
    n.judul_abstrak("ABSTRAK")
    n.abstrak(ABSTRAK, KATA_KUNCI_ID, "Kata Kunci:")
    I.pendahuluan(n)
    metode(n)
    n.bagian("Hasil dan Pembahasan")
    I.rancangan(n)
    I.lingkup(n)
    hasil_data(n)
    pembahasan(n)
    kesimpulan(n)
    n.bagian("Daftar Pustaka")
    n.pustaka(I.PUSTAKA)


NAMA_BERKAS = I.NAMA_BERKAS
