import { cn } from "@/lib/cn";

export function Card({ className, tone = "plain", ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: "plain" | "subtle" | "inverse" }) {
  return (
    <div
      className={cn(
        "rounded-3xl p-5 sm:p-6",
        tone === "plain" && "border border-border bg-card",
        tone === "subtle" && "bg-subtle",
        tone === "inverse" && "bg-fg text-bg",
        className,
      )}
      {...props}
    />
  );
}

export function SectionLabel({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("eyebrow mt-8 mb-3", className)}>
      {children}
    </h2>
  );
}

export function IconTile({ children, inverse, className }: { children: React.ReactNode; inverse?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5",
        inverse ? "bg-fg text-bg" : "bg-subtle text-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}
