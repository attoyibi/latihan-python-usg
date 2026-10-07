// Tantangan konsep (tanpa kode): pilihan ganda, urutkan langkah, pasangkan, seret ke kelas, isi titik, tabel penelusuran,
// dan pemilihan relasi UML. Dinilai otomatis di browser; tiap butir bisa memberi nilai sebagian.
//
// Dipakai untuk bab yang berupa konsep (flowchart, UML, JDBC, Swing, proyek) supaya setiap materi punya tantangan yang
// bisa dinilai, bukan hanya diunggah. Bagian murni (nilaiButir, nilaiSemua, kunciTeks) diuji dengan node (uji_konsep.mjs).
import { h } from "./dom.js";
import { JENIS_SERET_SENDIRI } from "./anticopas.js";

export const AMBANG_LULUS = 0.7;

const norm = (s) => String(s === null || s === undefined ? "" : s).trim().toLowerCase().replace(/\s+/g, " ");
const sama = (a, b) => norm(a) === norm(b);

// ---------- penilaian (murni) ----------

/**
 * Menilai satu butir. `j` adalah jawaban peserta untuk butir itu (bentuknya tergantung tipe).
 * @returns {{benar:number,total:number,rinci:boolean[]}} benar dan total dalam satuan sub-bagian (nilai sebagian)
 */
export function nilaiButir(b, j) {
  switch (b.tipe) {
    case "pilgan": {
      const ok = j !== null && j !== undefined && sama(j, b.opsi[b.benar]);
      return { benar: ok ? 1 : 0, total: 1, rinci: [ok] };
    }
    case "banyak": {
      const pilih = new Set((Array.isArray(j) ? j : []).map(norm));
      const rinci = b.opsi.map((o, i) => pilih.has(norm(o)) === b.benar.includes(i));
      return { benar: rinci.filter(Boolean).length, total: b.opsi.length, rinci };
    }
    case "urutkan": {
      const arr = Array.isArray(j) ? j : [];
      const rinci = b.langkah.map((l, i) => i < arr.length && sama(arr[i], l));
      return { benar: rinci.filter(Boolean).length, total: b.langkah.length, rinci };
    }
    case "cocokkan": {
      const rinci = b.pasangan.map(([kiri, kanan]) => !!j && sama(j[kiri], kanan));
      return { benar: rinci.filter(Boolean).length, total: b.pasangan.length, rinci };
    }
    case "seret": {
      const rinci = b.butir.map((x) => !!j && j[x.teks] === x.wadah);
      return { benar: rinci.filter(Boolean).length, total: b.butir.length, rinci };
    }
    case "isian": {
      const ok = j !== null && j !== undefined && b.jawaban.some((a) => sama(a, j));
      return { benar: ok ? 1 : 0, total: 1, rinci: [ok] };
    }
    case "tabel": {
      const rinci = [];
      b.baris.forEach((br, r) => br.sel.forEach((v, c) => rinci.push(!!j && !!j[r] && sama(j[r][c], v))));
      return { benar: rinci.filter(Boolean).length, total: rinci.length, rinci };
    }
    case "relasi": {
      const rinci = [];
      b.pasangan.forEach((p, i) => {
        const x = (j && j[i]) || {};
        rinci.push(sama(x.relasi, p.benar));
        if (p.a !== undefined) rinci.push(sama(x.a, p.a));
        if (p.b !== undefined) rinci.push(sama(x.b, p.b));
      });
      return { benar: rinci.filter(Boolean).length, total: rinci.length, rinci };
    }
    default:
      throw new Error("Tipe butir tidak dikenal: " + b.tipe);
  }
}

/** Menilai semua butir. `jawaban` adalah daftar jawaban sejajar dengan `butir`. */
export function nilaiSemua(butir, jawaban) {
  const per = butir.map((b, i) => nilaiButir(b, jawaban[i]));
  const benar = per.reduce((a, x) => a + x.benar, 0);
  const total = per.reduce((a, x) => a + x.total, 0);
  return { benar, total, persen: total ? benar / total : 0, per, lulus: total > 0 && benar / total >= AMBANG_LULUS, butirSalah: per.map((x, i) => (x.benar === x.total ? 0 : i + 1)).filter((x) => x > 0) };
}

