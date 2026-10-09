export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d="M10 22 L22 10" stroke="var(--bg)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M16.5 10 H22 V15.5" fill="none" stroke="var(--bg)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 10 L14 14 M18 18 L22 22" stroke="var(--bg)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark />
      <span className="text-xl font-semibold tracking-tight">
        Prep<span className="font-light">X</span>
      </span>
    </span>
  );
}
