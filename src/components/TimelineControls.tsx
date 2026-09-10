import { Play, Pause, RotateCcw } from "lucide-react";
import type { TimelinePoint } from "@/types/traffic";
import { formatSnapshotUtc, classifyTraffic, TRAFFIC_COLORS } from "@/utils/traffic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  timeline: TimelinePoint[];
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
}

export function TimelineControls({
  timeline,
  selectedIndex,
  onSelectIndex,
  playing,
  onTogglePlay,
  onReset,
}: Props) {
  const empty = timeline.length === 0;
  const current = timeline[selectedIndex];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Timeline</CardTitle>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Selected time</span>
          <span className="rounded-md bg-bg-elevated px-2 py-0.5 font-mono text-text-primary">
            {current ? `${formatSnapshotUtc(current.snapshot_time)} UTC` : "—"}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-4 text-center text-sm text-text-muted">
            No traffic observations available for this timestamp/window.
          </p>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-1.5">
              <Button size="sm" variant="subtle" onClick={onTogglePlay}>
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? "Pause" : "Play"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onReset}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <span className="ml-auto text-xs text-text-muted">
                Auto-advances through observations
              </span>
            </div>

            {/* Tick row */}
            <div className="relative">
              <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border-strong" />
              <div className="relative flex justify-between">
                {timeline.map((p, i) => {
                  const active = i === selectedIndex;
                  const color = TRAFFIC_COLORS[classifyTraffic(p.relative_speed)];
                  return (
                    <button
                      key={p.snapshot_time}
                      onClick={() => onSelectIndex(i)}
                      className="group flex flex-col items-center gap-1.5"
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border-2 transition-transform group-hover:scale-125"
                        style={{
                          backgroundColor: active ? color : "#161d2b",
                          borderColor: color,
                          transform: active ? "scale(1.3)" : undefined,
                        }}
                      />
                      <span
                        className={
                          "font-mono text-[11px] " +
                          (active ? "text-text-primary" : "text-text-muted")
                        }
                      >
                        {formatSnapshotUtc(p.snapshot_time)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={0}
              max={timeline.length - 1}
              step={1}
              value={selectedIndex}
              onChange={(e) => onSelectIndex(Number(e.target.value))}
              className="mt-4 w-full accent-accent"
              aria-label="Timeline position"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
