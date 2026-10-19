import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Cell, MetricKey, MetricStats, NormalConditions, ScenarioData, ScenarioModel, ScenarioSelection, Station } from "@/types/scenario";
import {
  HOURS,
  STEP_KMH,
  directionLabel,
  formatEffect,
  hourLabel,
  isNoMeasurableChange,
  medianAt,
  shortName,
  stepAllowed,
  type LimitStep,
  type SpeedScenario,
} from "@/utils/scenario";

/* ---------- road options ---------- */

export interface RoadOption {
  key: string;
  pointId: string;
  direction: 1 | 2;
  label: string;
  province: string | null;
}

export const roadKey = (pointId: string, direction: number) => `${pointId}|${direction}`;

/** The station directions with a known limit (a governing speed-limit sign), by road and station. The others stay in the data. */
export function roadOptions(data: ScenarioData): RoadOption[] {
  return data.stations
    .flatMap((s) =>
      s.directions.filter((d) => d.governing_sign).map((d) => ({
        key: roadKey(s.point_id, d.tms_direction),
        pointId: s.point_id,
        direction: d.tms_direction,
        label: directionLabel(data, s, d),
        province: s.province,
        sort: [s.road_number ?? 9999, s.tms_number, d.tms_direction],
      })),
    )
    .sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1] || a.sort[2] - b.sort[2])
    .map(({ sort: _sort, ...o }) => o);
}

/* ---------- small parts ---------- */

const labelClass = "text-xs text-text-muted";

/** A share effect in whole percentage points ("−5 points"). */
function wholePoints(value: number | null): string {
  if (value === null) return "–";
  const rounded = Math.round(Math.abs(value) * 100);
  const sign = rounded === 0 ? "±" : value > 0 ? "+" : "−";
  return `${sign}${rounded} points`;
}

/** The exact value, its 95 % range and N, for a hover. */
function exact(s: MetricStats | undefined, metric: MetricKey, unit: string): string | undefined {
  if (!s || s.mean === null) return undefined;
  const v = (x: number) => formatEffect(x, metric, unit).trim();
  const range = s.ci_low !== null && s.ci_high !== null ? `, 95 % range ${v(s.ci_low)} … ${v(s.ci_high)}` : "";
  return `${v(s.mean)}${range}, N ${s.n}`;
}

