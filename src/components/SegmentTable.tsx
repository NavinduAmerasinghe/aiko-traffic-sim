import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import type { TrafficResponse, SegmentFeature } from "@/types/traffic";
import { Collapsible } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type SortKey = "segment_id" | "route_id" | "segment_length_m" | "dist_from_entity_m";

interface Props {
  data: TrafficResponse | null;
  selectedSegmentId: string | null;
  onSelectSegment: (id: string) => void;
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "segment_id", label: "Segment ID" },
  { key: "route_id", label: "Route" },
  { key: "segment_length_m", label: "Length", numeric: true },
  { key: "dist_from_entity_m", label: "Distance", numeric: true },
];

export function SegmentTable({ data, selectedSegmentId, onSelectSegment }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("dist_from_entity_m");
  const [asc, setAsc] = useState(true);

  const features = data?.segments.features ?? [];
  const sorted = [...features].sort((a, b) => {
    const av = a.properties[sortKey];
    const bv = b.properties[sortKey];
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
    return asc ? cmp : -cmp;
  });

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(true);
    }
  };

  const fmt = (f: SegmentFeature, k: SortKey) => {
    const v = f.properties[k];
    if (k === "segment_length_m") return `${v} m`;
    if (k === "dist_from_entity_m") return `${Number(v).toFixed(1)} m`;
    return String(v);
  };

  return (
    <Collapsible
      title="Road Segments"
      right={<span>{features.length} segments</span>}
      defaultOpen
    >
      {features.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">No segments returned.</p>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-bg-panel">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-2 py-2">
                    <button
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "flex items-center gap-1 font-medium uppercase tracking-wider",
                        sortKey === c.key ? "text-text-primary" : "text-text-muted",
                      )}
                    >
                      {c.label}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => {
                const active = f.properties.segment_id === selectedSegmentId;
                return (
                  <tr
                    key={f.properties.segment_id}
                    onClick={() => onSelectSegment(f.properties.segment_id)}
                    className={cn(
                      "cursor-pointer border-t border-border-subtle transition-colors",
                      active ? "bg-accent-soft/40" : "hover:bg-bg-hover",
                    )}
                  >
                    {COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-2 py-1.5 font-mono",
                          c.key === "segment_id" ? "text-text-secondary" : "text-text-primary",
                          active && "text-text-primary",
                        )}
                      >
                        {fmt(f, c.key)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Collapsible>
  );
}
