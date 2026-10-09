import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export function Page({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <main id="main" className={cn("mx-auto w-full px-4 pb-32 pt-6 sm:px-6 sm:pt-8", wide ? "max-w-5xl" : "max-w-2xl", className)}>{children}</main>;
}

export function PageTitle({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="text-[2rem] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function BackHeader({ href, title, subtitle }: { href: string; title?: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Link href={href} aria-label="Back" className="inline-flex size-11 items-center justify-center rounded-full bg-subtle hover:bg-subtle-2">
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      {title ? (
        <div>
          <p className="text-lg font-semibold leading-tight">{title}</p>
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon: React.ReactNode; title: string; body: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-subtle p-6", className)}>
      <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-fg text-bg [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
