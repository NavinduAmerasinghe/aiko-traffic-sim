import { Search, Loader2 } from "lucide-react";
import type { TrafficQueryParams } from "@/types/traffic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

interface Props {
  params: TrafficQueryParams;
  onChange: (p: TrafficQueryParams) => void;
  onFetch: () => void;
  loading: boolean;
}

export function ApiQueryPanel({ params, onChange, onFetch, loading }: Props) {
  const set = <K extends keyof TrafficQueryParams>(k: K, v: TrafficQueryParams[K]) =>
    onChange({ ...params, [k]: v });
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label>Latitude</Label>
            <Input
              type="number"
              step="0.000001"
              value={params.latitude}
              onChange={(e) => set("latitude", num(e.target.value))}
            />
          </div>
          <div>
            <Label>Longitude</Label>
            <Input
              type="number"
              step="0.000001"
              value={params.longitude}
              onChange={(e) => set("longitude", num(e.target.value))}
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={params.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <Label>Time</Label>
            <Input type="time" value={params.time} onChange={(e) => set("time", e.target.value)} />
          </div>
          <div>
            <Label>Radius (m)</Label>
            <Input
              type="number"
              value={params.radius}
              onChange={(e) => set("radius", num(e.target.value))}
            />
          </div>
          <div>
            <Label>Window (min)</Label>
            <Input
              type="number"
              value={params.window}
              onChange={(e) => set("window", num(e.target.value))}
            />
          </div>
        </div>
        <Button onClick={onFetch} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching…
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Fetch Traffic Data
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
