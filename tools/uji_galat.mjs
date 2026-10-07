// Menguji pengelompokan galat (site/js/galat.js). Jalankan: node tools/uji_galat.mjs
import { klasifikasiGalat, kelompokGalat } from "../site/js/galat.js";

let total = 0;
let gagal = 0;
const cek = (nama, kondisi, detail = "") => {
  total++;
  if (!kondisi) {
    gagal++;
    console.log("GAGAL " + nama + (detail ? "  -> " + detail : ""));
  } else console.log("OK    " + nama);
};
const j = (b, e) => JSON.stringify(klasifikasiGalat(b, e));

console.log("== Python ==");
cek("SyntaxError dengan pesan", klasifikasiGalat("python", 'File "<exec>", line 3\n    if x > 1\n            ^\nSyntaxError: expected \':\'').jenis === "SyntaxError");
cek("pesan SyntaxError terbawa", klasifikasiGalat("python", "SyntaxError: expected ':'").pesan === "expected ':'");
cek("IndentationError dibedakan dari SyntaxError", klasifikasiGalat("python", "  File \"<exec>\", line 5\nIndentationError: expected an indented block after 'if' statement on line 4").jenis === "IndentationError");
cek("traceback panjang: yang terakhir dipakai", klasifikasiGalat("python", "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nNameError: name 'jumlah' is not defined").jenis === "NameError");
cek("galat berantai memakai yang terakhir", klasifikasiGalat("python", "ValueError: invalid literal for int()\n\nDuring handling of the above exception, another exception occurred:\n\nTypeError: bad").jenis === "TypeError");
cek("ZeroDivisionError", klasifikasiGalat("python", "ZeroDivisionError: division by zero").jenis === "ZeroDivisionError");
cek("EOFError (input habis)", klasifikasiGalat("python", "EOFError: EOF when reading a line").jenis === "EOFError");
cek("tanpa nama galat dikelompokkan GalatLain", klasifikasiGalat("python", "sesuatu yang aneh terjadi").jenis === "GalatLain");
cek("tanpa galat mengembalikan null", klasifikasiGalat("python", "") === null && klasifikasiGalat("python", null) === null && klasifikasiGalat("java", "   ") === null);
cek("pesan dipotong 200 karakter dan satu baris", klasifikasiGalat("python", "ValueError: " + "x".repeat(500)).pesan.length === 200 && !klasifikasiGalat("python", "ValueError: a\nb").pesan.includes("\n"));

console.log("\n== Java ==");
cek("kesalahan sintaks kompilasi", klasifikasiGalat("java", "Galat kompilasi:\n1. ERROR in Main.java (at line 4)\n\tSystem.out.println(x)\n\t                     ^\nSyntax error, insert \";\" to complete BlockStatements").jenis === "SyntaxError");
cek("simbol tidak ditemukan", klasifikasiGalat("java", "Galat kompilasi:\n1. ERROR in Main.java (at line 3)\n\tint y = x + 1;\nx cannot be resolved to a variable").jenis === "CannotResolve");
cek("tipe tidak cocok", klasifikasiGalat("java", "Galat kompilasi:\n1. ERROR in Main.java (at line 3)\n\tint a = \"teks\";\nType mismatch: cannot convert from String to int").jenis === "TypeMismatch");
cek("variabel belum diisi", klasifikasiGalat("java", "Galat kompilasi:\n1. ERROR in Main.java (at line 5)\nThe local variable total may not have been initialized").jenis === "GalatKompilasi" || klasifikasiGalat("java", "Galat kompilasi:\nThe local variable total might not have been initialized").jenis === "NotInitialized");
cek("galat kompilasi lain", klasifikasiGalat("java", "Galat kompilasi:\nSesuatu yang tidak dikenal").jenis === "GalatKompilasi");
cek("exception saat berjalan", klasifikasiGalat("java", 'Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.length()"').jenis === "NullPointerException");
cek("exception tanpa pesan", klasifikasiGalat("java", 'Exception in thread "main" java.lang.ArithmeticException: / by zero').jenis === "ArithmeticException");
cek("nama paket dibuang dari jenis", !klasifikasiGalat("java", 'Exception in thread "main" java.util.InputMismatchException').jenis.includes("."));

console.log("\n== kelompok ==");
const k = kelompokGalat;
cek("sintaks", k("SyntaxError") === "Sintaks" && k("IndentationError") === "Sintaks" && k("GalatKompilasi") === "Sintaks");
cek("nama tidak dikenal (Python dan Java)", k("NameError") === "Nama tidak dikenal" && k("CannotResolve") === "Nama tidak dikenal");
cek("tipe dan nilai", k("TypeError") === "Tipe dan nilai" && k("TypeMismatch") === "Tipe dan nilai");
cek("akses data", k("IndexError") === "Akses data" && k("NullPointerException") === "Akses data");
cek("timeout dan lainnya", k("Timeout") === "Berjalan terlalu lama" && k("RecursionError") === "Lainnya" && k(null) === "Lainnya");

console.log(gagal ? `\n${gagal} dari ${total} uji GAGAL.` : `\nSemua ${total} uji lulus.`);
process.exit(gagal ? 1 : 0);
