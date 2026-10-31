// Keadaan ujian peserta di browser (sementara, sebelum tersambung ke Supabase pada langkah berikutnya).
// Satu kunci per akun, mata kuliah, dan ujian, jadi dua akun di satu perangkat tidak saling melihat.
let KEY = null;
let state = {};

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

export const get = () => state;
export function update(fn) { fn(state); persist(); }
export function reset() { state = {}; persist(); }
