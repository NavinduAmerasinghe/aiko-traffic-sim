import type {
  Cell,
  DayStat,
  MetricKey,
  MetricStats,
  NormalConditions,
  ScenarioData,
  ScenarioModel,
  ScenarioSelection,
  Station,
  StationDirection,
} from "@/types/scenario";

/** Few past cases: a warning (the estimate is shaky). */
export function isFewCases(stats: MetricStats, model: ScenarioModel): boolean {
  return (
    stats.n < model.warning_rules.min_n ||
    stats.n_zones < model.warning_rules.min_zones ||
    stats.ci_low === null
  );
}

/** The 95 % CI includes 0: a result ("no measurable change"), not a warning. */
export function isNoMeasurableChange(stats: MetricStats): boolean {
  return stats.ci_low !== null && stats.ci_high !== null && stats.ci_low <= 0 && stats.ci_high >= 0;
}

export function findCell(cells: Cell[], s: Pick<ScenarioSelection, "change" | "sizeBin">, road: Cell["road"]): Cell | undefined {
  return cells.find((c) => c.change === s.change && c.size_bin === s.sizeBin && c.road === road);
}

export function findStation(data: ScenarioData, pointId: string): Station | undefined {
  return data.stations.find((s) => s.point_id === pointId);
}

export function findDirection(station: Station | undefined, direction: 1 | 2): StationDirection | undefined {
  return station?.directions.find((d) => d.tms_direction === direction);
}

/** The limit in force at the selected day type and hour (from the governing sign), or null. */
export function limitAt(direction: StationDirection | undefined, s: Pick<ScenarioSelection, "dayType" | "hour">): number | null {
  return direction?.normal[s.dayType]?.limit_kmh[s.hour] ?? null;
}

/** The median across days at the selected hour. */
export function medianAt(stat: DayStat | undefined, hour: number): number | null {
  return stat?.median[hour] ?? null;
}

/**
 * The headroom note: the station's normal share of vehicles over the lower of the current and the new limit at that
 * hour is under the model's threshold (50 %). Past changes almost never happened in that situation.
 * Returns the note's text, or null.
 */
export function headroomNote(
  model: ScenarioModel,
  direction: StationDirection | undefined,
  s: Pick<ScenarioSelection, "change" | "sizeBin" | "dayType" | "hour">,
): string | null {
  const current = limitAt(direction, s);
  if (current === null) return null;
  // an uncertain limit (over 80 % drive over it) is not a basis for the headroom note
  if (direction?.normal[s.dayType]?.limit_uncertain?.[s.hour]) return null;
  const size = s.sizeBin === "30+" ? 30 : Number(s.sizeBin);
  const lower = s.change === "lowered" ? current - size : current;
  const share = direction?.normal[s.dayType]?.share_over[String(lower)]?.[s.hour];
  if (share === null || share === undefined || share >= model.headroom.threshold) return null;
  const n = model.headroom.n_under_threshold[s.change];
  return s.change === "lowered"
    ? `Most traffic already drives below the new limit here. Past changes almost never happened in this situation (N = ${n}), so the estimate is uncertain; the effect is likely smaller.`
    : `Most traffic already drives below the current limit here. Past changes almost never happened in this situation (N = ${n}); raising it likely changes little.`;
}

/** The limit the knobs lead to, from the limit in force at that hour. 30+ means 30 or more. */
export function newLimit(current: number | null, s: Pick<ScenarioSelection, "change" | "sizeBin">): string | null {
  if (current === null) return null;
  const size = s.sizeBin === "30+" ? 30 : Number(s.sizeBin);
  const sign = s.change === "lowered" ? -1 : 1;
  return s.sizeBin === "30+" ? `${current + sign * size} or ${s.change === "lowered" ? "lower" : "higher"}` : `${current + sign * size}`;
}

const SHARE_METRICS: MetricKey[] = ["share_over_limit", "share_headway_lt_2s"];

export function isShare(metric: MetricKey): boolean {
  return SHARE_METRICS.includes(metric);
}

/** A metric value for display: shares as percentage points, the rest with their unit. */
export function formatEffect(value: number | null, metric: MetricKey, unit: string): string {
  if (value === null) return "–";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  const abs = Math.abs(value);
  if (isShare(metric)) return `${sign}${(abs * 100).toFixed(1)} points`;
  if (unit === "vehicles/h") return `${sign}${abs.toFixed(0)} veh/h`;
  return `${sign}${abs.toFixed(1)} ${unit}`;
}

export function formatCi(stats: MetricStats, metric: MetricKey, unit: string): string {
  if (stats.ci_low === null || stats.ci_high === null) return "no 95 % CI";
  return `95 % CI ${formatEffect(stats.ci_low, metric, unit)} … ${formatEffect(stats.ci_high, metric, unit)}`;
}

