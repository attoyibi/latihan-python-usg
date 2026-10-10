#!/usr/bin/env node
// Membuat halaman publik statis untuk mesin pencari dan AI: site/belajar/** (daftar mata kuliah, tiap mata kuliah, tiap bab),
// site/sitemap.xml, site/robots.txt, site/llms.txt, site/llms-full.txt, dan mengisi blok prarender di site/index.html.
//
// Situs aslinya aplikasi satu halaman (hash routing) yang meminta masuk, sehingga perayap tidak melihat isinya.
// Halaman ini berisi teks biasa (tanpa JavaScript) dan tautan "Mulai belajar" ke aplikasi.
// Hanya data yang memang publik yang dipakai: judul, ringkasan, rujukan buku, video, dan judul tantangan/praktik.
// TIDAK PERNAH memuat soal lengkap, kerangka kode, kasus uji, atau kunci jawaban.
//
// Variabel:  SITE_URL  alamat situs tanpa garis miring akhir (bawaan https://latihan-usg.vercel.app)
// Pemakaian: node tools/buat_halaman_publik.mjs            (menulis berkas)
//            node tools/buat_halaman_publik.mjs --periksa  (gagal bila berkas di disk tidak sama dengan hasil terbaru)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const SITE = (process.env.SITE_URL || "https://latihan-usg.vercel.app").trim().replace(/\/+$/, "");
const PEMBUAT = { nama: "Muchson", url: "https://muchson.web.id/" };
const NAMA_SITUS = "Latihan Pemrograman USG";
const periksa = process.argv.includes("--periksa");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const baca = (p) => JSON.parse(readFileSync(p, "utf8"));
const dua = (n) => String(n).padStart(2, "0");
const bahasaNama = { python: "Python", java: "Java" };

const keluaran = new Map(); // jalur relatif terhadap site -> isi

function muat() {
  const daftar = baca(join(site, "data", "matakuliah.json")).filter((c) => c.aktif).sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
  return daftar.map((c) => {
    const d = join(site, "data", "kuliah", c.id);
    const materi = existsSync(join(d, "materi.json")) ? baca(join(d, "materi.json")) : [];
    const bab = materi.map((m) => {
      const tj = join(d, "challenges", "bab-" + dua(m.bab) + ".json");
      const pk = join(d, "praktik", "bab-" + dua(m.bab) + ".json");
      return {
        ...m,
        tantangan: existsSync(tj) ? baca(tj).judul || "" : "",
        praktik: existsSync(pk) ? (({ judul, tujuan }) => ({ judul, tujuan }))(baca(pk)) : null,
      };
    });
    return { ...c, bab };
  });
}

const ytUrl = (id) => "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
const aplikasi = (mk, bab) => SITE + "/#k/" + mk + (bab ? "/bab-" + bab : "");

const CSS = `
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);line-height:1.65}
.wrap{max-width:820px;margin:0 auto;padding:20px 20px 8px}
.crumb{font-size:13px;color:var(--muted);margin:0 0 14px}
.crumb a{color:var(--brand-strong)}
h1{font-size:clamp(28px,5vw,40px);line-height:1.2;margin:6px 0 10px}
h2{font-size:21px;margin:28px 0 8px}
p.lead{font-size:17px;color:var(--muted);margin:0 0 18px}
a{color:var(--brand-strong)}
ol.bab,ul.plain{padding-left:22px}
ol.bab li{margin:8px 0}
.cta{display:inline-block;background:var(--brand);color:var(--on-brand);padding:11px 20px;border-radius:var(--r-btn);text-decoration:none;font-weight:700;margin:8px 0}
.kartu{border:1px solid var(--line);border-radius:var(--r-card);padding:14px 18px;margin:12px 0;background:var(--card)}
.kartu h3{margin:0 0 4px;font-size:17px}
.kecil{font-size:14px;color:var(--muted)}
.nav2{display:flex;justify-content:space-between;gap:12px;margin:28px 0 0;font-size:15px}
footer.pembuat{border-top:1px solid var(--line);margin-top:36px;padding:16px 20px 28px;text-align:center;font-size:14px;color:var(--muted)}
`;

