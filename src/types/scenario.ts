/**
 * Types of public/scenario_model.json and public/scenario_data.json, written by
 * aiko-fintraffic/analysis/03_scenario_export.py from Gold v2 (the sign-impact analysis week,
 * 2026-09-23 .. 10-01). The files are copied into public/, not fetched from a server.
 */

export type Change = "lowered" | "raised";
export type SizeBin = "10" | "20" | "30+";
export type Road = "dry" | "wet" | "any";
export type DayType = "weekday" | "saturday" | "sunday";
export type MetricKey =
  | "mean_speed"
  | "p85_speed"
  | "speed_std"
  | "share_over_limit"
  | "share_headway_lt_2s"
  | "volume";

export interface MetricStats {
  mean: number | null;
  ci_low: number | null;
  ci_high: number | null;
  p_value: number | null;
  n: number;
  n_zones: number;
  warnings: string[];
}

export interface Cell {
  change: Change;
  size_bin: SizeBin;
  road: Road;
  n: number;
  from_to: string[];
  metrics: Record<MetricKey, MetricStats>;
}

export interface CardCoefficient {
  key: string;
  label: string;
  unit: string;
  estimate: number;
  ci_low: number;
  ci_high: number;
  p_value: number;
}

export interface ScenarioModel {
  generated_at_utc: string;
  definition: string;
  metrics: Record<MetricKey, { unit: string; label: string }>;
  n_comparisons: number;
  n_zones: number;
  headline: Record<Change, MetricStats>;
  size_bins: SizeBin[];
  observed_from_to: string[];
  roads: Record<Road, string>;
  cells: Cell[];
  downstream: { definition: string; n_comparisons: number; cells: Cell[] };
  regression: {
    outcome: string;
    formula: string;
    n: number;
    n_zones: number;
    r_squared: number;
    card: CardCoefficient[];
    card_note: string;
  };
  warning_rules: { min_n: number; min_zones: number };
  not_covered: string[];
  /** Past comparisons with under `threshold` of the vehicles over the lower of the two limits before the change. */
  headroom: { threshold: number; n_under_threshold: Record<Change, number>; definition: string };
}

/** Per-hour arrays, index = Finnish local hour 0..23. */
export type Hourly = (number | null)[];

/** Each day's hourly value first, then the median across the days of the day type and the lowest / highest day. */
export interface DayStat {
  median: Hourly;
  min: Hourly;
  max: Hourly;
}

export interface NormalConditions {
  days: number;
  dates: string[];
  /** The limit the governing sign showed on the most covered days of this type in that hour (null: no sign data). */
  limit_kmh: Hourly;
  /** That limit's share of the sign's known minutes in the hour on the covered days. */
  limit_share_of_hour: Hourly;
  /** Covered days that showed limit_kmh, of limit_days_covered (a covered day: the sign's state is known for >= 30 min of the hour). */
  limit_days_showing?: number[];
  limit_days_covered?: number[];
  days_with_vehicles: number[];
  /** Days that had LAM raw in that hour (an outage hour is left out of the volume median). */
  days_with_data: number[];
  /** True when more than 80 % of the traffic drives over the limit in force (it may not govern this station); null: limit unknown. */
  limit_uncertain?: (boolean | null)[];
  mean_speed_kmh: DayStat;
  p85_kmh: DayStat;
  vehicles_per_hour: DayStat;
  /** Share of vehicles over that hour's limit. */
  share_over_limit: DayStat;
  /** Median share over each limit value ("50", "60", "70", "80", "100", "120"). */
  share_over: Record<string, Hourly>;
}

/**
 * Near capacity (analysis/03_scenario_export.py): q_ref = 99th percentile of 5-minute flow; v_ref = median speed in
 * light traffic; an hour is near capacity when its normal flow >= 85 % of q_ref and (its normal speed <= 90 % of v_ref
 * or >= 3 of its 5-minute points are under 70 % of v_ref). capacity_observed = at least 12 points under 70 % of v_ref.
 */
export interface Capacity {
  q_ref_veh_h: number;
  v_ref_kmh: number;
  slowed_points_week: number;
  capacity_observed: boolean;
  near_capacity: Record<DayType, (boolean | null)[]>;
}

/** public/scenario_points/<tms number>.json: the 5-minute points of the nine days per TMS direction. */
export interface StationPoints {
  point_id: string;
  day_types: DayType[];
  directions: Record<string, { hour: number[]; day_type: number[]; flow: number[]; speed: number[] }>;
}

export interface StationDirection {
  tms_direction: 1 | 2;
  capacity: Capacity | null;
  road_direction: string | null;
  towards: string | null;
  free_flow_kmh: number | null;
  /** The limit shown most over the whole week (for context only; the hourly limit is in normal). */
  typical_limit_kmh: number | null;
  limit_signs: string[];
  limit_from: string | null;
  /** First and last minute (UTC) with a known state of the governing sign inside the 5-minute sign data. */
  limit_sign_coverage?: { first_utc: string; last_utc: string } | null;
  normal: Partial<Record<DayType, NormalConditions>>;
  /**
   * Not in the export yet (to be added to 03_scenario_export.py): the after_zone station of the group whose sign governs
   * this station in this direction, and that sign's position. The map draws the downstream effect only when they are set.
   */
  after_zone_point_id?: string | null;
  governing_sign?: { id: string; lat: number; lon: number } | null;
}

export interface Station {
  point_id: string;
  tms_number: number;
  name: string;
  road_number: number | null;
  province: string | null;
  municipality: string | null;
  lat: number;
  lon: number;
  roles: { effect: number; control: number; after_zone: number };
  comparisons_as_effect: number;
  lam_tms_mismatch: boolean;
  directions: StationDirection[];
}

export interface ScenarioData {
  generated_at_utc: string;
  day_types: Record<DayType, { dates: string[]; days: number }>;
  /** The 5-minute sign data the limits come from (UTC), without the collector gap. */
  sign_data?: { from_utc: string; to_utc: string; gap_from_utc: string; gap_to_utc: string; covered_day_min_minutes: number };
  normal_definition: string;
  stations: Station[];
}

export interface ScenarioSelection {
  pointId: string;
  direction: 1 | 2;
  dayType: DayType;
  hour: number;
  change: Change;
  sizeBin: SizeBin;
  road: Exclude<Road, "any">;
}