export const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}–${String((hour + 1) % 24).padStart(2, "0")}`;
}

/** Pick a station, keeping the selected direction when the station has it. */
export function selectStation(data: ScenarioData, selection: ScenarioSelection, pointId: string): ScenarioSelection {
  const next = findStation(data, pointId);
  const direction = next?.directions.some((d) => d.tms_direction === selection.direction)
    ? selection.direction
    : (next?.directions[0]?.tms_direction ?? 1);
  return { ...selection, pointId, direction };
}

export interface SpeedScenario {
  normal: number;
  scenario: number;
  low: number | null;
  high: number | null;
}

/** The normal mean speed plus the pooled speed effect (and its 95 % CI), or null when either is missing. */
export function scenarioSpeed(normal: number | null, effect: MetricStats | undefined): SpeedScenario | null {
  if (normal === null || !effect || effect.mean === null) return null;
  return {
    normal,
    scenario: normal + effect.mean,
    low: effect.ci_low === null ? null : normal + effect.ci_low,
    high: effect.ci_high === null ? null : normal + effect.ci_high,
  };
}

/** The after_zone (downstream) station of the selected direction, when the export has it. */
export function afterZoneStation(data: ScenarioData, direction: StationDirection | undefined): Station | undefined {
  return direction?.after_zone_point_id ? findStation(data, direction.after_zone_point_id) : undefined;
}

/** One line for the after-zone station: the pooled downstream mean-speed effect, or "no measurable change". */
export function downstreamSummary(model: ScenarioModel, cell: Cell | undefined): string {
  const stats = cell?.metrics.mean_speed;
  if (!stats || stats.n === 0) return "no past case with a downstream station";
  const few = isFewCases(stats, model) ? " · few past cases" : "";
  if (isNoMeasurableChange(stats) || stats.mean === null) return `no measurable change (N ${stats.n})${few}`;
  const value = (v: number) => formatEffect(v, "mean_speed", "").trim();
  const ci = stats.ci_low !== null && stats.ci_high !== null ? `95 % CI ${value(stats.ci_low)} … ${value(stats.ci_high)}` : "no 95 % CI";
  return `${formatEffect(stats.mean, "mean_speed", model.metrics.mean_speed.unit)} mean speed (average of past changes, ${ci}, N ${stats.n})${few}`;
}

export type StationState = "near_capacity" | "below_limit" | "effect_applies" | "limit_unknown" | "no_data";

export const STATION_STATE_LABELS: Record<StationState, string> = {
  effect_applies: "likely effect (traffic near the limit)",
  below_limit: "little effect (most traffic already below the limit)",
  near_capacity: "little effect (near capacity)",
  limit_unknown: "limit unknown",
  no_data: "no data",
};

/**
 * A station's state at the selected day type and hour, in the selected direction (or its first one): no normal speed,
 * no known limit, near capacity (from the export), most traffic already below the limit (the headroom note), else the
 * effect applies.
 */
export function stationState(model: ScenarioModel, station: Station, selection: ScenarioSelection): StationState {
  const direction = findDirection(station, selection.direction) ?? station.directions[0];
  if (medianAt(direction?.normal[selection.dayType]?.mean_speed_kmh, selection.hour) === null) return "no_data";
  if (limitAt(direction, selection) === null) return "limit_unknown";
  if (direction?.capacity?.near_capacity[selection.dayType]?.[selection.hour] === true) return "near_capacity";
  if (headroomNote(model, direction, selection) !== null) return "below_limit";
  return "effect_applies";
}

/**
 * The map note on the downstream overlay: the export lacks the field, the station was never an effect station (null),
 * or the after-zone station is missing from the stations. Null when there is nothing to say.
 */
export function afterZoneNote(data: ScenarioData, direction: StationDirection | undefined): string | null {
  if (!direction) return null;
  if (direction.after_zone_point_id === undefined) return "After-zone station and sign position are not in the scenario export yet.";
  if (direction.after_zone_point_id === null)
    return "This station was never the effect station of a sign change, so there is no measured downstream station.";
  if (!findStation(data, direction.after_zone_point_id)) return `After-zone station ${direction.after_zone_point_id} is not among the scenario stations.`;
  return null;
}

/**
 * The limit at the selected hour is unknown, flagged uncertain by the export (most traffic far above it), or shown by the
 * sign for under 75 % of the hour. Null when it is clear.
 */
export function limitUncertainty(direction: StationDirection | undefined, s: Pick<ScenarioSelection, "dayType" | "hour">): string | null {
  if (!direction) return null;
  const current = limitAt(direction, s);
  if (current === null) return "The limit in force at this hour is unknown (no speed-limit sign data for it).";
  if (direction.normal[s.dayType]?.limit_uncertain?.[s.hour] === true)
    return "Limit uncertain: most traffic here drives well above this limit, so the sign may not govern these lanes.";
  const shown = direction.normal[s.dayType]?.limit_share_of_hour[s.hour];
  if (shown !== null && shown !== undefined && shown < 0.75)
    return `The sign shows ${current} km/h only ${Math.round(shown * 100)} % of this hour; the limit changes within the hour.`;
  return null;
}

/** The popup's single note, by priority: limit unknown or uncertain > few past cases > near capacity > headroom (near capacity explains it). */
export function primaryNote(
  model: ScenarioModel,
  cell: Cell | undefined,
  direction: StationDirection | undefined,
  s: ScenarioSelection,
): string | null {
  const limit = limitUncertainty(direction, s);
  if (limit) return limit;
  const stats = cell?.metrics.mean_speed;
  if (stats && stats.n > 0 && isFewCases(stats, model)) return `Few past cases (N ${stats.n}, ${stats.n_zones} zones): the result is uncertain.`;
  if (direction?.capacity?.near_capacity[s.dayType]?.[s.hour] === true)
    return "Traffic is near capacity at this hour: congestion, more than the limit, sets the speed.";
  if (headroomNote(model, direction, s))
    return s.change === "lowered"
      ? "Most traffic already drives below the new limit here: the effect is likely smaller."
      : "Most traffic already drives below the current limit here: raising it likely changes little.";
  return null;
}

/* ---------- display helpers for the speed-limit scenario view ---------- */

/** "vt3_Tre_Sarankulma" -> "Vt3". */
export function roadName(station: Station): string {
  const code = station.name.split("_")[0];
  return code.charAt(0).toUpperCase() + code.slice(1);
}

/** Town abbreviations used in LAM station names. */
const TOWN_ABBREVIATIONS: Record<string, string> = { Tre: "Tampere", Hlinna: "Hämeenlinna" };

/**
 * The LAM station name without the road code: town + short name. "vt3_Hämeenlinna_E" -> "Hämeenlinna E",
 * "vt3_Tre_Sarankulma" -> "Tampere Sarankulma", "vt3_Pirkkala_Huovi LAM" -> "Pirkkala Huovi"; a one-word name gets its
 * municipality in front: "vt3_Kivistö" -> "Vantaa Kivistö".
 */
export function placeName(station: Station): string {
  const parts = station.name.replace(/\s+LAM$/, "").split("_").slice(1);
  if (parts.length === 0) return station.municipality ?? "";
  parts[0] = TOWN_ABBREVIATIONS[parts[0]] ?? parts[0];
  return parts.length === 1 && station.municipality ? `${station.municipality} ${parts[0]}` : parts.join(" ");
}

/** The view offers one 20 km/h step from the limit in force: -1 lower, 0 no change, +1 raise. */
export type LimitStep = -1 | 0 | 1;
export const STEP_KMH = 20;
export const LIMIT_RANGE = { min: 60, max: 120 };

/** Whether a step keeps the limit within 60-120 km/h (always allowed when the limit is unknown). */
export function stepAllowed(current: number | null, step: LimitStep): boolean {
  if (current === null || step === 0) return true;
  const next = current + step * STEP_KMH;
  return next >= LIMIT_RANGE.min && next <= LIMIT_RANGE.max;
}

/** A share effect in percentage points, written "points" (shares are fractions in the model). */
export function formatPoints(value: number | null): string {
  if (value === null) return "–";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${(Math.abs(value) * 100).toFixed(1)} points`;
}

