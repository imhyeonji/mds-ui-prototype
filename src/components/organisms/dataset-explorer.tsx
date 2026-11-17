import { PipelineColumnProfile, type PipelineAnalysis } from "@/components/molecules/pipeline-column-profile";
import { DatasetColumnProfile } from "@/components/molecules/dataset-column-profile";
import { DatasetPreviewCharts } from "@/components/molecules/dataset-preview-charts";
import { T, useTranslator } from "@/i18n";
import { columnProfile, datasetCsv, filterDataset, type PreviewDataset } from "@/utilities/dataset-preview";
import {
  Alert, Button, Checkbox, Chip, FormControlLabel, Menu, MenuItem,
  Tab, TablePagination, TableSortLabel, Tabs, TextField, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import { useMemo, useState, type ReactNode } from "react";

interface DatasetExplorerProps {
  dataset: PreviewDataset;
  rawResponse: ReactNode;
  saved?: boolean;
  previewOnly?: boolean;
  dataLoading?: boolean;
  ensureData?: () => Promise<void>;
  analysis?: PipelineAnalysis;
  downloadOptions?: { label: string; action: () => void; disabled?: boolean }[];
}

export function DatasetExplorer({ dataset, rawResponse, saved = false, downloadOptions, analysis, previewOnly = false, dataLoading = false, ensureData }: DatasetExplorerProps) {
  const { translator } = useTranslator();
  const [tab, setTab] = useState(analysis ? "columns" : "raw");
  const [search, setSearch] = useState("");
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [detail, setDetail] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState(dataset.columns.map((column) => column.key));
  const [columnMenu, setColumnMenu] = useState<HTMLElement | null>(null);
  const [sort, setSort] = useState({ key: dataset.columns[0]?.key || "", direction: "asc" as "asc" | "desc" });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const filtered = useMemo(() => filterDataset(dataset.rows, search, filterField, filterValue), [dataset.rows, search, filterField, filterValue]);
  const columns = dataset.columns.filter((column) => visibleKeys.includes(column.key));
  const filterValues = [...new Set(dataset.rows.map((row) => String(row[filterField] ?? "")))].filter(Boolean).sort();
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const left = a[sort.key];
    const right = b[sort.key];
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right : String(left ?? "").localeCompare(String(right ?? ""));
    return sort.direction === "asc" ? comparison : -comparison;
  }), [filtered, sort]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(sorted.length / pageSize) - 1));
  const visibleRows = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const [downloadMenu, setDownloadMenu] = useState<HTMLElement | null>(null);


  function downloadData() {
    const url = URL.createObjectURL(new Blob([datasetCsv(sorted, columns)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = dataset.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const formatCell = (value: string | number | boolean | null, type: string) => {
    if (value === null || value === undefined) return "—";
    if (type === "json") return <details><summary className="cursor-pointer">JSON</summary><pre className="max-w-sm whitespace-pre-wrap break-all">{String(value)}</pre></details>;
    return typeof value === "number" ? value.toLocaleString("en") : String(value);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <Chip size="small" label={saved ? "Saved sample" : translator("datasetExplorer.liveData")} sx={{ bgcolor: saved ? "#fff7ed" : "#ecfdf5", fontSize: 11 }} />

            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{dataset.title}</h2>

          </div>
          <Button color="secondary" variant="contained" onClick={e => setDownloadMenu(e.currentTarget)} aria-haspopup="menu" aria-expanded={!!downloadMenu}>Download ▾</Button>
          <Menu anchorEl={downloadMenu} open={!!downloadMenu} onClose={() => setDownloadMenu(null)}>
            {downloadOptions?.map(option => <MenuItem key={option.label} disabled={option.disabled} onClick={() => { setDownloadMenu(null); option.action(); }}>{option.label}</MenuItem>)}
            <MenuItem disabled={!filtered.length || previewOnly || dataLoading} onClick={() => { setDownloadMenu(null); downloadData(); }}>CSV — filtered preview rows</MenuItem>
          </Menu>
        </div>
        {!analysis && dataset.warnings?.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
        <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-gray-100 pt-4 text-sm">
          <div><strong>{(analysis?.meta.rows ?? dataset.rows.length).toLocaleString("en")}</strong> <span className="text-gray-500"><T string="datasetExplorer.rows" /></span></div>
          <div><strong>{analysis?.meta.cols ?? dataset.columns.length}</strong> <span className="text-gray-500"><T string="datasetExplorer.columns" /></span></div>
          <div><span className="text-gray-500">Missing values </span><strong>{analysis ? `${analysis.health.missing_pct}%` : "—"}</strong></div>
        </div>
      </div>

      <Tabs value={tab} onChange={(_, value: string) => { setTab(value); if (value !== "columns") void ensureData?.().catch(() => {}); }} textColor="secondary" indicatorColor="secondary" variant="scrollable" aria-label={translator("datasetExplorer.views")} sx={{ px: 2, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        {["data", "charts", "columns", "raw"].map((view) => <Tab key={view} id={`dataset-tab-${view}`} aria-controls={`dataset-panel-${view}`} value={view} label={translator(`datasetExplorer.${view}`)} />)}
      </Tabs>

      {(tab === "data" || tab === "charts") && !previewOnly && (
        <div className="space-y-3 border-b border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <TextField size="small" color="secondary" label={translator("datasetExplorer.search")} value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} sx={{ flex: "1 1 220px", maxWidth: 380, bgcolor: "white" }} />
            <TextField select size="small" color="secondary" label={translator("datasetExplorer.filterField")} value={filterField} onChange={(event) => { setFilterField(event.target.value); setFilterValue(""); setPage(0); }} sx={{ minWidth: 180, maxWidth: 300, bgcolor: "white" }}>
              <MenuItem value=""><T string="datasetExplorer.noFilter" /></MenuItem>
              {dataset.columns.filter((column) => column.type !== "json").map((column) => <MenuItem key={column.key} value={column.key}>{column.label}</MenuItem>)}
            </TextField>
            {filterField && <TextField select size="small" color="secondary" label={translator("datasetExplorer.filterValue")} value={filterValue} onChange={(event) => { setFilterValue(event.target.value); setPage(0); }} sx={{ minWidth: 180, maxWidth: 300, bgcolor: "white" }}>
              <MenuItem value=""><T string="datasetExplorer.allValues" /></MenuItem>
              {filterValues.slice(0, 200).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>}
            {filterField && filterValues.length > 200 && <span className="text-xs text-gray-500"><T string="datasetExplorer.filterLimit" /></span>}
            {(search || filterField) && <Button color="secondary" onClick={() => { setSearch(""); setFilterField(""); setFilterValue(""); setPage(0); }}><T string="datasetExplorer.reset" /></Button>}
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {tab === "data" && <ToggleButtonGroup size="small" exclusive value={detail ? "detail" : "compact"} onChange={(_, value: string | null) => { if (value) setDetail(value === "detail"); }} aria-label={translator("datasetExplorer.density")}>
                <ToggleButton value="detail"><T string="datasetExplorer.detail" /></ToggleButton>
                <ToggleButton value="compact"><T string="datasetExplorer.compact" /></ToggleButton>
              </ToggleButtonGroup>}
              {tab === "data" && <Button color="secondary" onClick={(event) => setColumnMenu(event.currentTarget)} aria-haspopup="menu" aria-expanded={!!columnMenu}>
                {columns.length}/{dataset.columns.length} <span className="ml-1"><T string="datasetExplorer.columns" /></span>
              </Button>}
            </div>
          </div>
          <p className="text-xs text-gray-500" aria-live="polite">{filtered.length.toLocaleString("en")} / {dataset.rows.length.toLocaleString("en")} <T string="datasetExplorer.matchingRows" /></p>
          <Menu anchorEl={columnMenu} open={!!columnMenu} onClose={() => setColumnMenu(null)}>
            {dataset.columns.map((column) => <MenuItem key={column.key}>
              <FormControlLabel label={column.label} control={<Checkbox color="secondary" checked={visibleKeys.includes(column.key)} disabled={visibleKeys.length === 1 && visibleKeys.includes(column.key)} onChange={(_, checked) => setVisibleKeys((previous) => checked ? [...previous, column.key] : previous.filter((key) => key !== column.key))} />}/>
            </MenuItem>)}
          </Menu>
        </div>
      )}

      {tab === "columns" && <div className="px-4 py-2"><Button color="secondary" onClick={event => setColumnMenu(event.currentTarget)}>Columns</Button><Menu anchorEl={columnMenu} open={!!columnMenu} onClose={() => setColumnMenu(null)}>{dataset.columns.map(column => <MenuItem key={column.key}><FormControlLabel label={column.label} control={<Checkbox color="secondary" checked={visibleKeys.includes(column.key)} disabled={visibleKeys.length === 1 && visibleKeys.includes(column.key)} onChange={(_, checked) => setVisibleKeys(previous => checked ? [...previous, column.key] : previous.filter(key => key !== column.key))} />} /></MenuItem>)}</Menu></div>}

      <div role="tabpanel" id={`dataset-panel-${tab}`} aria-labelledby={`dataset-tab-${tab}`}>
        {tab !== "columns" && (previewOnly || dataLoading) ? <div className="p-6" role="status">{dataLoading ? "Loading data…" : <Button onClick={() => void ensureData?.().catch(() => {})}>Load data</Button>}</div> : tab === "raw" ? <div className="p-5">{rawResponse}</div> : tab !== "columns" && !filtered.length ? (
          <div className="p-8"><Alert severity="info"><T string="datasetExplorer.noMatches" /></Alert></div>
        ) : tab === "charts" ? <DatasetPreviewCharts rows={filtered} columns={dataset.columns} /> : tab === "columns" ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((column) => {
              const profile = analysis ? undefined : columnProfile(filtered, column);
              return <section key={column.key} className="space-y-4 rounded-lg border border-gray-200 p-5">
                <div><h3 className="font-semibold">{column.label}</h3><code className="text-xs text-gray-500">{column.key}</code></div>
                {!analysis && <p className="min-h-10 text-sm text-gray-500">{column.description}</p>}
                {analysis ? <PipelineColumnProfile analysis={analysis} column={column} /> : <DatasetColumnProfile rows={filtered} column={column} />}
                {profile && <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">{profile.unique} <T string="datasetExplorer.unique" /> · {profile.missing} <T string="datasetExplorer.missing" /></p>}
              </section>;
            })}
          </div>
        ) : (
          <>
            <div className="max-h-[54vh] overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">{dataset.title} — {translator("datasetExplorer.liveData")}</caption>
                <thead className="sticky top-0 z-10 bg-white">
                  <tr>{columns.map((column) => <th key={column.key} scope="col" className="min-w-[190px] border-r border-b border-gray-200 p-4 align-top" aria-sort={sort.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
                    <TableSortLabel active={sort.key === column.key} direction={sort.key === column.key ? sort.direction : "asc"} onClick={() => { setSort({ key: column.key, direction: sort.key === column.key && sort.direction === "asc" ? "desc" : "asc" }); setPage(0); }}>
                      <span className="mr-2 text-xs text-gray-400" aria-hidden="true">{column.type === "number" ? "#" : column.type === "datetime" ? "◷" : "Aa"}</span>{column.label}
                    </TableSortLabel>
                    {detail && <><p className="mb-4 mt-2 min-h-14 max-w-60 text-xs font-normal leading-5 text-gray-500">{column.description}</p>{analysis ? <PipelineColumnProfile analysis={analysis} column={column} /> : <DatasetColumnProfile rows={filtered} column={column} />}</>}
                  </th>)}</tr>
                </thead>
                <tbody>{visibleRows.map((row, index) => <tr key={index} className="even:bg-gray-50 hover:bg-yellow-50">
                  {columns.map((column) => <td key={column.key} className={`max-w-sm break-words border-r border-b border-gray-100 px-4 py-3 ${column.type === "number" ? "text-right tabular-nums" : "text-gray-600"}`}>{formatCell(row[column.key], column.type)}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
            <TablePagination component="div" count={filtered.length} page={currentPage} rowsPerPage={pageSize} rowsPerPageOptions={[10, 25, 50]} onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} />
          </>
        )}
      </div>
    </div>
  );
}
