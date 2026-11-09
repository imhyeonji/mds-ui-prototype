import type { DatasetColumn, DatasetRow, PreviewDataset } from "./dataset-preview";

export const MAX_PREVIEW_ROWS = 2000;
const MAX_COLUMNS = 80;
const MAX_CANDIDATES = 20;

export interface DatasetCandidate { path: string; values: unknown[] }
export interface ParsedPreview { candidates: DatasetCandidate[]; warnings: string[] }
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const segment = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");

// Quoted fields, embedded newlines, CRLF and escaped quotes are preserved.
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === '"' && !field && !closed) quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; closed = false; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = ""; closed = false;
      if (rows.length >= MAX_PREVIEW_ROWS + 2) return rows;
    } else {
      if (closed || char === '"') throw new Error("Malformed CSV quoting; use the raw response to inspect the data.");
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV field; use the raw response to inspect the data.");
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}

export function parsePreview(body: string, contentType: string): ParsedPreview {
  if (!body.trim()) return { candidates: [], warnings: [] };
  const mime = contentType.split(";")[0].trim().toLowerCase();
  const csv = mime === "text/csv" || mime === "application/csv" || mime === "text/tab-separated-values";
  if (csv) {
    const matrix = parseCsv(body.replace(/^\uFEFF/, ""), mime.includes("tab-separated") ? "\t" : ",");
    if (!matrix.length) return { candidates: [], warnings: [] };
    const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);
    const used = new Set<string>();
    const headers = Array.from({ length: width }, (_, i) => {
      const base = matrix[0][i] || `column_${i + 1}`;
      let name = base;
      let suffix = 2;
      while (used.has(name)) name = `${base}_${suffix++}`;
      used.add(name);
      return name;
    });
    const warnings = ["CSV values are preserved as text, including numeric-looking identifiers. Numeric charts require JSON numbers in this version."];
    if (matrix.length >= MAX_PREVIEW_ROWS + 2) warnings.push("CSV parsing is limited to the first 2,000 records for preview. The raw response remains available.");
    if (matrix.some((row) => row.length !== matrix[0].length)) warnings.push("CSV rows have different field counts. Additional columns are retained and absent fields are marked missing.");
    return { candidates: [{ path: "CSV", values: matrix.slice(1).map((row) => Object.fromEntries(headers.map((key, i) => [key, row[i] ?? null]))) }], warnings };
  }
  let value: unknown;
  try { value = JSON.parse(body); }
  catch {
    return { candidates: [], warnings: [mime.includes("json") ? "The response is not valid JSON. The original text is still available below." : "This response is plain text or an unsupported tabular format. View it in the raw response."] };
  }
  const candidates: DatasetCandidate[] = [];
  function visit(item: unknown, path: string, depth: number) {
    if (candidates.length >= MAX_CANDIDATES || depth > 5) return;
    if (Array.isArray(item)) { candidates.push({ path: path || "/", values: item }); return; }
    if (isRecord(item)) Object.entries(item).forEach(([key, nested]) => visit(nested, `${path}/${segment(key)}`, depth + 1));
  }
  visit(value, "", 0);
  if (!candidates.length && isRecord(value)) candidates.push({ path: "/", values: [value] });
  const preferredPaths = ["/result/records", "/records", "/data"];
  const priority = (path: string) => { const index = preferredPaths.indexOf(path); return index < 0 ? preferredPaths.length : index; };
  candidates.sort((a, b) => priority(a.path) - priority(b.path));
  const warnings: string[] = [];
  if (isRecord(value) && ("offset" in value || "limit" in value || "next" in value)) warnings.push("The response contains pagination metadata. Statistics cover only this response; further pages are not fetched automatically.");
  if (candidates.length === MAX_CANDIDATES) warnings.push("Only the first 20 array locations are listed.");
  return { candidates, warnings };
}

function flatten(value: unknown, path = "", depth = 0, output: Record<string, unknown> = Object.create(null)) {
  if (isRecord(value) && Object.keys(value).length && depth < 5) {
    Object.entries(value).forEach(([key, nested]) => flatten(nested, `${path}/${segment(key)}`, depth + 1, output));
  } else output[path || "/value"] = value;
  return output;
}

export function normalizeDataset(candidate: DatasetCandidate, title: string): PreviewDataset {
  const flattened = candidate.values.slice(0, MAX_PREVIEW_ROWS).map((value) => flatten(value));
  const allKeys = [...new Set(flattened.flatMap(Object.keys))];
  const keys = allKeys.slice(0, MAX_COLUMNS);
  const columns: DatasetColumn[] = keys.map((key) => {
    const present = flattened.map((row) => row[key]).filter((value) => value !== null && value !== undefined && value !== "");
    const kinds = new Set(present.map((value) => typeof value === "object" ? "json" : typeof value === "number" && !Number.isFinite(value) ? "mixed" : typeof value));
    const kind = kinds.size === 1 ? [...kinds][0] : "mixed";
    const type: DatasetColumn["type"] = kind === "number" ? "number" : kind === "boolean" ? "boolean" : kind === "json" ? "json" : kind === "string" ? "category" : "mixed";
    const label = key.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~")).join(" › ");
    return { key, label, type, description: `${type} · ${present.length} populated / ${flattened.length} loaded rows` };
  });
  const rows: DatasetRow[] = flattened.map((source) => Object.fromEntries(keys.map((key) => {
    const value = source[key];
    return [key, value === undefined || value === null ? null : typeof value === "object" ? JSON.stringify(value) : typeof value === "number" && Number.isFinite(value) || typeof value === "boolean" ? value : String(value)];
  })));
  const warnings: string[] = [];
  if (candidate.values.length > MAX_PREVIEW_ROWS) warnings.push(`Showing the first ${MAX_PREVIEW_ROWS} of ${candidate.values.length} received rows. Statistics and exports cover the displayed subset.`);
  if (allKeys.length > MAX_COLUMNS) warnings.push(`Showing the first ${MAX_COLUMNS} of ${allKeys.length} discovered columns. Use the raw response for all fields.`);
  if (columns.some((column) => column.type === "mixed")) warnings.push("Some fields have mixed or entirely missing values. Values are preserved; those fields are not treated as numeric measurements.");
  return {
    title, filename: "data-preview.csv", description: `Records from ${candidate.path}. Nested objects are flattened into columns; nested arrays are preserved as JSON. Field types are inferred without converting strings to numbers.`,
    period: "Statistics apply only to loaded rows", columns, rows, warnings,
  };
}
