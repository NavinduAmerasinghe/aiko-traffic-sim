import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import type { TimelinePoint } from "@/types/traffic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toChartData, axisProps, ChartTooltip } from "./chartUtils";

interface Props {
  timeline: TimelinePoint[];
  selectedIndex: number;
}

export function SpeedChart({ timeline, selectedIndex }: Props) {
  const data = toChartData(timeline);
  const selected = data[selectedIndex];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Speed ( Current vs Typical) </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">
            No traffic observations to chart.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#212a3a" vertical={false} />
              <XAxis dataKey="time" {...axisProps} />
              <YAxis {...axisProps} domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip content={<ChartTooltip unit=" km/h" />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#9aa7bd" }}
                iconType="plainline"
              />
              {selected && (
                <ReferenceLine x={selected.time} stroke="#3b82f6" strokeDasharray="4 3" />
              )}
              <Line
                name="Typical"
                type="monotone"
                dataKey="typical"
                stroke="#5f6b82"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
              <Line
                name="Current"
                type="monotone"
                dataKey="current"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
