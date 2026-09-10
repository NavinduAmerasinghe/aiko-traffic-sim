import type { TimelinePoint } from "@/types/traffic";
import { formatSnapshotUtc } from "@/utils/traffic";

export interface ChartDatum {
  time: string;
  current: number;
  typical: number;
  relative: number;
  index: number;
}

export function toChartData(timeline: TimelinePoint[]): ChartDatum[] {
  return timeline.map((p, i) => ({
    time: formatSnapshotUtc(p.snapshot_time),
    current: p.current_speed,
    typical: p.typical_speed,
    relative: p.relative_speed,
    index: i,
  }));
}

export const axisProps = {
  stroke: "#5f6b82",
  tick: { fill: "#9aa7bd", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "#212a3a" },
} as const;

export function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-bg-elevated px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-mono text-text-muted">{label} UTC</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}</span>
          <span className="ml-auto font-mono text-text-primary">
            {p.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
