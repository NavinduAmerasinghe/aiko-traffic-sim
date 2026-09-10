import { X } from "lucide-react";
import type { TrafficResponse } from "@/types/traffic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: TrafficResponse | null;
  selectedSegmentId: string | null;
  onClear: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-2 last:border-0">
      <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
      <span className="text-right font-mono text-xs text-text-primary">{value}</span>
    </div>
  );
}

export function SegmentInfo({ data, selectedSegmentId, onClear }: Props) {
  const seg = data?.segments.features.find(
    (f) => f.properties.segment_id === selectedSegmentId,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Segment Information</CardTitle>
        {seg && (
          <button onClick={onClear} className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        )}
      </CardHeader>
      <CardContent>
        {!seg ? (
          <p className="py-6 text-center text-sm text-text-muted">
            Click a road segment on the map to inspect its metadata.
          </p>
        ) : (
          <div>
            <Row label="Segment ID" value={seg.properties.segment_id} />
            <Row label="Route ID" value={seg.properties.route_id} />
            <Row label="Route Name" value={seg.properties.route_name} />
            <Row label="Length" value={`${seg.properties.segment_length_m} m`} />
            <Row
              label="Distance"
              value={`${seg.properties.dist_from_entity_m.toFixed(1)} m`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
