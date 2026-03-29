import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 md:py-24">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Cars of Ceylon</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          Preserve the history of Sri Lankan vehicles with photos, stories, and verified records.
        </h1>
        <p className="max-w-2xl text-lg text-zinc-300">
          This baseline now includes Prisma models, registration/auth scaffolding, vehicle APIs, and Docker setup
          for local development with PostgreSQL.
        </p>

        {/* High-level capability cards for quick project orientation. */}
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-lg font-semibold">Vehicle Archive</h2>
            <p className="mt-2 text-sm text-zinc-300">Unique identifier, plate, make, model, year, and narrative history.</p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-lg font-semibold">Timeline Events</h2>
            <p className="mt-2 text-sm text-zinc-300">Track service, ownership changes, inspections, incidents, and modifications.</p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-lg font-semibold">Albums and Moderation</h2>
            <p className="mt-2 text-sm text-zinc-300">Photo uploads, report queue, and role-based permissions for reliability.</p>
          </article>
        </div>

        {/* Visible stack summary matching current implementation choices. */}
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-zinc-700 px-3 py-1">Next.js</span>
          <span className="rounded-full border border-zinc-700 px-3 py-1">PostgreSQL</span>
          <span className="rounded-full border border-zinc-700 px-3 py-1">Prisma</span>
          <span className="rounded-full border border-zinc-700 px-3 py-1">Auth.js</span>
          <span className="rounded-full border border-zinc-700 px-3 py-1">Docker Compose</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/vehicles" className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300">
            Browse Vehicles
          </Link>
          <Link href="/vehicles/new" className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800">
            Add Vehicle
          </Link>
        </div>
      </section>
    </main>
  );
}
