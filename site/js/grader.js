// Membuang spasi di ujung tiap baris dan baris kosong di ujung keluaran.
export function normalize(s) {
  return String(s)
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

// saatKasus(i, total) dipanggil sebelum tiap kasus diperiksa (i mulai dari 1), untuk indikator kemajuan.
export async function grade(code, tests, run, saatKasus = () => {}) {
  const results = [];
  let i = 0;
  for (const t of tests) {
    saatKasus(++i, tests.length);
    const r = await run(code, t.input, false);
    let status;
    if (r.timeout) status = "timeout";
    else if (r.error) status = "error";
    else status = normalize(r.stdout) === normalize(t.expected) ? "pass" : "fail";
    results.push({ test: t, status, actual: r.stdout, error: r.error });
    if (status === "timeout") break;
  }
  return results;
}
