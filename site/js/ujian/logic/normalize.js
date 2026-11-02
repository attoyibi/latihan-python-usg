// Membuang spasi di ujung tiap baris dan baris kosong di ujung keluaran (sama dengan situs latihan).
export function normalize(s) {
  return String(s)
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}
