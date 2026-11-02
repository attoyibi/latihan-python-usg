"""Isi naskah jurnal: Pendahuluan, Rancangan platform, dan Daftar Pustaka (tidak bergantung data).

Bagian yang bergantung data (abstrak, metode, hasil, pembahasan, kesimpulan) ada di isi_hasil.py dan membaca angka dari
docs/jurnal/naskah/angka-naskah.json. Setiap kutipan di teks harus ada di PUSTAKA dan sebaliknya (diperiksa oleh
tools/jurnal/periksa_naskah.py). Pernyataan tentang isi pustaka hanya yang tertera di judul atau abstrak aslinya.
"""
import json
import pathlib

import gambar

AKAR = pathlib.Path(__file__).resolve().parents[2]
NAMA_BERKAS = "naskah-jurnal-abdiwiguna-platform-latihan-pemrograman.docx"
JUDUL = ("Pendampingan Keterampilan Digital Pemrograman Mahasiswa melalui Platform Latihan Berbasis Browser: "
         "Implementasi dan Evaluasi Penggunaan")

PUSTAKA = [
    "Ayub, M., & Karnalim, O. (2024). The effectiveness of Hedy and Python Tutor in helping students learning programming. *2024 47th MIPRO ICT and Electronics Convention (MIPRO)* (pp. 520–525). IEEE. https://doi.org/10.1109/mipro60963.2024.10569202",
    "Bilegjargal, D., & Hsueh, N.-L. (2021). Understanding students’ acceptance of online judge system in programming courses: A structural equation modeling approach. *IEEE Access, 9*, 152606–152615. https://doi.org/10.1109/access.2021.3126896",
    "Cerratto Pargman, T., & McGrath, C. (2021). Mapping the ethics of learning analytics in higher education: A systematic literature review of empirical research. *Journal of Learning Analytics, 8*(2), 123–139. https://doi.org/10.18608/jla.2021.1",
    "Cipriano, B. P., Fachada, N., & Alves, P. (2022). Drop Project: An automatic assessment tool for programming assignments. *SoftwareX, 18*, 101079. https://doi.org/10.1016/j.softx.2022.101079",
    "Cohen, A. K., Oleson, A., & Ko, A. J. (2024). Factors influencing the social help-seeking behavior of introductory programming students in a competitive university environment. *ACM Transactions on Computing Education, 24*(1), 1–27. https://doi.org/10.1145/3639059",
    "Emirtekin, E. (2025). Large language model-powered automated assessment: A systematic review. *Applied Sciences, 15*(10), 5683. https://doi.org/10.3390/app15105683",
    "Fragkoudakis, C., Karampatsis, M., & Lagaros, N. (2025). Overcoming platform dependency: The role of WebAssembly and Pyodide in civil engineering tools transition. *Lecture Notes in Civil Engineering* (pp. 176–184). Springer. https://doi.org/10.1007/978-3-031-92754-6_17",
    "Francis, M., Avoseh, M., Card, K., Newland, L., & Streff, K. (2023). Student privacy and learning analytics. *Journal of Learning Analytics, 10*(3), 102–114. https://doi.org/10.18608/jla.2023.7975",
    "Fu, Q., Bai, X., Zheng, Y., Du, R., Wang, D., & Zhang, T. (2022). VisOJ: Real-time visual learning analytics dashboard for online programming judge. *The Visual Computer, 39*(6), 2393–2405. https://doi.org/10.1007/s00371-022-02586-z",
    "Haindl, P., & Weinberger, G. (2024). Does ChatGPT help novice programmers write better code? Results from static code analysis. *IEEE Access, 12*, 114146–114156. https://doi.org/10.1109/access.2024.3445432",
    "Kadar, R., Abdul Wahab, N., Othman, J., Shamsuddin, M., & Mahlan, S. B. (2021). A study of difficulties in teaching and learning programming: A systematic literature review. *International Journal of Academic Research in Progressive Education and Development, 10*(3). https://doi.org/10.6007/ijarped/v10-i3/11100",
    "Kim, S., Park, J., Jeon, S., & Seo, D. (2022). Web-based online judge system for online programming education. *2022 IEEE International Conference on Consumer Electronics (ICCE)* (pp. 1–3). IEEE. https://doi.org/10.1109/icce53296.2022.9730422",
    "Kurniadi Siradjuddin, H., & Muhammad, F. (2022). Pelatihan keterampilan bahasa pemrograman Python pada komunitas masyarakat Zona IT Ternate. *TRIDARMA: Pengabdian Kepada Masyarakat (PkM), 5*(1), 241–245. https://doi.org/10.35335/abdimas.v5i1.2368",
    "Liang, Y., & Uehara, M. (2023). Browser-based Java development environment for programming education. *2023 Eleventh International Symposium on Computing and Networking Workshops (CANDARW)* (pp. 153–158). IEEE. https://doi.org/10.1109/candarw60564.2023.00033",
    "Livaja Mušac, P., Nakić, J., & Sović Kržić, A. (2026). Automatic assessment tools for grading coding assignments: A systematic literature review. *Applied Sciences, 16*(11), 5658. https://doi.org/10.3390/app16115658",
    "Novak, M., & Kermek, D. (2024). Assessment automation of complex student programming assignments. *Education Sciences, 14*(1), 54. https://doi.org/10.3390/educsci14010054",
    "Paiva, J. C., Leal, J. P., & Figueira, Á. (2023). PROGpedia: Collection of source-code submitted to introductory programming assignments. *Data in Brief, 46*, 108887. https://doi.org/10.1016/j.dib.2023.108887",
    "Rahman, M. M., Kawabayashi, S., & Watanobe, Y. (2021). Categorization of frequent errors in solution codes created by novice programmers. *SHS Web of Conferences, 102*, 04014. https://doi.org/10.1051/shsconf/202110204014",
    "Ramadhan, H., Dedi Leman, & Adil Setiawan. (2025). Pelatihan pemrograman dasar dan penerapan algoritma berbasis Python. *ULINA: Jurnal Pengabdian kepada Masyarakat, 3*(2), 1–10. https://doi.org/10.58918/3sbm9618",
    "Ramaswami, G., Susnjak, T., & Mathrani, A. (2023). Effectiveness of a learning analytics dashboard for increasing student engagement levels. *Journal of Learning Analytics, 10*(3), 115–134. https://doi.org/10.18608/jla.2023.7935",
    "Rys-Recker, N., & Hao, Q. (2024). Early identification of struggling students in large computer science courses: A replication study. *2024 IEEE 48th Annual Computers, Software, and Applications Conference (COMPSAC)* (pp. 88–93). IEEE. https://doi.org/10.1109/compsac61105.2024.00022",
    "Schnieder, M., & Williams, S. (2023). Educational mobile apps for programming in Python: Review and analysis. *Education Sciences, 13*(1), 66. https://doi.org/10.3390/educsci13010066",
    "Sobral, S. R. (2021). Teaching and learning to program: Umbrella review of introductory programming in higher education. *Mathematics, 9*(15), 1737. https://doi.org/10.3390/math9151737",
    "Tikva, C., & Tambouris, E. (2021). A systematic mapping study on teaching and learning computational thinking through programming in higher education. *Thinking Skills and Creativity, 41*, 100849. https://doi.org/10.1016/j.tsc.2021.100849",
    "Tushar, & Mohan, B. R. (2022). Comparative analysis of JavaScript and WebAssembly in the browser environment. *2022 IEEE 10th Region 10 Humanitarian Technology Conference (R10-HTC)* (pp. 232–237). IEEE. https://doi.org/10.1109/r10-htc54060.2022.9929829",
    "Wulandari, R., Razilu, Z., & Rahmawati, R. (2026). Pelatihan pemrograman berorientasi objek sebagai upaya penguatan keterampilan coding mahasiswa. *COMMUNITY: Jurnal Pengabdian Kepada Masyarakat, 6*(1), 565–576. https://doi.org/10.51878/community.v6i1.10057",
    "Zhou, Z., Wang, S., & Qian, Y. (2021). Learning from errors: Exploring the effectiveness of enhanced error messages in learning to program. *Frontiers in Psychology, 12*, 768962. https://doi.org/10.3389/fpsyg.2021.768962",
]


