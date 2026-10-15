import { cn } from "@/lib/cn";
import { ORGS, type OrgId } from "@/lib/orgs";

/** Organization tag: colored dot + mono name. `onHero` adapts it to inverse surfaces. */
export function OrgBadge({ org, className, onHero }: { org: OrgId; className?: string; onHero?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[11px] font-medium tracking-wider",
        onHero ? "border-hero-line text-hero-fg" : "border-border-strong text-fg",
        className,
      )}
    >
      <span className="size-1.5 rounded-full" style={{ background: `var(--${org})` }} aria-hidden />
      {ORGS[org].name}
    </span>
  );
}

export function Chip({ children, className, tone = "outline" }: { children: React.ReactNode; className?: string; tone?: "outline" | "inverse" | "warning" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
        tone === "outline" && "border border-border-strong text-fg",
        tone === "inverse" && "border border-hero-line text-hero-fg",
        tone === "warning" && "border border-warning/30 bg-warning/10 text-warning",
        tone === "accent" && "bg-accent text-accent-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function VerificationChip({ status }: { status: "verified" | "reference_observed" | "unverified" | "confirmed" | "tentative" | "unconfirmed" }) {
  if (status === "verified" || status === "confirmed") return <Chip>Verified</Chip>;
  if (status === "reference_observed") return <Chip>Format checked</Chip>;
  if (status === "tentative") return <Chip tone="warning">Tentative</Chip>;
  return <Chip tone="warning">Unconfirmed</Chip>;
}
