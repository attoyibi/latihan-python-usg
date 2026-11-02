// Profil bahasa pemrograman untuk layar ujian: penjalan, mode editor, tombol simbol, dan teks yang menyebut bahasanya.
// Bahasa diambil dari `bahasa` mata kuliah (matakuliah.json); index.js memanggil setBahasa() sebelum layar digambar.
// Perilaku Python sengaja dibiarkan persis seperti sebelum ada profil ini.
const PROFIL = {
  python: {
    id: 'python',
    nama: 'Python',
    mode: 'python',
    indentSetelah: /:\s*$/,
    simbol: ['    ', ':', '(', ')', '[', ']', '{', '}', '"', "'", '=', '==', '!=', '<', '>', '+', '-', '*', '/', '//', '%', '_', '#', '.', ','],
    masukan: 'satu baris untuk tiap input()',
    unduh: '±10 MB',
    batasDetik: 5,
    komentar: '#',
  },
  java: {
    id: 'java',
    nama: 'Java',
    mode: 'text/x-java',
    indentSetelah: /\{\s*$/,
    simbol: ['    ', ';', '(', ')', '[', ']', '{', '}', '"', "'", '=', '==', '!=', '<', '>', '+', '-', '*', '/', '%', '&&', '||', '!', '_', '.', ','],
    masukan: 'satu baris untuk tiap masukan yang dibaca Scanner',
    unduh: '±20 MB',
    batasDetik: 8,
    komentar: '//',
  },
};

let aktif = PROFIL.python;

export function setBahasa(id) { aktif = PROFIL[id] || PROFIL.python; }
export const bahasa = () => aktif;