function kepala({ judul, deskripsi, jalur, jsonld, tipe = "website" }) {
  const url = SITE + jalur;
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(judul)}</title>
<meta name="description" content="${esc(deskripsi)}">
<meta name="author" content="${esc(PEMBUAT.nama)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${esc(url)}">
<link rel="author" href="${esc(PEMBUAT.url)}">
<meta property="og:type" content="${tipe}">
<meta property="og:locale" content="id_ID">
<meta property="og:site_name" content="${esc(NAMA_SITUS)}">
<meta property="og:title" content="${esc(judul)}">
<meta property="og:description" content="${esc(deskripsi)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/css/tokens.css">
<style>${CSS}</style>
<script type="application/ld+json">${json(jsonld)}</script>
</head>
<body>
`;
}

const kaki = `<footer class="pembuat">Dibuat oleh <a href="${PEMBUAT.url}" rel="author noopener" target="_blank">${esc(PEMBUAT.nama)}</a> &middot; <a href="${PEMBUAT.url}" target="_blank" rel="noopener">muchson.web.id</a></footer>
</body>
</html>
`;

const orang = { "@type": "Person", name: PEMBUAT.nama, url: PEMBUAT.url };

function halamanIndeks(mks) {
  const jalur = "/belajar/";
  const items = mks.map((c) => `<div class="kartu"><h3><a href="/belajar/${c.id}/">${esc(c.nama)}</a></h3><p class="kecil">${esc(bahasaNama[c.bahasa] || c.bahasa)} &middot; ${c.bab.length} bab</p><p>${esc(c.deskripsi)}</p></div>`).join("\n");
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: NAMA_SITUS, item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Mata kuliah", item: SITE + jalur }] },
    { "@context": "https://schema.org", "@type": "ItemList", itemListElement: mks.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + "/belajar/" + c.id + "/", name: c.nama })) },
  ];
  return (
    kepala({ judul: "Mata kuliah pemrograman gratis: Python dan Java | " + NAMA_SITUS, deskripsi: "Daftar mata kuliah latihan pemrograman gratis: " + mks.map((c) => c.nama).join(", ") + ". Tulis dan jalankan kode langsung di browser.", jalur, jsonld }) +
    `<div class="wrap">
<p class="crumb"><a href="/">${esc(NAMA_SITUS)}</a> / Mata kuliah</p>
<h1>Mata kuliah pemrograman</h1>
<p class="lead">Latihan koding gratis tanpa instal. Pilih mata kuliah, tulis kode di browser, dan lihat hasilnya saat itu juga.</p>
${items}
<a class="cta" href="/#kuliah">Mulai belajar</a>
</div>
` + kaki
  );
}

function halamanKuliah(c) {
  const jalur = "/belajar/" + c.id + "/";
  const bhs = bahasaNama[c.bahasa] || c.bahasa;
  const daftar = c.bab.map((b) => `<li><a href="/belajar/${c.id}/bab-${dua(b.bab)}/">Bab ${b.bab}: ${esc(b.judul)}</a><br><span class="kecil">${esc(b.ringkasan || "")}</span></li>`).join("\n");
  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: c.nama,
      description: c.deskripsi,
      inLanguage: "id",
      url: SITE + jalur,
      isAccessibleForFree: true,
      provider: { "@type": "Organization", name: "Universitas Qomaruddin (USG) Gresik" },
      author: orang,
      educationalLevel: "Pemula",
      teaches: bhs,
      hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: "PT" + c.bab.length * 2 + "H" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "IDR", category: "Free" },
      hasPart: c.bab.map((b) => ({ "@type": "LearningResource", name: "Bab " + b.bab + ": " + b.judul, url: SITE + jalur + "bab-" + dua(b.bab) + "/" })),
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: NAMA_SITUS, item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Mata kuliah", item: SITE + "/belajar/" }, { "@type": "ListItem", position: 3, name: c.nama, item: SITE + jalur }] },
  ];
  return (
    kepala({ judul: c.nama + " dengan " + bhs + ": " + c.bab.length + " bab latihan gratis | " + NAMA_SITUS, deskripsi: c.deskripsi + " " + c.bab.length + " bab, gratis, tanpa instal.", jalur, jsonld }) +
    `<div class="wrap">
