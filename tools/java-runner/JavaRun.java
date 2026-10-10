import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.PrintStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.eclipse.jdt.core.compiler.CategorizedProblem;
import org.eclipse.jdt.core.compiler.CharOperation;
import org.eclipse.jdt.internal.compiler.ClassFile;
import org.eclipse.jdt.internal.compiler.CompilationResult;
import org.eclipse.jdt.internal.compiler.Compiler;
import org.eclipse.jdt.internal.compiler.DefaultErrorHandlingPolicies;
import org.eclipse.jdt.internal.compiler.ICompilerRequestor;
import org.eclipse.jdt.internal.compiler.classfmt.ClassFileReader;
import org.eclipse.jdt.internal.compiler.env.ICompilationUnit;
import org.eclipse.jdt.internal.compiler.env.INameEnvironment;
import org.eclipse.jdt.internal.compiler.env.NameEnvironmentAnswer;
import org.eclipse.jdt.internal.compiler.impl.CompilerOptions;
import org.eclipse.jdt.internal.compiler.problem.DefaultProblemFactory;

/**
 * Penjalan Java untuk situs latihan: mengompilasi satu berkas Main.java di memori dengan
 * ECJ, lalu menjalankannya. Dijalankan di dalam CheerpJ (JVM di browser), karena runtime itu
 * tidak membawa javac.
 *
 * Pemakaian: JavaRun [berkas sumber] [berkas masukan] [berkas keluaran]
 * Berkas masukan boleh memuat beberapa kasus, dipisah karakter form feed (\f); sumber hanya
 * dikompilasi sekali. Keluaran: per kasus satu baris status (OK atau GALAT_JALAN) lalu keluarannya,
 * dipisah \f juga. Bila kompilasi gagal, keluaran hanya GALAT_KOMPILASI dan daftar galatnya.
 *
 * Mode paket (praktikum, beberapa berkas): sumber diawali U+0002, berisi satu atau lebih paket dipisah U+0004. Tiap paket:
 * kelas-utama U+0003 masukan U+0003 nama1 U+0005 isi1 U+0005 nama2 U+0005 isi2 ... Tiap paket dikompilasi sendiri (semua
 * berkasnya sekaligus) lalu kelas utamanya dijalankan; hasil per paket (status, keluaran) dipisah \f.
 */
public class JavaRun {
    static final String MAIN = "Main";
    // Kelas sistem dibaca dari runtime lewat jaringan dan lambat; simpan agar pemanggilan berikutnya cepat.
    static final Map<String, byte[]> CACHE = new HashMap<>();
    static final byte[] TIDAK_ADA = new byte[0];

