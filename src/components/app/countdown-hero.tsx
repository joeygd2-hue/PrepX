import Link from "next/link";
import { OrgBadge, Chip } from "@/components/ui/badge";
import { formatRange } from "@/lib/dates";
import type { OrgId } from "@/lib/orgs";
import type { Target } from "@/server/dashboard";

export function CountdownHero({ target, daysLeft }: { target: Target; daysLeft: number }) {
  const label = daysLeft > 1 ? "days to go" : daysLeft === 1 ? "day to go" : daysLeft === 0 ? "It's today" : "days ago";
  return (
    <section aria-label="Competition countdown" className="rounded-3xl bg-fg p-6 text-bg sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <OrgBadge org={target.org as OrgId} />
        {target.dateChanged ? <Chip tone="inverse">Date changed</Chip> : null}
        {target.status !== "confirmed" ? <Chip tone="inverse">{target.status === "tentative" ? "Tentative date" : "Unconfirmed date"}</Chip> : null}
        {target.kind === "custom" ? <Chip tone="inverse">Your date</Chip> : null}
      </div>
      <p className="mt-5 flex items-baseline gap-3">
        <span className="text-7xl font-semibold leading-none tracking-tight tabular sm:text-8xl">{Math.abs(daysLeft)}</span>
        <span className="text-xl opacity-80">{label}</span>
      </p>
      <h2 className="mt-5 text-xl font-semibold sm:text-2xl">{target.name}</h2>
      <p className="mt-2 opacity-80">
        {formatRange(target.startsOn, target.endsOn)}
        {target.location ? ` · ${target.location}` : ""}
      </p>
      {target.status !== "confirmed" && target.statusNote ? <p className="mt-3 text-sm opacity-70">{target.statusNote}</p> : null}
      {target.sourceUrl ? (
        <Link href={target.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm underline underline-offset-2 opacity-70">
          Source
        </Link>
      ) : null}
    </section>
  );
}