function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; title?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-grid rounded-lg border border-border-subtle bg-bg-base p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            value === o.value ? "bg-bg-elevated text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The hour as a compact control: previous / the hour (opens the full list) / next. */
function HourControl({ hour, onChange }: { hour: number; onChange: (h: number) => void }) {
  const button = "flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-text-primary";
  return (
    <div className="inline-flex items-center rounded-lg border border-border-subtle bg-bg-base p-0.5">
      <button className={button} onClick={() => onChange((hour + 23) % 24)} aria-label="Previous hour">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="relative px-2 text-sm text-text-primary">
        {hourLabel(hour)}
        <select
          aria-label="Hour"
          value={hour}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </div>
      <button className={button} onClick={() => onChange((hour + 1) % 24)} aria-label="Next hour">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Row({ label, value, title, quiet }: { label: string; value: string; title?: string; quiet?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", title && "cursor-help")} title={title}>
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={cn("shrink-0 text-sm", quiet ? "text-text-muted" : "text-text-primary")}>{value}</span>
    </div>
  );
}

/** Before (grey) and after (blue) as two thin bars on one scale. */
function BeforeAfterBar({ before, after, scale }: { before: number; after: number; scale: number }) {
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`;
  return (
    <div className="space-y-1">
      <div className="h-1 rounded-full bg-bg-base">
        <div className="h-1 rounded-full bg-text-muted" style={{ width: w(before) }} />
      </div>
      <div className="h-1 rounded-full bg-bg-base">
        <div className="h-1 rounded-full bg-accent" style={{ width: w(after) }} />
      </div>
    </div>
  );
}

/* ---------- panel ---------- */

interface Props {
  model: ScenarioModel;
  options: RoadOption[];
  selection: ScenarioSelection;
  step: LimitStep;
  current: number | null;
  /** "on 3 of 3 covered days" for the limit in force (hover only), or null. */
  limitDays: string | null;
  normal: NormalConditions | undefined;
  cell: Cell | undefined;
  downstreamCell: Cell | undefined;
  /** The selected station, for the result's heading. */
  station: Station | undefined;
  afterZone: Station | null;
  speed: SpeedScenario | null;
  note: string | null;
  onRoad: (option: RoadOption) => void;
  onStep: (step: LimitStep) => void;
  onChange: (patch: Partial<Pick<ScenarioSelection, "road" | "hour">>) => void;
  onHowWeKnow: () => void;
}

export function ScenarioPanel(p: Props) {
  const { model, options, selection, step, current, limitDays, normal, cell, downstreamCell, station, afterZone, speed, note } = p;
  const hour = selection.hour;
  const next = current === null ? null : current + step * STEP_KMH;
  const down = (step - 1) as LimitStep;
  const up = (step + 1) as LimitStep;
  const canDown = step > -1 && stepAllowed(current, down);
  const canUp = step < 1 && stepAllowed(current, up);
  const chosen = options.find((o) => o.key === roadKey(selection.pointId, selection.direction));
  const kind = selection.change === "lowered" ? "lowerings" : "raisings";
  const roads = selection.road === "dry" ? "dry roads" : "wet roads";
  const stats = cell?.metrics.mean_speed;
  const speedUnit = model.metrics.mean_speed.unit;

  const stepButton = (label: string, enabled: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={!enabled}
      title={enabled ? undefined : "The limit would leave 60–120 km/h"}
      className="h-10 w-14 rounded-lg border border-border-subtle bg-bg-base text-sm text-text-primary transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border-subtle"
    >
      {label}
    </button>
  );

  // The result: normal conditions when nothing changes, otherwise the change
  let result: ReactNode;
  if (step === 0) {
    const s = medianAt(normal?.mean_speed_kmh, hour);
    const v = medianAt(normal?.vehicles_per_hour, hour);
    const o = medianAt(normal?.share_over_limit, hour);
    const parts = [
      s !== null ? `${Math.round(s)} km/h` : null,
      v !== null ? `${Math.round(v).toLocaleString("en")} cars/h` : null,
      o !== null && current !== null ? `${Math.round(o * 100)} % over ${current} km/h` : null,
    ].filter(Boolean);
    result = (
      <p className="text-base text-text-secondary" title={normal ? `Median of ${normal.days} weekdays` : undefined}>
        Normal at {hourLabel(hour)}: {parts.length ? <span className="text-text-primary">{parts.join(" · ")}</span> : "no data for this hour"}
      </p>
    );
  } else if (!stats || stats.n === 0 || stats.mean === null) {
    result = <p className="text-base text-text-secondary">No past {STEP_KMH} km/h {kind} on {roads}, so there is no estimate.</p>;
  } else {
    const next_ = downstreamCell?.metrics.mean_speed;
    const volume = cell?.metrics.volume;
    const over = cell?.metrics.share_over_limit;
    const close = cell?.metrics.share_headway_lt_2s;
    const none = (s: MetricStats | undefined) => Boolean(s && isNoMeasurableChange(s));
    const shareValue = (s: MetricStats | undefined) => (none(s) ? "no measurable change" : wholePoints(s?.mean ?? null));
    const change = formatEffect(stats.mean, "mean_speed", speedUnit);
    const heading = "text-xs font-medium uppercase tracking-wide text-text-muted";
    result = (
      <div className="space-y-5">
        <section className="space-y-3">
          {station && (
            <h4 className={heading}>
              At {shortName(station)} ({station.tms_number})
            </h4>
          )}
          <div className="space-y-2">
            <div className={labelClass}>{current === null ? `Limit unknown · ${STEP_KMH} km/h ${selection.change === "lowered" ? "lower" : "higher"}` : `Limit ${current} → ${next}`}</div>
            {current !== null && speed ? (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <div className="cursor-help text-4xl font-semibold tracking-tight text-text-primary" title={exact(stats, "mean_speed", speedUnit)}>
                    <span className="text-text-muted">{Math.round(speed.normal)}</span> → {Math.round(speed.scenario)}
                    <span className="ml-1 text-lg font-normal text-text-muted">km/h</span>
                  </div>
                  <span className="text-base text-text-secondary">{change}</span>
                </div>
                <BeforeAfterBar before={speed.normal} after={speed.scenario} scale={Math.max(current, next ?? 0, speed.normal, speed.scenario)} />
              </>
            ) : (
              <div className="cursor-help text-4xl font-semibold tracking-tight text-text-primary" title={exact(stats, "mean_speed", speedUnit)}>
                {formatEffect(stats.mean, "mean_speed", "").trim()}
                <span className="ml-1 text-lg font-normal text-text-muted">km/h</span>
              </div>
            )}
            <p className={labelClass}>
              Measured after {stats.n} real {STEP_KMH} km/h {kind} on {roads}
            </p>
          </div>
          <div className="divide-y divide-border-subtle border-y border-border-subtle">
            <Row label="Drivers over the new limit" value={shareValue(over)} title={exact(over, "share_over_limit", "")} quiet={none(over)} />
            <Row label="Cars following closely (gap < 2 s)" value={shareValue(close)} title={exact(close, "share_headway_lt_2s", "")} quiet={none(close)} />
            <Row
              label="Traffic volume"
              value={none(volume) ? "no measurable change" : formatEffect(volume?.mean ?? null, "volume", model.metrics.volume.unit)}
              title={exact(volume, "volume", model.metrics.volume.unit)}
              quiet={none(volume)}
            />
          </div>
        </section>
        {afterZone && (
          <section className="space-y-2">
            <h4 className={heading}>Further down the road</h4>
            <div className="border-y border-border-subtle">
              <Row
                label={`${shortName(afterZone)} (${afterZone.tms_number})`}
                value={!next_ || next_.n === 0 || next_.mean === null ? "not measured" : `${none(next_) ? "no measurable change" : formatEffect(next_.mean, "mean_speed", speedUnit)} · all weather`}
                title={next_ && next_.n > 0 ? `downstream effect, pooled over all road surfaces, N ${next_.n}` : undefined}
                quiet={!next_ || next_.n === 0 || none(next_)}
              />
            </div>
          </section>
        )}
        {note && <p className={labelClass}>{note}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl border border-border-subtle bg-bg-panel p-5 tabular-nums">
      {/* Road picker: the chosen label wraps instead of being cut off; the native select lies invisibly on top */}
      <div className="space-y-2">
        <div className={labelClass}>Road</div>
        {options.length === 0 ? (
          <p className="text-sm text-text-muted">No speed-limit sign data in this area</p>
        ) : (
          <div className="relative rounded-lg border border-border-subtle bg-bg-base px-3 py-2 pr-9 text-base leading-snug text-text-primary focus-within:ring-2 focus-within:ring-accent/40">
            {chosen?.label ?? "Pick a road"}
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <select
              aria-label="Road"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={roadKey(selection.pointId, selection.direction)}
              onChange={(e) => {
                const option = options.find((o) => o.key === e.target.value);
                if (option) p.onRoad(option);
              }}
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* The limit: −20 / sign / +20 */}
      <div className="space-y-2">
        <div className={labelClass}>Speed limit</div>
        <div className="flex items-center justify-center gap-4">
          {stepButton(`−${STEP_KMH}`, canDown, () => p.onStep(down))}
          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full border-[8px] border-[#ef4444] bg-white text-2xl font-bold text-black",
              limitDays && "cursor-help",
            )}
            title={current !== null && limitDays ? `Now ${current} km/h, ${limitDays}` : undefined}
          >
            {current === null ? "?" : next}
          </div>
          {stepButton(`+${STEP_KMH}`, canUp, () => p.onStep(up))}
        </div>
      </div>

      {/* Surface and hour */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          options={[
            { value: "dry", label: "Dry" },
            { value: "wet", label: "Wet", title: "Moist or wet road" },
          ]}
          value={selection.road}
          onChange={(road) => p.onChange({ road })}
        />
        <HourControl hour={hour} onChange={(h) => p.onChange({ hour: h })} />
      </div>

      <div>{result}</div>

      <button onClick={p.onHowWeKnow} className="text-sm text-accent hover:underline">
        Impact Analysis →
      </button>
    </div>
  );
}
