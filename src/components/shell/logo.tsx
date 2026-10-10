/** PrepX mark: an X whose rising stroke becomes an arrow, finished in the accent color. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="10" fill="var(--fg)" />
      <path d="M10 10 L14 14 M18 18 L22 22" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" />
      <path d="M10 22 L22 10" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" />
      <path d="M16.2 10 H22 V15.8" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark />
      <span className="text-[1.35rem] font-semibold tracking-[-0.04em]">
        Prep<span className="font-display text-[1.15em] font-normal italic tracking-normal">X</span>
      </span>
    </span>
  );
}
