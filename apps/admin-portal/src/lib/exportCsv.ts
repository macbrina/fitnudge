/**
 * Export array of objects to CSV and trigger download.
 */
export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: (keyof T)[]
): void {
  if (data.length === 0) return;
  const keys = columns ?? (Object.keys(data[0]) as (keyof T)[]);
  const header = keys.join(",");
  const rows = data.map((row) =>
    keys
      .map((k) => {
        const v = row[k];
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
