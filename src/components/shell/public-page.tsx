import { cn } from "@/lib/cn";
import { Chip } from "@/components/ui/badge";
import { PublicFooter, PublicHeader } from "./public-footer";

/** Shell for signed-out pages: header, a quiet dot texture behind the top of the page, content and footer. */
export function PublicPage({ children, wide, narrow }: { children: React.ReactNode; wide?: boolean; narrow?: boolean }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <span
        aria-hidden
        className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-[440px] text-fg opacity-[0.06] [mask-image:radial-gradient(70%_80%_at_50%_0%,#000_20%,transparent_75%)]!"
      />
      <div className="relative">
        <PublicHeader />
      </div>
      <main id="main" className={cn("relative mx-auto w-full flex-1 px-4 pb-6 pt-12 sm:px-6 sm:pt-20", wide ? "max-w-5xl" : narrow ? "max-w-xl" : "max-w-3xl")}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

/** Marketing-scale page heading: optional eyebrow, a large headline and a lead paragraph. Extra content (like a meta line) goes in `children`. */
export function PublicTitle({ eyebrow, title, lead, children }: { eyebrow?: React.ReactNode; title: React.ReactNode; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-10 sm:mb-14">
      {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
      <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{title}</h1>
      {lead ? <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted">{lead}</p> : null}
      {children}
    </header>
  );
}

/** Effective date and draft marking for policy pages. */
export function LegalMeta({ effective }: { effective: string }) {
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-muted">
      <span className="font-mono text-xs tabular">Effective {effective}</span> <span aria-hidden>·</span> <Chip tone="warning">Draft pending legal review</Chip>
    </p>
  );
}

/** Long-form typesetting for policy pages: a comfortable measure, hairline-ruled section headings and dash bullets. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[68ch] space-y-4 text-pretty text-[15px] leading-[1.75] sm:text-base [&_h2]:mt-12 [&_h2]:border-t [&_h2]:border-border [&_h2]:pt-7 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:tracking-[-0.02em] [&_h2]:text-balance [&>h2:first-child]:mt-0 [&_ul]:space-y-2.5 [&_li]:relative [&_li]:pl-6 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.5lh] [&_li]:before:h-px [&_li]:before:w-3 [&_li]:before:bg-muted [&_strong]:font-semibold [&_a]:font-medium [&_a]:underline [&_a]:decoration-border-strong [&_a]:underline-offset-4 [&_a]:transition-colors [&_a]:hover:decoration-fg">
      {children}
    </div>
  );
}
