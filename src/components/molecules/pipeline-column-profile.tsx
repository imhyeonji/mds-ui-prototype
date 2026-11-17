import type { DatasetColumn } from "@/utilities/dataset-preview";

export interface PipelineAnalysis {
  meta: { format: string; rows: number; cols: number; partial_warning?: boolean; excel_allowed?: boolean; container?: string; excluded_columns?: string[]; generated_at?: string };
  health: { missing_pct: number; missing_cells: number; total_cells: number };
  info: { columns: { column: string; type: string; dtype: string; non_null: number; null_pct: number; leading_zeros: boolean; coerced: number }[] };
  describe: { stats: Record<string, Record<string, unknown>> };
  ranges: Record<string, Record<string, unknown>>;
  schema: { source: { json_record_path?: string } };
}
export const pipelineColumnName = (column: DatasetColumn) => column.key.replace(/^\//, "").split("/").map(s => s.replaceAll("~1", "/").replaceAll("~0", "~")).join(".");
export function PipelineColumnProfile({ analysis, column }: { analysis: PipelineAnalysis; column: DatasetColumn }) {
  const name = pipelineColumnName(column);
  const excluded = analysis.meta.excluded_columns?.some(c => name === c || name.startsWith(c + "."));
  const info = analysis.info.columns.find(c => c.column === name);
  if (excluded || !info) return <p className="text-sm text-gray-500">Not analysed</p>;
  const stats = analysis.describe.stats[name] || {};
  const ranges = Object.values(analysis.ranges).map(group => group?.[name]).filter(v => v != null);
  const display = (v: unknown) => typeof v === "object" ? JSON.stringify(v) : String(v);
  return <div className="space-y-3 text-sm">
    <dl className="grid grid-cols-2 gap-2">
      {[["Type", info.type], ["Data type", info.dtype], ["Missing values", `${info.null_pct}%`], ["Non-empty values", info.non_null], ["Leading zeros", info.leading_zeros ? "Preserved" : "No"], ["Converted values", info.coerced], ...Object.entries(stats).filter(([key]) => key !== "count").map(([k,v]) => [k === "mean" ? "Mean" : k === "min" ? "Minimum" : k === "max" ? "Maximum" : k, v])].map(([key,value]) => <div key={String(key)}><dt className="text-xs text-gray-500">{String(key)}</dt><dd className="break-words">{display(value)}</dd></div>)}
    </dl>
    {ranges.length > 0 && <details><summary className="cursor-pointer text-xs text-gray-500">Value ranges</summary>{ranges.map((r,i) => <pre key={i} className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(r,null,2)}</pre>)}</details>}
  </div>;
}
