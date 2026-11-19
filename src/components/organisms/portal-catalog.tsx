import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import { assessPortalOffer } from "@/domain/metadata-quality/portal-offer";
import { useTranslator } from "@/i18n";
import snapshot from "@/data/portal-catalog-snapshot.json";
import { categoryLabel, filterPortalOffers, resolvePortalDataset, type PortalOffer } from "@/utilities/portal-catalog";

import DataOfferDialog from "@/components/organisms/data-offer-dialog";
import { proxyConnectorManagement } from "@/constants/proxy";
import { useEdcConnectorClient } from "@think-it-labs/edc-connector-ui/use-edc-connector";
import { Dataset } from "@think-it-labs/edc-connector-client";
import { counterPartyAddressWithDsp2025_1 } from "@/utilities/catalog";

import { catalogStatusKey, type CatalogStatus } from "@/utilities/catalog-status";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";

const offers: PortalOffer[] = snapshot.dataOffers;
const organizations = [...new Map(offers.map((offer) => [offer.organizationId, offer.organizationName])).entries()];
const categories = [...new Set(offers.map((offer) => offer.dataCategory).filter(Boolean))];

const QUALITY_RING_SIZE = 16;

/** The offer's metadata quality score on its card: a small ring, the score out of 100 and its band. */
function QualityScore({ offer }: { offer: PortalOffer }) {
  const { translator } = useTranslator();
  const { score, band } = assessPortalOffer(offer);
  const title = translator("assets.metadataQuality.title");
  const bandLabel = translator(`assets.metadataQuality.bands.${band}`);
  return <span className="inline-flex items-center gap-1.5 text-gray-600" data-testid="portal-offer-quality" data-score={score} data-band={band} aria-label={`${title}: ${score}/100, ${bandLabel}`}>
    <Box component="span" aria-hidden sx={{ position: "relative", display: "inline-flex", width: QUALITY_RING_SIZE, height: QUALITY_RING_SIZE }}>
      <CircularProgress variant="determinate" value={100} size={QUALITY_RING_SIZE} thickness={6} sx={{ color: "grey.300", position: "absolute" }} />
      <CircularProgress variant="determinate" value={score} size={QUALITY_RING_SIZE} thickness={6} sx={{ color: "secondary.main", position: "absolute" }} />
    </Box>
    <span aria-hidden>{title} <b className="text-gray-900">{score}</b>/100 · {bandLabel}</span>
  </span>;
}

