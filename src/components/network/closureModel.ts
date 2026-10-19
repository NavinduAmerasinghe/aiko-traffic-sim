/**
 * The modelled Lempäälä closure: a line-by-line port of st130_hour() and scenario() in
 * aiko-fintraffic/analysis/closure_exploration/area_e/03_build.py (option a). Inputs come from public/closure_lempaala.json,
 * which that script writes. Nothing here is measured on a real closure; see the JSON's "model" and "caveats".
 * Rounding follows Python's round() (exact halves to even), and the extra trip time uses the rounded speed and delay,
 * as the script does, so the numbers match analysis/outputs/closure_lempaala_check.csv.
 */

export type Dir = 1 | 2;
export type Closed = "north" | "south" | "both";
export type CapacityLevel = "low" | "mid" | "high";

export interface CurveBin {
  flow_from_veh_h: number;
  flow_to_veh_h: number;
  median_speed_kmh: number;
  p10_speed_kmh: number;
  points: number;
}

export interface Measured {
  weekdays: number;
  volume_median_veh_h: (number | null)[];
  heavy_share: (number | null)[];
  light_traffic_speed_kmh: number;
  speed_volume_curve: CurveBin[];
}

export interface ClosureStation {
  name: string;
  road: string;
  lat: number;
  lon: number;
  directions: Record<"1" | "2", { towards: string; measured: Measured }>;
}

export interface ClosureRoute {
  length_m: number;
  stations: string[];
  polyline: [number, number][];
  result?: string;
}

export interface ClosureDirection {
  tms_direction: Dir;
  station_440: { closed_from_km: number; closed_to_km: number; inside_closed_section: boolean };
  routes: { vt3: ClosureRoute; st130: ClosureRoute; western: ClosureRoute; [k: string]: ClosureRoute };
  default_split: Record<string, number>;
  count_of_diverted_traffic: string;
}

export interface ClosureFile {
  kind: string;
  attribution: string;
  osm_downloaded_utc: string;
  stations: Record<string, ClosureStation>;
  options: Record<string, { label: string; directions: Record<"northbound" | "southbound", ClosureDirection> }>;
  model: {
    capacity: Record<CapacityLevel, { value: number; unit: "veh/h" | "pc/h" }>;
    two_way_cap_pc_h: number;
    breakdown: { at_pct_of_capacity: number; speed_kmh: number; text: string };
    queue: { label: string; carry_over: string };
    speed: { measured_part: string; assumed_part: string; slope_km_h_per_pc_h: number };
    pc_conversion: { E_T_by_two_way_pc_h: { up_to: number | null; E_T: number }[] };
    extra_trip_time: string;
    demand: string;
  };
  measured_vs_assumed: { measured: string[]; assumed: string[] };
  sources: { id: string; used_for: string; text: string; url: string }[];
  caveats: string[];
}

export const DIRECTION_NAME: Record<Dir, "northbound" | "southbound"> = { 1: "northbound", 2: "southbound" };
const ST130_STATIONS = ["tms:433", "tms:402"];

/** Python's round(x, n): the exact value of the double, exact halves to even. */
export function pyRound(x: number, n = 0): number {
  const digits = Math.abs(x).toFixed(Math.min(100, n + 30));
  const point = digits.indexOf(".");
  const rest = digits.slice(point + 1 + n);
  if (/^50*$/.test(rest)) {
    // an exact half: round to the even neighbour
    const down = Number(Math.abs(x).toFixed(Math.min(100, n + 30)).slice(0, point + 1 + n).replace(/\.$/, ""));
    const lastDigit = Number(digits[n === 0 ? point - 1 : point + n]);
    const step = 10 ** -n;
    const r = lastDigit % 2 === 0 ? down : down + step;
    return Math.sign(x) * Number(r.toFixed(n));
  }
  return Number(x.toFixed(n));
}

/** np.interp over the bin midpoints plus the last bin's upper edge (clamped at both ends). */
function curveSpeed(m: Measured, q: number): number {
  const pts = m.speed_volume_curve;
  const x = [...pts.map((c) => (c.flow_from_veh_h + c.flow_to_veh_h) / 2), pts[pts.length - 1].flow_to_veh_h];
  const y = [...pts.map((c) => c.median_speed_kmh), pts[pts.length - 1].median_speed_kmh];
  if (q <= x[0]) return y[0];
  if (q >= x[x.length - 1]) return y[y.length - 1];
  let i = 0;
  while (x[i + 1] < q) i++;
  return y[i] + ((y[i + 1] - y[i]) * (q - x[i])) / (x[i + 1] - x[i]);
}

