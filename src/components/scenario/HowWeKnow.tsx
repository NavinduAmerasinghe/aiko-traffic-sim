import { Area, CartesianGrid, ComposedChart, ErrorBar, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps } from "@/components/chartUtils";
import type { Cell, MetricKey, MetricStats, NormalConditions, ScenarioModel, ScenarioSelection, Station, StationDirection } from "@/types/scenario";
import { HOURS, STEP_KMH, formatEffect, hourLabel, placeName } from "@/utils/scenario";

/** Round speed ticks for the y axis. */
const SPEED_TICKS = [20, 50, 80, 110];
const GREY = "#9aa7bd";
const BLUE = "#3b82f6";

/** "Speed through the day": median speed with the band of the days, the limit as a step line, the scenario at the chosen hour. */
function SpeedThroughDay({ normal, effect, selection, signs }: { normal: NormalConditions | undefined; effect: MetricStats | undefined; selection: ScenarioSelection; signs: string }) {
  const h = selection.hour;
  const base = normal?.mean_speed_kmh.median[h] ?? null;
  const data = HOURS.map((hour) => {
    const low = normal?.mean_speed_kmh.min[hour] ?? null;
    const high = normal?.mean_speed_kmh.max[hour] ?? null;
    const row: Record<string, number | string | null | [number, number]> = {
      hour: String(hour).padStart(2, "0"),
      median: normal?.mean_speed_kmh.median[hour] ?? null,
      range: low !== null && high !== null ? [low, high] : null,
      limit: normal?.limit_kmh[hour] ?? null,
    };
    if (hour === h && base !== null && effect?.mean !== null && effect?.mean !== undefined) {
      row.scenario = Number((base + effect.mean).toFixed(1));
      if (effect.ci_low !== null && effect.ci_high !== null) {
        row.error = [Number((effect.mean - effect.ci_low).toFixed(2)), Number((effect.ci_high - effect.mean).toFixed(2))];
      }
    }
    return row;
  });

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-text-primary">Speed through the day</h3>
      {!normal ? (
        <p className="text-sm text-text-muted">No traffic data for this station.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#212a3a" vertical={false} />
            <XAxis dataKey="hour" {...axisProps} interval={2} />
            <YAxis {...axisProps} ticks={SPEED_TICKS} domain={[SPEED_TICKS[0], (max: number) => Math.max(SPEED_TICKS[SPEED_TICKS.length - 1], Math.ceil(max / 10) * 10)]} />
            <Tooltip
              contentStyle={{ background: "#161d2b", border: "1px solid #2c374a", fontSize: 12 }}
              labelFormatter={(label) => `${label}:00`}
              formatter={(value: number | [number, number], name: string) => [Array.isArray(value) ? `${value[0]}–${value[1]} km/h` : `${value} km/h`, name]}
            />
            <ReferenceLine x={String(h).padStart(2, "0")} stroke={BLUE} strokeDasharray="4 3" strokeOpacity={0.6} />
            <Area name="Range of the days" dataKey="range" stroke="none" fill={GREY} fillOpacity={0.15} connectNulls={false} />
            <Line name="Median speed" type="monotone" dataKey="median" stroke={GREY} strokeWidth={2} dot={false} connectNulls={false} />
            <Line name="Limit" type="stepAfter" dataKey="limit" stroke="#5f6b82" strokeWidth={1.25} strokeDasharray="5 4" dot={false} connectNulls={false} />
            <Scatter name="With the change (95 % range)" dataKey="scenario" fill={BLUE}>
              <ErrorBar dataKey="error" width={6} strokeWidth={1.5} stroke={BLUE} direction="y" />
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      )}
      <p className="text-xs text-text-muted">
        Grey: median weekday speed and the range of the {normal?.days ?? 0} days. 
        Dashed: the limit {signs ? `sign ${signs}` : "sign"} showed most in each hour.
        Blue: the speed with the change at {hourLabel(h)}.
      </p>
    </section>
  );
}

interface Props {
  model: ScenarioModel;
  selection: ScenarioSelection;
  direction: StationDirection | undefined;
  normal: NormalConditions | undefined;
  cell: Cell | undefined;
  downstreamCell: Cell | undefined;
  afterZone: Station | null;
  isChange: boolean;
}

/** The "How we know" drawer: only what is not on the main screen. */
export function HowWeKnow({ model, selection, direction, normal, cell, downstreamCell, afterZone, isChange }: Props) {
  const kind = selection.change === "lowered" ? "lowering" : "raising";
  const roads = selection.road === "dry" ? "dry roads" : "moist or wet roads";
  const signs = direction?.limit_signs.map((s) => s.replace("sign:", "")).join(", ") ?? "";
  const effects: { label: string; stats: MetricStats | undefined; metric: MetricKey }[] = [
    { label: "Mean speed", stats: cell?.metrics.mean_speed, metric: "mean_speed" },
    { label: afterZone ? `Next station (${placeName(afterZone)} ${afterZone.tms_number})` : "Next station", stats: afterZone ? downstreamCell?.metrics.mean_speed : undefined, metric: "mean_speed" },
    { label: "Drivers over the new limit", stats: cell?.metrics.share_over_limit, metric: "share_over_limit" },
    { label: "Cars following closely (gap < 2 s)", stats: cell?.metrics.share_headway_lt_2s, metric: "share_headway_lt_2s" },
    { label: "Traffic volume", stats: cell?.metrics.volume, metric: "volume" },
  ];
  const v = (x: number | null, metric: MetricKey) => formatEffect(x, metric, model.metrics[metric].unit).trim();

  return (
    <div className="space-y-8 tabular-nums">
      <SpeedThroughDay normal={normal} effect={isChange ? cell?.metrics.mean_speed : undefined} selection={selection} signs={signs} />

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-text-primary">Method</h3>
        <p className="text-sm leading-relaxed text-text-secondary">
          Every number comes from real changes the variable speed-limit signs made between 23 Sep and 1 Oct 2026 ({model.n_comparisons} in all). Each
          effect is the change at the station in the first 15 minutes minus the change at a nearby control station before the signs, pooled over all
          stations.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-text-primary">
          Effects of a {STEP_KMH} km/h {kind} on {roads}
        </h3>
        <div className="divide-y divide-border-subtle border-y border-border-subtle text-sm">
          {effects.map(({ label, stats, metric }) => (
            <div key={label} className="flex items-baseline justify-between gap-4 py-2">
              <span className="text-text-secondary">{label}</span>
              {!stats || stats.n === 0 || stats.mean === null ? (
                <span className="text-text-muted">not measured</span>
              ) : (
                <span className="text-right">
                  <span className="text-text-primary">{v(stats.mean, metric)}</span>
                  <span className="block text-xs text-text-muted">
                    {stats.ci_low !== null && stats.ci_high !== null ? `95 % range ${v(stats.ci_low, metric)} … ${v(stats.ci_high, metric)} · ` : ""}N {stats.n}
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
