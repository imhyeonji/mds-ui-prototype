import { useState } from "react";
import { Alert, Button, Card, CardActionArea, CardContent, MenuItem, TextField } from "@mui/material";
import { Dataset } from "@think-it-labs/edc-connector-client";
import { ContractOffersList } from "@think-it-labs/edc-connector-ui/contract-offers-list";
import { useListContext } from "@think-it-labs/edc-connector-ui/list";
import { MAX_ITEMS } from "@/constants/lists";
import { T, useTranslator } from "@/i18n";
import { catalogMetadata, matchesCatalogFilters } from "@/utilities/catalog-metadata";
import { CatalogMetadataSummary } from "@/components/molecules/catalog-metadata-summary";

export function CatalogResults({ participantId, onSelect }: { participantId: string; onSelect: (dataset: Dataset) => void }) {
  const { items, isLoading, errors } = useListContext<Dataset>();
  const { translator } = useTranslator();
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("");
  const loaded = items.slice(0, MAX_ITEMS).map((item) => catalogMetadata(item, participantId));
  const formats = [...new Set(loaded.flatMap((item) => [item.format, ...item.methods]).filter(Boolean))].sort();
  const visible = loaded.filter((item) => matchesCatalogFilters(item, query, format)).length;
  return <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <details open>
        <summary className="cursor-pointer font-semibold text-gray-900"><T string="catalog.refinePage" /></summary>
        <div className="mt-4 space-y-4">
          <TextField fullWidth size="small" color="secondary" label={translator("catalog.localSearch")} value={query} onChange={(event) => setQuery(event.target.value)} />
          <TextField select fullWidth size="small" color="secondary" label={translator("catalog.formatOrMethod")} value={format} onChange={(event) => setFormat(event.target.value)}>
            <MenuItem value=""><T string="catalog.allFormats" /></MenuItem>
            {[...new Set([...formats, ...(format ? [format] : [])])].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <Button color="secondary" size="small" disabled={!query && !format} onClick={() => { setQuery(""); setFormat(""); }}><T string="catalog.clearFilters" /></Button>
        </div>
      </details>
    </aside>
    <section className="min-w-0 space-y-4" data-testid="catalog-list" aria-busy={isLoading}>
      {errors?.length ? <Alert severity="error"><T string="common.catalogLoadError" /></Alert> : !isLoading && <p className="text-sm text-gray-500" aria-live="polite">{visible} / {loaded.length} <T string="catalog.loadedResults" /></p>}
      {!isLoading && !errors?.length && visible === 0 && <Alert severity="info"><T string={loaded.length ? "catalog.noFilterMatches" : "catalog.noResults"} /></Alert>}
      <ContractOffersList.Items limit={MAX_ITEMS}>
        {({ item }) => {
          const metadata = catalogMetadata(item, participantId);
          if (!matchesCatalogFilters(metadata, query, format)) return <></>;
          return <Card key={metadata.id} variant="outlined" sx={{ borderRadius: 3 }} data-testid="catalog-item">
            <CardActionArea onClick={() => onSelect(item)} aria-label={`View details: ${metadata.title || metadata.id}`}>
              <CardContent className="space-y-4 !p-5 sm:!p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-2 text-xs font-medium text-gray-500 break-all">{metadata.provider || translator("catalog.notProvided")}</p>
                    <h2 className="text-xl font-semibold tracking-tight text-gray-900 break-words" data-testid="asset-title">{metadata.title || metadata.id}</h2>
                    <p className="mt-1 text-xs text-gray-400 break-all">{metadata.id}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-gray-600" aria-hidden="true">↗</span>
                </div>
                <p className="line-clamp-3 text-sm leading-6 text-gray-600">{metadata.description || translator("catalog.noDescription")}</p>
                <div className="border-t border-gray-100 pt-4"><CatalogMetadataSummary dataset={item} participantId={participantId} /></div>
                <p className="text-sm font-medium text-gray-900"><T string="catalog.viewDetails" /> →</p>
              </CardContent>
            </CardActionArea>
          </Card>;
        }}
      </ContractOffersList.Items>
      <ContractOffersList.Loading><p role="status" className="py-12 text-center text-gray-500"><T string="catalog.loading" /></p></ContractOffersList.Loading>
    </section>
  </div>;
}
