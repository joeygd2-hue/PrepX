import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export function Page({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <main id="main" className={cn("mx-auto w-full px-4 pb-36 pt-7 sm:px-6 sm:pt-10", wide ? "max-w-5xl" : "max-w-2xl", className)}>{children}</main>;
}

/** Italic serif accent for a word or two inside a headline. */
export function Accent({ children }: { children: React.ReactNode }) {
  return <em className="font-display text-[1.08em] font-normal italic tracking-normal">{children}</em>;
}

export function PageTitle({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="mb-7 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-[2.15rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.5rem]">{title}</h1>
        {subtitle ? <p className="mt-2.5 text-muted">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function BackHeader({ href, title, subtitle }: { href: string; title?: string; subtitle?: string }) {
  return (
    <div className="mb-7 flex items-center gap-3">
      <Link
        href={href}
        aria-label="Back"
        className="group/back inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card shadow-card transition-colors hover:border-border-strong"
      >
        <ArrowLeft className="size-[18px] transition-transform group-hover/back:-translate-x-0.5" aria-hidden />
      </Link>
      {title ? (
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold leading-tight tracking-[-0.02em]">{title}</p>
          {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon: React.ReactNode; title: string; body: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[24px] border border-dashed border-border-strong bg-card/60 p-6 sm:p-8", className)}>
      <span className="mb-5 inline-flex size-12 items-center justify-center rounded-[14px] bg-primary text-primary-fg shadow-card [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 max-w-md text-muted">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
