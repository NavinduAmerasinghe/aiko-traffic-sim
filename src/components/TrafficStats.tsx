import { Gauge, Activity, Percent, Route, TrafficCone } from "lucide-react";
import type { TimelinePoint } from "@/types/traffic";
import { classifyTraffic, TRAFFIC_COLORS, TRAFFIC_LABELS } from "@/utils/traffic";
import { Card } from "@/components/ui/card";

interface Props {
  point: TimelinePoint | null;
  segmentsFound: number;
}

function Stat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="p-3.5">
      <div className="flex items-center gap-1.5 text-text-muted">
        {/* {icon} */}
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div
        className="mt-1.5 text-2xl font-semibold tabular-nums"
        style={{ color: accent ?? "#e6edf5" }}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

export function TrafficStats({ point, segmentsFound }: Props) {
  const state = classifyTraffic(point?.relative_speed);
  const hasObs = point != null;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      <Stat
        icon={<Gauge className="h-3.5 w-3.5" />}
        label="Current Speed"
        value={hasObs ? `${point!.current_speed}` : "—"}
        sub="km/h"
      />
      <Stat
        icon={<Activity className="h-3.5 w-3.5" />}
        label="Typical Speed"
        value={hasObs ? `${point!.typical_speed}` : "—"}
        sub="km/h"
      />
      <Stat
        icon={<Percent className="h-3.5 w-3.5" />}
        label="Relative Speed"
        value={hasObs ? `${point!.relative_speed}%` : "—"}
        sub={hasObs ? "of typical" : "no observation"}
        accent={hasObs ? TRAFFIC_COLORS[state] : undefined}
      />
      <Stat
        icon={<Route className="h-3.5 w-3.5" />}
        label="Road Segments"
        value={`${segmentsFound}`}
        sub="in radius"
      />
      {/* <Stat
        icon={<TrafficCone className="h-3.5 w-3.5" />}
        label="Traffic Status"
        value={hasObs ? TRAFFIC_LABELS[state] : "No Data"}
        accent={TRAFFIC_COLORS[state]}
      /> */}
    </div>
  );
}