/** "on 3 of 3 covered days": how many covered days showed the hour's limit (null when the export lacks the counts). */
export function limitDaysText(direction: StationDirection | undefined, s: Pick<ScenarioSelection, "dayType" | "hour">): string | null {
  const normal = direction?.normal[s.dayType];
  const covered = normal?.limit_days_covered?.[s.hour];
  if (!normal || !covered) return null;
  return `on ${normal.limit_days_showing?.[s.hour] ?? 0} of ${covered} covered ${covered === 1 ? "day" : "days"}`;
}

/** "100 km/h (on 3 of 3 covered days)", or null when the limit at that hour is unknown. */
export function limitInForceText(direction: StationDirection | undefined, s: Pick<ScenarioSelection, "dayType" | "hour">): string | null {
  const limit = limitAt(direction, s);
  if (limit === null) return null;
  const days = limitDaysText(direction, s);
  return days ? `${limit} km/h (${days})` : `${limit} km/h`;
}

/** The station's own name without its town ("Tampere Sarankulma" -> "Sarankulma"); kept whole when that leaves too little ("Hämeenlinna E"). */
export function shortName(station: Station): string {
  const place = placeName(station);
  const town = place.split(" ")[0];
  const rest = place.slice(town.length).trim();
  return rest.length >= 3 ? rest : place;
}

/**
 * One label per station direction, used in the road picker and the card: "Vt3 · Sarankulma (449) → towards Pirkkala".
 * The direction is the next (after-zone) station's town, or that station's name when it is in the same town; without a
 * next station, the direction's destination.
 */
export function directionLabel(data: ScenarioData, station: Station, direction: StationDirection): string {
  const next = afterZoneStation(data, direction);
  const head = `${roadName(station)} · ${shortName(station)} (${station.tms_number})`;
  if (next) {
    const town = next.municipality ?? placeName(next).split(" ")[0];
    const sameTown = town === (station.municipality ?? placeName(station).split(" ")[0]);
    return `${head} → towards ${sameTown ? shortName(next) : town}`;
  }
  return `${head} → towards ${direction.towards ?? `direction ${direction.tms_direction}`}`;
}

