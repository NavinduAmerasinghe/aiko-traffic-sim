import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { RequestDebugInfo } from "@/types/traffic";
import { Collapsible } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  debug: RequestDebugInfo | null;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (label: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  return { copied, copy };
}

function StatBox({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-base px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={cn("mt-0.5 font-mono text-sm", tone ?? "text-text-primary")}>{value}</div>
    </div>
  );
}

export function ApiDebugPanel({ debug }: Props) {
  const { copied, copy } = useCopy();
  const statusTone =
    debug?.error != null
      ? "text-traffic-heavy"
      : debug?.httpStatus === 200
        ? "text-traffic-free"
        : "text-text-primary";

  return (
    <Collapsible
      title="API Response / Debug"
      defaultOpen
      right={
        debug ? (
          <span className={statusTone}>
            {debug.httpStatus ?? "—"} · {debug.responseTimeMs} ms
          </span>
        ) : (
          <span>no request yet</span>
        )
      }
    >
      {!debug ? (
        <p className="py-4 text-center text-sm text-text-muted">
          Fetch data to inspect the request and response here.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <StatBox label="Mode" value={debug.mode} />
            <StatBox
              label="HTTP Status"
              value={debug.httpStatus != null ? String(debug.httpStatus) : "—"}
              tone={statusTone}
            />
            <StatBox label="Response Time" value={`${debug.responseTimeMs} ms`} />
            <StatBox label="Segments" value={String(debug.segmentsFound)} />
            <StatBox label="Timeline Obs." value={String(debug.timelineCount)} />
          </div>

          {debug.error && (
            <div className="rounded-lg border border-traffic-heavy/40 bg-traffic-heavy/10 px-3 py-2 text-xs text-traffic-heavy">
              {debug.error}
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">
                Request URL
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy("url", debug.requestUrl)}
                className="h-6 px-1.5"
              >
                {copied === "url" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Copy Request
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-base px-3 py-2 font-mono text-[11px] text-text-secondary">
              {debug.requestUrl}
            </pre>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">
                Raw JSON Response
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy("json", JSON.stringify(debug.rawResponse, null, 2))}
                className="h-6 px-1.5"
              >
                {copied === "json" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Copy JSON
              </Button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg border border-border-subtle bg-bg-base px-3 py-2 font-mono text-[11px] leading-relaxed text-text-secondary">
              {JSON.stringify(debug.rawResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Collapsible>
  );
}
