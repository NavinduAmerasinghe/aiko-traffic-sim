import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { TimelinePoint } from "@/types/traffic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toChartData, axisProps, ChartTooltip } from "./chartUtils";

interface Props {
  timeline: TimelinePoint[];
  selectedIndex: number;
}

export function RelativeSpeedChart({ timeline, selectedIndex }: Props) {
  const data = toChartData(timeline);
  const selected = data[selectedIndex];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relative Speed (% of typical)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">
            No traffic observations to chart.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="relFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#212a3a" vertical={false} />
              <XAxis dataKey="time" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 110]} ticks={[0, 50, 70, 90, 100]} />
              <Tooltip content={<ChartTooltip unit="%" />} />
              {/* Threshold guides for the traffic-state buckets */}
              <ReferenceLine y={90} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={70} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              {selected && (
                <ReferenceLine x={selected.time} stroke="#3b82f6" strokeDasharray="4 3" />
              )}
              <Area
                name="Relative"
                type="monotone"
                dataKey="relative"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#relFill)"
                dot={{ r: 2.5, fill: "#22c55e" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
