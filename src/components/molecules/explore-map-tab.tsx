import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { T, useTranslator } from "@/i18n";
import type { ExploreGeo, GeoRegion } from "@/utilities/explore-types";
import { formatCount } from "@/utilities/geo-map";
import { Alert, Chip } from "@mui/material";
import dynamic from "next/dynamic";
import { useMemo } from "react";

// Leaflet needs `window`, and it is only downloaded when someone opens this tab.
const GeoMapCanvas = dynamic(() => import("@/components/molecules/geo-map-canvas"), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center"><LoadingSpinner /></div>,
});

const countryName = (code: string | null) => {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

const regionName = (region: GeoRegion) =>
  [region.city, countryName(region.country_code)].filter(Boolean).join(", ") || "—";

const formatPct = (pct: number) => `${pct < 0.1 && pct > 0 ? "<0.1" : pct.toLocaleString("en", { maximumFractionDigits: 1 })}%`;

/** Where the rows are: the pipeline's region list, largest first. */
function RegionList({ regions, total }: { regions: NonNullable<ExploreGeo["regions"]>; total: number }) {
  const { translator } = useTranslator();
  if (!regions.items.length) return null;
  return (
    <section aria-labelledby="map-regions-title" data-testid="map-regions" className="space-y-2">
      <h3 id="map-regions-title" className="text-sm font-semibold"><T string="explorePreview.mapRegions" /></h3>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {regions.items.map((region) => (
          <li key={`${region.city}-${region.admin1}-${region.country_code}`}>
            <Chip size="small" variant="outlined" label={<><span>{regionName(region)}</span> <span className="tabular-nums text-gray-500">· {formatPct(region.pct)}</span></>}
              title={[region.admin1, `${formatCount(region.count)} ${translator("explorePreview.mapRows")}`].filter(Boolean).join(" · ")} />
          </li>
        ))}
        {regions.other_count > 0 && (
          <li>
            <Chip size="small" variant="outlined" label={<><span><T string="explorePreview.mapRegionsOther" /></span> <span className="tabular-nums text-gray-500">· {formatPct(Math.round(regions.other_count / total * 1000) / 10)}</span></>}
              title={`${formatCount(regions.other_count)} ${translator("explorePreview.mapRows")}`} />
          </li>
        )}
      </ul>
      <p className="m-0 text-xs text-gray-500"><T string="explorePreview.mapRegionsNote" /></p>
    </section>
  );
}

/** The Map tab of the data preview: where the dataset's rows are located. */
export function ExploreMapTab({ geo }: { geo: ExploreGeo }) {
  const { translator } = useTranslator();
  // Stable labels so the map isn't rebuilt on every render.
  const labels = useMemo(() => ({
    row: (row: string) => `${translator("explorePreview.mapRow")} ${row}`,
    standsFor: (count: string) => `${count} ${translator("explorePreview.mapRowsHere")}`,
    mapLabel: translator("explorePreview.mapLabel"),
  }), [translator]);

  return (
    <div className="space-y-3 p-5" data-testid="explore-map">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-gray-600">
        {geo.lat_column && geo.lon_column
          ? <span><T string="explorePreview.mapColumns" /> <code>{geo.lat_column}</code> / <code>{geo.lon_column}</code></span>
          : <span><T string="explorePreview.mapGeojson" /></span>}
        <span className="tabular-nums" data-testid="map-point-count">
          {geo.sampled
            ? <>{translator("explorePreview.mapShowing")} {formatCount(geo.point_count)} {translator("explorePreview.mapOf")} {formatCount(geo.total_valid)} {translator("explorePreview.mapPoints")}</>
            : <>{formatCount(geo.point_count)} {translator("explorePreview.mapPoints")}</>}
        </span>
      </div>
      {geo.regions && <RegionList regions={geo.regions} total={geo.total_valid} />}
      {geo.sampled && <Alert severity="info"><T string="explorePreview.mapSampled" /></Alert>}
      <GeoMapCanvas geo={geo} labels={labels} />
    </div>
  );
}
