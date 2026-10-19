/**
 * Acceptance check for the Closure (model) view: runs the app's closure model (src/components/network/closureModel.ts)
 * for every row of aiko-fintraffic's analysis/outputs/closure_lempaala_check.csv and compares all fields.
 *
 *   npm run check:closure -- <path to closure_lempaala_check.csv> [path to closure_lempaala.json]
 *
 * The JSON defaults to public/closure_lempaala.json. Exits with code 1 when any row differs.
 */
import { readFileSync } from "node:fs";
import { closureScenario, type CapacityLevel, type Closed, type ClosureFile, type DirectionRow } from "../src/components/network/closureModel";

const [csvPath, jsonPath = "public/closure_lempaala.json"] = process.argv.slice(2);
if (!csvPath) {
  console.error("usage: npm run check:closure -- <closure_lempaala_check.csv> [closure_lempaala.json]");
  process.exit(2);
}

const FIELDS: (keyof DirectionRow)[] = [
  "bottleneck", "volume_before_veh_h", "added_veh_h", "volume_after_veh_h", "heavy_share_after", "E_T", "pc_after_pc_h", "capacity",
  "capacity_unit", "pct_full", "two_way_pc_h", "over_two_way_cap", "speed_stable_kmh", "speed_if_breakdown_kmh", "queue_end_of_hour_veh",
  "avg_queue_delay_min", "western_added_veh_h", "extra_trip_time_min", "label", "direction_closed",
];

/** Both sides as text: numbers without trailing zeros (CSV "10.0" = 10), booleans as Python prints them, null as empty. */
const fromModel = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "True" : "False") : String(v));
const fromCsv = (s: string) => (s !== "" && /^-?\d+(\.\d+)?$/.test(s) ? String(Number(s)) : s);

const file: ClosureFile = JSON.parse(readFileSync(jsonPath, "utf8"));
const lines = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
const header = lines[0].split(",");
let ok = 0;
const failures: string[] = [];
for (const line of lines.slice(1)) {
  const row = Object.fromEntries(line.split(",").map((v, i) => [header[i], v]));
  if (row.option !== "a") continue;
  const direction = row.st130_direction.includes("(d1)") ? 1 : 2;
  const out = closureScenario(file, {
    hour: Number(row.hour_local.slice(0, 2)),
    closed: row.closed as Closed,
    divert: Number(row.divert_share),
    st130Share: Number(row.st130_share),
    capacity: row.capacity_level as CapacityLevel,
  }).find((r) => r.direction === direction)!;
  const diffs = FIELDS.filter((f) => fromCsv(row[f]) !== fromModel(out[f]));
  if (diffs.length === 0) ok++;
  else
    failures.push(
      `${row.hour_local} ${row.closed} divert ${row.divert_share} st130 ${row.st130_share} ${row.capacity_level} ${row.st130_direction}: ` +
        diffs.map((f) => `${f} csv ${row[f]} / app ${fromModel(out[f])}`).join("; "),
    );
}
console.log(`closure check: ${ok} of ${ok + failures.length} rows match on all ${FIELDS.length} fields`);
for (const f of failures.slice(0, 20)) console.log(`  DIFF ${f}`);
process.exit(failures.length ? 1 : 0);
