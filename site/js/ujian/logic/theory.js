// Penilaian otomatis soal teori (esai singkat) dari poin kunci. Sebuah poin tertangkap bila SETIAP kelompok kata
// memiliki minimal satu kata yang muncul di jawaban. Skor = poin tertangkap / need (maksimal 1).
// Ini penilaian awal yang kasar (kata kunci): dosen bisa menimpanya, dan jawaban terlalu pendek diberi nol.

const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Kata pendek (<= 3 huruf, mis. "for", "str", "0") harus cocok utuh; kata lebih panjang cocok sebagai awalan kata
// (supaya "masalah" mengenai "masalahnya", tetapi "for" tidak mengenai "format" atau "informasi").
export function hasKeyword(text, keyword) {
  const k = keyword.toLowerCase();
  const re = new RegExp(`(^|[^a-z0-9_])${escapeRe(k)}${k.length <= 3 ? '([^a-z0-9_]|$)' : ''}`);
  return re.test(text);
}

export function scoreTheory(text, question, { minWords = 25 } = {}) {
  const t = norm(text);
  const words = t ? t.split(' ').length : 0;
  const matched = question.keyPoints.filter((kp) => kp.all.every((group) => group.some((k) => hasKeyword(t, k)))).map((kp) => kp.id);
  const tooShort = words < minWords;
  return {
    words, matched, count: matched.length, need: question.need, total: question.keyPoints.length, tooShort,
    score: tooShort ? 0 : Math.min(1, matched.length / question.need),
  };
}