<p class="crumb"><a href="/">${esc(NAMA_SITUS)}</a> / <a href="/belajar/">Mata kuliah</a> / ${esc(c.nama)}</p>
<h1>${esc(c.nama)} dengan ${esc(bhs)}</h1>
<p class="lead">${esc(c.deskripsi)}</p>
<a class="cta" href="${esc(aplikasi(c.id))}">Mulai belajar (perlu masuk)</a>
<h2>Isi mata kuliah: ${c.bab.length} bab</h2>
<ol class="bab">
${daftar}
</ol>
<h2>Cara belajarnya</h2>
<ul class="plain">
<li>Tulis kode ${esc(bhs)} langsung di browser, tanpa instal apa pun, dan lihat hasilnya saat itu juga.</li>
<li>Tiap bab punya tantangan koding yang diperiksa otomatis, dan sebagian bab punya praktik dua bagian.</li>
<li>Kerjakan dengan urutan bebas; progresmu tersimpan dan bisa dijadikan laporan PDF.</li>
</ul>
</div>
` + kaki
  );
}

function halamanBab(c, i) {
  const b = c.bab[i];
  const jalur = "/belajar/" + c.id + "/bab-" + dua(b.bab) + "/";
  const bhs = bahasaNama[c.bahasa] || c.bahasa;
  const sebelum = c.bab[i - 1];
  const sesudah = c.bab[i + 1];
  const video = (b.video || []).map((v) => `<li><a href="${esc(ytUrl(v.id))}" rel="noopener" target="_blank">${esc(v.judul)}</a>${v.channel ? ' <span class="kecil">(' + esc(v.channel) + ")</span>" : ""}</li>`).join("\n");
  const latihan = [];
  if (b.tantangan) latihan.push(`<li><strong>Tantangan:</strong> ${esc(b.tantangan)}</li>`);
  if (b.praktik) latihan.push(`<li><strong>Praktik:</strong> ${esc(b.praktik.judul)}. <span class="kecil">${esc(b.praktik.tujuan)}</span></li>`);
  if (b.pertanyaanKonsep) latihan.push(`<li><strong>Pertanyaan konsep:</strong> ${esc(b.pertanyaanKonsep)}</li>`);
  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "LearningResource",
      name: "Bab " + b.bab + ": " + b.judul,
      description: b.ringkasan,
      inLanguage: "id",
      url: SITE + jalur,
      isAccessibleForFree: true,
      learningResourceType: b.jenis === "konsep" ? "Pertanyaan konsep" : "Latihan koding",
      teaches: b.judul,
      isPartOf: { "@type": "Course", name: c.nama, url: SITE + "/belajar/" + c.id + "/" },
      author: orang,
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: NAMA_SITUS, item: SITE + "/" }, { "@type": "ListItem", position: 2, name: c.nama, item: SITE + "/belajar/" + c.id + "/" }, { "@type": "ListItem", position: 3, name: "Bab " + b.bab, item: SITE + jalur }] },
  ];
  return (
    kepala({ judul: "Bab " + b.bab + ": " + b.judul + " | " + c.nama + " (" + bhs + ")", deskripsi: b.ringkasan || c.deskripsi, jalur, jsonld, tipe: "article" }) +
    `<div class="wrap">
<p class="crumb"><a href="/">${esc(NAMA_SITUS)}</a> / <a href="/belajar/${c.id}/">${esc(c.nama)}</a> / Bab ${b.bab}</p>
<h1>Bab ${b.bab}: ${esc(b.judul)}</h1>
<p class="lead">${esc(b.ringkasan || "")}</p>
<a class="cta" href="${esc(aplikasi(c.id, b.bab))}">Kerjakan bab ini (perlu masuk)</a>
${b.buku ? `<h2>Rujukan buku ajar</h2>\n<p>${esc(b.buku.teks)}${b.buku.halaman ? ", halaman " + esc(b.buku.halaman) : ""}.</p>` : ""}
${video ? `<h2>Video pendamping</h2>\n<ul class="plain">\n${video}\n</ul>` : ""}
${latihan.length ? `<h2>Yang akan kamu kerjakan</h2>\n<ul class="plain">\n${latihan.join("\n")}\n</ul>` : ""}
<div class="nav2"><span>${sebelum ? `<a href="/belajar/${c.id}/bab-${dua(sebelum.bab)}/">&larr; Bab ${sebelum.bab}: ${esc(sebelum.judul)}</a>` : ""}</span><span>${sesudah ? `<a href="/belajar/${c.id}/bab-${dua(sesudah.bab)}/">Bab ${sesudah.bab}: ${esc(sesudah.judul)} &rarr;</a>` : ""}</span></div>
</div>
` + kaki
  );
}

function prarender(mks) {
  const kartu = mks.map((c) => `<li><a href="/belajar/${c.id}/"><strong>${esc(c.nama)}</strong></a> (${esc(bahasaNama[c.bahasa] || c.bahasa)}, ${c.bab.length} bab): ${esc(c.deskripsi)}</li>`).join("\n");
  return `<!--PRARENDER-->
<section class="prarender" style="max-width:820px;margin:0 auto;padding:24px 0">
<h1>${esc(NAMA_SITUS)}: belajar Python dan Java langsung di browser</h1>
<p>Latihan koding gratis tanpa instal untuk mahasiswa dan pemula. Tulis kode, jalankan, dan lihat hasilnya saat itu juga.</p>
<h2>Mata kuliah</h2>
<ul>
${kartu}
</ul>
<p><a href="/belajar/">Lihat semua mata kuliah dan isi bab</a></p>
</section>
<!--/PRARENDER-->`;
}

function sitemap(mks) {
  const u = [["/", "1.0"], ["/belajar/", "0.9"]];
  for (const c of mks) {
    u.push(["/belajar/" + c.id + "/", "0.8"]);
    for (const b of c.bab) u.push(["/belajar/" + c.id + "/bab-" + dua(b.bab) + "/", "0.6"]);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${u.map(([p, pr]) => `  <url><loc>${esc(SITE + p)}</loc><priority>${pr}</priority></url>`).join("\n")}\n</urlset>\n`;
}

