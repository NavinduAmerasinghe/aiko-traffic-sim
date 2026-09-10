import { MapPin, Route, LineChart, Eye, ArrowDown } from "lucide-react";
import type { TrafficResponse } from "@/types/traffic";
import { Collapsible } from "@/components/ui/collapsible";

interface Props {
  data: TrafficResponse | null;
}

function Stage({
  icon,
  title,
  summary,
  json,
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  json?: unknown;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-base">
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
          <span className="text-accent">{icon}</span>
          <span className="font-medium text-text-primary">{title}</span>
          <span className="ml-auto text-xs text-text-muted">{summary}</span>
        </summary>
        {json !== undefined && (
          <pre className="max-h-56 overflow-auto border-t border-border-subtle px-3 py-2 font-mono text-[11px] leading-relaxed text-text-secondary">
            {JSON.stringify(json, null, 2)}
          </pre>
        )}
      </details>
    </div>
  );
}

export function ApiResponseExplorer({ data }: Props) {
  return (
    <Collapsible title="API Response Explorer" right={<span>data flow</span>}>
      <p className="mb-3 text-xs text-text-muted">
        How the endpoint's payload flows through the app. Expand each stage to
        inspect the underlying JSON.
      </p>
      <div className="space-y-1.5">
        <Stage
          icon={<MapPin className="h-4 w-4" />}
          title="Location"
          summary={
            data ? `${data.location.latitude}, ${data.location.longitude}` : "—"
          }
          json={data?.location}
        />
        <div className="flex justify-center text-text-muted">
          <ArrowDown className="h-3.5 w-3.5" />
        </div>
        <Stage
          icon={<Route className="h-4 w-4" />}
          title="Road Segments"
          summary={data ? `${data.segments.features.length} features` : "—"}
          json={data?.segments.features[0]}
        />
        <div className="flex justify-center text-text-muted">
          <ArrowDown className="h-3.5 w-3.5" />
        </div>
        <Stage
          icon={<LineChart className="h-4 w-4" />}
          title="Traffic Timeline"
          summary={data ? `${data.timeline.length} observations` : "—"}
          json={data?.timeline[0]}
        />
        <div className="flex justify-center text-text-muted">
          <ArrowDown className="h-3.5 w-3.5" />
        </div>
        <Stage
          icon={<Eye className="h-4 w-4" />}
          title="Visualization"
          summary="map · charts · simulation"
        />
      </div>
    </Collapsible>
  );
}
