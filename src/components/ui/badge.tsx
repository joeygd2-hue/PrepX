import { cn } from "@/lib/cn";
import { ORGS, type OrgId } from "@/lib/orgs";

export function OrgBadge({ org, className }: { org: OrgId; className?: string }) {
  return (
    <span
      className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold tracking-wide text-white", className)}
      style={{ background: ORGS[org].color }}
    >
      {ORGS[org].name}
    </span>
  );
}

export function Chip({ children, className, tone = "outline" }: { children: React.ReactNode; className?: string; tone?: "outline" | "inverse" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs",
        tone === "outline" && "border border-border text-fg",
        tone === "inverse" && "border border-white/40 text-white",
        tone === "warning" && "border border-warning/40 bg-warning/10 text-warning",
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
