import { Sparkles, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  currentSpeed: number | null;
}

/**
 * Placeholder for the future forecasting integration. Deliberately shows NO
 * fake numbers — the "+15 min" slot stays "Coming soon" until the LightGBM
 * model (aiko-traffic-forecasting@production) is wired in.
 */
export function MlForecast({ currentSpeed }: Props) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute right-3 top-3 text-text-muted/40">
        <Lock className="h-4 w-4" />
      </div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> ML Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-muted">
              Current Speed
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-text-primary">
              {currentSpeed != null ? `${currentSpeed} km/h` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-muted">
              Predicted (+15 min)
            </div>
            <div className="mt-1 text-xl font-semibold text-text-muted">Coming soon</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Prediction Status</span>
          <Badge color="#64748b">Not connected</Badge>
        </div>
        <p className="rounded-lg border border-dashed border-border-strong bg-bg-base/50 px-3 py-2 text-xs leading-relaxed text-text-muted">
          Future integration: connect the LightGBM traffic forecasting model here
          (forecasts speed +15&nbsp;min at 5&nbsp;min resolution).
        </p>
      </CardContent>
    </Card>
  );
}
