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
      className={cn("h-1.5 w-full overflow-hidden rounded-full", inverse ? "bg-white/25" : "bg-subtle-2", className)}
    >
      <div className={cn("h-full rounded-full", inverse ? "bg-white" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 76, label }: { value: number; size?: number; label: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(pct)} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--subtle-2)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--fg)"
          strokeWidth={6}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold tabular">{Math.round(pct)}</span>
    </div>
  );
}
