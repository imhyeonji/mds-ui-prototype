export type DatasetRow = Record<string, string | number | boolean | null>;

export interface DatasetColumn {
  key: string;
  label: string;
  description: string;
  type: "number" | "category" | "datetime" | "boolean" | "mixed" | "json";
  unit?: string;
}

export interface PreviewDataset {
  title: string;
  filename: string;
  description: string;
  period: string;
  columns: DatasetColumn[];
  rows: DatasetRow[];
  warnings?: string[];
}

export function columnProfile(rows: DatasetRow[], column: DatasetColumn) {
  const values = rows.map((row) => row[column.key]).filter((value) => value !== null && value !== undefined && value !== "");
  const unique = new Set(values).size;
  const missing = rows.length - values.length;
  if (column.type === "number") {
    const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const min = numbers.length ? Math.min(...numbers) : 0;
    const max = numbers.length ? Math.max(...numbers) : 0;
    const width = (max / 8 - min / 8) || 1;
    const bins = Array.from({ length: 8 }, (_, index) => ({
      label: `${(min * (1 - index / 8) + max * (index / 8)).toFixed(1)}–${(min * (1 - (index + 1) / 8) + max * ((index + 1) / 8)).toFixed(1)}`,
      count: 0,
    }));
    numbers.forEach((value) => { bins[Math.max(0, Math.min(7, Math.floor(value / width - min / width)))].count += 1; });
    return { unique, missing, min, max, mean: numbers.length ? numbers.reduce((sum, value) => sum + value / numbers.length, 0) : 0, bins, categories: [] };
  }
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(String(value), (counts.get(String(value)) || 0) + 1));
  const categories = [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  return { unique, missing, min: 0, max: 0, mean: 0, bins: [], categories };
}

export function filterDataset(rows: DatasetRow[], search: string, field = "", selected = "") {
  const query = search.trim().toLowerCase();
  return rows.filter((row) =>
    (!field || !selected || String(row[field] ?? "") === selected) &&
    (!query || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query))),
  );
}

export function chartGroups(rows: DatasetRow[], field: string, metric = "", operation = "count") {
  const groups = new Map<string, { sum: number; count: number }>();
  let excluded = 0;
  rows.forEach((row) => {
    const category = row[field];
    const value = row[metric];
    if (category == null || category === "" || (operation !== "count" && (typeof value !== "number" || !Number.isFinite(value)))) { excluded++; return; }
    const name = String(category);
    const group = groups.get(name) || { sum: 0, count: 0 };
    group.count++;
    if (typeof value === "number") group.sum += value;
    groups.set(name, group);
  });
  const all = [...groups].map(([name, group]) => ({ name, value: operation === "count" ? group.count : operation === "mean" ? group.sum / group.count : group.sum })).sort((a, b) => b.value - a.value);
  return { data: all.slice(0, 20), excluded, omittedGroups: Math.max(0, all.length - 20) };
}

export function datasetCsv(rows: DatasetRow[], columns: DatasetColumn[]) {
  const escape = (value: string | number | boolean | null) => {
    let text = String(value ?? "");
    // Prevent spreadsheet formula execution when opening exported provider strings.
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [columns.map((column) => escape(column.key)).join(","), ...rows.map((row) => columns.map((column) => escape(row[column.key])).join(","))].join("\n");
}