def angka():
    return json.loads((AKAR / "docs" / "jurnal" / "naskah" / "angka-naskah.json").read_text(encoding="utf8"))


def pendahuluan(n):
    n.bagian("Pendahuluan")
    n.para("Kemampuan memprogram kini menjadi keterampilan digital dasar bagi mahasiswa program studi sistem informasi, dan berpikir komputasional (*computational thinking*) di pendidikan tinggi semakin sering dikembangkan melalui pemrograman (Tikva & Tambouris, 2021). Namun, mata kuliah pemrograman pengantar secara tradisional memiliki tingkat kegagalan dan putus kuliah yang tinggi (Sobral, 2021). Kajian sistematis juga menunjukkan bahwa pengajar menghadapi kendala dalam membuat mahasiswa, terutama yang berasal dari luar ilmu komputer, memahami konsep pemrograman dan mampu memakainya untuk menyelesaikan masalah nyata (Kadar et al., 2021).")
    n.para("Latihan dengan umpan balik yang cepat menjadi kunci. Alat penilaian otomatis mengevaluasi program mahasiswa tanpa menunggu dosen, memberi umpan balik cepat, dan menyorot kesalahan (Cipriano et al., 2022). Tinjauan terbaru melaporkan meningkatnya kebutuhan metode penilaian yang terukur dan andal seiring berkembangnya pendidikan pemrograman dan pembelajaran daring (Livaja Mušac et al., 2026), sementara menilai tugas pemrograman yang kompleks sendiri bukan pekerjaan mudah (Novak & Kermek, 2024). Sistem *online judge* telah luas dipakai untuk membantu mahasiswa melatih keterampilan koding (Bilegjargal & Hsueh, 2021) dan dapat meringankan dosen yang harus mengelola penilaian, latihan, dan umpan balik sekaligus (Kim et al., 2022).")
    n.para("Umpan balik bawaan lingkungan pemrograman sering kurang membantu pemula. Pesan galat kerap samar dan membingungkan (Zhou et al., 2021), dan pemula menghabiskan banyak waktu mencari kesalahan di kodenya sendiri (Rahman et al., 2021). Bagi dosen, pertanyaan praktisnya adalah galat apa yang paling sering muncul dan di bab mana mahasiswa tersangkut. Dasbor analitik belajar makin populer untuk memberi wawasan tentang pola perilaku belajar di lingkungan daring (Ramaswami et al., 2023), termasuk dasbor visual untuk *online judge* pemrograman (Fu et al., 2022), dan identifikasi dini mahasiswa yang kesulitan di kelas besar tetap menjadi perhatian peneliti (Rys-Recker & Hao, 2024).")
    n.para("Kendala lain bersifat teknis. Alat bantu belajar pemrograman yang menuntut instalasi di tiap perangkat bergantung pada sistem operasi dan kondisi komputer mahasiswa. WebAssembly dan Pyodide dibahas sebagai cara mengatasi ketergantungan platform pada perkakas berbasis Python (Fragkoudakis et al., 2025), dan aplikasi web lebih mudah diakses serta tidak bergantung pada platform (Tushar & Mohan, 2022). Lingkungan pemrograman berbasis browser telah dikembangkan untuk pembelajaran interaktif (Liang & Uehara, 2023).")
    n.para("Kegiatan pengabdian bertema pelatihan Python juga telah dilaporkan, misalnya pada komunitas masyarakat (Kurniadi Siradjuddin & Muhammad, 2022), peserta didik tingkat kejuruan (Ramadhan et al., 2025), dan mahasiswa program pendidikan teknologi informasi (Wulandari et al., 2026). Kegiatan semacam itu umumnya berupa sesi pelatihan terjadwal. Sepengetahuan penulis, pada pustaka yang ditinjau belum banyak laporan yang memadukan tiga hal dalam satu platform yang dapat dioperasikan dosen dengan biaya rendah: eksekusi Python tanpa instalasi di perangkat peserta, penilaian otomatis berbasis kasus uji, dan pencatatan proses belajar yang tunduk pada persetujuan peserta disertai dasbor untuk dosen. Karena rekaman proses belajar adalah data pribadi, rancangan seperti ini harus memperhatikan etika dan privasi (Cerratto Pargman & McGrath, 2021; Francis et al., 2023).")
    n.para("Kegiatan ini bertujuan (1) menerapkan platform latihan pemrograman berbasis browser (Python dan Java) sebagai teknologi tepat guna untuk mendampingi mahasiswa Program Studi Sistem Informasi Universitas Sunan Gresik membangun keterampilan digital pemrograman, dan (2) mengevaluasi penggunaannya dari rekaman anonim: bab yang diselesaikan, jumlah percobaan, jenis galat, dan waktu belajar.")


