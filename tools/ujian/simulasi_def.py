"""Soal SIMULASI ujian (Bab 1-4, lebih mudah dari UTS), supaya peserta mencoba setiap tahap sebelum UTS/UAS.

Format sama dengan prototype double-check-exam (tools/tasks_def.py dan changes_def.py). `buat_ujian.py simulasi`
menjalankan kunci (REF) untuk menghitung keluaran yang diharapkan, jadi tes tidak diketik tangan.
"""

S1_REF = '''nama = input()
jumlah = int(input())
total = jumlah * 20000
print(f"Halo, {nama}!")
print(f"Jumlah boks: {jumlah}")
print(f"Total: Rp {total}")
'''

S2_REF = '''jumlah = int(input())
subtotal = jumlah * 20000
if jumlah >= 10:
    ongkir = 0
else:
    ongkir = 10000
print(f"Subtotal: Rp {subtotal}")
print(f"Ongkir: Rp {ongkir}")
print(f"Total bayar: Rp {subtotal + ongkir}")
'''

TASKS = [
    {
        "id": "S1",
        "title": "Praktik 1 · Struk sederhana",
        "topic": "Variabel dan input (Bab 2)",
        "statement": [
            "UD Rasa Gresik menjual kue Rp 20.000 per boks. Tulis program yang membaca nama pembeli pada baris pertama dan jumlah boks (bilangan bulat) pada baris kedua.",
            "Cetak tiga baris: Halo, NAMA! lalu Jumlah boks: ... lalu Total: Rp ... (jumlah dikali 20000).",
        ],
        "starter": "# Baca nama dan jumlah boks\nnama = input()\n\n",
        "visible": [["Ani", "3"], ["Budi", "1"]],
        "hidden": [["Citra", "0"], ["Dewi", "10"], ["Eko", "7"], ["Fajar", "25"]],
        "trace_inputs": [["Sari", "2"], ["Tono", "5"], ["Umi", "4"], ["Wati", "12"], ["Yani", "1"], ["Zaki", "6"]],
        "ref": S1_REF,
        "variants": [
            {"id": "v1", "note": "Harga salah ketik 2000 (kurang satu nol)",
             "code": S1_REF.replace("jumlah * 20000", "jumlah * 2000")},
            {"id": "v2", "note": "Menjumlahkan, bukan mengalikan",
             "code": S1_REF.replace("jumlah * 20000", "jumlah + 20000")},
            {"id": "v3", "note": "Baris Jumlah boks mencetak total",
             "code": S1_REF.replace('print(f"Jumlah boks: {jumlah}")', 'print(f"Jumlah boks: {total}")')},
        ],
    },
    {
        "id": "S2",
        "title": "Praktik 2 · Ongkos kirim",
        "topic": "Percabangan (Bab 4)",
        "statement": [
            "Harga kue Rp 20.000 per boks. Pesanan 10 boks atau lebih gratis ongkos kirim; di bawah 10 boks ongkos kirimnya Rp 10.000. Tulis program yang membaca jumlah boks (bilangan bulat).",
            "Cetak tiga baris: Subtotal: Rp ... (jumlah dikali 20000), Ongkir: Rp ... (0 bila gratis), dan Total bayar: Rp ... (subtotal ditambah ongkir).",
        ],
        "starter": "# Baca jumlah boks\njumlah = int(input())\n\n",
        "visible": [["3"], ["12"]],
        "hidden": [["10"], ["9"], ["1"], ["0"], ["50"]],
        "trace_inputs": [["2"], ["9"], ["10"], ["11"], ["5"], ["20"]],
        "ref": S2_REF,
        "variants": [
            {"id": "v1", "note": "Memakai > bukan >= (tepat 10 boks tetap kena ongkir)",
             "code": S2_REF.replace("if jumlah >= 10:", "if jumlah > 10:")},
            {"id": "v2", "note": "Ongkir tertukar antara gratis dan berbayar",
             "code": S2_REF.replace("    ongkir = 0\nelse:\n    ongkir = 10000", "    ongkir = 10000\nelse:\n    ongkir = 0")},
            {"id": "v3", "note": "Total bayar lupa menambahkan ongkir",
             "code": S2_REF.replace("{subtotal + ongkir}", "{subtotal}")},
        ],
    },
]

CHANGES = {
    "S1": [
        {
            "id": "CS1a", "title": "Harga naik",
            "text": "Harga satu boks naik menjadi Rp 25.000. Bentuk keluaran tidak berubah.",
            "ref": S1_REF.replace("jumlah * 20000", "jumlah * 25000"),
            "visible": [["Ani", "3"], ["Budi", "1"]],
            "hidden": [["Citra", "2"], ["Dewi", "10"], ["Eko", "4"]],
        },
    ],
    "S2": [
        {
            "id": "CS2a", "title": "Batas gratis ongkir turun",
            "text": "Gratis ongkos kirim kini berlaku mulai 5 boks (bukan 10). Di bawah 5 boks ongkirnya tetap Rp 10.000.",
            "ref": S2_REF.replace("if jumlah >= 10:", "if jumlah >= 5:"),
            "visible": [["5"], ["4"]],
            "hidden": [["7"], ["9"], ["1"], ["12"]],
        },
    ],
}