function eT(file: ClosureFile, twoWayPc: number): number {
  return file.model.pc_conversion.E_T_by_two_way_pc_h.find((e) => e.up_to === null || twoWayPc <= e.up_to)!.E_T;
}

type PerDir<T> = Record<Dir, T>;

/** flows / shares per direction -> E_T and the factor per direction; E_T from the two-way pc flow (two passes). */
function pcFactors(file: ClosureFile, flows: PerDir<number>, shares: PerDir<number>): { et: number; f: PerDir<number> } {
  let et = eT(file, flows[1] + flows[2]);
  for (let i = 0; i < 2; i++) {
    const f = { 1: 1 + shares[1] * (et - 1), 2: 1 + shares[2] * (et - 1) };
    et = eT(file, flows[1] * f[1] + flows[2] * f[2]);
  }
  return { et, f: { 1: 1 + shares[1] * (et - 1), 2: 1 + shares[2] * (et - 1) } };
}

const measuredAt = (file: ClosureFile, point: string, d: Dir) => file.stations[point].directions[String(d) as "1" | "2"].measured;

export interface St130Result {
  bottleneck: string;
  volume_before_veh_h: number;
  added_veh_h: number;
  volume_after_veh_h: number;
  heavy_share_after: number;
  E_T: number;
  pc_after_pc_h: number;
  capacity: number;
  capacity_unit: "veh/h" | "pc/h";
  pct_full: number;
  two_way_pc_h: number;
  over_two_way_cap: boolean;
  speed_stable_kmh: number;
  speed_if_breakdown_kmh: number | null;
  queue_end_of_hour_veh: number;
  avg_queue_delay_min: number;
}

/** st130 at its bottleneck in one hour; added = diverted veh/h onto st130 per direction. */
export function st130Hour(file: ClosureFile, hour: number, added: PerDir<number>, level: CapacityLevel): PerDir<St130Result> {
  const { value: capValue, unit: capUnit } = file.model.capacity[level];
  const vol = (p: string, d: Dir) => measuredAt(file, p, d).volume_median_veh_h[hour] ?? 0;
  const neck = {} as PerDir<string>;
  for (const d of [1, 2] as Dir[]) neck[d] = ST130_STATIONS.reduce((best, p) => (vol(p, d) > vol(best, d) ? p : best), ST130_STATIONS[0]);
  const m = { 1: measuredAt(file, neck[1], 1), 2: measuredAt(file, neck[2], 2) };
  const before = { 1: m[1].volume_median_veh_h[hour] ?? 0, 2: m[2].volume_median_veh_h[hour] ?? 0 };
  const after = { 1: before[1] + added[1], 2: before[2] + added[2] };
  const p440 = { 1: measuredAt(file, "tms:440", 1).heavy_share[hour] ?? 0, 2: measuredAt(file, "tms:440", 2).heavy_share[hour] ?? 0 };
  const shareAfter = {
    1: (before[1] * (m[1].heavy_share[hour] ?? 0) + added[1] * p440[1]) / after[1],
    2: (before[2] * (m[2].heavy_share[hour] ?? 0) + added[2] * p440[2]) / after[2],
  };
  const { et, f } = pcFactors(file, after, shareAfter);
  const { f: fOppAdded } = pcFactors(file, after, p440);
  const pcAfter = { 1: after[1] * f[1], 2: after[2] * f[2] };
  const twoWayPc = pcAfter[1] + pcAfter[2];
  const twoWayCap = file.model.two_way_cap_pc_h;
  const slope = file.model.speed.slope_km_h_per_pc_h;
  const breakdownShare = file.model.breakdown.at_pct_of_capacity / 100;
  const out = {} as PerDir<St130Result>;
  for (const d of [1, 2] as Dir[]) {
    const o: Dir = d === 1 ? 2 : 1;
    let cap = capValue;
    const demand = capUnit === "veh/h" ? after[d] : pcAfter[d];
    if (twoWayPc > twoWayCap) {
      const shareCapPc = (twoWayCap * pcAfter[d]) / twoWayPc;
      cap = Math.min(cap, capUnit === "veh/h" ? shareCapPc / f[d] : shareCapPc);
    }
    const served = Math.min(demand, cap);
    const servedVeh = capUnit === "veh/h" ? served : served / f[d];
    const upTo = m[d].speed_volume_curve[m[d].speed_volume_curve.length - 1].flow_to_veh_h;
    const excessPc = Math.max(0, servedVeh - upTo) * f[d];
    const addedOppPc = added[o] * fOppAdded[o];
    const speed = curveSpeed(m[d], Math.min(servedVeh, upTo)) - slope * (excessPc + addedOppPc);
    const queue = Math.max(0, demand - cap);
    const queueVeh = capUnit === "veh/h" ? queue : queue / f[d];
    const delayMin = queue > 0 ? (queue / (2 * cap)) * 60 : 0;
    out[d] = {
      bottleneck: neck[d],
      volume_before_veh_h: before[d],
      added_veh_h: pyRound(added[d]),
      volume_after_veh_h: pyRound(after[d]),
      heavy_share_after: pyRound(shareAfter[d], 3),
      E_T: et,
      pc_after_pc_h: pyRound(pcAfter[d]),
      capacity: pyRound(cap),
      capacity_unit: capUnit,
      pct_full: pyRound((100 * demand) / cap, 1),
      two_way_pc_h: pyRound(twoWayPc),
      over_two_way_cap: twoWayPc > twoWayCap,
      speed_stable_kmh: pyRound(speed, 1),
      speed_if_breakdown_kmh: demand >= breakdownShare * cap ? file.model.breakdown.speed_kmh : null,
      queue_end_of_hour_veh: pyRound(queueVeh),
      avg_queue_delay_min: pyRound(delayMin, 1),
    };
  }
  return out;
}

