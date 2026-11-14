import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen text-[#271310]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 md:py-24">
        <p className="text-sm uppercase tracking-[0.28em] text-[#725a39]">Cars of Ceylon</p>
        <h1 className="max-w-3xl font-serif text-4xl leading-tight md:text-6xl">
          Preserve the history of Sri Lankan vehicles with photos, stories, and verified records.
        </h1>
        <p className="max-w-2xl text-lg text-[#504442]">
          This baseline now includes Prisma models, registration/auth scaffolding, vehicle APIs, and Docker setup
          for local development with PostgreSQL.
        </p>

        {/* High-level capability cards for quick project orientation. */}
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl bg-[#ffffff] p-5 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
            <h2 className="font-serif text-lg text-[#271310]">Vehicle Archive</h2>
            <p className="mt-2 text-sm text-[#504442]">Unique identifier, plate, make, model, year, and narrative history.</p>
          </article>
          <article className="rounded-2xl bg-[#ffffff] p-5 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
            <h2 className="font-serif text-lg text-[#271310]">Timeline Events</h2>
            <p className="mt-2 text-sm text-[#504442]">Track service, ownership changes, inspections, incidents, and modifications.</p>
          </article>
          <article className="rounded-2xl bg-[#ffffff] p-5 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
            <h2 className="font-serif text-lg text-[#271310]">Albums and Moderation</h2>
            <p className="mt-2 text-sm text-[#504442]">Photo uploads, report queue, and role-based permissions for reliability.</p>
          </article>
        </div>

        {/* Visible stack summary matching current implementation choices. */}
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-[#f5f4e8] px-3 py-1 ring-1 ring-[#d3c3c0]/70">Next.js</span>
          <span className="rounded-full bg-[#f5f4e8] px-3 py-1 ring-1 ring-[#d3c3c0]/70">PostgreSQL</span>
          <span className="rounded-full bg-[#f5f4e8] px-3 py-1 ring-1 ring-[#d3c3c0]/70">Prisma</span>
          <span className="rounded-full bg-[#f5f4e8] px-3 py-1 ring-1 ring-[#d3c3c0]/70">Auth.js</span>
          <span className="rounded-full bg-[#f5f4e8] px-3 py-1 ring-1 ring-[#d3c3c0]/70">Docker Compose</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/vehicles" className="rounded-full bg-[#271310] px-5 py-2.5 text-sm font-semibold text-[#fbfaee] hover:bg-[#3e2723]">
            Browse Vehicles
          </Link>
          <Link href="/vehicles/new" className="rounded-full border border-[#d3c3c0] px-5 py-2.5 text-sm font-semibold text-[#271310] hover:bg-[#f5f4e8]">
            Add Vehicle
          </Link>
        </div>
      </section>
    </main>
  );
}
