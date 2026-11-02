import * as store from '../store.js';
import { getExam, demoStudent, ensureAttempt, attempts, examSession } from '../data.js';
import { catchUp, itemLimitMs } from '../logic/session.js';
import { markDiff } from '../logic/trace.js';
import { html, show, $, $$, mmss, TYPE_LABEL, numbered } from '../ui.js';
import { codeViewer } from '../codetools.js';
import * as Anticopas from '../../anticopas.js';
import { isOpen, OPEN_LABEL } from '../logic/open.js';


const saveAtt = (n, fn) => store.update((s) => fn(s.demo.stage2.attempts.find((a) => a.n === n)));

// Tahap 2 satu kali jalan: dimulai otomatis, semua butir pilihan ganda + keyakinan, tiap butir punya batas waktu sendiri.
// Memilih jawaban dan keyakinan = butir terkunci dan layar pindah sendiri; waktu habis = pindah sendiri (kosong bila belum dijawab).
// Posisi dihitung dari jam (catchUp), jadi menutup atau memuat ulang halaman tidak menghentikan waktu.
export function render(root, ctx) {
  const exam = getExam();
  const cfg = exam.config;
  if (!attempts().length) ensureAttempt(1);
  const att = attempts().find((a) => !a.finishedAt);
  if (!att) { ctx.rerender(); return; }
  const ses = examSession();
  const now = Date.now();

  const terbuka = isOpen(exam);
  if (now < att.beginAt) return terbuka ? renderBeginOpen(root, ctx, att, cfg) : renderBegin(root, ctx, att, cfg);

  const cu = catchUp(att, att.items, now, cfg, ses.factor, ses.speed);
  if (cu.finished || cu.idx !== att.idx) {
    saveAtt(att.n, (a) => { a.idx = cu.idx; a.shownAt = cu.shownAt; a.skipped = cu.skipped; if (cu.finished) a.finishedAt = cu.finishedAt; });
    if (cu.finished) return ctx.rerender();
    return ctx.rerender();
  }
  (terbuka ? renderItemOpen : renderItem)(root, ctx, exam, att, ses);
}

function renderBegin(root, ctx, att, cfg) {
  const counts = att.items.reduce((m, i) => ({ ...m, [i.type]: (m[i.type] || 0) + 1 }), {});
  const lim = cfg.stage2.limitSec;
  show(root, html`
    <div class="exam-focus">
      <div class="page-head"><h1>Tahap 2 · Verifikasi pemahaman${att.n > 1 ? ' (uji ulang)' : ''}</h1>
        <p>${att.n > 1 ? 'Butir baru dari kodemu sendiri. ' : 'Tahap 1 sudah terkunci. '}Tahap 2 dimulai otomatis.</p></div>
      <section class="card">
        <div class="stat"><div class="v num" id="count">--</div><div class="l">detik sebelum mulai</div></div>
        <ul>
          <li><strong>${att.items.length} butir</strong>, satu per layar, semua pilihan ganda: ${counts.trace || 0} tebak keluaran programmu (${lim.trace} dtk), ${counts.bugline || 0} temukan baris yang salah (${lim.bugline} dtk), ${counts.concept || 0} konsep teori (${lim.concept} dtk), ${counts.transfer || 0} ketentuan berubah (${lim.transfer} dtk).</li>
          <li>Tiap butir punya batas waktu sendiri, lalu pindah otomatis. Tidak bisa kembali.</li>
          <li>Pilih jawaban lalu keyakinanmu (1–3): butir langsung terkunci dan lanjut sendiri. Menebak dengan yakin berisiko mengurangi poin; jujur pada ketidakyakinan tidak dihukum.</li>
          <li>Butirnya dari kodemu sendiri, jadi tidak ada materi baru. Waktu tetap berjalan bila halaman ditutup.</li>
        </ul>
        <button class="btn btn-primary" id="go-now" type="button">Mulai sekarang</button>
      </section>
    </div>`);
  const tick = () => {
    const left = (att.beginAt - Date.now()) / 1000;
    if (left <= 0) { clearInterval(iv); ctx.rerender(); return; }
    $('#count', root).textContent = String(Math.ceil(left));
  };
  const iv = setInterval(tick, 250);
  ctx.onLeave(() => clearInterval(iv));
  tick();
  $('#go-now', root).addEventListener('click', () => {
    const t = Date.now();
    saveAtt(att.n, (a) => { a.beginAt = t; a.shownAt = t; });
    ctx.rerender();
  });
}