    static byte[] bacaKelas(String name) {
        byte[] b = CACHE.get(name);
        if (b != null) {
            return b;
        }
        try (InputStream in = ClassLoader.getSystemResourceAsStream(name + ".class")) {
            b = in == null ? TIDAK_ADA : in.readAllBytes();
        } catch (Exception e) {
            b = TIDAK_ADA;
        }
        CACHE.put(name, b);
        return b;
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 2 && args[0].equals("serve")) {
            serve(args[1]);
            return;
        }
        String source = Files.readString(Path.of(args[0]), StandardCharsets.UTF_8);
        String semua = Files.readString(Path.of(args[1]), StandardCharsets.UTF_8);
        tulis(args[2], proses(source, semua));
    }

    /**
     * Mode layanan: JVM dibiarkan hidup dan menunggu pekerjaan, supaya kompilator tidak perlu
     * dimuat ulang tiap kali. Pekerjaan ke-n berupa berkas /str/job-n.txt berisi sumber, satu
     * karakter U+0001, lalu masukan; hasilnya ditulis ke /files/res-SID-n.txt.
     */
    static void serve(String sid) throws Exception {
        tulis("/files/siap-" + sid + ".txt", "siap");
        int n = 1;
        while (true) {
            Path job = Path.of("/str/job-" + sid + "-" + n + ".txt");
            if (Files.exists(job)) {
                String isi = Files.readString(job, StandardCharsets.UTF_8);
                int k = isi.indexOf('\u0001');
                String hasil;
                try {
                    hasil = proses(isi.substring(0, k), isi.substring(k + 1));
                } catch (Throwable t) {
                    hasil = "GALAT_KOMPILASI" + (char) 10 + "Penjalan gagal: " + t;
                }
                tulis("/files/res-" + sid + "-" + n + ".txt", hasil);
                n++;
            } else {
                Thread.sleep(40);
            }
        }
    }

    static String proses(String source, String semua) throws Exception {
        if (source.startsWith("\u0002")) {
            return prosesPaket(source.substring(1));
        }
        String[] kasus = semua.split("\f", -1);
        StringBuilder hasil = new StringBuilder();

        Map<String, byte[]> classes = new HashMap<>();
        Map<String, String> satu = new LinkedHashMap<>();
        satu.put(MAIN + ".java", source);
        List<String> galat = compile(satu, classes);
        if (!galat.isEmpty()) {
            hasil.append("GALAT_KOMPILASI\n");
            for (String g : galat) {
                hasil.append(g).append('\n');
            }
            return hasil.toString();
        }
        for (int k = 0; k < kasus.length; k++) {
            if (k > 0) {
                hasil.append('\f');
            }
            hasil.append(jalankan(classes, kasus[k].getBytes(StandardCharsets.UTF_8), MAIN));
        }
        return hasil.toString();
    }

    static String prosesPaket(String mentah) {
        String[] paket = mentah.split("\u0004", -1);
        StringBuilder hasil = new StringBuilder();
        for (int i = 0; i < paket.length; i++) {
            if (i > 0) {
                hasil.append('\f');
            }
            try {
                hasil.append(satuPaket(paket[i]));
            } catch (Throwable e) {
                hasil.append("GALAT_KOMPILASI\nPenjalan gagal: ").append(e);
            }
        }
        return hasil.toString();
    }

    static String satuPaket(String p) {
        String[] bagian = p.split("\u0003", 3);
        String utama = bagian[0];
        String masukan = bagian[1];
        String[] f = bagian[2].split("\u0005", -1);
        Map<String, String> berkas = new LinkedHashMap<>();
        for (int i = 0; i + 1 < f.length; i += 2) {
            berkas.put(f[i], f[i + 1]);
        }
        Map<String, byte[]> classes = new HashMap<>();
        List<String> galat = compile(berkas, classes);
        if (!galat.isEmpty()) {
            StringBuilder b = new StringBuilder("GALAT_KOMPILASI\n");
            for (String g : galat) {
                b.append(g).append('\n');
            }
            return b.toString();
        }
        return jalankan(classes, masukan.getBytes(StandardCharsets.UTF_8), utama);
    }

    static String jalankan(Map<String, byte[]> classes, byte[] input, String utama) {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        PrintStream out = new PrintStream(buf, true, StandardCharsets.UTF_8);
        PrintStream oldOut = System.out;
        PrintStream oldErr = System.err;
        InputStream oldIn = System.in;
        String status = "OK";
        try {
            System.setOut(out);
            System.setErr(out);
            System.setIn(new ByteArrayInputStream(input));
            ClassLoader loader = new ClassLoader(JavaRun.class.getClassLoader()) {
                @Override
                protected Class<?> findClass(String name) throws ClassNotFoundException {
                    byte[] b = classes.get(name);
                    if (b == null) {
                        throw new ClassNotFoundException(name);
                    }
                    return defineClass(name, b, 0, b.length);
                }
            };
            Method m = loader.loadClass(utama).getDeclaredMethod("main", String[].class);
            m.invoke(null, (Object) new String[0]);
        } catch (InvocationTargetException e) {
            status = "GALAT_JALAN";
            Throwable t = e.getCause();
            out.println("Exception in thread \"main\" " + t);
            for (StackTraceElement el : t.getStackTrace()) {
                if (el.getClassName().startsWith("java.") || el.getClassName().startsWith("jdk.") || el.getClassName().equals("JavaRun")) {
                    continue;
                }
                out.println("	at " + el);
            }
        } catch (Throwable t) {
            status = "GALAT_JALAN";
            out.println(t.toString());
        } finally {
            out.flush();
            System.setOut(oldOut);
            System.setErr(oldErr);
            System.setIn(oldIn);
        }
        return status + "\n" + buf.toString(StandardCharsets.UTF_8);
    }

    static void tulis(String path, String isi) throws Exception {
        try (FileOutputStream f = new FileOutputStream(path)) {
            f.write(isi.getBytes(StandardCharsets.UTF_8));
        }
    }

    static List<String> compile(Map<String, String> berkas, Map<String, byte[]> classes) {
        List<String> galat = new ArrayList<>();
        Map<String, ICompilationUnit> unitPerNama = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : berkas.entrySet()) {
            String namaBerkas = e.getKey();
            String tipe = namaBerkas.endsWith(".java") ? namaBerkas.substring(0, namaBerkas.length() - 5) : namaBerkas;
            char[] contents = e.getValue().toCharArray();
            unitPerNama.put(tipe, new ICompilationUnit() {
                public char[] getContents() { return contents; }
                public char[] getMainTypeName() { return tipe.toCharArray(); }
                public char[][] getPackageName() { return null; }
                public char[] getFileName() { return namaBerkas.toCharArray(); }
                public boolean ignoreOptionalProblems() { return false; }
            });
        }
        Set<String> namaTipe = unitPerNama.keySet();

        INameEnvironment env = new INameEnvironment() {
            public NameEnvironmentAnswer findType(char[][] compoundTypeName) {
                return cari(CharOperation.toString(compoundTypeName).replace('.', '/'));
            }

            public NameEnvironmentAnswer findType(char[] typeName, char[][] packageName) {
                String pkg = packageName == null || packageName.length == 0 ? "" : CharOperation.toString(packageName).replace('.', '/') + "/";
                return cari(pkg + new String(typeName));
            }

            NameEnvironmentAnswer cari(String name) {
                ICompilationUnit unit = unitPerNama.get(name);
                if (unit != null) {
                    return new NameEnvironmentAnswer(unit, null);
                }
                byte[] b = bacaKelas(name);
                if (b == TIDAK_ADA) {
                    return null;
                }
                try {
                    return new NameEnvironmentAnswer(ClassFileReader.read(b, name + ".class", true), null);
                } catch (Exception e) {
                    return null;
                }
            }

            public boolean isPackage(char[][] parentPackageName, char[] packageName) {
                String nama = (parentPackageName == null ? "" : CharOperation.toString(parentPackageName).replace('.', '/') + "/") + new String(packageName);
                if (namaTipe.contains(nama)) {
                    return false;
                }
                return bacaKelas(nama) == TIDAK_ADA;
            }

            public void cleanup() {
            }
        };

        Map<String, String> opsi = new HashMap<>();
        opsi.put(CompilerOptions.OPTION_Source, CompilerOptions.VERSION_1_8);
        opsi.put(CompilerOptions.OPTION_TargetPlatform, CompilerOptions.VERSION_1_8);
        opsi.put(CompilerOptions.OPTION_Compliance, CompilerOptions.VERSION_1_8);
        opsi.put(CompilerOptions.OPTION_ReportDeprecation, CompilerOptions.IGNORE);

        ICompilerRequestor req = new ICompilerRequestor() {
            public void acceptResult(CompilationResult r) {
                if (r.hasErrors()) {
                    for (CategorizedProblem p : r.getErrors()) {
                        galat.add(new String(r.getCompilationUnit().getFileName()) + ":" + p.getSourceLineNumber() + ": " + p.getMessage());
                    }
                } else {
                    for (ClassFile cf : r.getClassFiles()) {
                        classes.put(CharOperation.toString(cf.getCompoundName()), cf.getBytes());
                    }
                }
            }
        };

        Compiler compiler = new Compiler(env, DefaultErrorHandlingPolicies.proceedWithAllProblems(), new CompilerOptions(opsi), req, new DefaultProblemFactory(Locale.ENGLISH));
        compiler.compile(unitPerNama.values().toArray(new ICompilationUnit[0]));
        return galat;
    }
}
