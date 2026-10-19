/**
 * A ±20 km/h change of st130's speed limit on top of the closure model, from the file's speed_limit_effect (measured on
 * other roads with variable signs, Gold v2 sign-change comparisons). Applied after closureScenario(), so the model's own
 * numbers (and the acceptance check) are unchanged:
 *   flowing traffic (≤ 100 % full): speed + coefficient(dry/wet) × limit change; extra trip time recalculated
 *   volume and capacity: unchanged (the measured volume effect of limit changes includes 0)
 *   over capacity: unchanged (a different limit doesn't change how many cars get through)
 */
import { DIRECTION_NAME, pyRound, type ClosureFile, type DirectionRow } from "./closureModel";

export type Surface = "dry" | "wet";

interface Estimate {
  estimate?: number;
  mean?: number;
  ci_low: number;
  ci_high: number;
  n: number;
  n_zones: number;
  unit: string;
}

export interface SpeedLimitEffect {
  source: string;
  speed_per_kmh: Record<Surface, Estimate>;
  volume: { per_kmh: Estimate; lowered: Estimate; raised: Estimate };
  where_measured: string;
  st130_current_limit: Record<string, Record<string, Record<string, { by_value: { maxspeed: string; length_m: number; share: number }[]; source: string }>>>;
  st130_current_limit_note: string;
}

export type LimitFile = ClosureFile & { speed_limit_effect?: SpeedLimitEffect };

export const LIMIT_STEP = 20;
export const LIMIT_RANGE = { min: 60, max: 120 };

/** st130's current limit: the OpenStreetMap maxspeed on the longest share of the option-a route (both directions agree). */
export function st130CurrentLimit(file: LimitFile): { kmh: number; share: number; source: string } | null {
  const per = file.speed_limit_effect?.st130_current_limit?.a;
  if (!per) return null;
  const pick = (dir: string) =>
    per[dir]?.st130?.by_value.filter((v) => /^\d+$/.test(v.maxspeed)).reduce((a, b) => (b.share > a.share ? b : a), { maxspeed: "0", length_m: 0, share: -1 });
  const north = pick("northbound");
  const south = pick("southbound");
  if (!north || !south || north.maxspeed !== south.maxspeed) return null;
  return { kmh: Number(north.maxspeed), share: Math.min(north.share, south.share), source: per.northbound.st130.source };
}

export interface LimitedRow extends DirectionRow {
  /** Speed change from the limit (0 when over capacity or no change). */
  limit_effect_kmh: number;
  /** Over capacity with a limit change: the queue and speed are unchanged. */
  limit_no_throughput: boolean;
}

/** The rows with st130's limit changed by stepKmh (−20, 0, +20). */
export function applySt130Limit(file: LimitFile, rows: DirectionRow[], stepKmh: number, surface: Surface): LimitedRow[] {
  const coef = file.speed_limit_effect?.speed_per_kmh[surface].estimate ?? 0;
  return rows.map((r) => {
    if (stepKmh === 0) return { ...r, limit_effect_kmh: 0, limit_no_throughput: false };
    if (r.pct_full > 100) return { ...r, limit_effect_kmh: 0, limit_no_throughput: true };
    const effect = coef * stepKmh;
    const speed = pyRound(r.speed_stable_kmh + effect, 1);
    let extra = r.extra_trip_time_min;
    if (extra !== null) {
      const routes = file.options.a.directions[DIRECTION_NAME[r.direction]].routes;
      const light = file.stations["tms:440"].directions[String(r.direction) as "1" | "2"].measured.light_traffic_speed_kmh;
      extra = pyRound((routes.st130.length_m / 1000 / speed) * 60 - (routes.vt3.length_m / 1000 / light) * 60 + r.avg_queue_delay_min, 1);
    }
    return { ...r, speed_stable_kmh: speed, extra_trip_time_min: extra, limit_effect_kmh: effect, limit_no_throughput: false };
  });
}
