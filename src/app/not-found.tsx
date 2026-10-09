import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-3xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">It may have moved, or you may not have access to it.</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-fg px-6 font-medium text-bg">
        Go home
      </Link>
    </main>
  );
}
