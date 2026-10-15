import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { schema } from "@/db";
import { OrgBadge, Chip, VerificationChip } from "@/components/ui/badge";
import { Notice } from "@/components/ui/form";
import type { OrgId } from "@/lib/orgs";

type EventRow = typeof schema.events.$inferSelect;

export function eventLines(e: EventRow) {
  const c = e.components;
  const lines: string[] = [];
  if (c.exam) lines.push(`Test: ${c.exam.label}${c.exam.questions || c.exam.minutes ? ` (${[c.exam.questions && `${c.exam.questions} questions`, c.exam.minutes && `${c.exam.minutes} min`].filter(Boolean).join(", ")})` : ""}`);
  if (c.roleplay) {
    const bits = [c.roleplay.prepMinutes && `${c.roleplay.prepMinutes} min prep`, c.roleplay.performMinutes && `${c.roleplay.performMinutes} min with the judge`, c.roleplay.indicators && `${c.roleplay.indicators} indicators`].filter(Boolean);
    lines.push(`Role-play${c.roleplay.count && c.roleplay.count > 1 ? `s (${c.roleplay.count})` : ""}${bits.length ? `: ${bits.join(", ")}` : ""}`);
  }
  if (c.caseStudy) lines.push(`Case study: ${[c.caseStudy.prepMinutes && `${c.caseStudy.prepMinutes} min prep`, c.caseStudy.performMinutes && `${c.caseStudy.performMinutes} min with the judges`].filter(Boolean).join(", ")}${c.caseStudy.team ? ", team" : ""}`);
  if (c.written) lines.push(`Written: ${c.written.label}`);
  if (c.presentation) lines.push(`Presentation: ${c.presentation.label}`);
  if (c.interview) lines.push("Interview");
  if (c.production) lines.push(`Performance: ${c.production.label}`);
  if (c.spelldown) lines.push("Spelldown round");
  return lines;
}

export function EventSummary({ event, action }: { event: EventRow; action?: React.ReactNode }) {
  const lines = eventLines(event);
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <OrgBadge org={event.org as OrgId} />
          <Chip className="font-mono tracking-wider">{event.code}</Chip>
          {event.verification !== "verified" && event.verification !== "reference_observed" ? <Chip tone="warning">Format unverified</Chip> : null}
        </div>
        {action}
      </div>
      <h2 className="mt-5 text-[1.6rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-3xl">{event.name}</h2>
      <p className="eyebrow mt-3">{[shortCategory(event.category), event.cluster].filter(Boolean).join(" · ")}</p>
      {lines.length ? (
        <ul className="mt-5 space-y-2 border-t border-border pt-4 text-[15px]">
          {lines.map((l) => (
            <li key={l} className="flex gap-3">
              <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-fg/40" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function shortCategory(c: string) {
  return c.replace(/ \(.*\)$/, "").replace(/^./, (m) => m.toUpperCase());
}

export function EventFacts({ event }: { event: EventRow }) {
  const rows: [string, React.ReactNode][] = [
    ["Organization", event.org.toUpperCase()],
    ["Category", event.category],
    ["Career cluster", event.cluster ?? "—"],
    ["Division", event.division],
    ["Participants", event.team ?? "Individual"],
    ["Format", event.formatLabel],
    ["Season", event.season],
    ["Status", <VerificationChip key="v" status={event.verification} />],
  ];
  return (
    <div className="space-y-4">
      {event.verification === "unverified" ? (
        <Notice tone="warning">
          These format details haven&apos;t been verified against the {event.season} official guidelines yet. Always confirm time limits, question counts and requirements in the official
          guidelines before competition.
        </Notice>
      ) : event.verification === "reference_observed" ? (
        <Notice>Format details were checked against a published reference. Confirm specifics in the official guidelines.</Notice>
      ) : null}
      <dl className="divide-y divide-border rounded-[24px] border border-border bg-card px-5 shadow-card">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-3.5 text-sm">
            <dt className="eyebrow">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {event.rubric.length ? (
        <div className="rounded-[24px] border border-border bg-card p-5 shadow-card sm:p-6">
          <h3 className="text-lg font-semibold tracking-[-0.02em]">What PrepX practice feedback looks at</h3>
          <p className="mt-1 text-sm text-muted">
            {event.rubricVerification === "verified" ? "Based on the official rubric." : "General practice criteria, not the official rubric or its point values."}
          </p>
          <ol className="mt-5 space-y-4 text-sm">
            {event.rubric.map((r, i) => (
              <li key={r.id} className="flex gap-3">
                <span aria-hidden className="mt-px font-mono text-xs text-muted tabular">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="font-medium">{r.label}.</span> <span className="text-muted">{r.description}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {event.sourceUrl ? (
        <Link
          href={event.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-subtle"
        >
          Official guidelines <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
