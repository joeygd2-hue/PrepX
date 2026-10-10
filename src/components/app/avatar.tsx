import { cn } from "@/lib/cn";

export function initials(first?: string | null, last?: string | null, fallback = "?") {
  const s = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  return s || fallback;
}

export function Avatar({ text, size = "md", className }: { text: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center font-mono font-semibold tracking-tight",
        size === "sm" && "size-9 rounded-[11px] border border-border bg-card text-xs",
        size === "md" && "size-11 rounded-[14px] border border-border bg-card text-sm shadow-card",
        size === "lg" && "size-24 rounded-[28px] bg-hero text-3xl text-hero-fg shadow-float ring-4 ring-accent/40 ring-offset-4 ring-offset-bg",
        className,
      )}
    >
      {text}
    </span>
  );
}
