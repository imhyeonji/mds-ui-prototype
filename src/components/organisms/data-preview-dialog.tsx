import { DataPreview, type DataPreviewResponse, type DataPreviewState } from "@/components/molecules/data-preview";
import { DatasetExplorer } from "@/components/organisms/dataset-explorer";
import { normalizeDataset, parsePreview, type ParsedPreview } from "@/utilities/normalize-preview";
import { T, useTranslator } from "@/i18n";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { jsonDownload } from "@/utilities/preview-download";

type FetchedResponse = DataPreviewResponse & { fetchedAt: string; bytes: number; addressSource: string; source?: "saved" };

function ReceivedData({ response, assetId }: { response: FetchedResponse; assetId: string }) {
  const { translator } = useTranslator();
  const parsed = useMemo<ParsedPreview>(() => {
    if (response.status < 200 || response.status >= 300) return { candidates: [], warnings: [] };
    try { return parsePreview(response.body, response.contentType); }
    catch (error) { return { candidates: [], warnings: [error instanceof Error ? error.message : "Could not interpret this response as a table."] }; }
  }, [response]);
  const [path, setPath] = useState(parsed.candidates[0]?.path || "");
  const candidate = parsed.candidates.find((item) => item.path === path);
  const dataset = useMemo(() => candidate ? normalizeDataset(candidate, assetId) : undefined, [candidate, assetId]);
  const raw = <DataPreview state={{ kind: "response", response }} />;
  const download = jsonDownload(response.body, assetId, response.source === "saved");
  const downloadJson = () => {
    if (!download) return;
    const url = URL.createObjectURL(new Blob([download.body], { type: download.type }));
    const link = document.createElement("a");
    link.href = url; link.download = download.filename;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Alert severity={response.source === "saved" ? "warning" : "info"}>
          <T string={response.source === "saved" ? "dataPreview.savedNotice" : "dataPreview.liveNotice"} />
        </Alert>
        <Button variant="outlined" color="secondary" onClick={downloadJson} disabled={!download || response.status < 200 || response.status >= 300} data-testid="download-preview-json">
          <T string="dataPreview.downloadJson" />
        </Button>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div><dt className="font-semibold">HTTP status</dt><dd>{response.status} {response.statusText}</dd></div>
        <div><dt className="font-semibold">Content-Type</dt><dd>{response.contentType || "Not provided"}</dd></div>
        <div><dt className="font-semibold"><T string={response.source === "saved" ? "dataPreview.capturedAt" : "datasetExplorer.fetchedAt"} /></dt><dd>{response.fetchedAt}</dd></div>
        <div><dt className="font-semibold"><T string="datasetExplorer.received" /></dt><dd>{(response.bytes / 1024).toFixed(1)} KiB</dd></div>
      </dl>
      <Alert severity="info"><T string="datasetExplorer.loadedOnly" /></Alert>
      {response.status >= 500 && <Alert severity="error">The data provider returned HTTP {response.status}. The provider was reached, but could not deliver the data. Retry later.</Alert>}
      {response.status === 401 || response.status === 403 ? <Alert severity="warning"><T string="datasetExplorer.authFailed" /></Alert> : null}
      {parsed.warnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
      {parsed.candidates.length > 1 && <TextField select fullWidth size="small" color="secondary" label={translator("datasetExplorer.arrayPath")} value={path} onChange={(event) => setPath(event.target.value)}>
        {parsed.candidates.map((item) => <MenuItem key={item.path} value={item.path}>{item.path} ({item.values.length} rows)</MenuItem>)}
      </TextField>}
      {dataset && dataset.columns.length ? <DatasetExplorer key={path} dataset={dataset} rawResponse={raw} saved={response.source === "saved"} /> : raw}
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
  return received ? <ReceivedData response={received} assetId={assetId} /> : <DataPreview state={state} />;
}

interface DataPreviewDialogProps {
  assetId: string;
  transferProcessId: string;
  onClose: () => void;
  saved?: boolean;
}

export function DataPreviewDialog({ assetId, transferProcessId, onClose, saved = false }: DataPreviewDialogProps) {
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <Dialog open fullWidth maxWidth={false} fullScreen={expanded}
      sx={{ "& .MuiDialog-paper": { width: expanded ? "100%" : "94vw", maxWidth: expanded ? "none" : 1600, height: expanded ? "100%" : "92vh", m: expanded ? 0 : 1 } }}
      onClose={onClose} aria-labelledby="data-preview-title" data-testid="data-preview-dialog">
      <DialogTitle id="data-preview-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span><T string={saved ? "dataPreview.savedTitle" : "dataPreview.title"} /></span>
          <div>
            <Button color="secondary" size="small" onClick={() => setAttempt((value) => value + 1)}><T string="datasetExplorer.reload" /></Button>
            <Button color="secondary" size="small" onClick={() => setExpanded((value) => !value)} aria-pressed={expanded}><T string={expanded ? "datasetExplorer.restore" : "datasetExplorer.expand"} /></Button>
          </div>
        </div>
      </DialogTitle>
      <DialogContent>
        <div className="space-y-4">
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs break-all text-gray-500">
            <div><dt className="font-semibold"><T string="transferProcesses.headingAsset" /></dt><dd>{assetId}</dd></div>
            {!saved && <div><dt className="font-semibold"><T string="dataPreview.transferId" /></dt><dd>{transferProcessId}</dd></div>}
          </dl>
          <PreviewRequest key={`${transferProcessId}-${attempt}-${saved}`} transferProcessId={transferProcessId} assetId={assetId} saved={saved} />
        </div>
      </DialogContent>
      <DialogActions><Button color="secondary" onClick={onClose}><T string="common.close" /></Button></DialogActions>
    </Dialog>
  );
}
