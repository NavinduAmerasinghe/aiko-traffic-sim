import type { TrafficState, TimelinePoint } from "@/types/traffic";

/**
 * Map a relative_speed percentage to a traffic-condition bucket.
 *
 *   90–100% = Free flow
 *   70–89%  = Moderate
 *   50–69%  = Slow
 *   < 50%   = Heavy congestion
 */
export function classifyTraffic(relativeSpeed: number | null | undefined): TrafficState {
  if (relativeSpeed == null || Number.isNaN(relativeSpeed)) return "none";
  if (relativeSpeed >= 90) return "free";
  if (relativeSpeed >= 70) return "moderate";
  if (relativeSpeed >= 50) return "slow";
  return "heavy";
}

export const TRAFFIC_COLORS: Record<TrafficState, string> = {
  free: "#22c55e",
  moderate: "#eab308",
  slow: "#f97316",
  heavy: "#ef4444",
  none: "#64748b",
};

export const TRAFFIC_LABELS: Record<TrafficState, string> = {
  free: "Free Flow",
  moderate: "Moderate",
  slow: "Slow",
  heavy: "Heavy Congestion",
  none: "No Data",
};

export const TRAFFIC_LEGEND: { state: TrafficState; range: string }[] = [
  { state: "free", range: "90–100%" },
  { state: "moderate", range: "70–89%" },
  { state: "slow", range: "50–69%" },
  { state: "heavy", range: "< 50%" },
];

export function trafficColor(relativeSpeed: number | null | undefined): string {
  return TRAFFIC_COLORS[classifyTraffic(relativeSpeed)];
}

export function trafficLabel(relativeSpeed: number | null | undefined): string {
  return TRAFFIC_LABELS[classifyTraffic(relativeSpeed)];
}

/** Format a snapshot_time ISO string to HH:mm (UTC), used across the timeline. */
export function formatSnapshotUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Safe accessor for the currently selected timeline point. */
export function pointAt(
  timeline: TimelinePoint[],
  index: number,
): TimelinePoint | null {
  if (timeline.length === 0) return null;
  const i = Math.max(0, Math.min(index, timeline.length - 1));
  return timeline[i] ?? null;
}
