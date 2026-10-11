import { LogoMark } from "@/components/shell/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="relative isolate inline-flex">
        <span aria-hidden className="dot-grid absolute -inset-12 -z-10 text-fg opacity-[0.14] [mask-image:radial-gradient(closest-side,#000,transparent)]!" />
        <LogoMark className="size-14 rounded-[18px] shadow-float" />
      </span>
      <p className="eyebrow mt-10 tabular">404</p>
      <h1 className="mt-3 text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em]">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-pretty text-muted">It may have moved, or you may not have access to it.</p>
      <ButtonLink href="/" className="mt-8">
        Go home
      </ButtonLink>
    </main>
  );
}
