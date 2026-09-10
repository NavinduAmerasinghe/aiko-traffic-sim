import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  color,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 text-xs font-medium text-text-secondary",
        className,
      )}
      {...props}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {props.children}
    </span>
  );
}
