import { PublicFooter, PublicHeader } from "./public-footer";

export function PublicPage({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className={`mx-auto w-full flex-1 px-4 py-12 sm:px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_li]:ml-5 [&_li]:list-disc [&_li]:marker:text-muted">
      {children}
    </div>
  );
}