/** Teks jawaban yang benar, untuk ditampilkan setelah peserta lulus. */
export function kunciTeks(b) {
  switch (b.tipe) {
    case "pilgan":
      return b.opsi[b.benar];
    case "banyak":
      return b.benar.map((i) => b.opsi[i]).join("; ");
    case "urutkan":
      return b.langkah.map((l, i) => i + 1 + ". " + l).join(" ");
    case "cocokkan":
      return b.pasangan.map(([k, v]) => k + " = " + v).join("; ");
    case "seret": {
      const nama = new Map(b.wadah.map((w) => [w.id, w.nama]));
      return b.butir.map((x) => x.teks + " -> " + nama.get(x.wadah)).join("; ");
    }
    case "isian":
      return b.jawaban[0];
    case "tabel":
      return b.baris.map((br) => br.label + ": " + br.sel.join(", ")).join("; ");
    case "relasi":
      return b.pasangan.map((p) => p.dari + " - " + p.ke + ": " + p.benar + (p.a !== undefined ? " (" + p.a + " ke " + p.b + ")" : "")).join("; ");
    default:
      return "";
  }
}

// ---------- tampilan ----------

const acak = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Pegangan seret-lepas yang juga bisa dipakai tanpa seret: ketuk satu butir lalu ketuk tempatnya (ponsel, papan ketik).
function widgetSeret({ butir, wadah, awal = {}, kapasitas = Infinity, ubah }) {
  const tempat = Object.assign({}, awal); // teks butir -> id wadah | undefined
  let terpilih = null;
  const kolam = h("div", { class: "seret-kolam", role: "group", "aria-label": "Butir yang tersedia" });
  const slot = new Map();
  const bungkus = h("div", { class: "seret-papan" });
  const chip = (teks) => {
    const c = h("button", { type: "button", class: "seret-chip", draggable: "true", "aria-pressed": "false" }, teks);
    c.addEventListener("click", (e) => {
      e.stopPropagation();
      if (tempat[teks] !== undefined) {
        // ketuk butir yang sudah ditempatkan: kembalikan ke kolam
        delete tempat[teks];
        terpilih = null;
        gambar();
        ubah();
        return;
      }
      terpilih = terpilih === teks ? null : teks;
      gambar();
    });
    c.addEventListener("dragstart", (e) => {
      terpilih = teks;
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", teks);
        e.dataTransfer.setData(JENIS_SERET_SENDIRI, "1");
        e.dataTransfer.effectAllowed = "move";
      }
    });
    return c;
  };
  const taruh = (teks, idWadah) => {
    if (idWadah !== null && kapasitas !== Infinity) {
      const isi = Object.keys(tempat).filter((t) => tempat[t] === idWadah);
      if (isi.length >= kapasitas) return;
    }
    if (idWadah === null) delete tempat[teks];
    else tempat[teks] = idWadah;
    terpilih = null;
    gambar();
    ubah();
  };
  const gambar = () => {
    kolam.replaceChildren(...butir.filter((t) => tempat[t] === undefined).map((t) => {
      const c = chip(t);
      c.classList.toggle("pilih", terpilih === t);
      c.setAttribute("aria-pressed", String(terpilih === t));
      return c;
    }));
    if (!kolam.children.length) kolam.append(h("span", { class: "muted" }, "Semua butir sudah ditempatkan. Ketuk butir di dalam kotak untuk mengembalikannya."));
    for (const w of wadah) {
      const el = slot.get(w.id);
      const isi = butir.filter((t) => tempat[t] === w.id);
      const wrap = el.querySelector(".seret-isi");
      wrap.replaceChildren(...isi.map((t) => chip(t)));
      el.classList.toggle("sasaran", terpilih !== null);
    }
  };
  for (const w of wadah) {
    const el = h("div", { class: "seret-slot", role: "group", "aria-label": w.nama, tabindex: "0" }, h("strong", { class: "seret-judul" }, w.nama), h("div", { class: "seret-isi" }));
    el.addEventListener("click", () => {
      if (terpilih !== null) taruh(terpilih, w.id);
    });
    el.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && terpilih !== null) {
        e.preventDefault();
        taruh(terpilih, w.id);
      }
    });
    el.addEventListener("dragover", (e) => e.preventDefault());
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      const t = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || terpilih;
      if (t && butir.includes(t)) taruh(t, w.id);
    });
    slot.set(w.id, el);
  }
  kolam.addEventListener("dragover", (e) => e.preventDefault());
  kolam.addEventListener("drop", (e) => {
    e.preventDefault();
    const t = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || terpilih;
    if (t && butir.includes(t)) taruh(t, null);
  });
  bungkus.append(kolam, h("div", { class: "seret-slots" }, ...wadah.map((w) => slot.get(w.id))));
  gambar();
  bungkus.ambil = () => Object.assign({}, tempat);
  return bungkus;
}

