// Ekspor jawaban ujian: PDF (peserta untuk dirinya, dosen untuk semua peserta) dan CSV untuk dianalisis.
// PDF memakai jsPDF yang dimuat dari CDN hanya saat dipakai (js/pdf.js). Isi disusun oleh logic/open.js.
import { blokPdf, barisAnalisis, KOLOM_ANALISIS, KOLOM_HASIL } from './logic/open.js';
import { toCsv } from './logic/csv.js';
import { download } from './ui.js';

const aman = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function unduhBlob(nama, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nama });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Satu peserta.
export async function unduhPdfPeserta(sal) {
  const { buatPdfBlok } = await import('../pdf.js');
  unduhBlob(`jawaban-${aman(sal.ujian)}-${aman(sal.peserta.nim || sal.peserta.nama)}.pdf`, await buatPdfBlok(blokPdf(sal), sal.kode || '-'));
}

// Semua peserta satu ujian: tiap peserta mulai di halaman baru.
export async function unduhPdfSemua(salinanList, namaUjian) {
  const { buatPdfBlok } = await import('../pdf.js');
  const blok = [{ t: 'judul', teks: namaUjian }, { t: 'catatan', teks: `${salinanList.length} peserta. Dibuat ${new Date().toLocaleString('id-ID')}.` }];
  salinanList.forEach((s) => { blok.push({ t: 'halaman' }, ...blokPdf(s, { judul: false })); });
  unduhBlob(`jawaban-semua-${aman(namaUjian)}.pdf`, await buatPdfBlok(blok, `semua-${salinanList.length}-peserta`));
}

// CSV untuk dianalisis (satu baris per pertanyaan Tahap 2 per peserta, lengkap dengan pembanding Tahap 1).
export function unduhCsvAnalisis(salinanList, namaBerkas) {
  download(`${namaBerkas}.csv`, toCsv(barisAnalisis(salinanList), KOLOM_ANALISIS), 'text/csv');
}

// Format kosong untuk hasil analisis: id_baris dan peserta_id terisi, kolom penilaian dikosongkan untuk diisi AI/dosen.
export function unduhFormatHasil(salinanList, namaBerkas) {
  const rows = barisAnalisis(salinanList).map((r) => ({ id_baris: r.idBaris, peserta_id: r.pesertaId, konsistensi: '', skor: '', catatan: '' }));
  download(`${namaBerkas}.csv`, toCsv(rows, KOLOM_HASIL.map((k) => ({ label: k, get: (r) => r[k] }))), 'text/csv');
}
