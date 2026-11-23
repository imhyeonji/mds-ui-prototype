// Shape of the /v1/explore response (pipelines API contract v1). Unknown fields are ignored.

export type ColumnType = "numeric" | "categorical" | "date";
export const COLUMN_TYPES: ColumnType[] = ["numeric", "categorical", "date"];

export type Cell = string | number | boolean | null | Record<string, unknown> | unknown[];
export type Row = Record<string, Cell>;

export interface InfoColumn {
  column: string;
  dtype: string;
  type: ColumnType;
  leading_zeros: boolean;
  coerced: number;
  non_null: number;
  null_pct: number;
}

export interface NumericRange { min: number | null; q1: number | null; median: number | null; q3: number | null; max: number | null }
export interface CategoricalRange { top: { label: string; count: number }[]; other_count: number }
export interface DateRange { min: string | null; max: string | null }

export interface Ranges {
  numeric: Record<string, NumericRange>;
  categorical: Record<string, CategoricalRange>;
  date: Record<string, DateRange>;
}

export type DescribeStats = Record<string, Record<string, string | number | boolean>>;

/** One view of the data: normalized (top level) or raw (`raw` block). */
export interface ExploreView {
  head: Row[];
  /** Missing on pipeline versions before the preview-window changes. */
  tail?: Row[];
  info: { note: string; columns: InfoColumn[] };
  describe: { note: string; stats: DescribeStats };
  ranges: Ranges;
}

/** One map point: [lat, lon, row, count]. `row` is the 0-based row in the full dataset; `count` is how many rows it stands for. */
export type GeoPoint = [lat: number, lon: number, row: number, count: number];

/** One place in `geo.regions`: nearest city (offline GeoNames lookup), weighted by rows. */
export interface GeoRegion {
  city: string | null;
  admin1: string | null;
  /** ISO 3166-1 alpha-2, e.g. "DK". */
  country_code: string | null;
  count: number;
  /** Share of `total_valid`, in percent. */
  pct: number;
}

/** The explore response's `geo` block (see the Explore API map points handover). Points arrive cleaned and thinned. */
export interface ExploreGeo {
  source: "columns" | "geojson";
  lat_column: string | null;
  lon_column: string | null;
  points: GeoPoint[];
  point_count: number;
  total_valid: number;
  sampled: boolean;
  cell_deg: number | null;
  /** Largest places first. Missing or null when the pipeline couldn't look regions up. */
  regions?: { items: GeoRegion[]; other_count: number } | null;
  bounds: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
}

export interface ExploreResponse extends ExploreView {
  meta: {
    asset_id: string;
    format: "csv" | "tsv" | "json" | "geojson" | "xml";
    container: "zip" | null;
    rows: number;
    cols: number;
    pages: number;
    partial_warning: boolean;
    excel_allowed: boolean;
    excluded_columns: string[];
    generated_at: string;
  };
  health: { missing_pct: number; missing_cells: number; total_cells: number };
  /** Ready-to-plot GPS points; null (or absent in older responses) when the dataset has no coordinates. */
  geo?: ExploreGeo | null;
  raw?: ExploreView;
  schema: { source: Record<string, unknown> };
}

export function viewOf(summary: ExploreResponse, raw: boolean): ExploreView {
  return raw && summary.raw ? summary.raw : summary;
}

/** Download formats allowed by the contract for this summary. */
export function downloadFormats(summary: ExploreResponse): string[] {
  const formats = ["csv", "tsv", "json", "parquet"];
  if (summary.meta.excel_allowed) formats.push("xlsx");
  if (!formats.includes(summary.meta.format)) formats.push(summary.meta.format);
  if (summary.meta.container === "zip") formats.push("zip");
  return formats;
}

export const MOSTLY_UNIQUE = 0.9;

/** Categorical column whose unique / count ratio is at least 90% (ids, codes). */
export function mostlyUnique(stats: DescribeStats, column: string): number | undefined {
  const unique = Number(stats[column]?.unique);
  const count = Number(stats[column]?.count);
  return count > 0 && unique / count >= MOSTLY_UNIQUE ? unique : undefined;
}

export function formatCell(value: Cell | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return value.toLocaleString("en", { maximumFractionDigits: 6 });
  return String(value);
}
