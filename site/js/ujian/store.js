// Keadaan ujian peserta di browser: cadangan lokal dari pekerjaan yang juga dikirim ke server (kolom keadaan).
// Satu kunci per akun, mata kuliah, dan ujian, jadi dua akun di satu perangkat tidak saling melihat.
// _t = waktu perubahan terakhir (jam perangkat), dipakai memilih versi terbaru antara browser dan server.
let KEY = null;
let state = {};
let pendengar = () => {};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* memori saja */ }
}

// Dipanggil sebelum layar ujian digambar.
export function pakai(userId, mk, ujianId) {
  const k = `ujian:${userId || 'lokal'}:${mk}:${ujianId}`;
  if (k !== KEY) { KEY = k; state = load(); }
}

// Dipanggil setiap ada perubahan pekerjaan (untuk dikirim ke server).
export const onSimpan = (fn) => { pendengar = fn; };

export const get = () => state;
// diam: perubahan dari server (waktu sesi), tidak perlu dikirim balik.
export function update(fn, { diam = false } = {}) {
  fn(state);
  if (!diam) state._t = Date.now();
  persist();
  if (!diam) pendengar();
}
export function ganti(baru) { state = baru || {}; persist(); }
export function reset() { state = {}; persist(); }