const robots = () => `# Halaman publik boleh dirayapi mesin pencari dan AI. Bagian berlogin tidak berisi apa pun untuk dirayapi.
User-agent: *
Allow: /

# Perayap AI yang diizinkan secara eksplisit
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

function llms(mks, penuh) {
  const t = [`# ${NAMA_SITUS}`, "", `> Situs latihan koding gratis tanpa instal: tulis dan jalankan kode Python dan Java langsung di browser. Dibuat oleh ${PEMBUAT.nama} (${PEMBUAT.url}) untuk mahasiswa Universitas Qomaruddin (USG) Gresik dan pemula umum. Bahasa: Indonesia.`, ""];
  t.push("Aplikasi latihan memerlukan akun; halaman di bawah ini adalah ringkasan publik tiap mata kuliah dan bab.", "");
  for (const c of mks) {
    t.push(`## ${c.nama} (${bahasaNama[c.bahasa] || c.bahasa})`, "", c.deskripsi, "", `- [Ringkasan mata kuliah](${SITE}/belajar/${c.id}/)`);
    for (const b of c.bab) {
      t.push(`- [Bab ${b.bab}: ${b.judul}](${SITE}/belajar/${c.id}/bab-${dua(b.bab)}/)${penuh ? "" : ": " + (b.ringkasan || "")}`);
      if (penuh) {
        t.push(`  - Ringkasan: ${b.ringkasan || ""}`);
        if (b.buku) t.push(`  - Rujukan buku: ${b.buku.teks}${b.buku.halaman ? ", hlm. " + b.buku.halaman : ""}`);
        if (b.tantangan) t.push(`  - Tantangan: ${b.tantangan}`);
        if (b.praktik) t.push(`  - Praktik: ${b.praktik.judul}. ${b.praktik.tujuan}`);
        for (const v of b.video || []) t.push(`  - Video: ${v.judul} (${ytUrl(v.id)})`);
      }
    }
    t.push("");
  }
  t.push("## Pembuat", "", `- [${PEMBUAT.nama}](${PEMBUAT.url})`, "");
  return t.join("\n");
}

function suntikIndex(mks) {
  const p = join(site, "index.html");
  let s = readFileSync(p, "utf8");
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  const blok = prarender(mks);
  if (!/<!--PRARENDER-->[\s\S]*?<!--\/PRARENDER-->/.test(s)) throw new Error("index.html belum punya penanda <!--PRARENDER-->...<!--/PRARENDER-->");
  s = s.replace(/<!--PRARENDER-->[\s\S]*?<!--\/PRARENDER-->/, () => blok);
  s = s.replace(/(<link rel="canonical" href=")[^"]*(")/, (_, a, b) => a + SITE + "/" + b);
  s = s.replace(/(<meta property="og:url" content=")[^"]*(")/, (_, a, b) => a + SITE + "/" + b);
  return crlf ? s.replace(/\n/g, "\r\n") : s;
}

function bangun() {
  const mks = muat();
  keluaran.set("belajar/index.html", halamanIndeks(mks));
  for (const c of mks) {
    keluaran.set("belajar/" + c.id + "/index.html", halamanKuliah(c));
    c.bab.forEach((b, i) => keluaran.set("belajar/" + c.id + "/bab-" + dua(b.bab) + "/index.html", halamanBab(c, i)));
  }
  keluaran.set("sitemap.xml", sitemap(mks));
  keluaran.set("robots.txt", robots());
  keluaran.set("llms.txt", llms(mks, false));
  keluaran.set("llms-full.txt", llms(mks, true));
  keluaran.set("index.html", suntikIndex(mks));
}

bangun();
let beda = 0;
for (const [rel, isi] of keluaran) {
  const p = join(site, rel);
  if (periksa) {
    const ada = existsSync(p) ? readFileSync(p, "utf8") : null;
    if (ada !== isi) {
      beda++;
      console.error("BEDA  " + rel);
    }
  } else {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, isi, "utf8");
  }
}
if (periksa) {
  if (beda) {
    console.error(`${beda} berkas tidak sesuai. Jalankan: node tools/buat_halaman_publik.mjs`);
    process.exit(1);
  }
  console.log(`Semua ${keluaran.size} berkas publik sesuai dengan data.`);
} else console.log(`[buat_halaman_publik] ${keluaran.size} berkas ditulis untuk ${SITE}`);
