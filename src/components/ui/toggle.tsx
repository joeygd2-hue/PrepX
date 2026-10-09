"use client";
import { useOptimistic, useTransition } from "react";
import { cn } from "@/lib/cn";

/**
 * Accessible switch that persists through a server action. The action receives the new
 * boolean and must enforce authorization itself.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => Promise<unknown>;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label={label}
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            setOptimistic(!optimistic);
            await onChange(!optimistic);
          })
        }
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
          optimistic ? "bg-fg" : "bg-subtle-2",
        )}
      >
        <span className={cn("inline-block size-6 rounded-full bg-bg shadow transition-transform", optimistic ? "translate-x-5.5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