function widgetUrutkan({ langkah, awal, ubah }) {
  let daftar = awal && awal.length === langkah.length ? awal.slice() : acak(langkah);
  // hindari urutan awal yang kebetulan sudah benar
  if (!awal && daftar.every((x, i) => x === langkah[i]) && langkah.length > 1) daftar = daftar.slice(1).concat(daftar[0]);
  const ol = h("ol", { class: "urutkan-daftar" });
  let seret = null;
  const gambar = () => {
    ol.replaceChildren(...daftar.map((t, i) => {
      const naik = h("button", { type: "button", class: "btn btn-sm btn-ghost", "aria-label": "Naikkan: " + t, disabled: i === 0 ? "" : false }, "↑");
      const turun = h("button", { type: "button", class: "btn btn-sm btn-ghost", "aria-label": "Turunkan: " + t, disabled: i === daftar.length - 1 ? "" : false }, "↓");
      const pindah = (dari, ke) => {
        if (ke < 0 || ke >= daftar.length) return;
        const [x] = daftar.splice(dari, 1);
        daftar.splice(ke, 0, x);
        gambar();
        ubah();
      };
      naik.addEventListener("click", () => pindah(i, i - 1));
      turun.addEventListener("click", () => pindah(i, i + 1));
      const li = h("li", { class: "urutkan-butir", draggable: "true" }, h("span", { class: "urutkan-teks" }, t), h("span", { class: "urutkan-aksi" }, naik, turun));
      li.addEventListener("dragstart", (e) => {
        seret = i;
        if (e.dataTransfer) {
          e.dataTransfer.setData("text/plain", t);
          e.dataTransfer.setData(JENIS_SERET_SENDIRI, "1");
          e.dataTransfer.effectAllowed = "move";
        }
      });
      li.addEventListener("dragover", (e) => e.preventDefault());
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        if (seret !== null) pindah(seret, i);
        seret = null;
      });
      return li;
    }));
  };
  gambar();
  const el = h("div", { class: "urutkan" }, h("p", { class: "muted" }, "Seret langkah ke urutan yang benar, atau pakai tombol panah."), ol);
  el.ambil = () => daftar.slice();
  return el;
}

