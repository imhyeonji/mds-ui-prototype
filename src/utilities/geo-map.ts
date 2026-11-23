import type { ExploreGeo, ExploreResponse } from "@/utilities/explore-types";

// Helpers for the data preview map. Points arrive cleaned and thinned by the pipeline, so nothing here re-filters them.

/** The geo block to plot, or null when the dataset has no usable coordinates (the map tab is then hidden). */
export function geoOf(summary: Pick<ExploreResponse, "geo">): ExploreGeo | null {
  const geo = summary.geo;
  return geo && Array.isArray(geo.points) && geo.points.length > 0 ? geo : null;
}

export const MARKER_RADIUS = { min: 4, max: 14 } as const;

/**
 * Marker radius in pixels. A point standing for more rows (`count`) gets a bigger circle.
 * The area grows with the count (square root), so a 400-row depot doesn't swallow the map.
 */
export function markerRadius(count: number, maxCount: number): number {
  const { min, max } = MARKER_RADIUS;
  if (!(maxCount > 1) || !(count > 1)) return min;
  const share = Math.sqrt(Math.min(count, maxCount) / maxCount);
  return Math.round((min + share * (max - min)) * 10) / 10;
}

export function maxCountOf(geo: ExploreGeo): number {
  return geo.points.reduce((max, point) => Math.max(max, point[3] ?? 1), 1);
}

/** Leaflet bounds as [[south, west], [north, east]]. Leaflet takes [lat, lng], the same order as the points. */
export function leafletBounds(geo: ExploreGeo): [[number, number], [number, number]] {
  const { min_lat, min_lon, max_lat, max_lon } = geo.bounds;
  return [[min_lat, min_lon], [max_lat, max_lon]];
}

export const formatCount = (value: number) => value.toLocaleString("en");
