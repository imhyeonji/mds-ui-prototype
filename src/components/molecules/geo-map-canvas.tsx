import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { ExploreGeo } from "@/utilities/explore-types";
import { formatCount, leafletBounds, markerRadius, maxCountOf } from "@/utilities/geo-map";

const MARKER_COLOR = "#2563eb";
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export interface GeoMapLabels {
  row: (row: string) => string;
  standsFor: (count: string) => string;
  mapLabel: string;
}

/**
 * The Leaflet map itself. Loaded only in the browser and only when the Map tab opens (see explore-map-tab.tsx),
 * so Leaflet's ~40 KB never slow down the preview window itself.
 */
export default function GeoMapCanvas({ geo, labels }: { geo: ExploreGeo; labels: GeoMapLabels }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    // Canvas draws all points as one image; thousands of separate DOM markers would be slow.
    const map = L.map(container.current, { preferCanvas: true, worldCopyJump: true });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

    const maxCount = maxCountOf(geo);
    for (const [lat, lon, row, count] of geo.points) {
      const tooltip = count > 1
        ? `${labels.row(formatCount(row + 1))}<br>${labels.standsFor(formatCount(count))}`
        : labels.row(formatCount(row + 1));
      L.circleMarker([lat, lon], {
        radius: markerRadius(count, maxCount), color: "#ffffff", weight: 1, fillColor: MARKER_COLOR, fillOpacity: 0.7,
      }).bindTooltip(tooltip).addTo(map);
    }

    // A single location has zero-size bounds; give it a sensible street-level zoom instead.
    const bounds = L.latLngBounds(leafletBounds(geo));
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) map.setView(bounds.getCenter(), 16);
    else map.fitBounds(bounds, { padding: [24, 24] });

    // The dialog may still be resizing when the map mounts; re-measure once the layout settles.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [geo, labels]);

  return <div ref={container} className="h-[420px] w-full rounded-lg border border-gray-200" role="region" aria-label={labels.mapLabel} />;
}
