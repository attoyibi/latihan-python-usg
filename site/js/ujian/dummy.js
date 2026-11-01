// Peserta DUMMY untuk simulasi: dipakai dosen untuk melihat seperti apa pantauan, ekspor CSV/PDF, dan tampilan analisis
// tanpa menunggu mahasiswa mengerjakan. Seluruhnya dibuat di browser dari soal simulasi dan contoh jawabannya; TIDAK pernah
// ditulis ke server. Jawaban Tahap 2 sengaja bervariasi (konsisten, berbeda dari Tahap 1, kosong, serba cepat) supaya bentuk
// hasil dan penandanya terlihat.
import { buildOpenItems } from './logic/open.js';

const PROFIL = [
  ['Aulia Rahma', '2024001', 2024, 'A'], ['Bagas Pratama', '2024002', 2024, 'A'], ['Citra Lestari', '2024015', 2024, 'B'],
  ['Dimas Saputra', '2023008', 2023, 'A'], ['Eka Putri', '2024021', 2024, 'B'], ['Fajar Nugroho', '2024033', 2024, 'C'],
  ['Gita Maharani', '2023019', 2023, 'B'], ['Hendra Wijaya', '2024040', 2024, 'C'],
];

// Satu kalimat dari contoh jawaban teori, ditulis ulang ringan (jawaban yang konsisten dengan Tahap 1).
const kalimatPertama = (teks) => String(teks || '').split(/(?<=\.)\s+/)[0] || String(teks || '');
const KONSISTEN = {
  line: 'Baris itu menyimpan hasil perhitungan dari masukan, lalu dipakai untuk dicetak sesuai format yang diminta soal.',
  change: 'Saya ubah rumus atau kondisi yang memuat aturan lama, lalu sesuaikan angkanya dengan ketentuan baru.',
};
const BEDA = {
  probe: 'Kurang paham sebenarnya, jawaban teori tadi banyak dari AI.',
  line: 'Tidak ingat persisnya, kodenya dibuatkan AI.',
  change: 'Mungkin cukup tambah satu baris print saja.',
};

const hash = (s) => Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(s.charCodeAt(i % s.length) * (i + 7)) % 16]).join('');
const menit = (n) => n * 60000;