function renderBeginOpen(root, ctx, att, cfg) {
  const lim = cfg.stage2.limitSec;
  const counts = att.items.reduce((m, i) => ({ ...m, [i.type]: (m[i.type] || 0) + 1 }), {});
  show(root, html`
    <div class="exam-focus">
      <div class="page-head"><h1>Tahap 2 · Pertanyaan singkat</h1>
        <p>Tahap 1 sudah terkunci. Tahap 2 dimulai otomatis.</p></div>
      <section class="card">
        <div class="stat"><div class="v num" id="count">--</div><div class="l">detik sebelum mulai</div></div>
        <ul>
          <li><strong>${att.items.length} pertanyaan</strong>, satu per layar: ${counts.probe || 0} konsep (${lim.probe} dtk), ${counts.line || 0} tentang satu baris kodemu (${lim.line} dtk), ${counts.change || 0} tentang ketentuan yang berubah (${lim.change} dtk).</li>
          <li>Jawab dengan <strong>satu kalimat</strong> (boleh dua) memakai kata-katamu sendiri. Tidak ada pilihan ganda.</li>
          <li>Tekan Kirim jawaban (atau Ctrl+Enter) untuk lanjut. Waktu habis = jawabanmu yang sudah ditulis ikut terkirim dan layar pindah sendiri. Tidak bisa kembali.</li>
          <li>Pertanyaannya dari kodemu dan jawabanmu di Tahap 1, jadi tidak ada materi baru. Waktu tetap berjalan bila halaman ditutup.</li>
          <li>Setelah selesai, jawabanmu dikunci dan tersimpan; kamu bisa mengunduhnya sebagai PDF.</li>
        </ul>
        <button class="btn btn-primary" id="go-now" type="button">Mulai sekarang</button>
      </section>
    </div>`);
  const tick = () => {
    const left = (att.beginAt - Date.now()) / 1000;
    if (left <= 0) { clearInterval(iv); ctx.rerender(); return; }
    $('#count', root).textContent = String(Math.ceil(left));
  };
  const iv = setInterval(tick, 250);
  ctx.onLeave(() => clearInterval(iv));
  tick();
  $('#go-now', root).addEventListener('click', () => {
    const t = Date.now();
    saveAtt(att.n, (a) => { a.beginAt = t; a.shownAt = t; });
    ctx.rerender();
  });
}