export function PortalCatalog() {
  const [statuses, setStatuses] = useState<Record<string, CatalogStatus>>({});
  const [statusError, setStatusError] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusRevision, setStatusRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatusLoading(true);
    setStatusError(false);
    setStatuses({});
    fetch("/connector/catalog-status", { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { setStatuses(data.statuses); })
      .catch(() => { if (!controller.signal.aborted) setStatusError(true); })
      .finally(() => { if (!controller.signal.aborted) setStatusLoading(false); });
    return () => controller.abort();
  }, [statusRevision]);
  const statusBadge = (offer: PortalOffer) => {
    const status = statuses[catalogStatusKey(offer.connectorId, offer.assetId)];
    return status ? <Chip size="small" icon={status === "contract" ? <CheckCircleOutlineIcon /> : <ScheduleIcon />} label={status === "contract" ? "Contract available" : "Request in progress"} sx={{ fontWeight: 700, bgcolor: status === "contract" ? "#dcfce7" : "#fef3c7", color: status === "contract" ? "#166534" : "#92400e", "& .MuiChip-icon": { color: "inherit" } }} /> : null;
  };
  const client = useEdcConnectorClient({ management: proxyConnectorManagement });
  const requestId = useRef(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [liveOffer, setLiveOffer] = useState<{ dataset: Dataset; participantId: string; endpoint: string } | null>(null);
  const closeDetails = () => { requestId.current += 1; setSelected(null); setLoading(false); setLoadError(""); };
  const loadCurrentOffer = async (offer: PortalOffer) => {
    if (!offer.connectorEndpoint) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setLoadError("");
    try {
      const endpoint = counterPartyAddressWithDsp2025_1(offer.connectorEndpoint);
      const catalog = await client.management.catalog.request({
        counterPartyId: offer.connectorId,
        counterPartyAddress: endpoint,
        querySpec: { offset: 0, limit: 100, filterExpression: [{ operandLeft: "id", operator: "=", operandRight: offer.assetId }] },
      });
      if (currentRequest !== requestId.current) return;
      const resolved = resolvePortalDataset(catalog, offer);
      if (!resolved.dataset) {
        setLoadError(resolved.error || "Current terms are unavailable.");
        return;
      }
      setLiveOffer({ dataset: resolved.dataset, participantId: resolved.participantId, endpoint });
      setSelected(null);
    } catch (error) {
      const providerUnavailable = error instanceof Error && /was 503:/.test(error.message);
      if (currentRequest === requestId.current) setLoadError(providerUnavailable
        ? `${offer.organizationName}'s server is temporarily unavailable (HTTP 503). Please try again later.`
        : "Could not retrieve current terms. The connector or provider could not complete the request. Please retry.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };
  const [query, setQuery] = useState("");
  const [organization, setOrganization] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("source");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PortalOffer | null>(null);
  const visible = filterPortalOffers(offers, query, organization, category, sort);
  const pageCount = Math.max(1, Math.ceil(visible.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const pageOffers = visible.slice(currentPage * 10, (currentPage + 1) * 10);
  const clear = () => { setQuery(""); setOrganization(""); setCategory(""); setPage(0); };

  return <div className="space-y-6" data-testid="portal-catalog">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Discover mobility data</h2>
      </div>
      <Chip size="small" label="Saved portal catalogue" variant="outlined" />
    </div>
    {statusError ? <Alert severity="warning" action={<Button color="inherit" onClick={() => setStatusRevision(v => v + 1)}>Retry</Button>}>Contract and request status could not be checked.</Alert> : <div className="flex items-center justify-between text-xs text-gray-500"><span aria-live="polite">{statusLoading ? "Checking your contracts and requests…" : ""}</span><Button size="small" color="secondary" disabled={statusLoading} onClick={() => setStatusRevision(v => v + 1)}>Refresh status</Button></div>}
    <div className="flex flex-wrap items-end gap-4">
      <TextField fullWidth color="secondary" label="Search datasets" placeholder="Title, provider, asset ID or description" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} sx={{ flex: "1 1 320px" }} />
      <TextField select color="secondary" label="Sort by" value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }} sx={{ minWidth: 190 }}>
        <MenuItem value="source">Saved catalogue order</MenuItem><MenuItem value="title">Title A–Z</MenuItem><MenuItem value="quality">Metadata quality: highest first</MenuItem>
      </TextField>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <details open>
          <summary className="cursor-pointer font-semibold text-gray-900">Filter datasets</summary>
          <div className="mt-5 space-y-5">
            <TextField select fullWidth size="small" color="secondary" label="Provider" value={organization} onChange={(event) => { setOrganization(event.target.value); setPage(0); }}>
              <MenuItem value="">All providers</MenuItem>
              {organizations.map(([id, title]) => <MenuItem key={id} value={id}>{title} ({offers.filter((offer) => offer.organizationId === id).length})</MenuItem>)}
            </TextField>
            <TextField select fullWidth size="small" color="secondary" label="Data category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }}>
              <MenuItem value="">All categories</MenuItem>
              {categories.map((value) => <MenuItem key={value} value={value}>{categoryLabel(value)}</MenuItem>)}
            </TextField>
            <Button color="secondary" size="small" onClick={clear} disabled={!query && !organization && !category}>Clear filters</Button>
          </div>
        </details>
      </aside>
      <section className="min-w-0 space-y-4" aria-label="Dataset results">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500" aria-live="polite">{visible.length} of {offers.length} saved datasets · Page {currentPage + 1} of {pageCount}</p>
          <div className="flex gap-2">
            <Button color="secondary" size="small" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <Button color="secondary" size="small" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
          </div>
        </div>
        {!visible.length && <Alert severity="info" action={<Button color="inherit" onClick={clear}>Clear filters</Button>}>No saved datasets match your search.</Alert>}
        {pageOffers.map((offer) => <Card key={`${offer.connectorId}:${offer.assetId}`} variant="outlined" sx={{ borderRadius: 3 }} data-testid="portal-offer">
          <CardActionArea onClick={() => { setLoadError(""); setSelected(offer); }} aria-label={`View details: ${offer.assetTitle || offer.assetId}`}>
            <CardContent className="space-y-2 !p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-600">{offer.organizationName}</p>
                <span className="text-xs text-gray-500">Provider at capture: {offer.connectorOnlineStatus.toLowerCase()}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold tracking-tight text-gray-900 break-words">{offer.assetTitle || offer.assetId}</h3>{statusBadge(offer)}</div>
              <p className="line-clamp-2 text-sm leading-5 text-gray-600">{offer.descriptionShortText.replaceAll("\\n", " ").replace(/\s+/g, " ") || "No description provided."}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-xs text-gray-500">
                {offer.dataCategory && <span>{categoryLabel(offer.dataCategory)}</span>}
                {offer.version && <span>Version {offer.version}</span>}
                {offer.assetDataSourceAvailability && <span>Source: {offer.assetDataSourceAvailability}</span>}
                <QualityScore offer={offer} />
                <span className="ml-auto font-medium text-gray-900">View details →</span>
              </div>
            </CardContent>
          </CardActionArea>
        </Card>)}
      </section>
    </div>
    <Dialog open={!!selected} onClose={closeDetails} fullWidth maxWidth="md" aria-labelledby="portal-offer-title">
      {selected && <>
        <DialogTitle id="portal-offer-title">{selected.assetTitle}</DialogTitle>
        <DialogContent className="space-y-5">
          <div className="flex flex-wrap gap-2"><Chip size="small" label="Saved portal metadata" />{statusBadge(selected)}</div>
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{selected.descriptionShortText.replaceAll("\\n", "\n")}</p>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[["Provider", selected.organizationName], ["Asset ID", selected.assetId], ["Connector ID", selected.connectorId], ["Category", categoryLabel(selected.dataCategory)], ["Data format / model", "Not included in this saved response"], ["Terms / transfer methods", "Retrieve from the provider's connector"]].map(([label, value]) => <div key={label}><dt className="font-medium text-gray-500">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>)}
          </dl>
        </DialogContent>
        {(loadError || loading) && <div className="shrink-0 border-t border-gray-200 px-6 py-3" data-testid="catalog-lookup-status">
          {loadError && <Alert severity="error" role="alert">{loadError}</Alert>}
          {loading && <Alert severity="info" role="status">Connecting to {selected.organizationName} and retrieving current terms…</Alert>}
        </div>}
        <DialogActions>
          <Button color="secondary" onClick={closeDetails}>Close</Button>
          <Button color="secondary" variant="outlined" disabled={loading || !selected.connectorEndpoint} onClick={() => void loadCurrentOffer(selected)}>{loading ? "Retrieving…" : loadError ? "Retry current terms" : "View current terms"}</Button>
        </DialogActions>
      </>}
    </Dialog>
    {liveOffer && <DataOfferDialog open dataset={liveOffer.dataset} participantId={liveOffer.participantId} counterPartyAddress={liveOffer.endpoint} assetIsOwned={false} onClose={() => { setLiveOffer(null); setStatusRevision(v => v + 1); }} onNegotiateSuccess={() => setStatusRevision(v => v + 1)} contentStyle={{ maxWidth: "90vw", width: "1000px" }} />}
  </div>;
}
