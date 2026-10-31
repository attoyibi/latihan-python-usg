import { getExam, startExam, peserta } from '../data.js';
import { getRunner } from '../runner.js';
import { html, show, $ } from '../ui.js';

// Halaman awal peserta: aturan main satu kali jalan, lalu tombol Mulai. Tidak ada kode sesi:
// peserta yang sudah masuk langsung boleh mulai, dan Tahap 2 mengikuti otomatis setelah Tahap 1.
// Tombol Mulai baru aktif setelah penjalan Python siap (±10 MB), supaya waktu Tahap 1 tidak habis untuk mengunduh.
export function render(root, ctx) {
  const exam = getExam();
  const c = exam.config;
  const s2Sec = Object.entries(c.stage2.itemsPerType).reduce((s, [t, n]) => s + n * c.stage2.limitSec[t], 0);
  const me = peserta();
  const runner = getRunner();
  runner.start();
  show(root, html`
    <div class="page-head"><h1>${exam.title}</h1><p>Halo, ${me.nama}. Ujian ini berjalan sendiri dari awal sampai nilai keluar, dalam satu kali duduk.</p></div>
    <section class="card">
      <h2>Alurnya</h2>
      <ol>
        <li><strong>Tahap 1 · Koding dan teori</strong> (${c.tahap1Minutes} menit). ${c.tahap1Order.length} soal: ${exam.theory.length} soal teori (esai singkat) dan ${exam.tasks.length} soal praktik (koding Python). Jawaban terkunci sendiri saat waktu habis atau saat kamu mengumpulkan.</li>
        <li><strong>Tahap 2 · Verifikasi</strong> (±${Math.ceil(s2Sec / 60)} menit). Dimulai otomatis setelah Tahap 1. Semua pilihan ganda tentang kodemu sendiri; tiap butir punya batas waktu, lalu berpindah sendiri.</li>
        <li><strong>Nilai</strong> keluar otomatis (skala 100) di akhir. Bila hasil Tahap 2 jauh di bawah Tahap 1, kamu ditawari satu kali uji ulang dengan butir baru.</li>
      </ol>
      <div class="callout warn"><strong>Penting.</strong> Kerjakan sendiri. Tahap 2 menguji apakah kamu memahami kodemu; jangan menutup halaman di tengah tahap karena waktu tetap berjalan. AI boleh dipakai di Tahap 1 asal dideklarasikan. Salin dan tempel dimatikan seperti di halaman latihan.</div>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-primary" id="mulai" type="button" disabled>Mulai ujian</button>
        <span class="runner-chip" id="runner-chip"><i></i><span>Penjalan Python: memuat…</span></span>
        <button class="btn btn-sm" id="runner-retry" type="button" hidden>Coba lagi</button>
      </div>
      <p class="small muted">Tombol Mulai aktif setelah penjalan Python siap. Waktu Tahap 1 baru berjalan setelah kamu menekan Mulai.</p>
    </section>`);
  const btn = $('#mulai', root);
  const chip = $('#runner-chip', root);
  const retry = $('#runner-retry', root);
  const unsub = runner.subscribe(({ ready, failed }) => {
    btn.disabled = !ready;
    chip.className = `runner-chip ${ready ? 'ready' : failed ? 'fail' : ''}`;
    chip.lastElementChild.textContent = ready ? 'Penjalan Python: siap' : failed ? `Penjalan gagal: ${failed}` : 'Penjalan Python: memuat (sekali, ±10 MB)…';
    retry.hidden = !failed;
  });
  ctx.onLeave(unsub);
  retry.addEventListener('click', () => runner.retry());
  btn.addEventListener('click', () => {
    startExam();
    ctx.rerender();
  });
}
