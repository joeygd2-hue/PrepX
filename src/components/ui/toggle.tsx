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
        <p className="font-medium tracking-[-0.01em]">{label}</p>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      <Switch
        checked={optimistic}
        label={label}
        disabled={disabled || pending}
        onToggle={() =>
          start(async () => {
            setOptimistic(!optimistic);
            await onChange(!optimistic);
          })
        }
      />
    </div>
  );
}

export function Switch({ checked, label, disabled, onToggle }: { checked: boolean; label: string; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-60",
        checked ? "border-transparent bg-accent" : "border-border-strong bg-subtle-2",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-[cubic-bezier(.2,.7,.2,1)]",
          checked ? "translate-x-[23px] bg-accent-fg" : "translate-x-[3px] bg-card",
        )}
      />
    </button>
  );
}
