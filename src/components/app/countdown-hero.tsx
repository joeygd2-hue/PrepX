import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OrgBadge, Chip } from "@/components/ui/badge";
import { HeroTexture } from "@/components/ui/card";
import { formatRange } from "@/lib/dates";
import type { OrgId } from "@/lib/orgs";
import type { Target } from "@/server/dashboard";

export function CountdownHero({ target, daysLeft }: { target: Target; daysLeft: number }) {
  const label = daysLeft > 1 ? "days to go" : daysLeft === 1 ? "day to go" : daysLeft === 0 ? "It's today" : "days ago";
  return (
    <section aria-label="Competition countdown" className="relative overflow-hidden rounded-[28px] bg-hero p-6 text-hero-fg shadow-float sm:p-8">
      <HeroTexture />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <OrgBadge org={target.org as OrgId} onHero />
          {target.dateChanged ? <Chip tone="accent">Date changed</Chip> : null}
          {target.status !== "confirmed" ? <Chip tone="inverse">{target.status === "tentative" ? "Tentative date" : "Unconfirmed date"}</Chip> : null}
          {target.kind === "custom" ? <Chip tone="inverse">Your date</Chip> : null}
        </div>
        <p className="mt-8 flex items-end gap-3">
          <span className="font-mono text-[5.5rem] font-medium leading-[0.8] tracking-[-0.06em] tabular sm:text-[7.5rem]">{Math.abs(daysLeft)}</span>
          <span className="pb-1 text-lg text-hero-muted">{label}</span>
        </p>
        <h2 className="mt-7 text-[1.65rem] leading-tight sm:text-3xl">
          <span className="font-display italic">{target.name}</span>
        </h2>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.1em] text-hero-muted">
          {formatRange(target.startsOn, target.endsOn)}
          {target.location ? ` · ${target.location}` : ""}
        </p>
        {target.status !== "confirmed" && target.statusNote ? <p className="mt-4 max-w-lg text-sm text-hero-muted">{target.statusNote}</p> : null}
        {target.sourceUrl ? (
          <Link href={target.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm text-hero-muted underline-offset-4 hover:text-hero-fg hover:underline">
            Source <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
