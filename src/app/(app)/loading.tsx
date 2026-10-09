export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8" role="status" aria-label="Loading">
      <div className="h-4 w-32 animate-pulse rounded-full bg-subtle" />
      <div className="mt-3 h-9 w-56 animate-pulse rounded-full bg-subtle" />
      <div className="mt-8 h-48 animate-pulse rounded-3xl bg-subtle" />
      <div className="mt-4 h-32 animate-pulse rounded-3xl bg-subtle" />
      <div className="mt-4 h-32 animate-pulse rounded-3xl bg-subtle" />
    </div>
  );
}
