import type { PipelineAnalysis } from "@/components/molecules/pipeline-column-profile";
import { DataPreview, type DataPreviewResponse, type DataPreviewState } from "@/components/molecules/data-preview";
import { DatasetExplorer } from "@/components/organisms/dataset-explorer";
import { normalizeDataset, parsePreview, type ParsedPreview } from "@/utilities/normalize-preview";
import { T, useTranslator } from "@/i18n";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Menu, MenuItem, TextField } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { jsonDownload } from "@/utilities/preview-download";



type FetchedResponse = DataPreviewResponse & { fetchedAt: string; bytes: number; addressSource: string; source?: "saved"; analysis?: PipelineAnalysis; previewOnly?: boolean };

function ReceivedData({ response: initialResponse, assetId, transferProcessId }: { response: FetchedResponse; assetId: string; transferProcessId: string }) {
  const [response, setResponse] = useState(initialResponse);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const pendingData = useRef<Promise<void> | null>(null);
  const loadedResponse = useRef(initialResponse);
  const ensureData = () => {
    if (!loadedResponse.current.previewOnly) return Promise.resolve();
    if (pendingData.current) return pendingData.current;
    setDataLoading(true); setDataError("");
    const operation = (async () => {
      try {
        const result = await fetch("/connector/data-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transferProcessId, format: initialResponse.analysis!.meta.format, schema: initialResponse.analysis!.schema }), cache: "no-store" });
        if (!result.ok) { const error = await result.json(); throw new Error(error.error || "Could not load data."); }
        const body = await result.text();
        const full = { ...initialResponse, body, contentType: result.headers.get("content-type") || initialResponse.contentType, bytes: new TextEncoder().encode(body).length, previewOnly: false };
        loadedResponse.current = full; setResponse(full);
      } catch (error) { setDataError(error instanceof Error ? error.message : "Could not load data."); throw error; }
      finally { setDataLoading(false); pendingData.current = null; }
    })();
    pendingData.current = operation;
    return operation;
  };
  const { translator } = useTranslator();
  const parsed = useMemo<ParsedPreview>(() => {
    if (response.status < 200 || response.status >= 300) return { candidates: [], warnings: [] };
    try { return parsePreview(response.body, response.contentType); }
    catch (error) { return { candidates: [], warnings: [error instanceof Error ? error.message : "Could not interpret this response as a table."] }; }
  }, [response]);
  const schemaPath = response.analysis?.schema.source.json_record_path;
  const preferredPath = schemaPath ? "/" + schemaPath.split(".").join("/") : "";
  const [path, setPath] = useState(parsed.candidates.find(c => c.path === preferredPath)?.path || parsed.candidates[0]?.path || "");
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const candidate = parsed.candidates.find((item) => item.path === path) || parsed.candidates.find(item => item.path === preferredPath) || parsed.candidates[0];
  const dataset = useMemo(() => candidate ? normalizeDataset(candidate, assetId) : undefined, [candidate, assetId]);
  const raw = <DataPreview state={{ kind: "response", response: candidate ? { ...response, body: JSON.stringify(candidate.values, null, 2), contentType: "application/json" } : response }} />;
  const download = jsonDownload(response.body, assetId, response.source === "saved");
  const downloadJson = async () => {
    try { await ensureData(); } catch { return; }
    const download = jsonDownload(loadedResponse.current.body, assetId, response.source === "saved");
    if (!download) return;
    const url = URL.createObjectURL(new Blob([download.body], { type: download.type }));
    const link = document.createElement("a");
    link.href = url; link.download = download.filename;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportFile = async (format: string) => {
    setBusy(true); setDownloadError("");
    try {
      const result = await fetch("/connector/data-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transferProcessId, format, schema: response.analysis?.schema }) });
      if (!result.ok) { const error = await result.json(); throw new Error(error.error || "Download failed."); }
      const url = URL.createObjectURL(await result.blob()); const link = document.createElement("a");
      link.href = url; link.download = /filename="([^"]+)"/.exec(result.headers.get("content-disposition") || "")?.[1] || `dataset.${format}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      const warning = result.headers.get("x-export-warning"); if (warning) setDownloadError(warning);
    } catch (error) { setDownloadError(error instanceof Error ? error.message : "Download failed."); } finally { setBusy(false); }
  };
  const options = [
    { label: "Original JSON", action: downloadJson, disabled: !download || response.status >= 300 },
    ...(response.analysis ? [...new Set(["csv", "tsv", "json", "parquet", ...(response.analysis.meta.excel_allowed ? ["xlsx"] : []), ...(response.analysis.meta.container === "zip" ? ["zip"] : []), response.analysis.meta.format])].map(format => ({ label: `${format.toUpperCase()}`, action: () => void exportFile(format), disabled: busy })) : []),
  ];
  const meaningfulCandidates = parsed.candidates.filter(c => !/\/(fields|columns)$/.test(c.path));
  return (
    <div className="space-y-3">
      {response.source === "saved" && <Alert severity="warning"><T string="dataPreview.savedNotice" /></Alert>}
      {response.analysis?.meta.partial_warning && <Alert severity="warning">Partial dataset: this preview contains only the records received from the provider.</Alert>}
      {dataError && <Alert severity="error" action={<Button onClick={() => void ensureData().catch(() => {})}>Retry</Button>}>{dataError}</Alert>}
      {busy && <p role="status" className="text-sm">Preparing download from the provider…</p>}
      {downloadError && <Alert severity="warning">{downloadError}</Alert>}
      <details className="rounded border border-gray-200 p-3 text-xs text-gray-500"><summary className="cursor-pointer">Technical details</summary>
        <dl className="mt-3 flex flex-wrap gap-4">
          {[["Asset ID", assetId], ["Transfer ID", transferProcessId], ["HTTP status", `${response.status} ${response.statusText}`], ["Content-Type", response.contentType], ["Retrieved at (UTC)", response.fetchedAt], ["Received", `${(response.bytes / 1024).toFixed(1)} KiB`], ["Source", response.addressSource]].map(([key,value]) => <div key={key}><dt>{key}</dt><dd className="break-all">{value}</dd></div>)}
        </dl>
        {response.analysis && <dl className="mt-3 flex flex-wrap gap-4"><div><dt>Missing cells</dt><dd>{response.analysis.health.missing_cells} / {response.analysis.health.total_cells}</dd></div><div><dt>Analysed at</dt><dd>{response.analysis.meta.generated_at}</dd></div></dl>}
      </details>
      {response.status >= 500 && <Alert severity="error">The data provider returned HTTP {response.status}. The provider was reached, but could not deliver the data. Retry later.</Alert>}
      {response.status === 401 || response.status === 403 ? <Alert severity="warning"><T string="datasetExplorer.authFailed" /></Alert> : null}
      {parsed.warnings.filter(w => !w.includes("pagination metadata")).map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
      {meaningfulCandidates.length > 1 && <TextField select fullWidth size="small" color="secondary" label={translator("datasetExplorer.arrayPath")} value={path} onChange={(event) => setPath(event.target.value)}>
        {meaningfulCandidates.map((item) => <MenuItem key={item.path} value={item.path}>{item.path} ({item.values.length} rows)</MenuItem>)}
      </TextField>}
      {dataset && dataset.columns.length ? <DatasetExplorer dataset={dataset} rawResponse={raw} saved={response.source === "saved"} downloadOptions={options} analysis={response.analysis} previewOnly={!!response.previewOnly} dataLoading={dataLoading} ensureData={ensureData} /> : <><Button color="secondary" onClick={e => setMenu(e.currentTarget)}>Download ▾</Button><Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>{options.map(o => <MenuItem key={o.label} disabled={o.disabled} onClick={() => { setMenu(null); o.action(); }}>{o.label}</MenuItem>)}</Menu>{raw}</>}
    </div>
  );
}

function PreviewRequest({ transferProcessId, assetId, saved }: { transferProcessId: string; assetId: string; saved: boolean }) {
  const [state, setState] = useState<DataPreviewState>({ kind: "loading" });
  const [received, setReceived] = useState<FetchedResponse>();
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await fetch(saved ? "/connector/data-preview/sample" : "/connector/data-preview", {
          method: saved ? "GET" : "POST", headers: { "Content-Type": "application/json" },
          body: saved ? undefined : JSON.stringify({ transferProcessId }), signal: controller.signal, cache: "no-store",
        });
        const payload = await result.json();
        if (!result.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Data preview request failed.");
        if (typeof payload.body !== "string" || typeof payload.status !== "number" || typeof payload.contentType !== "string") throw new Error("The preview server returned an invalid response.");
        if (!controller.signal.aborted) setReceived(payload);
      } catch (error) {
        if (!controller.signal.aborted) setState({ kind: "error", message: error instanceof Error ? error.message : "Data preview request failed." });
      }
    }
    void load();
    return () => controller.abort();
  }, [transferProcessId, saved]);
  return received ? <ReceivedData response={received} assetId={assetId} transferProcessId={transferProcessId} /> : <DataPreview state={state} />;
}

