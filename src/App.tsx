import { useState } from "react";
import { cn } from "@/lib/utils";
import { ScenarioView } from "@/components/scenario/ScenarioView";
import { CLOSURE_BANNER, ClosureView } from "@/components/network/ClosureView";

type Tab = "scenario" | "network";

const TABS: { id: Tab; label: string; title?: string }[] = [
  { id: "scenario", label: "Scenario" },
  { id: "network", label: "Road closure (model)", title: CLOSURE_BANNER },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("scenario");
  return (
    <div className="min-h-screen bg-bg-base">
      <nav className="flex gap-1 border-b border-border-subtle bg-bg-panel px-4 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.id ? "border-border-subtle bg-bg-base text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "scenario" ? <ScenarioView /> : <ClosureView />}
    </div>
  );
}