// Satu pertanyaan terbuka: satu kalimat, tanpa keyakinan dan tanpa nilai. Konteksnya (kode sendiri) hanya baca.
function renderItemOpen(root, ctx, exam, att, ses) {
  const cfg = exam.config;
  const item = att.items[att.idx];
  const total = att.items.length;
  const ans = att.answers[item.id] || {};
  const limitMs = itemLimitMs(item, cfg, ses.factor, ses.speed);
  const student = demoStudent();
  const kode = item.taskId ? student.code[item.taskId] : '';
  const konteks = item.type === 'line'
    ? html`<details open style="margin:10px 0"><summary><strong>Kodemu untuk ${item.taskId}</strong> (baris ${item.line} yang ditanyakan)</summary><div style="margin-top:6px">${codeViewer(numbered(kode), `${item.taskId} · dengan nomor baris`)}</div></details><p class="small">Baris ${item.line}: <code>${item.lineText}</code></p>`
    : item.type === 'change'
      ? html`<details style="margin:10px 0"><summary><strong>Kodemu untuk ${item.taskId}</strong> (hanya baca)</summary><div style="margin-top:6px">${codeViewer(kode, item.taskId)}</div></details>`
      : '';

  show(root, html`
    <div class="exam-focus">
      <div class="timerbar" id="timerbar" role="timer" aria-live="off">
        <span><strong>Pertanyaan ${att.idx + 1} dari ${total}</strong> <span class="badge info">${OPEN_LABEL[item.type]}</span></span>
        <span class="clock" id="clock">--:--</span>
      </div>
      <div class="meter" id="meter"><i id="meter-fill" style="width:100%"></i></div>
      <div class="dots" aria-hidden="true" style="margin-top:8px">${att.items.map((_, i) => html`<i class="${i < att.idx ? 'done' : i === att.idx ? 'cur' : ''}"></i>`)}</div>
      <section class="card" style="margin-top:14px">
        <p><strong>${item.text}</strong></p>
        ${konteks}
        <label class="field"><span>Jawabanmu <span class="hint">(satu kalimat)</span></span>
          <textarea id="open-text" rows="4" maxlength="600" placeholder="Tulis dengan kata-katamu sendiri.">${ans.text || ''}</textarea></label>
        <div class="row"><button class="btn btn-primary" type="button" id="kirim">Kirim jawaban</button><span class="small muted" id="open-wc">0 kata</span></div>
      </section>
      <p class="small muted">Tidak bisa kembali ke pertanyaan sebelumnya. Waktu habis = jawabanmu yang sudah ditulis ikut terkirim.</p>
    </div>
  `);

  const ta = $('#open-text', root);
  let tempel = ans.tempel || 0;
  ctx.onLeave(Anticopas.blokirSalinTempel(root, { lokasi: 'ujian', saatTempel: () => { tempel += 1; saveAtt(att.n, (a) => { (a.answers[item.id] ||= {}).tempel = tempel; }); } }));
  const catat = () => saveAtt(att.n, (a) => { const cur = (a.answers[item.id] ||= {}); cur.text = ta.value; if (tempel) cur.tempel = tempel; });
  const hitung = () => { $('#open-wc', root).textContent = `${ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0} kata`; };
  ta.addEventListener('input', () => { hitung(); catat(); });
  hitung();
  ta.focus();

  let advanced = false;
  const advance = (timedOut) => {
    if (advanced) return;
    advanced = true;
    catat();
    const t = Date.now();
    saveAtt(att.n, (a) => {
      const cur = (a.answers[item.id] ||= {});
      cur.latencySec = Math.round((t - a.shownAt) / 1000);
      if (timedOut) cur.habisWaktu = true;
      if (!String(cur.text || '').trim()) a.skipped = [...(a.skipped || []), item.id];
      if (a.idx + 1 >= a.items.length) a.finishedAt = t;
      else { a.idx += 1; a.shownAt = timedOut ? a.shownAt + limitMs : t; }
    });
    ctx.rerender();
  };
  $('#kirim', root).addEventListener('click', () => {
    if (!ta.value.trim()) { ta.focus(); return; }
    advance(false);
  });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && ta.value.trim()) { e.preventDefault(); advance(false); } });

  const bar = $('#timerbar', root);
  const meter = $('#meter', root);
  const tick = () => {
    const left = att.shownAt + limitMs - Date.now();
    if (left <= 0) { clearInterval(iv); advance(true); return; }
    $('#clock', root).textContent = mmss(left / 1000);
    $('#meter-fill', root).style.width = `${(left / limitMs) * 100}%`;
    const low = left < limitMs * 0.3, crit = left < limitMs * 0.12;
    bar.classList.toggle('low', low && !crit); bar.classList.toggle('crit', crit);
    meter.classList.toggle('low', low && !crit); meter.classList.toggle('crit', crit);
  };
  const iv = setInterval(tick, 250);
  ctx.onLeave(() => clearInterval(iv));
  tick();
}

