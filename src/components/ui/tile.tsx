import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { HeroTexture } from "./card";

type Tone = "plain" | "hero" | "accent" | "subtle";

const surface: Record<Tone, string> = {
  plain: "border border-border bg-card shadow-card hover:border-border-strong hover:shadow-float",
  hero: "bg-hero text-hero-fg shadow-float",
  accent: "bg-accent text-accent-fg shadow-[0_14px_34px_-20px_var(--accent)]",
  subtle: "bg-subtle hover:bg-subtle-2",
};
const iconBox: Record<Tone, string> = {
  plain: "border border-border bg-subtle/70 text-fg",
  hero: "bg-accent text-accent-fg",
  accent: "bg-accent-fg text-accent",
  subtle: "bg-primary text-primary-fg",
};
const sub: Record<Tone, string> = {
  plain: "text-muted",
  hero: "text-hero-muted",
  accent: "text-accent-fg/70",
  subtle: "text-muted",
};

/** Bento-style link tile: icon top-left, arrow top-right, title and details pinned to the bottom. */
export function Tile({
  href,
  icon,
  title,
  subtitle,
  meta,
  tone = "plain",
  className,
}: {
  href: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/tile relative flex min-h-[9.5rem] flex-col overflow-hidden rounded-[22px] p-4 transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out hover:-translate-y-0.5 sm:p-5",
        surface[tone],
        className,
      )}
    >
      {tone === "hero" ? <HeroTexture /> : null}
      <span className="relative flex items-start justify-between gap-3">
        <span aria-hidden className={cn("inline-flex size-10 items-center justify-center rounded-[12px] [&>svg]:size-[18px]", iconBox[tone])}>
          {icon}
        </span>
        <ArrowUpRight
          aria-hidden
          className="size-[18px] opacity-35 transition-[transform,opacity] duration-300 group-hover/tile:-translate-y-0.5 group-hover/tile:translate-x-0.5 group-hover/tile:opacity-100"
        />
      </span>
      <span className="relative mt-auto block pt-6">
        <span className="block text-[15px] font-semibold leading-snug tracking-[-0.02em] sm:text-base">{title}</span>
        {subtitle ? <span className={cn("mt-1 block text-[13px] leading-snug sm:text-sm", sub[tone])}>{subtitle}</span> : null}
        {meta ? <span className="mt-3 block">{meta}</span> : null}
      </span>
    </Link>
  );
}

/** Responsive grid for tiles. */
export function TileGrid({ children, className, cols = 2 }: { children: React.ReactNode; className?: string; cols?: 2 | 3 }) {
  return <div className={cn("stagger grid grid-cols-2 gap-3", cols === 3 && "sm:grid-cols-3", className)}>{children}</div>;
}

/** Compact stat strip: big mono numbers separated by hairlines. */
export function StatStrip({ items, className }: { items: { value: string; label: string; icon?: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn("grid divide-x divide-border rounded-[22px] border border-border bg-card shadow-card", className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((s) => (
        <div key={s.label} className="min-w-0 px-4 py-4 sm:px-5">
          {s.icon ? <span className="mb-2 block text-muted [&>svg]:size-4" aria-hidden>{s.icon}</span> : null}
          <p className="font-mono text-2xl font-medium tracking-[-0.04em] tabular sm:text-[1.75rem]">{s.value}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
