import Link from "next/link";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publiclyIndexable } from "@/lib/seo";

// Live numbers and recent records: render per request (no database at build time).
export const dynamic = "force-dynamic";

const cardClass =
  "rounded-2xl bg-[#ffffff] p-5 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70";

export default async function Home() {
  const [session, vehicleCount, eventCount, photoCount, recent] = await Promise.all([
    getAuthSession(),
    prisma.vehicle.count({ where: publiclyIndexable }),
    prisma.vehicleEvent.count({ where: { hiddenAt: null, vehicle: publiclyIndexable } }),
    prisma.vehiclePhoto.count({ where: { hiddenAt: null, vehicle: publiclyIndexable } }),
    prisma.vehicle.findMany({
      where: publiclyIndexable,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        manufacturer: true,
        model: true,
        year: true,
        photos: { where: { hiddenAt: null }, orderBy: { createdAt: "asc" }, take: 1, select: { url: true } },
        _count: { select: { events: true } },
      },
    }),
  ]);
  const signedIn = Boolean(session?.user?.id);

  return (
    <main className="text-[#271310]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:px-10 md:py-24">
        <p className="text-sm uppercase tracking-[0.28em] text-[#725a39]">Cars of Ceylon</p>
        <h1 className="max-w-3xl font-serif text-4xl leading-tight md:text-6xl">
          Preserve the history of Sri Lankan vehicles with photos, stories, and verified records.
        </h1>
        <p className="max-w-2xl text-lg text-[#504442]">
          From Morris Minors to Land Rovers: build a timeline for every car, share its photos, and follow the people who
          keep these machines on the road.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/vehicles" className="rounded-full bg-[#271310] px-5 py-2.5 text-sm font-semibold text-[#fbfaee] hover:bg-[#3e2723]">
            Browse the archive
          </Link>
          <Link
            href={signedIn ? "/vehicles/new" : "/register"}
            className="rounded-full border border-[#d3c3c0] px-5 py-2.5 text-sm font-semibold text-[#271310] hover:bg-[#f5f4e8]"
          >
            {signedIn ? "Add a vehicle" : "Join the archive"}
          </Link>
        </div>

        <dl className="grid grid-cols-3 gap-4 md:max-w-xl" aria-label="Archive statistics">
          {[
            ["Vehicles", vehicleCount],
            ["Timeline events", eventCount],
            ["Photos", photoCount],
          ].map(([label, value]) => (
            <div key={label} className={cardClass}>
              <dt className="text-xs uppercase tracking-[0.2em] text-[#725a39]">{label}</dt>
              <dd className="mt-1 font-serif text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16 md:px-10">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-2xl">Recently added</h2>
          <Link href="/vehicles" className="text-sm font-semibold text-[#725a39] hover:text-[#271310]">
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-[#504442]">No vehicles have been published yet. Be the first to add one.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((vehicle) => (
              <li key={vehicle.id}>
                <Link href={`/vehicles/${vehicle.id}`} className={`${cardClass} block overflow-hidden p-0 hover:ring-[#725a39]`}>
                  <div className="aspect-[16/10] bg-[#f5f4e8]">
                    {vehicle.photos[0] ? (
                      <>
                        {/* Plain <img>: photos are served from the storage host, not optimized by next/image. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={vehicle.photos[0].url} alt={`${vehicle.manufacturer} ${vehicle.model}`} className="h-full w-full object-cover" />
                      </>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-serif text-lg">
                      {vehicle.year} {vehicle.manufacturer} {vehicle.model}
                    </p>
                    <p className="text-xs text-[#765f5c]">{vehicle._count.events} timeline events</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3 md:px-10">
        <article className={cardClass}>
          <h2 className="font-serif text-lg">Vehicle archive</h2>
          <p className="mt-2 text-sm text-[#504442]">Identifier, plate, make, model, year, and the story behind each car.</p>
        </article>
        <article className={cardClass}>
          <h2 className="font-serif text-lg">Living timelines</h2>
          <p className="mt-2 text-sm text-[#504442]">Service, ownership changes, inspections, incidents, and modifications, in order.</p>
        </article>
        <article className={cardClass}>
          <h2 className="font-serif text-lg">Community moderated</h2>
          <p className="mt-2 text-sm text-[#504442]">Reports, review workflows, and an audit trail keep the records trustworthy.</p>
        </article>
      </section>
    </main>
  );
}
