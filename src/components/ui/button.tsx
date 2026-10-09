import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "ghost" | "danger" | "subtle";
const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:opacity-90 active:opacity-80",
  outline: "border border-border bg-card text-fg hover:bg-subtle",
  ghost: "text-fg hover:bg-subtle",
  danger: "bg-danger text-white hover:opacity-90",
  subtle: "bg-subtle text-fg hover:bg-subtle-2",
};
const sizes = { sm: "h-9 px-4 text-sm", md: "h-12 px-6 text-[15px]", lg: "h-14 px-6 text-base" };

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
