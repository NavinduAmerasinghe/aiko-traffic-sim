import type { SegmentFeature } from "@/types/traffic";
import {
  cumulativeDistances,
  lineLengthMeters,
  pointAtDistance,
  type LngLat,
} from "./geo";

/**
 * A "route path" is the concatenation of all segment geometries that share a
 * route_id, giving one continuous polyline a vehicle can travel along.
 *
 * IMPORTANT: These vehicles are a VISUAL AID only. The API returns aggregate
 * traffic speed, not individual vehicle positions. Nothing here represents a
 * real car — positions are synthesized from the observed aggregate speed.
 */
export interface RoutePath {
  routeId: string;
  coords: LngLat[];
  cumulative: number[];
  lengthM: number;
}

export interface Vehicle {
  id: string;
  routeIndex: number;
  /** Metres travelled along the route path; wraps at the route length. */
  dist: number;
  /** Small per-vehicle speed jitter so they don't move in lockstep. */
  speedFactor: number;
}

/** Build continuous route paths by grouping and ordering segments per route. */
export function buildRoutePaths(features: SegmentFeature[]): RoutePath[] {
  const byRoute = new Map<string, SegmentFeature[]>();
  for (const f of features) {
    const key = f.properties.route_id;
    if (!byRoute.has(key)) byRoute.set(key, []);
    byRoute.get(key)!.push(f);
  }

  const paths: RoutePath[] = [];
  for (const [routeId, segs] of byRoute) {
    // Order segments by distance from the requested entity as a stable proxy
    // for their sequence along the road.
    const ordered = [...segs].sort(
      (a, b) => a.properties.dist_from_entity_m - b.properties.dist_from_entity_m,
    );
    const coords: LngLat[] = [];
    for (const s of ordered) {
      for (const c of s.geometry.coordinates) {
        const last = coords[coords.length - 1];
        // Skip exact duplicate joins between consecutive segments.
        if (!last || last[0] !== c[0] || last[1] !== c[1]) coords.push(c);
      }
    }
    if (coords.length < 2) continue;
    paths.push({
      routeId,
      coords,
      cumulative: cumulativeDistances(coords),
      lengthM: lineLengthMeters(coords),
    });
  }
  return paths;
}

/** Deterministic-ish pseudo random so re-spawns look stable across renders. */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Spawn `count` vehicles distributed across the available route paths. */
export function spawnVehicles(paths: RoutePath[], count: number): Vehicle[] {
  if (paths.length === 0) return [];
  const rand = seededRandom(1337);
  const vehicles: Vehicle[] = [];
  for (let i = 0; i < count; i++) {
    const routeIndex = i % paths.length;
    const path = paths[routeIndex];
    vehicles.push({
      id: `sim-${i}`,
      routeIndex,
      dist: rand() * path.lengthM,
      speedFactor: 0.85 + rand() * 0.3,
    });
  }
  return vehicles;
}

/**
 * Advance every vehicle by dt seconds.
 *
 * @param currentSpeedKmh aggregate observed speed for the selected timestamp
 * @param simSpeed        UI speed multiplier (0.5–5)
 * @param dtSeconds       real elapsed time since last frame
 *
 * A display scale keeps motion visible on-map without warping perception of
 * relative speeds: faster observed traffic => visibly faster vehicles.
 */
export function advanceVehicles(
  vehicles: Vehicle[],
  paths: RoutePath[],
  currentSpeedKmh: number,
  simSpeed: number,
  dtSeconds: number,
): void {
  const mps = (currentSpeedKmh * 1000) / 3600; // real m/s
  const DISPLAY_SCALE = 4; // exaggerate so movement reads at map zoom
  for (const v of vehicles) {
    const path = paths[v.routeIndex];
    if (!path) continue;
    v.dist += mps * v.speedFactor * simSpeed * DISPLAY_SCALE * dtSeconds;
    if (v.dist > path.lengthM) v.dist -= path.lengthM;
  }
}

/** Current positions as a GeoJSON FeatureCollection for the map vehicle layer. */
export function vehiclePositions(vehicles: Vehicle[], paths: RoutePath[]) {
  return {
    type: "FeatureCollection" as const,
    features: vehicles
      .map((v) => {
        const path = paths[v.routeIndex];
        if (!path) return null;
        const pos = pointAtDistance(path.coords, path.cumulative, v.dist);
        return {
          type: "Feature" as const,
          properties: { id: v.id, routeId: path.routeId },
          geometry: { type: "Point" as const, coordinates: pos },
        };
      })
      .filter(Boolean) as GeoJSON.Feature[],
  };
}
