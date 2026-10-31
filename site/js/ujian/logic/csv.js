export function toCsv(rows, columns) {
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => cell(c.label)).join(',');
  return [head, ...rows.map((r) => columns.map((c) => cell(c.get(r))).join(','))].join('\n');
}
