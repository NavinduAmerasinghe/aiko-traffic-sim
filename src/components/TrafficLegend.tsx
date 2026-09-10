import { TRAFFIC_LEGEND, TRAFFIC_COLORS, TRAFFIC_LABELS } from "@/utils/traffic";

export function TrafficLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-secondary">
      <span className="uppercase tracking-wider text-text-muted">Traffic</span>
      {TRAFFIC_LEGEND.map((l) => (
        <span key={l.state} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: TRAFFIC_COLORS[l.state] }}
          />
          {TRAFFIC_LABELS[l.state]}
          <span className="text-text-muted">({l.range})</span>
        </span>
      ))}
    </div>
  );
}
