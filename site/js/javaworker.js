// Penjalan Java di dalam Web Worker memakai CheerpJ (JVM di WebAssembly) dan ECJ (kompilator Java).
// Worker dipakai supaya perulangan tak berujung di kode mahasiswa bisa dihentikan dengan terminate().
// JavaRun (site/vendor/javarun.jar, sumbernya di tools/java-runner) berjalan terus sebagai layanan:
// pekerjaan masuk lewat berkas /str/job-N.txt dan hasilnya dibaca dari /files/res-N.txt.
importScripts("https://cjrtnc.leaningtech.com/4.2/loader.js");

const vendor = "/app" + new URL("../vendor/", self.location.href).pathname;
const SEP = "\u0001";
let nomor = 0;
// Berkas di /files bertahan antar kunjungan, jadi tiap worker memakai penanda sesi sendiri agar
// tidak membaca hasil lama.
const sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function tunggu(path, batas) {
  const mulai = Date.now();
  while (Date.now() - mulai < batas) {
    const b = await cjFileBlob(path);
    if (b) return b.text();
    await new Promise((r) => setTimeout(r, 30));
  }
  return null;
}

async function kerja(sumber, masukan) {
  nomor++;
  cheerpOSAddStringFile("/str/job-" + sid + "-" + nomor + ".txt", sumber + SEP + masukan);
  return tunggu("/files/res-" + sid + "-" + nomor + ".txt", 24 * 3600 * 1000);
}

async function mulai() {
  await cheerpjInit({ version: 17 });
  // Layanan berjalan selamanya; promise ini tidak pernah selesai selama worker hidup.
  cheerpjRunMain("JavaRun", vendor + "javarun.jar:" + vendor + "ecj.jar", "serve", sid);
  await tunggu("/files/siap-" + sid + ".txt", 120000);
  // Pemanasan: kompilasi pertama memuat kompilator dan lambat (belasan detik), selanjutnya cepat.
  await kerja("import java.util.*;public class Main{public static void main(String[] a){System.out.println(new ArrayList<String>());}}", "");
  self.postMessage({ type: "ready" });
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      await mulai();
    } catch (err) {
      self.postMessage({ type: "fatal", error: String(err) });
    }
  } else if (m.type === "run") {
    self.postMessage({ type: "started", id: m.id });
    const hasil = await kerja(m.code, m.inputs.join("\f"));
    self.postMessage({ type: "done", id: m.id, hasil });
  }
};
