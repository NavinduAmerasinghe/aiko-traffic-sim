import type { SegmentFeature } from "@/types/traffic";

export type LngLat = [number, number];

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two [lng, lat] points, in metres. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(a[0] - b[0]) * -1;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length of a LineString coordinate list, in metres. */
export function lineLengthMeters(coords: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1], coords[i]);
  }
  return total;
}

/**
 * Cumulative distance at each vertex of a polyline. cumulative[i] is the
 * distance from the start of the line to vertex i.
 */
export function cumulativeDistances(coords: LngLat[]): number[] {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversineMeters(coords[i - 1], coords[i]));
  }
  return cum;
}

/**
 * Interpolate a point at `dist` metres along a polyline.
 * Distances beyond the line length are clamped to the endpoints.
 */
export function pointAtDistance(
  coords: LngLat[],
  cum: number[],
  dist: number,
): LngLat {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  const total = cum[cum.length - 1];
  const d = Math.max(0, Math.min(dist, total));
  // Find the segment [i-1, i] that contains d.
  let i = 1;
  while (i < cum.length && cum[i] < d) i++;
  const segStart = cum[i - 1];
  const segEnd = cum[i];
  const segLen = segEnd - segStart || 1;
  const t = (d - segStart) / segLen;
  const [x0, y0] = coords[i - 1];
  const [x1, y1] = coords[i];
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

/** Bounding box [west, south, east, north] over a set of segment features. */
export function boundsOfSegments(
  features: SegmentFeature[],
): [number, number, number, number] | null {
  if (features.length === 0) return null;
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  for (const f of features) {
    for (const [lng, lat] of f.geometry.coordinates) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  return [west, south, east, north];
}
