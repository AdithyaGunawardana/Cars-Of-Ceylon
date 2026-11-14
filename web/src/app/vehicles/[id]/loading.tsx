export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16" aria-busy="true" aria-live="polite">
      <div className="h-4 w-40 animate-pulse rounded-full bg-[#d3c3c0]/60" />
      <div className="mt-4 h-10 w-2/3 animate-pulse rounded-2xl bg-[#d3c3c0]/50" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#d3c3c0]/40" />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </main>
  );
}
