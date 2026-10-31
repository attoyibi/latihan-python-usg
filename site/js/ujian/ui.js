// Template HTML yang meng-escape semua interpolasi kecuali yang dibungkus raw()/html``.
class Raw { constructor(s) { this.s = s; } }
export const raw = (s) => new Raw(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toStr = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(toStr).join('') : v === null || v === undefined || v === false ? '' : esc(v));
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += toStr(vals[i]); });
  return raw(out);
}
export const show = (el, r) => { el.innerHTML = r.s; };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Angka gaya Indonesia (koma desimal).
export const fmt = (n, d = 2) => (n === null || n === undefined || Number.isNaN(n) ? '–' : Number(n).toFixed(d).replace('.', ','));
// Skala 100 untuk tampilan: 0,847 -> "85".
export const pt = (x) => (x === null || x === undefined || Number.isNaN(x) ? '–' : String(Math.round(x * 100)));
export const mmss = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
export const wordCount = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

// Pengganti confirm() bawaan, yang di sebagian browser tertanam langsung mengembalikan false tanpa tampil.
export function ask(message, okLabel = 'Ya') {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'uj-dlg';
    dlg.innerHTML = html`<form method="dialog" class="dialog-body"><p style="margin:0">${message}</p>
      <div class="row"><button class="btn btn-primary" value="ok">${okLabel}</button><button class="btn" value="cancel">Batal</button></div></form>`.s;
    // Selesai lewat klik tombol (langsung) atau Esc (event close). Event close bisa tertunda di tab latar,
    // jadi klik tombol tidak menunggunya.
    let done = false;
    const finish = (ok) => { if (done) return; done = true; if (dlg.open) dlg.close(); dlg.remove(); resolve(ok); };
    dlg.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); finish(b.value === 'ok'); }));
    dlg.addEventListener('close', () => finish(dlg.returnValue === 'ok'));
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// SHA-256. crypto.subtle hanya ada di konteks aman (https atau localhost); lewat alamat LAN (http://192.168...) tidak ada,
// jadi dipakai versi JavaScript murni sebagai cadangan agar kode tetap bisa dikunci dari HP.
function sha256Fallback(text) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor((len * 8) / 4294967296));
  dv.setUint32(padded.length - 4, (len * 8) >>> 0);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
  }
  return H.map((v) => v.toString(16).padStart(8, '0')).join('');
}

export async function sha256(text) {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(text);
}
export { sha256Fallback };

export const TYPE_LABEL = { trace: 'Tebak keluaran kodemu', bugline: 'Temukan baris yang salah', concept: 'Konsep teori', transfer: 'Ketentuan berubah' };

// Kode dengan nomor baris (untuk butir "temukan baris yang salah").
export const numbered = (code) => code.split('\n').map((l, i) => `${String(i + 1).padStart(2)}  ${l}`).join('\n');
