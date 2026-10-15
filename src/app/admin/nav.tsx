"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/** Scrollable segmented section nav. The current section is a solid ink pill and is kept in view on narrow screens. */
export function AdminNav({ items }: { items: [href: string, label: string][] }) {
  const path = usePathname() ?? "/admin";
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("[aria-current=page]");
    if (!list || !active) return;
    if (active.offsetLeft < list.scrollLeft || active.offsetLeft + active.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2 });
    }
  }, [path]);
  return (
    <nav aria-label="Admin" className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
      <ul ref={listRef} className="relative flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-full bg-subtle p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(([href, label]) => {
          const active = href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium tracking-[-0.01em] transition-colors duration-200",
                  active ? "bg-primary text-primary-fg shadow-card" : "text-muted hover:bg-card hover:text-fg",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
