import { T, useTranslator } from "@/i18n";
import { chartGroups, columnProfile, type DatasetColumn, type DatasetRow } from "@/utilities/dataset-preview";
import { Alert, MenuItem, TextField } from "@mui/material";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DatasetPreviewCharts({ rows, columns }: { rows: DatasetRow[]; columns: DatasetColumn[] }) {
  const { translator } = useTranslator();
  const available = columns.filter((column) => column.type !== "json");
  const numeric = columns.filter((column) => column.type === "number");
  const [mode, setMode] = useState("count");
  const [field, setField] = useState(available.find((column) => ["boolean", "category"].includes(column.type))?.key || available[0]?.key || "");
  const [metric, setMetric] = useState(numeric[0]?.key || "");
  if (!available.length) return <Alert severity="info" sx={{ m: 3 }}><T string="datasetExplorer.noChartFields" /></Alert>;
  const distribution = mode === "distribution";
  const selectedNumeric = numeric.find((column) => column.key === metric);
  const profile = selectedNumeric ? columnProfile(rows, selectedNumeric) : undefined;
  const grouped = chartGroups(rows, field, metric, mode);
  const data = distribution ? (profile?.bins.map((bin) => ({ name: bin.label, value: bin.count })) || []) : grouped.data;
  const excluded = distribution ? profile?.missing || 0 : grouped.excluded;
  const valueLabel = translator(distribution ? "datasetExplorer.count" : `datasetExplorer.${mode}`);

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap gap-3">
        <TextField select size="small" color="secondary" label={translator("datasetExplorer.chartType")} value={mode} onChange={(event) => setMode(event.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="count"><T string="datasetExplorer.count" /></MenuItem>
          {numeric.length > 0 && ["distribution", "sum", "mean"].map((value) => <MenuItem key={value} value={value}><T string={`datasetExplorer.${value}`} /></MenuItem>)}
        </TextField>
        {!distribution && <TextField select size="small" color="secondary" label={translator("datasetExplorer.groupField")} value={field} onChange={(event) => setField(event.target.value)} sx={{ minWidth: 200, maxWidth: 400 }}>
          {available.map((column) => <MenuItem key={column.key} value={column.key}>{column.label}</MenuItem>)}
        </TextField>}
        {mode !== "count" && <TextField select size="small" color="secondary" label={translator("datasetExplorer.numericField")} value={metric} onChange={(event) => setMetric(event.target.value)} sx={{ minWidth: 200, maxWidth: 400 }}>
          {numeric.map((column) => <MenuItem key={column.key} value={column.key}>{column.label}</MenuItem>)}
        </TextField>}
      </div>
      <p className="text-sm text-gray-500"><T string="datasetExplorer.chartScope" /> · {excluded} <T string="datasetExplorer.excluded" /></p>
      {!distribution && grouped.omittedGroups > 0 && <Alert severity="info">{grouped.omittedGroups} <T string="datasetExplorer.omittedGroups" /></Alert>}
      {!data.length ? <Alert severity="info"><T string="datasetExplorer.noChartFields" /></Alert> : <>
        <div className="rounded-xl border border-gray-200 p-4">
          <ResponsiveContainer width="100%" height={Math.max(260, data.length * 34)}>
            <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, bottom: 5, left: 0 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.length > 22 ? `${value.slice(0, 20)}…` : value} />
              <Tooltip cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="value" name={valueLabel} fill="#60a5fa" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <details className="text-sm text-gray-600">
          <summary className="cursor-pointer"><T string="datasetExplorer.chartValues" /></summary>
          <table className="mt-3 w-full text-left"><thead><tr><th scope="col"><T string="datasetExplorer.groupField" /></th><th scope="col">{valueLabel}</th></tr></thead><tbody>{data.map((item) => <tr key={item.name}><td className="py-1 break-all">{item.name}</td><td>{item.value.toLocaleString("en", { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table>
        </details>
      </>}
    </div>
  );
}