def rancangan(n):
    A = angka()
    s = A["sistem"]
    n.subbagian("Rancangan dan Arsitektur Platform")
    n.para("Platform dirancang agar seluruh kode peserta dijalankan di peramban peserta sendiri (Gambar 2). Situs berupa berkas statis (HTML, CSS, dan JavaScript tanpa proses *build*) yang dilayani hosting statis, sehingga tidak ada server yang mengeksekusi kode mahasiswa. Python dijalankan oleh Pyodide versi %s, yaitu CPython yang dikompilasi ke WebAssembly, di dalam *Web Worker* terpisah dengan batas waktu %d detik agar program yang macet berhenti sendiri tanpa membekukan halaman. Java dijalankan dengan cara serupa memakai mesin virtual Java yang berjalan di WebAssembly dan kompiler Eclipse, juga tanpa server. Keluaran program dinilai di peramban dengan membandingkannya terhadap kasus uji setelah spasi di ujung baris dinormalkan. Akun, progres, dan rekaman belajar disimpan di Supabase (PostgreSQL dan autentikasi) dengan aturan akses per baris (*row level security*): peserta hanya dapat membaca dan menulis datanya sendiri, sedangkan akun dosen dapat meninjau seluruh peserta." % (s["pyodide"], s["batas_detik"]))
    n.gambar(AKAR / "docs" / "jurnal" / "naskah" / "gambar" / "gambar-arsitektur.png", "Arsitektur platform latihan berbasis browser (dibuat penulis)", 12.5)
    n.para("Tabel 1 merangkum komponen utama dan pertimbangan perancangannya. Pilihan eksekusi di browser menghilangkan kebutuhan instalasi dan biaya server eksekusi, tetapi menuntut unduhan awal Pyodide sekitar 10 MB sekali per perangkat; karena itu pustaka tersebut dimuat lebih awal hanya bagi peserta yang sudah masuk.")
    n.tabel("Komponen Platform dan Pertimbangan Rancangan",
            ["Komponen", "Teknologi", "Fungsi dan pertimbangan"],
            [["Antarmuka", "HTML, CSS, JavaScript (%d berkas, ± %s baris)" % (s["berkas_js"], format(s["baris_js"], ",").replace(",", ".")), "Berjalan di laptop dan ponsel; tanpa langkah *build* sehingga mudah diperbarui dosen"],
             ["Eksekusi kode", "Pyodide %s (Python) dan JVM di WebAssembly (Java), dalam *Web Worker*" % s["pyodide"], "Tanpa instalasi; kode dijalankan di perangkat peserta; batas %d detik" % s["batas_detik"]],
             ["Penilaian", "Kasus uji per soal (%d dan %d kasus uji)" % (s["python"]["kasus_uji"], s["java"]["kasus_uji"]), "Umpan balik seketika; petunjuk tiga tingkat dibuka bertahap"],
             ["Data dan akun", "Supabase: PostgreSQL, Auth (%d migrasi skema)" % s["migrasi"], "Aturan akses per baris; kolom riset dipisah dari identitas"],
             ["Dasbor dosen", "Halaman instruktur di situs yang sama", "Rekap progres, jejak peserta, kehadiran, dan ekspor anonim"]],
            [3.0, 5.2, 7.3], "dokumentasi dan kode sumber platform (repositori latihan-python-usg)", ["left", "left", "left"])


