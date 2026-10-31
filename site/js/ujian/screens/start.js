import { getExam, startExam, peserta, isLatihan, jadwal } from '../data.js';
import { getRunner } from '../runner.js';
import { html, show, $ } from '../ui.js';

const waktu = (iso) => new Date(iso).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

// Halaman awal peserta: aturan main satu kali jalan, jadwal kelasnya (dari server), lalu tombol Mulai.
// Tombol Mulai aktif bila jadwal kelasnya sedang buka DAN penjalan Python siap (±10 MB), supaya waktu Tahap 1 tidak habis
// untuk mengunduh. Waktu mulai dan batas Tahap 1 dicatat server.
export function render(root, ctx) {
  const exam = getExam();
  const c = exam.config;
  const s2Sec = Object.entries(c.stage2.itemsPerType).reduce((s, [t, n]) => s + n * c.stage2.limitSec[t], 0);
  const me = peserta();
  const j = jadwal();
  const menit = j.info?.menit || c.tahap1Minutes;
  const runner = getRunner();
  runner.start();
  const infoJadwal = !j.info
    ? html`<div class="callout warn"><strong>Belum dijadwalkan.</strong> Pengajar belum membuka ujian ini untuk kelasmu (${me.kelas}). Halaman ini akan bisa dipakai setelah jadwalnya dibuka.</div>`
    : j.buka
      ? html`<div class="callout ok"><strong>Dibuka untuk ${j.info.kelas === '*' ? 'semua kelas' : `kelas ${j.info.kelas}`}</strong> sampai ${waktu(j.info.tutup)}. Mulai sebelum waktu itu.</div>`
      : html`<div class="callout warn"><strong>Belum dibuka.</strong> Jadwal ${j.info.kelas === '*' ? 'semua kelas' : `kelas ${j.info.kelas}`}: ${waktu(j.info.buka)} sampai ${waktu(j.info.tutup)}. ${Date.parse(j.info.tutup) < Date.now() ? 'Jadwal ini sudah lewat; hubungi pengajarmu.' : 'Muat ulang halaman saat waktunya tiba.'}</div>`;
  show(root, html`
    <div class="page-head"><h1>${exam.title}</h1><p>Halo, ${me.nama}. Ujian ini berjalan sendiri dari awal sampai nilai keluar, dalam satu kali duduk.</p></div>
    <section class="card">
      <h2>Alurnya</h2>
      <ol>
        <li><strong>Tahap 1 · Koding dan teori</strong> (${menit} menit). ${c.tahap1Order.length} soal: ${exam.theory.length} soal teori (esai singkat) dan ${exam.tasks.length} soal praktik (koding Python). Jawaban terkunci sendiri saat waktu habis atau saat kamu mengumpulkan.</li>
        <li><strong>Tahap 2 · Verifikasi</strong> (±${Math.ceil(s2Sec / 60)} menit). Dimulai otomatis setelah Tahap 1. Semua pilihan ganda tentang kodemu sendiri; tiap butir punya batas waktu, lalu berpindah sendiri.</li>
        <li><strong>Nilai</strong> keluar otomatis (skala 100) di akhir. Bila hasil Tahap 2 jauh di bawah Tahap 1, kamu ditawari satu kali uji ulang dengan butir baru.</li>
      </ol>
      ${isLatihan() ? html`<div class="callout ok"><strong>Ini simulasi.</strong> Soalnya lebih mudah dan nilainya tidak dihitung. Alur, batas waktu, dan cara kerjanya sama dengan UTS dan UAS, jadi pakai untuk membiasakan diri. Setelah selesai kamu boleh mengulang dari awal.</div>` : ''}
      ${infoJadwal}
      <div class="callout warn"><strong>Penting.</strong> Kerjakan sendiri. Tahap 2 menguji apakah kamu memahami kodemu; jangan menutup halaman di tengah tahap karena waktu tetap berjalan (jam dari server). Jawabanmu tersimpan di server, jadi bila perangkat bermasalah kamu bisa melanjutkan dari perangkat lain. AI boleh dipakai di Tahap 1 asal dideklarasikan. Salin dan tempel dimatikan seperti di halaman latihan.</div>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-primary" id="mulai" type="button" disabled>${isLatihan() ? 'Mulai simulasi' : 'Mulai ujian'}</button>
        <span class="runner-chip" id="runner-chip"><i></i><span>Penjalan Python: memuat…</span></span>
        <button class="btn btn-sm" id="runner-retry" type="button" hidden>Coba lagi</button>
      </div>
      <div id="mulai-galat"></div>
      <p class="small muted">Tombol Mulai aktif setelah penjalan Python siap. Waktu Tahap 1 baru berjalan setelah kamu menekan Mulai.</p>
    </section>`);
  const btn = $('#mulai', root);
  const chip = $('#runner-chip', root);
  const retry = $('#runner-retry', root);
  const unsub = runner.subscribe(({ ready, failed }) => {
    btn.disabled = !ready || !j.buka;
    chip.className = `runner-chip ${ready ? 'ready' : failed ? 'fail' : ''}`;
    chip.lastElementChild.textContent = ready ? 'Penjalan Python: siap' : failed ? `Penjalan gagal: ${failed}` : 'Penjalan Python: memuat (sekali, ±10 MB)…';
    retry.hidden = !failed;
  });
  ctx.onLeave(unsub);
  retry.addEventListener('click', () => runner.retry());
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Memulai…';
    try {
      await startExam();
      ctx.rerender();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = isLatihan() ? 'Mulai simulasi' : 'Mulai ujian';
      show($('#mulai-galat', root), html`<div class="callout bad" role="alert">${e.jenis === 'jadwal' ? 'Ujian belum dibuka untuk kelasmu. Muat ulang halaman untuk melihat jadwal terbaru.' : e.jenis === 'jaringan' ? 'Tidak bisa terhubung ke server. Periksa internet lalu coba lagi.' : e.message}</div>`);
    }
  });
}
