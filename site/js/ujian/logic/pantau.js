// Memantau ujian untuk dosen: siapa yang sudah masuk (punya sesi) dan siapa yang belum, di tahap mana, dengan penyaringan dan
// pengurutan menurut prodi, angkatan, kelas, dan status. Fungsi murni; "sekarang" diberikan dari luar. Daftar peserta diambil
// dari profil (semua peserta mata kuliah), sesi dari tabel ujian_sesi: peserta tanpa sesi = belum masuk.

export const STATUS = { belum: 'Belum masuk', tahap1: 'Tahap 1', tahap2: 'Tahap 2', selesai: 'Selesai' };
const URUT_STATUS = { belum: 0, tahap1: 1, tahap2: 2, selesai: 3 };

const adaTahap2Selesai = (keadaan) => {
  const atts = keadaan?.demo?.stage2?.attempts || [];
  return atts.length > 0 && atts.every((a) => a.finishedAt);
};

// Status satu peserta: kode, label, dan penanda tambahan (lewat batas waktu Tahap 1, terlambat mengunci).
export function statusPeserta(sesi, now = Date.now()) {
  if (!sesi) return { kode: 'belum', label: STATUS.belum, lewat: false };
  if (sesi.selesai_pada || sesi.hasil?.tahap === 'selesai' || (sesi.terkunci_pada && adaTahap2Selesai(sesi.keadaan))) return { kode: 'selesai', label: STATUS.selesai, lewat: false };
  if (sesi.terkunci_pada) return { kode: 'tahap2', label: STATUS.tahap2, lewat: false };
  return { kode: 'tahap1', label: STATUS.tahap1, lewat: !!sesi.batas_tahap1 && now > Date.parse(sesi.batas_tahap1) + 120000 };
}

// profil: [{id, nama, nim, kelas, prodi, angkatan, rombel}], sesi: baris ujian_sesi satu ujian. Satu baris hasil per peserta.
export function barisPantau(profil, sesiList, now = Date.now()) {
  const sesiDari = new Map(sesiList.map((s) => [s.user_id, s]));
  const ids = new Set(profil.map((p) => p.id));
  // Sesi tanpa profil (profil dihapus atau tidak terbaca) tetap tampil agar tidak hilang dari pantauan.
  const yatim = sesiList.filter((s) => !ids.has(s.user_id)).map((s) => ({ id: s.user_id, nama: '(profil tidak terbaca)', nim: '', kelas: s.kelas || '', prodi: '', angkatan: null, rombel: '' }));
  return [...profil, ...yatim].map((p) => {
    const s = sesiDari.get(p.id) || null;
    const st = statusPeserta(s, now);
    const fokus = s?.keadaan?.demo?.fokus;
    const sub = s?.keadaan?.demo?.stage1?.submitted;
    return {
      id: p.id, nama: p.nama || '', nim: p.nim || '', kelas: p.kelas || '', prodi: p.prodi || '', angkatan: p.angkatan ?? null, rombel: p.rombel || '',
      status: st.kode, label: st.label, lewat: st.lewat, dummy: !!p.dummy,
      mulai: s?.mulai_pada || null, batas: s?.batas_tahap1 || null, terkunci: s?.terkunci_pada || null, selesai: s?.selesai_pada || null,
      terlambat: !!s?.terlambat, faktor: s ? Number(s.faktor) || 1 : null,
      sisaDetik: st.kode === 'tahap1' && s?.batas_tahap1 ? Math.round((Date.parse(s.batas_tahap1) - now) / 1000) : null,
      keluar: fokus?.n ?? s?.hasil?.keluar ?? 0, keluarDetik: fokus?.detik ?? s?.hasil?.keluarDetik ?? 0, tempel: sub?.tempelDiblokir ?? s?.hasil?.tempel ?? 0,
      dianalisis: !!(s?.analisis && s.analisis.rows && Object.keys(s.analisis.rows).length),
    };
  });
}

// Saringan: prodi, angkatan, rombel (kelas), status, dan kata kunci (nama atau NIM). Nilai kosong = semua.
export function saringPantau(baris, { prodi = '', angkatan = '', rombel = '', status = '', cari = '' } = {}) {
  const q = String(cari).trim().toLowerCase();
  return baris.filter((b) => {
    if (prodi && b.prodi !== prodi) return false;
    if (angkatan && String(b.angkatan ?? '') !== String(angkatan)) return false;
    if (rombel && b.rombel !== rombel) return false;
    if (status && b.status !== status) return false;
    if (q && !(b.nama.toLowerCase().includes(q) || b.nim.toLowerCase().includes(q))) return false;
    return true;
  });
}

export const KUNCI_URUT = {
  status: 'Status', nama: 'Nama', nim: 'NIM', angkatan: 'Angkatan', kelas: 'Kelas', mulai: 'Waktu mulai', keluar: 'Keluar tab',
};

const teks = (a, b) => String(a).localeCompare(String(b), 'id', { numeric: true, sensitivity: 'base' });
const angka = (a, b) => (a ?? Infinity) - (b ?? Infinity);
const PERBANDINGAN = {
  status: (a, b) => URUT_STATUS[a.status] - URUT_STATUS[b.status],
  nama: (a, b) => teks(a.nama, b.nama),
  nim: (a, b) => teks(a.nim, b.nim),
  angkatan: (a, b) => angka(a.angkatan, b.angkatan),
  kelas: (a, b) => teks(a.prodi, b.prodi) || angka(a.angkatan, b.angkatan) || teks(a.rombel, b.rombel),
  mulai: (a, b) => (a.mulai ? Date.parse(a.mulai) : Infinity) - (b.mulai ? Date.parse(b.mulai) : Infinity),
  keluar: (a, b) => a.keluar - b.keluar,
};

// Urut menurut kunci (arah 1 naik, -1 turun); selisih diurutkan lagi menurut kelas (prodi, angkatan, rombel) lalu nama.
export function urutkanPantau(baris, kunci = 'status', arah = 1) {
  const utama = PERBANDINGAN[kunci] || PERBANDINGAN.status;
  return [...baris].sort((a, b) => utama(a, b) * arah || PERBANDINGAN.kelas(a, b) || teks(a.nama, b.nama));
}

// Hitungan untuk lencana ringkasan.
export function ringkasPantau(baris) {
  const r = { total: baris.length, belum: 0, tahap1: 0, tahap2: 0, selesai: 0, masuk: 0, lewat: 0, keluarBanyak: 0 };
  for (const b of baris) {
    r[b.status] += 1;
    if (b.status !== 'belum') r.masuk += 1;
    if (b.lewat) r.lewat += 1;
    if (b.keluar > 3) r.keluarBanyak += 1;
  }
  return r;
}

// Teks sisa waktu Tahap 1 (mm:ss), atau "lewat batas".
export const teksSisa = (detik) => (detik === null || detik === undefined ? '' : detik <= 0 ? 'lewat batas' : `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, '0')}`);
