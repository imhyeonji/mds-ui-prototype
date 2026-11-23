import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { T, useTranslator } from "@/i18n";
import type { ExploreGeo } from "@/utilities/explore-types";
import { formatCount } from "@/utilities/geo-map";
import { Alert } from "@mui/material";
import dynamic from "next/dynamic";
import { useMemo } from "react";

// Leaflet needs `window`, and it is only downloaded when someone opens this tab.
const GeoMapCanvas = dynamic(() => import("@/components/molecules/geo-map-canvas"), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center"><LoadingSpinner /></div>,
});

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
      {geo.sampled && <Alert severity="info"><T string="explorePreview.mapSampled" /></Alert>}
      <GeoMapCanvas geo={geo} labels={labels} />
    </div>
  );
}
