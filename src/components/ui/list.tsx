import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconTile } from "./card";

export function ListGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card px-5", className)}>{children}</div>;
}

type RowProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  href?: string;
  danger?: boolean;
  external?: boolean;
  className?: string;
};

export function ListRow({ icon, title, subtitle, right, href, danger, external, className }: RowProps) {
  const inner = (
    <>
      {icon ? <IconTile>{icon}</IconTile> : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block font-medium", danger && "text-danger")}>{title}</span>
        {subtitle ? <span className="mt-0.5 block text-sm text-muted">{subtitle}</span> : null}
      </span>
      {right ?? (href ? <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden /> : null)}
    </>
  );
  const cls = cn("flex items-center gap-4 py-4", href && "-mx-5 px-5 hover:bg-subtle/60", className);
  if (!href) return <div className={cls}>{inner}</div>;
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