interface DataPreviewDialogProps {
  assetId: string;
  transferProcessId: string;
  onClose: () => void;
  saved?: boolean;
  title?: string;
}

export function DataPreviewDialog({ assetId, transferProcessId, onClose, saved = false, title }: DataPreviewDialogProps) {
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <Dialog open fullWidth maxWidth={false} fullScreen={expanded}
      sx={{ "& .MuiDialog-paper": { width: expanded ? "100%" : "94vw", maxWidth: expanded ? "none" : 1600, height: expanded ? "100%" : "92vh", m: expanded ? 0 : 1 } }}
      onClose={onClose} aria-labelledby="data-preview-title" data-testid="data-preview-dialog">
      <DialogTitle id="data-preview-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{title || <T string={saved ? "dataPreview.savedTitle" : "dataPreview.title"} />}</span>
          <div>
            <Button color="secondary" size="small" onClick={() => setAttempt((value) => value + 1)}><T string="datasetExplorer.reload" /></Button>
            <Button color="secondary" size="small" onClick={() => setExpanded((value) => !value)} aria-pressed={expanded}><T string={expanded ? "datasetExplorer.restore" : "datasetExplorer.expand"} /></Button>
          </div>
        </div>
      </DialogTitle>
      <DialogContent>
        <div className="space-y-4">
          <PreviewRequest key={`${transferProcessId}-${attempt}-${saved}`} transferProcessId={transferProcessId} assetId={assetId} saved={saved} />
        </div>
      </DialogContent>
      <DialogActions><Button color="secondary" onClick={onClose}><T string="common.close" /></Button></DialogActions>
    </Dialog>
  );
}