/** Membuat tampilan satu butir. Mengembalikan {el, ambil(), tandai(hasil, kunci)}. */
export function buatButir(b, nomor, jawabanAwal, ubah) {
  const el = h("section", { class: "butir", "aria-label": "Soal " + nomor });
  const kepala = h("p", { class: "butir-tanya" }, h("strong", {}, nomor + ". "), b.tanya);
  const hasil = h("div", { class: "butir-hasil", "aria-live": "polite" });
  let ambil = () => null;
  let badan;
  switch (b.tipe) {
    case "pilgan": {
      const name = "pg-" + nomor + "-" + Math.random().toString(36).slice(2, 6);
      const opsi = acak(b.opsi);
      const radios = opsi.map((o) => {
        const r = h("input", { type: "radio", name, value: o });
        if (jawabanAwal === o) r.checked = true;
        r.addEventListener("change", ubah);
        return h("label", { class: "pilihan" }, r, h("span", {}, o));
      });
      badan = h("div", { class: "pilihan-daftar", role: "radiogroup" }, ...radios);
      ambil = () => {
        const c = badan.querySelector("input:checked");
        return c ? c.value : null;
      };
      break;
    }
    case "banyak": {
      const opsi = acak(b.opsi);
      const cek = opsi.map((o) => {
        const r = h("input", { type: "checkbox", value: o });
        if (Array.isArray(jawabanAwal) && jawabanAwal.includes(o)) r.checked = true;
        r.addEventListener("change", ubah);
        return h("label", { class: "pilihan" }, r, h("span", {}, o));
      });
      badan = h("div", { class: "pilihan-daftar" }, h("p", { class: "muted" }, "Boleh lebih dari satu."), ...cek);
      ambil = () => [...badan.querySelectorAll("input:checked")].map((c) => c.value);
      break;
    }
    case "urutkan": {
      badan = widgetUrutkan({ langkah: b.langkah, awal: jawabanAwal, ubah });
      ambil = () => badan.ambil();
      break;
    }
    case "cocokkan": {
      // setiap istilah di kiri punya kotak; arti di kanan diseret atau diketuk ke kotaknya
      const kanan = acak(b.pasangan.map((p) => p[1]));
      const wadah = b.pasangan.map((p, i) => ({ id: "k" + i, nama: p[0] }));
      const awal = {};
      if (jawabanAwal) b.pasangan.forEach((p, i) => jawabanAwal[p[0]] && (awal[jawabanAwal[p[0]]] = "k" + i));
      badan = widgetSeret({ butir: kanan, wadah, awal, kapasitas: 1, ubah });
      ambil = () => {
        const tempat = badan.ambil();
        const j = {};
        b.pasangan.forEach((p, i) => {
          const t = Object.keys(tempat).find((x) => tempat[x] === "k" + i);
          j[p[0]] = t === undefined ? null : t;
        });
        return j;
      };
      break;
    }
    case "seret": {
      const awal = {};
      if (jawabanAwal) Object.assign(awal, jawabanAwal);
      badan = widgetSeret({ butir: acak(b.butir.map((x) => x.teks)), wadah: b.wadah, awal, ubah });
      ambil = () => badan.ambil();
      break;
    }
    case "isian": {
      const i = h("input", { type: "text", class: "input isian", autocomplete: "off", "aria-label": "Jawaban soal " + nomor, value: jawabanAwal || "" });
      i.addEventListener("input", ubah);
      badan = h("div", {}, i);
      ambil = () => i.value;
      break;
    }
    case "tabel": {
      const inputs = b.baris.map((br, r) => br.sel.map((_, c) => {
        const i = h("input", { type: "text", class: "input sel-tabel", autocomplete: "off", "aria-label": br.label + ", " + b.kolom[c], value: jawabanAwal && jawabanAwal[r] ? jawabanAwal[r][c] || "" : "" });
        i.addEventListener("input", ubah);
        return i;
      }));
      badan = h("div", { class: "tablewrap" }, h("table", { class: "rekap tabel-jawab" }, h("thead", {}, h("tr", {}, h("th", { scope: "col" }, ""), b.kolom.map((k) => h("th", { scope: "col" }, k)))), h("tbody", {}, b.baris.map((br, r) => h("tr", {}, h("th", { scope: "row" }, br.label), inputs[r].map((i) => h("td", {}, i)))))));
      ambil = () => inputs.map((baris) => baris.map((i) => i.value));
      break;
    }
    case "relasi": {
      const sel = (opsi, nilai, label, kelas) => {
        const s = h("select", { class: "pilih-relasi " + kelas, "aria-label": label }, h("option", { value: "" }, "pilih"), ...opsi.map((o) => h("option", { value: o, selected: nilai === o ? "" : false }, o)));
        s.addEventListener("change", ubah);
        return s;
      };
      const baris = b.pasangan.map((p, i) => {
        const x = (jawabanAwal && jawabanAwal[i]) || {};
        const sa = p.a !== undefined ? sel(b.multiplisitas, x.a, "Multiplisitas di sisi " + p.dari, "u-sa") : null;
        const sb = p.b !== undefined ? sel(b.multiplisitas, x.b, "Multiplisitas di sisi " + p.ke, "u-sb") : null;
        const sr = sel(b.relasi, x.relasi, "Jenis relasi " + p.dari + " dan " + p.ke, "u-sr");
        return { sa, sb, sr, el: h("div", { class: "relasi-baris" }, h("span", { class: "kotak-uml u-dari" }, p.dari), sa, h("span", { class: "garis-uml", "aria-hidden": "true" }, "──"), sr, h("span", { class: "garis-uml", "aria-hidden": "true" }, "──"), sb, h("span", { class: "kotak-uml u-ke" }, p.ke)) };
      });
      badan = h("div", { class: "relasi" }, ...baris.map((x) => x.el));
      ambil = () => baris.map((x) => ({ relasi: x.sr.value, a: x.sa ? x.sa.value : undefined, b: x.sb ? x.sb.value : undefined }));
      break;
    }
    default:
      badan = h("p", { class: "verdict fail" }, "Tipe soal tidak dikenal: " + b.tipe);
  }
  el.append(kepala, badan, hasil);
  return {
    el,
    ambil,
    tandai(nilai, kunci) {
      el.classList.toggle("benar", nilai.benar === nilai.total);
      el.classList.toggle("salah", nilai.benar !== nilai.total);
      const penuh = nilai.benar === nilai.total;
      hasil.replaceChildren(h("p", { class: "butir-status " + (penuh ? "ok" : "no") }, penuh ? "Benar" : nilai.benar > 0 ? "Sebagian benar (" + nilai.benar + " dari " + nilai.total + " bagian). Coba perbaiki." : "Belum tepat. Coba lagi."));
      if (kunci) hasil.append(h("p", { class: "butir-kunci" }, h("strong", {}, "Jawaban: "), kunciTeks(b)), b.penjelasan ? h("p", { class: "butir-penjelasan muted" }, b.penjelasan) : null);
    },
    bersihkan() {
      el.classList.remove("benar", "salah");
      hasil.replaceChildren();
    },
  };
}