export interface ScenarioInput {
  hour: number;
  closed: Closed;
  divert: number;
  st130Share: number;
  capacity: CapacityLevel;
}

export interface DirectionRow extends St130Result {
  direction: Dir;
  direction_closed: boolean;
  western_added_veh_h: number;
  extra_trip_time_min: number | null;
  label: string;
}

const CLOSED_DIRS: Record<Closed, Dir[]> = { north: [1], south: [2], both: [1, 2] };
export const closedDirs = (closed: Closed): Dir[] => CLOSED_DIRS[closed];

/** The check-table rows of one scenario: one row per st130 direction (option a). */
export function closureScenario(file: ClosureFile, s: ScenarioInput): DirectionRow[] {
  const dirs = closedDirs(s.closed);
  const vol440 = (d: Dir) => measuredAt(file, "tms:440", d).volume_median_veh_h[s.hour] ?? 0;
  const demand = { 1: dirs.includes(1) ? vol440(1) * s.divert : 0, 2: dirs.includes(2) ? vol440(2) * s.divert : 0 };
  const added = { 1: demand[1] * s.st130Share, 2: demand[2] * s.st130Share };
  const res = st130Hour(file, s.hour, added, s.capacity);
  return ([1, 2] as Dir[]).map((d) => {
    const r = res[d];
    const opt = file.options.a.directions[DIRECTION_NAME[d]].routes;
    const light = measuredAt(file, "tms:440", d).light_traffic_speed_kmh;
    const extra = dirs.includes(d)
      ? pyRound((opt.st130.length_m / 1000 / r.speed_stable_kmh) * 60 - (opt.vt3.length_m / 1000 / light) * 60 + r.avg_queue_delay_min, 1)
      : null;
    return {
      ...r,
      direction: d,
      direction_closed: dirs.includes(d),
      western_added_veh_h: pyRound(demand[d] - added[d]),
      extra_trip_time_min: extra,
      label: r.queue_end_of_hour_veh > 0 ? file.model.queue.label : "modelled",
    };
  });
}

/** The same hour with nothing diverted: st130's own traffic on the measured curve. */
export function closureBefore(file: ClosureFile, hour: number, level: CapacityLevel): PerDir<St130Result> {
  return st130Hour(file, hour, { 1: 0, 2: 0 }, level);
}
