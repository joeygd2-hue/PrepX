import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconTile } from "./card";

export function ListGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5", className)}>{children}</div>;
}

type RowProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  href?: string;
  danger?: boolean;
  /** Plain <a> (mailto:, downloads, API routes). */
  external?: boolean;
  /** Opens another site in a new tab, with an outbound-link icon. */
  newTab?: boolean;
  className?: string;
};

export function ListRow({ icon, title, subtitle, right, href, danger, external, newTab, className }: RowProps) {
  const inner = (
    <>
      {icon ? <IconTile className={danger ? "text-danger" : undefined}>{icon}</IconTile> : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block font-medium tracking-[-0.01em]", danger && "text-danger")}>{title}</span>
        {subtitle ? <span className="mt-0.5 block text-sm text-muted">{subtitle}</span> : null}
      </span>
      {right ??
        (newTab ? (
          <ArrowUpRight className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover/row:-translate-y-0.5 group-hover/row:translate-x-0.5 group-hover/row:text-fg" aria-hidden />
        ) : href ? (
          <ChevronRight className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fg" aria-hidden />
        ) : null)}
    </>
  );
  const cls = cn("group/row flex items-center gap-3.5 py-3.5", href && "-mx-4 px-4 transition-colors hover:bg-subtle/60 sm:-mx-5 sm:px-5", className);
  if (!href) return <div className={cls}>{inner}</div>;
  if (newTab)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  if (external)
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
