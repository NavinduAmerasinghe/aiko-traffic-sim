import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Minimal accessible disclosure used by the debug / table / explorer panels. */
export function Collapsible({
  title,
  defaultOpen = false,
  right,
  children,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={cn("rounded-xl border border-border-subtle bg-bg-panel", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <ChevronDown
            className={cn(
              "h-4 w-4 text-text-muted transition-transform",
              open && "rotate-180",
            )}
          />
          {title}
        </span>
        <span className="flex items-center gap-2 text-xs text-text-muted">{right}</span>
      </button>
      {open && <div className="border-t border-border-subtle px-4 py-3">{children}</div>}
    </div>
  );
}