def lingkup(n):
    A = angka()
    py, jv = A["sistem"]["python"], A["sistem"]["java"]
    n.subbagian("Cakupan Materi dan Fitur Pendampingan")
    n.para("Materi Algoritma dan Pemrograman mengikuti buku ajar *Algoritma dan Pemrograman: Fondasi Berpikir Komputasional dengan Python* yang terdiri atas %d bab, dari dasar algoritma sampai rekursi dan proyek akhir; Pemrograman Berorientasi Objek memuat %d bab dengan Java. Setiap bab memuat ringkasan materi dengan rujukan ke sub-bab buku, video bantuan bila tersedia, satu soal latihan, dan pada sebagian besar bab praktik berkas. Urutan bab tidak dikunci: mahasiswa bebas memilih bab, dan setiap bab diberi penanda belum, sedang, atau selesai. Bab koding dianggap selesai bila seluruh kasus uji soal latihan terpenuhi, sedangkan bab konsep dijawab dengan isian. Tabel 2 merangkum cakupan dan fitur pendampingan." % (py["bab"], jv["bab"]))
    n.tabel("Cakupan Materi dan Fitur Pendampingan pada Dua Mata Kuliah",
            ["Unsur", "Python", "Java", "Peran dalam pendampingan"],
            [["Bab materi", "%d" % py["bab"], "%d" % jv["bab"], "Urutan bebas; penanda status per bab"],
             ["Soal latihan", "%d koding, %d konsep" % (py["soal_koding"], py["soal_konsep"]), "%d koding, %d konsep" % (jv["soal_koding"], jv["soal_konsep"]), "Dinilai otomatis oleh kasus uji"],
             ["Kasus uji", "%d" % py["kasus_uji"], "%d" % jv["kasus_uji"], "Umpan balik seketika, termasuk kasus tepi"],
             ["Petunjuk bertingkat", "3 tingkat", "3 tingkat", "Bantuan bertahap; penggunaan dicatat"],
             ["Praktik berkas", "%d" % py["praktik"], "%d" % jv["praktik"], "Berlatih menyusun program beberapa berkas"],
             ["Laporan praktikum", "5 kolom", "5 kolom", "Refleksi tertulis; tempel dan salin dinonaktifkan; ekspor PDF"],
             ["Rekaman belajar", "ya", "ya", "Percobaan, galat, dan sesi untuk pemantauan dosen"],
             ["Dasbor dosen", "ya", "ya", "Menemukan peserta yang tersangkut"]],
            [3.2, 3.0, 3.0, 6.3], "dokumentasi dan data isi platform (repositori latihan-python-usg)", ["left", "center", "center", "left"])
