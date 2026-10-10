export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-7 sm:px-6 sm:pt-10" role="status" aria-label="Loading">
      <div className="skeleton h-3 w-28 rounded-full" />
      <div className="skeleton mt-3 h-10 w-60 rounded-[14px]" />
      <div className="skeleton mt-8 h-56 rounded-[28px]" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="skeleton h-36 rounded-[22px]" />
        <div className="skeleton h-36 rounded-[22px]" />
      </div>
      <div className="skeleton mt-3 h-32 rounded-[24px]" />
    </div>
  );
}
