import { cn } from "@/lib/cn";

type Tone = "plain" | "subtle" | "inverse";

export function Card({ className, tone = "plain", ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div
      className={cn(
        "relative rounded-[24px] p-5 sm:p-6",
        tone === "plain" && "border border-border bg-card shadow-card",
        tone === "subtle" && "bg-subtle",
        tone === "inverse" && "overflow-hidden bg-hero text-hero-fg",
        className,
      )}
      {...props}
    />
  );
}

/** Decorative dot texture + accent glow for inverse "feature" surfaces. Place as the first child of a relative container. */
export function HeroTexture() {
  return (
    <>
      <span aria-hidden className="dot-grid pointer-events-none absolute inset-0 text-hero-fg opacity-[0.09]" />
      <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent opacity-[0.22] blur-3xl" />
    </>
  );
}

/** Section label: mono caps with an optional count and a hairline that runs to the edge. */
export function SectionLabel({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("eyebrow mt-10 mb-3 flex items-center gap-3", className)}>
      <span className="size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_25%,transparent)]" aria-hidden />
      <span className="shrink-0">{children}</span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </h2>
  );
}

export function IconTile({ children, inverse, className }: { children: React.ReactNode; inverse?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] [&>svg]:size-[18px]",
        inverse ? "bg-primary text-primary-fg" : "border border-border bg-subtle/70 text-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}
