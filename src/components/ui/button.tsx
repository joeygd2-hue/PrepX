import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger" | "subtle" | "hero";
const base =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-[14px] font-medium tracking-[-0.01em] transition-[transform,background-color,box-shadow,opacity,border-color] duration-200 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none select-none";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_20px_-12px_rgba(0,0,0,0.6)] hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_12px_24px_-12px_rgba(0,0,0,0.6)]",
  accent: "bg-accent text-accent-fg shadow-[0_1px_0_rgba(255,255,255,0.45)_inset,0_10px_24px_-14px_var(--accent)] hover:-translate-y-px hover:brightness-[1.04]",
  outline: "border border-border-strong bg-card text-fg hover:border-fg/40 hover:bg-subtle/60",
  ghost: "text-fg hover:bg-subtle",
  danger: "bg-danger text-white hover:-translate-y-px hover:opacity-95",
  subtle: "bg-subtle text-fg hover:bg-subtle-2",
  hero: "bg-hero-fg text-hero hover:-translate-y-px hover:opacity-95",
};
const sizes = { sm: "h-9 px-3.5 text-sm rounded-[11px]", md: "h-12 px-5 text-[15px]", lg: "h-14 px-6 text-base" };

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  block?: boolean;
};

export function Button({ variant = "primary", size = "md", block, className, ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], sizes[size], block && "w-full", className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block,
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: keyof typeof sizes; block?: boolean; className?: string; children: React.ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], block && "w-full", className)} {...rest}>
      {children}
    </Link>
  );
}
