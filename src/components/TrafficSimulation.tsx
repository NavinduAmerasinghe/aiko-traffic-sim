import { Play, Pause, RotateCcw, Car, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 1, 2, 5];

interface Props {
  playing: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  simSpeed: number;
  onSpeedChange: (s: number) => void;
  showVehicles: boolean;
  onToggleVehicles: () => void;
  currentSpeed: number | null;
}

export function TrafficSimulation({
  playing,
  onTogglePlay,
  onReset,
  simSpeed,
  onSpeedChange,
  showVehicles,
  onToggleVehicles,
  currentSpeed,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Car className="h-4 w-4 text-accent" /> Vehicle Simulation
        </CardTitle>
        <button
          onClick={onToggleVehicles}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          {showVehicles ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {showVehicles ? "Visible" : "Hidden"}
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="subtle" onClick={onTogglePlay}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-text-muted">
            Simulation Speed
          </div>
          <div className="inline-flex rounded-lg border border-border-subtle bg-bg-base p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  simSpeed === s
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] leading-snug text-text-muted">
          Vehicle motion is driven by the observed aggregate{" "}
          <span className="text-text-secondary">current speed</span>
          {currentSpeed != null ? ` (${currentSpeed} km/h)` : ""}. These are
          simulated markers, not real vehicle positions.
        </p>
      </CardContent>
    </Card>
  );
}
