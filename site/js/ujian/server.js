// Panggilan Supabase untuk fitur Ujian (migrasi 0010_ujian.sql). Semua waktu ujian berasal dari jam server;
// selisih jam perangkat dengan server diukur setiap kali status dibaca, lalu dipakai untuk hitung mundur di layar.
import * as Auth from '../auth.js';

const klien = () => Auth.getClient();
let selisihMs = 0; // jam server - jam perangkat
export const sekarangServer = () => Date.now() + selisihMs;
// Waktu server (ISO) -> jam perangkat (ms), untuk dibandingkan dengan Date.now().
export const keLokal = (iso) => Date.parse(iso) - selisihMs;

const ukur = (sekarang) => { if (sekarang) selisihMs = Date.parse(sekarang) - Date.now(); };

// Galat yang dikenali: fungsi/tabel belum ada (migrasi belum dijalankan), jadwal belum buka, kunci belum dipasang.
function galat(e) {
  const pesan = (e && e.message) || String(e);
  const err = new Error(pesan);
  const kode = e && e.code;
  if (kode === 'PGRST202' || kode === '42883' || kode === 'PGRST205' || /could not find the function|does not exist/i.test(pesan)) err.jenis = 'belum-siap';
  else if (/belum dibuka/i.test(pesan)) err.jenis = 'jadwal';
  else if (/kunci ujian belum dipasang/i.test(pesan)) err.jenis = 'kunci';
  else if (/sudah dikumpulkan/i.test(pesan)) err.jenis = 'terkunci';
  else if (kode === '42501') err.jenis = 'izin';
  else if (!kode && /fetch|network|jaringan/i.test(pesan)) err.jenis = 'jaringan';
  return err;
}

async function rpc(nama, args) {
  if (!klien()) throw Object.assign(new Error('Ujian membutuhkan sambungan ke server (Supabase).'), { jenis: 'belum-siap' });
  const { data, error } = await klien().rpc(nama, args);
  if (error) throw galat(error);
  return data;
}

export async function status(mk, ujian) {
  const s = await rpc('ujian_status', { p_mk: mk, p_ujian: ujian });
  ukur(s.sekarang);
  return s;
}

export async function mulai(mk, ujian, menit) {
  const s = await rpc('ujian_mulai', { p_mk: mk, p_ujian: ujian, p_menit: menit });
  ukur(s.sekarang);
  return s;
}

export async function kunciTahap1(mk, ujian, snapshot, hash) {
  const r = await rpc('ujian_kunci_tahap1', { p_mk: mk, p_ujian: ujian, p_snapshot: snapshot, p_hash: hash });
  ukur(r.sekarang);
  return r.kunci;
}

export const ambilKunci = (mk, ujian) => rpc('ujian_ambil_kunci', { p_mk: mk, p_ujian: ujian });
// Menutup jawaban peserta (migrasi 0011): sesudahnya server menolak perubahan keadaan dan hasil.
export const selesai = (mk, ujian) => rpc('ujian_selesai', { p_mk: mk, p_ujian: ujian });
// Contoh jawaban UTS/UAS, hanya untuk instruktur (migrasi 0012).
export const contohDosen = (mk, ujian) => rpc('ujian_contoh_dosen', { p_mk: mk, p_ujian: ujian });
export const ulang = (mk, ujian) => rpc('ujian_ulang', { p_mk: mk, p_ujian: ujian });

// Pekerjaan peserta (keadaan) dan ringkasan nilai. Peserta hanya boleh mengubah dua kolom ini (lihat migrasi).
export async function simpan(mk, ujian, keadaan, hasil) {
  const { error } = await klien().from('ujian_sesi').update({ keadaan, hasil }).eq('user_id', Auth.getUserId()).eq('matakuliah_id', mk).eq('ujian_id', ujian);
  if (error) throw galat(error);
}

// ---------- dosen ----------
export async function bacaJadwal(mk) {
  const { data, error } = await klien().from('ujian_jadwal').select('*').eq('matakuliah_id', mk);
  if (error) throw galat(error);
  return data || [];
}
export async function simpanJadwal(baris) {
  const { error } = await klien().from('ujian_jadwal').upsert(baris, { onConflict: 'matakuliah_id,ujian_id,kelas' });
  if (error) throw galat(error);
}
export async function hapusJadwal(mk, ujian, kelas) {
  const { error } = await klien().from('ujian_jadwal').delete().eq('matakuliah_id', mk).eq('ujian_id', ujian).eq('kelas', kelas);
  if (error) throw galat(error);
}
export async function bacaAkomodasi(mk) {
  const { data, error } = await klien().from('ujian_akomodasi').select('*').eq('matakuliah_id', mk);
  if (error) throw galat(error);
  return data || [];
}
export async function simpanAkomodasi(baris) {
  const { error } = await klien().from('ujian_akomodasi').upsert(baris, { onConflict: 'matakuliah_id,ujian_id,user_id' });
  if (error) throw galat(error);
}
export async function hapusAkomodasi(mk, ujian, userId) {
  const { error } = await klien().from('ujian_akomodasi').delete().eq('matakuliah_id', mk).eq('ujian_id', ujian).eq('user_id', userId);
  if (error) throw galat(error);
}
export async function bacaSesi(mk) {
  // keadaan = seluruh jawaban peserta (untuk ekspor dan tampilan dosen). Kolom selesai_pada dan analisis ada sejak migrasi 0011;
  // bila belum dijalankan, dibaca tanpa keduanya.
  const dasar = 'user_id,ujian_id,kelas,mulai_pada,batas_tahap1,faktor,terkunci_pada,terlambat,hasil,keadaan,ulang,diperbarui_pada';
  let { data, error } = await klien().from('ujian_sesi').select(`${dasar},selesai_pada,analisis`).eq('matakuliah_id', mk);
  if (error && /selesai_pada|analisis|column/i.test(error.message || '')) ({ data, error } = await klien().from('ujian_sesi').select(dasar).eq('matakuliah_id', mk));
  if (error) throw galat(error);
  return data || [];
}
// Hasil analisis (AI atau dosen) per peserta, disimpan di server supaya bisa dilihat kembali. Hanya instruktur (migrasi 0011).
export async function simpanAnalisis(mk, ujian, userId, analisis) {
  const { error } = await klien().rpc('ujian_analisis_simpan', { p_mk: mk, p_ujian: ujian, p_user: userId, p_analisis: analisis });
  if (error) throw galat(error);
}
// Pantauan berkala: tanpa kolom keadaan (jawaban lengkap) supaya ringan walau pesertanya banyak.
export async function bacaSesiRingan(mk) {
  const dasar = 'user_id,ujian_id,kelas,mulai_pada,batas_tahap1,faktor,terkunci_pada,terlambat,hasil,diperbarui_pada';
  let { data, error } = await klien().from('ujian_sesi').select(`${dasar},selesai_pada`).eq('matakuliah_id', mk);
  if (error && /selesai_pada|column/i.test(error.message || '')) ({ data, error } = await klien().from('ujian_sesi').select(dasar).eq('matakuliah_id', mk));
  if (error) throw galat(error);
  return data || [];
}
export async function hapusSesi(mk, ujian, userId) {
  const { error } = await klien().from('ujian_sesi').delete().eq('matakuliah_id', mk).eq('ujian_id', ujian).eq('user_id', userId);
  if (error) throw galat(error);
}
export async function bacaProfil() {
  const { data, error } = await klien().from('profiles').select('id,nama,nim,kelas,prodi,angkatan,rombel,peran');
  if (error) throw galat(error);
  return data || [];
}
