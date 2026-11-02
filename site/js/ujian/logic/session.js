// Jadwal waktu ujian satu kali jalan. Fungsi murni: semua waktu dalam milidetik, "sekarang" diberikan dari luar.
// speed > 1 mempercepat semua durasi (hanya untuk uji prototype); factor > 1 = waktu tambahan (akomodasi, ditetapkan dosen).

export const accommodationFactor = (cfg, username) => (cfg.accommodations.includes(username) ? cfg.accommodationFactor : 1);

export const stage1Deadline = (startedAt, cfg, factor = 1, speed = 1) => startedAt + (cfg.tahap1Minutes * 60000 * factor) / speed;

export const itemLimitMs = (item, cfg, factor = 1, speed = 1) => (cfg.stage2.limitSec[item.type] * 1000 * factor) / speed;

// Mengejar waktu: bila peserta pergi atau jendela ditutup, butir yang batas waktunya lewat dihitung tidak terjawab dan
// layar maju ke butir berikutnya. att = { idx, shownAt, skipped: [] }. Mengembalikan keadaan baru (tidak mengubah input).
export function catchUp(att, items, now, cfg, factor = 1, speed = 1) {
  const out = { idx: att.idx, shownAt: att.shownAt, skipped: [...(att.skipped || [])], finished: false, finishedAt: null };
  while (out.idx < items.length) {
    const limit = itemLimitMs(items[out.idx], cfg, factor, speed);
    if (now < out.shownAt + limit) return out;
    out.skipped.push(items[out.idx].id);
    out.shownAt += limit;
    out.idx += 1;
  }
  out.finished = true;
  out.finishedAt = out.shownAt;
  return out;
}

// Total waktu bersih Tahap 2 (jumlah batas per butir), dalam detik.
export const stage2TotalSec = (items, cfg) => items.reduce((s, it) => s + cfg.stage2.limitSec[it.type], 0);