// exam: definisi lengkap (exam, tasks dengan changes, theory dengan probe, language); contoh: contoh.json simulasi; templates: templates.json.
// Mengembalikan { profil: [...], sesi: [...], analisis } siap digabung ke data tab dosen.
export function buatDummy({ exam, contoh, templates, ujianId, kuliahId, sekarang = Date.now() }) {
  const kode = (t, buruk) => (buruk ? t.starter : contoh.code[t.id] || t.starter);
  const examChanges = { ...exam, tasks: exam.tasks.map((t) => ({ ...t, changes: (contoh.changes || {})[t.id] || t.changes || [] })) };
  const profil = [];
  const sesi = [];
  const rancangan = [
    { sifat: 'konsisten', tahap: 'selesai', keluar: 0, tempel: 0 },
    { sifat: 'beda', tahap: 'selesai', keluar: 6, tempel: 4 },
    { sifat: 'konsisten', tahap: 'selesai', keluar: 1, tempel: 0 },
    { sifat: 'kosong', tahap: 'selesai', keluar: 2, tempel: 1, kodeBuruk: true },
    { sifat: 'konsisten', tahap: 'tahap2' },
    { sifat: 'konsisten', tahap: 'tahap1', menitLalu: 12 },
    { sifat: 'konsisten', tahap: 'belum' },
    { sifat: 'beda', tahap: 'tahap1', menitLalu: 75 }, // lewat batas waktu, belum mengumpulkan
  ];
  PROFIL.forEach(([nama, nim, angkatan, rombel], i) => {
    const id = `dummy-${i + 1}`;
    const r = rancangan[i];
    profil.push({ id, nama, nim, kelas: `SI-${angkatan}-${rombel}`, prodi: 'SI', angkatan, rombel, peran: 'peserta', dummy: true });
    if (r.tahap === 'belum') return;
    const mulai = sekarang - menit(r.menitLalu ?? 40 + i);
    const batas = mulai + menit(Number(exam.config.tahap1Minutes) || 40);
    const row = {
      user_id: id, ujian_id: ujianId, matakuliah_id: kuliahId, kelas: `SI-${angkatan}-${rombel}`, mulai_pada: new Date(mulai).toISOString(), batas_tahap1: new Date(batas).toISOString(),
      faktor: 1, terkunci_pada: null, terlambat: false, hasil: {}, keadaan: {}, ulang: 0, diperbarui_pada: new Date(sekarang).toISOString(), selesai_pada: null, analisis: {}, dummy: true,
    };
    const demo = { fokus: r.keluar ? { n: r.keluar, detik: r.keluar * 23, kejadian: [] } : undefined };
    if (r.tahap !== 'tahap1') {
      const theory = Object.fromEntries(exam.theory.map((q) => [q.id, r.sifat === 'kosong' ? 'Kelas itu seperti cetakan dan objek itu hasilnya.' : contoh.theory[q.id] || '']));
      const codes = Object.fromEntries(exam.tasks.map((t) => [t.id, kode(t, r.kodeBuruk)]));
      const taskResults = Object.fromEntries(exam.tasks.map((t) => [t.id, { passed: r.kodeBuruk ? 1 : t.visible.length + 3, total: t.visible.length + 3 }]));
      demo.stage1 = { submitted: { code: codes, theory, taskResults, hash: hash(id), ai: { level: r.sifat === 'beda' ? 'ideas' : 'language', tools: 'ChatGPT', how: 'menjelaskan konsep dan memeriksa ide' }, submittedAt: new Date(mulai + menit(28)).toISOString(), auto: false, tempelDiblokir: r.tempel || 0, contohDiisi: [] } };
      row.terkunci_pada = new Date(mulai + menit(28)).toISOString();
      const items = buildOpenItems({ id, code: codes }, { exam: examChanges, templates });
      const jawab = {};
      const hitung = r.tahap === 'selesai' ? items.length : 2;
      items.slice(0, hitung).forEach((it, k) => {
        let teks;
        if (r.sifat === 'kosong' && k % 2 === 1) teks = '';
        else if (r.sifat === 'beda') teks = BEDA[it.type];
        else teks = it.type === 'probe' ? `Intinya, ${kalimatPertama(contoh.theory[it.questionId]).replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())}.` : KONSISTEN[it.type];
        jawab[it.id] = { text: teks, latencySec: r.sifat === 'beda' ? 6 + k : 25 + k * 7, tempel: r.sifat === 'beda' && k === 0 ? 2 : 0 };
      });
      demo.stage2 = { attempts: [{ n: 1, items, answers: jawab, idx: hitung, shownAt: sekarang, beginAt: sekarang, skipped: [], finishedAt: r.tahap === 'selesai' ? sekarang - menit(i + 3) : null }] };
      row.hasil = { tahap: r.tahap, mode: 'terbuka', s1: r.kodeBuruk ? 55 : 92 - i, butir: items.length, terjawab: Object.values(jawab).filter((a) => a.text).length, keluar: r.keluar || 0, keluarDetik: (r.keluar || 0) * 23 };
      if (r.tahap === 'selesai') row.selesai_pada = new Date(sekarang - menit(i + 2)).toISOString();
    }
    row.keadaan = { demo };
    sesi.push(row);
  });
  // Analisis contoh (seperti hasil unggahan dari AI) untuk dua peserta pertama, supaya tampilannya terlihat.
  const analisis = {};
  const beri = (idSesi, konsistensi, skor, catatan) => {
    const s = sesi.find((x) => x.user_id === idSesi);
    const rows = {};
    s?.keadaan.demo.stage2.attempts[0].items.forEach((it) => { rows[it.id] = { konsistensi, skor, catatan }; });
    analisis[idSesi] = { rows, diimpor: new Date(sekarang).toISOString() };
  };
  beri('dummy-1', 'konsisten', 88, 'Jawaban Tahap 2 selaras dengan teori dan kode Tahap 1; bahasanya sendiri.');
  beri('dummy-2', 'tidak_konsisten', 15, 'Teori Tahap 1 rinci, tetapi di Tahap 2 mengaku tidak paham dan menyebut AI. Perlu ditinjau.');
  return { profil, sesi, analisis };
}
