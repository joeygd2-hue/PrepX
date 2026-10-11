import { Sparkles } from "lucide-react";
import { formatDay } from "@/lib/dates";

/** Shown while the free launch period gives everyone Pro. */
export function LaunchBanner({ endsOn }: { endsOn: string }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-[18px] border border-accent/45 bg-accent/12 px-4 py-3">
      <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
        <Sparkles className="size-4" />
      </span>
      <p className="text-sm leading-snug">
        <span className="font-semibold">Everything is free during launch.</span>{" "}
        <span className="text-muted">Pro is unlocked for everyone through {formatDay(endsOn, { month: "long", day: "numeric" })}. No card needed.</span>
      </p>
    </div>
  );
}
