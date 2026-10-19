/**
 * A specific day for the closure model: public/closure_lempaala_days.json (aiko-fintraffic analysis/closure_exploration/
 * area_e/04_days.py) holds each day's measured hourly volume per station direction. The model itself is unchanged: a day
 * replaces the typical-weekday volumes of 440, 433 and 402 in a copy of its input; speed curves and heavy-vehicle shares
 * stay the typical ones.
 */
import type { ClosureFile } from "./closureModel";

export interface ClosureDays {
  generated_at_utc: string;
  definition: Record<string, string>;
  dates: string[];
  day_types: string[];
  data: Record<
    string,
    {
      observed_share: (number | null)[][];
      incomplete: (boolean | null)[][];
      directions: Record<"1" | "2", { volume: (number | null)[][]; median_speed_kmh?: (number | null)[][] }>;
    }
  >;
}

export const DAY_STATIONS = ["tms:440", "tms:433", "tms:402"];

export const DAY_TYPE_LABEL: Record<string, string> = { weekday: "weekday", saturday: "Saturday", sunday_holiday: "Sunday or holiday" };

/** Stations whose hour is flagged incomplete (or has no volume) on that day, with their observed share. */
export function incompleteStations(days: ClosureDays, dayIndex: number, hour: number): { point: string; observed: number | null }[] {
  return DAY_STATIONS.filter((p) => {
    const s = days.data[p];
    if (!s) return true;
    const noVolume = (["1", "2"] as const).some((d) => s.directions[d]?.volume[dayIndex]?.[hour] == null);
    return s.incomplete[dayIndex]?.[hour] !== false || noVolume;
  }).map((p) => ({ point: p, observed: days.data[p]?.observed_share[dayIndex]?.[hour] ?? null }));
}

/** A copy of the model input with that day's measured hourly volumes at 440, 433 and 402. */
export function fileForDay(file: ClosureFile, days: ClosureDays, dayIndex: number): ClosureFile {
  const stations = Object.fromEntries(
    Object.entries(file.stations).map(([point, station]) => {
      const day = days.data[point];
      if (!day) return [point, station];
      const directions = Object.fromEntries(
        (["1", "2"] as const).map((d) => [
          d,
          { ...station.directions[d], measured: { ...station.directions[d].measured, volume_median_veh_h: day.directions[d].volume[dayIndex] } },
        ]),
      ) as typeof station.directions;
      return [point, { ...station, directions }];
    }),
  );
  return { ...file, stations };
}

/** "Wed 30 Sep" */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "").replace("Sept", "Sep");
}
