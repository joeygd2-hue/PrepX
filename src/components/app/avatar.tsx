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
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" && "size-9 bg-subtle text-sm",
        size === "md" && "size-12 bg-subtle",
        size === "lg" && "size-24 bg-fg text-3xl text-bg",
        className,
      )}
    >
      {text}
    </span>
  );
}
