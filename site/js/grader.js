// Membuang spasi di ujung tiap baris dan baris kosong di ujung keluaran.
export function normalize(s) {
  return String(s)
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export async function grade(code, tests, run) {
  const results = [];
  for (const t of tests) {
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
