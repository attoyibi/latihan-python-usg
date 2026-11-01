import { getExam, peserta, isLatihan, ulangi, keadaanSekarang, tandaiSelesai } from '../data.js';
import { salinan } from '../logic/open.js';
import { unduhPdfPeserta } from '../ekspor.js';
import { html, show, $, ask } from '../ui.js';

// Layar akhir Tahap 2 terbuka: peserta TIDAK melihat nilai. Hanya kabar bahwa semuanya tersimpan dan terkunci, ditambah PDF
// salinan jawabannya (untuk dikumpulkan di tempat lain). Nilai dan analisis hanya dilihat dosen.
export function render(root, ctx) {
  const exam = getExam();
  const me = peserta();
  const sal = () => salinan({ keadaan: keadaanSekarang(), exam, peserta: me, ujian: exam.title });
  const latihan = isLatihan();
  show(root, html`
    <div class="exam-focus">
      <div class="page-head"><h1>${latihan ? 'Simulasi selesai' : 'Ujian selesai'}</h1><p>Terima kasih, ${me.nama}.</p></div>
      <section class="card">
        <div class="callout ok" role="status"><strong>Semua jawabanmu sudah selesai dan tersimpan di server.</strong> Jawaban yang sudah dikumpulkan dikunci: bisa dilihat kembali lewat PDF di bawah, tetapi tidak bisa diubah. ${latihan ? 'Ini simulasi, jadi tidak ada nilai.' : 'Hasil penilaian disampaikan dosen; nilai tidak ditampilkan di sini.'}</div>
        <p id="status-simpan" class="small muted" role="status">Menyimpan…</p>
        <div class="row" style="margin-top:12px">
          <button class="btn btn-primary" id="pdf" type="button">Unduh jawabanku (PDF)</button>
          <button class="btn" id="coba-lagi" type="button" hidden>Coba simpan lagi</button>
          ${latihan ? html`<button class="btn btn-ghost" id="ulangi" type="button">Ulangi simulasi dari awal</button>` : ''}
        </div>
        <div id="pdf-galat"></div>
      </section>
    </div>`);
  const status = $('#status-simpan', root);
  const retry = $('#coba-lagi', root);
  const simpan = () => {
    status.textContent = 'Menyimpan…';
    retry.hidden = true;
    tandaiSelesai().then(() => { status.textContent = 'Tersimpan dan dikunci di server.'; }).catch((e) => {
      status.textContent = `Belum tersimpan di server: ${e.message}. Jawabanmu aman di perangkat ini; tekan Coba simpan lagi saat koneksi pulih.`;
      retry.hidden = false;
    });
  };
  simpan();
  retry.addEventListener('click', simpan);
  $('#pdf', root).addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try { await unduhPdfPeserta(sal()); show($('#pdf-galat', root), html``); } catch (err) { show($('#pdf-galat', root), html`<p class="callout bad" role="alert">${err.message}</p>`); }
    e.currentTarget.disabled = false;
  });
  $('#ulangi', root)?.addEventListener('click', async () => {
    if (!(await ask('Hapus hasil simulasi ini dan mulai lagi dari awal?', 'Ulangi'))) return;
    try { await ulangi(); } catch (err) { alert(err.message); return; }
    ctx.rerender();
  });
}
