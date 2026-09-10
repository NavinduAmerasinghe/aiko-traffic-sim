import { RefreshCw, Loader2, Circle } from "lucide-react";
import type { DataMode } from "@/types/traffic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  mode: DataMode;
  onModeChange: (m: DataMode) => void;
  loading: boolean;
  httpStatus: number | null;
  error: string | null;
  onRefresh: () => void;
}

export function Header({ mode, onModeChange, loading, httpStatus, error, onRefresh }: Props) {
  const status = loading
    ? { label: "Fetching…", tone: "text-accent" }
    : error
      ? { label: "API Error", tone: "text-traffic-heavy" }
      : httpStatus === 200
        ? {
            label: mode === "mock" ? "Mock Data — static sample" : "Live API Connected",
            tone: "text-traffic-free",
          }
        : { label: "Idle", tone: "text-text-muted" };

  return (
    <header className="flex flex-col gap-3 border-b border-border-subtle bg-bg-panel/60 px-4 py-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        {/* <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated">
          <svg viewBox="0 0 32 32" className="h-5 w-5">
            <path d="M6 20h20M9 12h14" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="11" cy="20" r="2" fill="#22c55e" />
            <circle cx="21" cy="12" r="2" fill="#eab308" />
          </svg>
        </div> */}
        <div>
          <h1 className="text-base font-semibold leading-tight text-text-primary">
            AIKO Traffic Simulation
          </h1>
          {/* <p className="text-xs text-text-muted">
            Traffic flow visualization and forecasting prototype
          </p> */}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Mock / Live toggle */}
        {/* <div className="inline-flex rounded-lg border border-border-subtle bg-bg-base p-0.5">
          {(["live", "mock"] as DataMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              title={m === "mock" ? "Mock Data — static sample" : "Live API"}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                mode === m ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {m === "mock" ? "Mock Data — static sample" : "Live API"}
            </button>
          ))}
        </div> */}

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-base px-2.5 py-1.5 text-xs font-medium",
            status.tone,
          )}
        >
          <Circle className="h-2 w-2 fill-current" />
          {status.label}
        </span>

        <Button variant="subtle" size="icon" onClick={onRefresh} disabled={loading} aria-label="Refresh">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
