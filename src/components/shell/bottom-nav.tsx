"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, House, User, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" || p.startsWith("/buddies") || p.startsWith("/goals") || p.startsWith("/invite") || p.startsWith("/share") || p.startsWith("/notifications") || p.startsWith("/leaderboard") },
  { href: "/study", label: "Study", icon: GraduationCap, match: (p: string) => p.startsWith("/study") },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
  { href: "/chapter", label: "Chapter", icon: Users, match: (p: string) => p.startsWith("/chapter") },
  { href: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
];

export function BottomNav() {
  const path = usePathname() ?? "/";
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur safe-bottom">
      <ul className="mx-auto grid max-w-none grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 border-2 text-[11px] sm:h-[68px] sm:flex-row sm:gap-2.5 sm:text-sm",
                  active ? "border-fg font-semibold" : "border-transparent text-fg/80 hover:text-fg",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.6} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.9 : 0} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
