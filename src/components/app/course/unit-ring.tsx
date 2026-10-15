import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Small progress ring for a course unit (0–1). Mastered units show a filled accent check. */
export function UnitRing({ value, mastered, className }: { value: number; mastered: boolean; className?: string }) {
  if (mastered)
    return (
      <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg", className)}>
        <Check className="size-4" strokeWidth={3} />
      </span>
    );
  const size = 36;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <svg aria-hidden width={size} height={size} className={cn("shrink-0 -rotate-90", className)}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--subtle-2)" strokeWidth={stroke} />
      {pct > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--fg)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      ) : null}
    </svg>
  );
}