function renderItem(root, ctx, exam, att, ses) {
  const cfg = exam.config;
  const item = att.items[att.idx];
  const total = att.items.length;
  const ans = att.answers[item.id] || {};
  const limitMs = itemLimitMs(item, cfg, ses.factor, ses.speed);
  const student = demoStudent();
  const cbm = cfg.cbm;
  const cbmHint = (k) => `${cbm.correct[k] >= 0 ? '+' : ''}${cbm.correct[k]} bila benar · ${cbm.wrong[k]} bila salah`.replace('-', '−');

  const optList = (render) => html`<div class="opts" role="radiogroup" aria-label="Pilihan jawaban">
        ${item.options.map((o) => html`<label class="opt ${ans.optionId === o.id ? 'checked' : ''}"><input type="radio" name="opt" value="${o.id}" ${ans.optionId === o.id ? 'checked' : ''}><span class="key">${o.key}</span>${render(o)}</label>`)}
      </div>`;
  const pre = (o) => html`<pre class="block" style="margin:0;flex:1">${o.text}</pre>`;
  // Keluaran panjang: baris yang berbeda antar pilihan disorot, baris yang sama di semua pilihan dipudarkan.
  const marked = markDiff(item.options.map((o) => o.text));
  const diffPre = (o) => html`<pre class="block lines" style="margin:0;flex:1">${marked[item.options.indexOf(o)].map((l) => html`<span class="ln ${l.differs ? 'diff' : 'same'}">${l.text || ' '}</span>`)}</pre>`;
  const diffHint = html`<p class="small muted" style="margin:8px 0 0">Baris yang <strong>disorot kuning</strong> berbeda antar pilihan: cukup telusuri bagian kodemu yang menghasilkan baris itu. Baris pudar sama di semua pilihan.</p>`;
  const howto = (steps) => html`<div class="howto"><strong>Cara mengerjakan</strong><ol>${steps.map((x) => html`<li>${x}</li>`)}</ol></div>`;
  const confidence = html`<h3>Seberapa yakin kamu?</h3>
      <div class="seg" role="radiogroup" aria-label="Tingkat keyakinan">
        ${[1, 2, 3].map((k) => html`<button type="button" class="${ans.confidence === k ? 'on' : ''}" data-conf="${k}" role="radio" aria-checked="${ans.confidence === k}">${k} · ${['Ragu', 'Cukup yakin', 'Sangat yakin'][k - 1]}</button>`)}
      </div>
      <p class="small muted" style="margin-top:6px">${ans.confidence ? cbmHint(ans.confidence) : 'Pilih jawaban dan keyakinan: butir terkunci dan lanjut sendiri.'}</p>`;
  const myCode = (open) => html`<details ${open ? 'open' : ''} style="margin:10px 0"><summary><strong>Kodemu untuk ${item.taskId}</strong> (hanya baca)</summary><div style="margin-top:6px">${codeViewer(student.code[item.taskId], item.taskId)}</div></details>`;

  let body;
  if (item.type === 'trace') body = html`${howto(['Lihat masukan di bawah (dibaca baris demi baris oleh programmu).', 'Bandingkan pilihan jawaban: baris yang berbeda antar pilihan disorot.', 'Telusuri kodemu hanya untuk baris yang disorot, lalu pilih jawaban dan keyakinanmu.'])}${myCode(true)}<div class="small muted">Masukan</div><pre class="block">${item.input.join('\n')}</pre>${diffHint}${optList(diffPre)}${confidence}`;
  else if (item.type === 'bugline') body = html`${howto(['Satu baris kodemu sudah diubah sehingga programnya jadi salah.', 'Cari baris yang terlihat tidak cocok dengan tujuan programmu (operator, angka, atau kondisi yang janggal).', 'Pilih nomor barisnya, lalu keyakinanmu.'])}<details open style="margin:10px 0"><summary><strong>Kodemu (satu barisnya sudah diubah)</strong></summary><div style="margin-top:6px">${codeViewer(numbered(item.startCode), `${item.taskId} · dengan nomor baris`)}</div></details>${optList(pre)}${confidence}`;
  else if (item.type === 'transfer') body = html`${howto(['Baca ketentuan baru di pertanyaan (bagian yang berubah saja).', 'Bayangkan kodemu disesuaikan, lalu terapkan ke masukan di bawah.', 'Baris yang disorot berbeda antar pilihan: periksa hanya baris itu, lalu pilih jawaban dan keyakinanmu.'])}${myCode(false)}<div class="small muted">Masukan</div><pre class="block">${item.input.join('\n')}</pre>${diffHint}${optList(diffPre)}${confidence}`;
  else body = html`${optList((o) => html`<span>${o.text}</span>`)}${confidence}`;

  show(root, html`
    <div class="exam-focus">
      <div class="timerbar" id="timerbar" role="timer" aria-live="off">
        <span><strong>Butir ${att.idx + 1} dari ${total}</strong> <span class="badge info">${TYPE_LABEL[item.type]}</span>${att.n > 1 ? html` <span class="badge warn">uji ulang</span>` : ''}</span>
        <span class="clock" id="clock">--:--</span>
      </div>
      <div class="meter" id="meter"><i id="meter-fill" style="width:100%"></i></div>
      <div class="dots" aria-hidden="true" style="margin-top:8px">${att.items.map((_, i) => html`<i class="${i < att.idx ? 'done' : i === att.idx ? 'cur' : ''}"></i>`)}</div>
      <section class="card" style="margin-top:14px">
        <p><strong>${item.text}</strong></p>
        ${body}
      </section>
      <p class="small muted">Tidak bisa kembali ke butir sebelumnya. Waktu habis = butir berpindah sendiri.</p>
    </div>
  `);

  let advanced = false;
  const advance = (timedOut) => {
    if (advanced) return;
    advanced = true;
    const t = Date.now();
    saveAtt(att.n, (a) => {
      const cur = (a.answers[item.id] ||= {});
      if (!timedOut || cur.optionId) cur.latencySec = Math.round((t - a.shownAt) / 1000);
      if (timedOut && cur.optionId && !cur.confidence) cur.confidence = 1; // sudah memilih, belum menilai keyakinan: keyakinan terendah
      if (timedOut && !cur.optionId) a.skipped = [...(a.skipped || []), item.id];
      if (a.idx + 1 >= a.items.length) a.finishedAt = t;
      else { a.idx += 1; a.shownAt = timedOut ? a.shownAt + limitMs : t; }
    });
    ctx.rerender();
  };
  const maybeAdvance = () => {
    const a = (attempts().find((x) => x.n === att.n)?.answers || {})[item.id] || {};
    if (a.optionId && a.confidence) setTimeout(() => advance(false), 350);
  };

  $$('input[name="opt"]', root).forEach((r) => r.addEventListener('change', () => {
    saveAtt(att.n, (a) => { (a.answers[item.id] ||= {}).optionId = r.value; });
    $$('.opt', root).forEach((o) => o.classList.toggle('checked', o.querySelector('input').checked));
    maybeAdvance();
  }));
  $$('[data-conf]', root).forEach((b) => b.addEventListener('click', () => {
    saveAtt(att.n, (a) => { (a.answers[item.id] ||= {}).confidence = Number(b.dataset.conf); });
    $$('[data-conf]', root).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    maybeAdvance();
  }));

  const bar = $('#timerbar', root);
  const meter = $('#meter', root);
  const tick = () => {
    const left = att.shownAt + limitMs - Date.now();
    if (left <= 0) { clearInterval(iv); advance(true); return; }
    $('#clock', root).textContent = mmss(left / 1000);
    $('#meter-fill', root).style.width = `${(left / limitMs) * 100}%`;
    const low = left < limitMs * 0.3, crit = left < limitMs * 0.12;
    bar.classList.toggle('low', low && !crit); bar.classList.toggle('crit', crit);
    meter.classList.toggle('low', low && !crit); meter.classList.toggle('crit', crit);
  };
  const iv = setInterval(tick, 250);
  ctx.onLeave(() => clearInterval(iv));
  tick();
}
