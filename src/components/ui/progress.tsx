import { cn } from "@/lib/cn";

export function ProgressBar({ value, max = 100, className, label, inverse }: { value: number; max?: number; className?: string; label?: string; inverse?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", inverse ? "bg-hero-line" : "bg-subtle-2", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", inverse ? "bg-accent" : "bg-fg")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Circular gauge. The arc uses the accent color with an ink outline so it reads on both themes. */
export function Ring({ value, size = 84, label, inverse }: { value: number; size?: number; label: string; inverse?: boolean }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(pct)} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={inverse ? "var(--hero-line)" : "var(--subtle-2)"} strokeWidth={stroke} />
        {pct > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[26px] font-medium tracking-tight tabular">{Math.round(pct)}</span>
    </div>
  );
}
