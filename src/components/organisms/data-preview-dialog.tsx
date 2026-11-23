import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { ExploreChartsTab } from "@/components/molecules/explore-charts-tab";
import { ExploreColumnsTab } from "@/components/molecules/explore-columns-tab";
import { ExploreDataTab } from "@/components/molecules/explore-data-tab";
import { ExploreMapTab } from "@/components/molecules/explore-map-tab";
import { T, useTranslator } from "@/i18n";
import { downloadFormats, viewOf, type ExploreResponse } from "@/utilities/explore-types";
import { geoOf } from "@/utilities/geo-map";
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Menu, MenuItem, Tab, Tabs, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; summary: ExploreResponse };

function filenameFrom(disposition: string | null, fallback: string) {
  const match = /filename="?([^";]+)"?/i.exec(disposition || "");
  return match?.[1] || fallback;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="font-semibold"><T string={label} /></dt><dd>{children}</dd></div>;
}

function DownloadMenu({ summary, transferProcessId, disabled }: { summary: ExploreResponse; transferProcessId: string; disabled: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<{ severity: "warning" | "error"; message: string }>();

  async function download(format: string) {
    setAnchor(null); setBusy(format); setNotice(undefined);
    try {
      const response = await fetch("/connector/data-preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ transferProcessId, format, schema: summary.schema }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === "string" ? payload.error : "The download failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filenameFrom(response.headers.get("Content-Disposition"), `${summary.meta.asset_id}.${format}`);
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const warning = response.headers.get("X-Export-Warning");
      if (warning) setNotice({ severity: "warning", message: warning });
    } catch (error) {
      setNotice({ severity: "error", message: error instanceof Error ? error.message : "The download failed." });
    } finally { setBusy(undefined); }
  }

  const original = (format: string) => format === summary.meta.format || format === "zip";
  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="outlined" color="secondary" disabled={disabled || !!busy} onClick={(event) => setAnchor(event.currentTarget)} aria-haspopup="menu" aria-expanded={!!anchor} data-testid="download-menu">
        {busy ? <><T string="explorePreview.downloading" /> {busy.toUpperCase()}…</> : <T string="explorePreview.download" />}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {downloadFormats(summary).map((format) => <MenuItem key={format} onClick={() => void download(format)}>
          {format.toUpperCase()}{original(format) && <span className="ml-2 text-xs text-gray-500"><T string="explorePreview.original" /></span>}
        </MenuItem>)}
      </Menu>
      {disabled && <span className="text-xs text-gray-500"><T string="explorePreview.downloadSaved" /></span>}
      {notice && <Alert severity={notice.severity} onClose={() => setNotice(undefined)}>{notice.message}</Alert>}
    </div>
  );
}

function Summary({ summary, transferProcessId, saved }: { summary: ExploreResponse; transferProcessId: string; saved: boolean }) {
  const { translator } = useTranslator();
  const [tab, setTab] = useState("data");
  const [raw, setRaw] = useState(false);
  const view = viewOf(summary, raw);
  const { meta, health } = summary;
  // The Map tab exists only when the pipeline found coordinates. There is no raw.geo, so it ignores the raw toggle.
  const geo = geoOf(summary);
  const tabs = geo ? ["data", "charts", "columns", "map"] : ["data", "charts", "columns"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Fact label="explorePreview.rows">{meta.rows.toLocaleString("en")}</Fact>
          <Fact label="explorePreview.cols">{meta.cols}</Fact>
          <Fact label="explorePreview.format">{meta.format.toUpperCase()}{meta.container ? ` (${meta.container.toUpperCase()})` : ""}</Fact>
          <Fact label="explorePreview.pages">{meta.pages}</Fact>
          <Fact label="explorePreview.missing">{health.missing_pct}% ({health.missing_cells.toLocaleString("en")} / {health.total_cells.toLocaleString("en")})</Fact>
          <Fact label="explorePreview.generatedAt">{meta.generated_at}</Fact>
        </dl>
        <DownloadMenu summary={summary} transferProcessId={transferProcessId} disabled={saved} />
      </div>
      {saved && <Alert severity="warning"><T string="explorePreview.savedNotice" /></Alert>}
      {meta.partial_warning && <Alert severity="warning"><T string="explorePreview.partial" /></Alert>}
      {meta.excluded_columns.length > 0 && <Alert severity="info"><T string="explorePreview.excluded" /> {meta.excluded_columns.join(", ")}</Alert>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-2">
          <Tabs value={tab} onChange={(_, value: string) => setTab(value)} textColor="secondary" indicatorColor="secondary" variant="scrollable" aria-label={translator("explorePreview.views")}>
            {tabs.map((item) => <Tab key={item} value={item} id={`explore-tab-${item}`} aria-controls={`explore-panel-${item}`} label={translator(`explorePreview.tab_${item}`)} />)}
          </Tabs>
          <ToggleButtonGroup size="small" exclusive value={raw ? "raw" : "normalized"} onChange={(_, value: string | null) => { if (value) setRaw(value === "raw"); }} aria-label={translator("explorePreview.viewMode")}
            sx={{ mr: 1, "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover": { bgcolor: "primary.main", color: "#000" } }}>
            <ToggleButton value="normalized"><T string="explorePreview.normalized" /></ToggleButton>
            <ToggleButton value="raw" disabled={!summary.raw}><T string="explorePreview.raw" /></ToggleButton>
          </ToggleButtonGroup>
        </div>
        {raw && summary.raw && <Alert severity="info" sx={{ m: 2, mb: 0 }}>{summary.raw.info.note}</Alert>}
        <div role="tabpanel" id={`explore-panel-${tab}`} aria-labelledby={`explore-tab-${tab}`}>
          {tab === "data" ? <ExploreDataTab key={String(raw)} view={view} totalRows={meta.rows} />
            : tab === "charts" ? <ExploreChartsTab view={view} />
            : tab === "map" && geo ? <ExploreMapTab geo={geo} />
            : <ExploreColumnsTab view={view} />}
        </div>
      </div>
    </div>
  );
}

function ExploreRequest({ transferProcessId, saved }: { transferProcessId: string; saved: boolean }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await fetch(saved ? "/connector/data-preview/sample" : "/connector/data-preview", {
          method: saved ? "GET" : "POST", headers: { "Content-Type": "application/json" },
          body: saved ? undefined : JSON.stringify({ transferProcessId }), signal: controller.signal, cache: "no-store",
        });
        const payload = await result.json().catch(() => ({}));
        if (!result.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The dataset summary request failed.");
        // Live route nests the explore summary under `analysis`; the saved sample is the summary itself.
        const summary = payload?.analysis ?? payload;
        if (!summary?.meta || !summary?.info || !summary?.schema) throw new Error("The pipelines returned an invalid summary.");
        if (!controller.signal.aborted) setState({ kind: "ready", summary });
      } catch (error) {
        if (!controller.signal.aborted) setState({ kind: "error", message: error instanceof Error ? error.message : "The dataset summary request failed." });
      }
    }
    void load();
    return () => controller.abort();
  }, [transferProcessId, saved]);

  if (state.kind === "loading") return <div className="flex flex-col items-center gap-3 py-16"><LoadingSpinner /><p className="text-sm text-gray-500"><T string="explorePreview.loading" /></p></div>;
  if (state.kind === "error") return <Alert severity="error">{state.message}</Alert>;
  return <Summary summary={state.summary} transferProcessId={transferProcessId} saved={saved} />;
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
          <ExploreRequest key={`${transferProcessId}-${attempt}-${saved}`} transferProcessId={transferProcessId} saved={saved} />
        </div>
      </DialogContent>
      <DialogActions><Button color="secondary" onClick={onClose}><T string="common.close" /></Button></DialogActions>
    </Dialog>
  );
}
