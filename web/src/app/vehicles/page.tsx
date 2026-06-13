import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  manufacturer?: string;
  model?: string;
  year?: string;
  search?: string;
};

// Public vehicle archive with server-side filtering.
export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // Normalize optional query params before building Prisma filters.
  const manufacturer = params.manufacturer?.trim() || undefined;
  const model = params.model?.trim() || undefined;
  const search = params.search?.trim() || undefined;
  const year = params.year ? Number(params.year) : undefined;

  // Keep list filtering aligned with API search behavior.
  const where = {
    visibility: "PUBLIC" as const,
    ...(manufacturer ? { manufacturer: { contains: manufacturer, mode: "insensitive" as const } } : {}),
    ...(model ? { model: { contains: model, mode: "insensitive" as const } } : {}),
    ...(year && Number.isInteger(year) ? { year } : {}),
    ...(search
      ? {
          OR: [
            { uniqueIdentifier: { contains: search, mode: "insensitive" as const } },
            { licensePlate: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { name: true },
      },
      _count: {
        select: { events: true, photos: true },
      },
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-[#ffffff]/80 p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Archive</p>
          <h1 className="font-serif text-3xl text-[#271310]">Vehicle Archive</h1>
          <p className="mt-1 text-sm text-[#504442]">Browse and search Sri Lankan vehicle history records.</p>
        </div>
        <Link
          href="/vehicles/new"
          className="rounded-full bg-[#271310] px-4 py-2 text-sm font-semibold text-[#fbfaee] hover:bg-[#3e2723]"
        >
          Add Vehicle
        </Link>
      </header>

      <form className="grid gap-3 rounded-3xl bg-[#f5f4e8] p-4 shadow-[0_14px_35px_rgba(27,28,21,0.05)] ring-1 ring-[#d3c3c0]/70 md:grid-cols-5">
        <input
          name="search"
          defaultValue={params.search}
          placeholder="Plate / Unique ID"
          className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]"
        />
        <input
          name="manufacturer"
          defaultValue={params.manufacturer}
          placeholder="Manufacturer"
          className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]"
        />
        <input
          name="model"
          defaultValue={params.model}
          placeholder="Model"
          className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]"
        />
        <input
          name="year"
          defaultValue={params.year}
          placeholder="Year"
          className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]"
        />
        <button
          type="submit"
          className="rounded-full bg-[#725a39] px-3 py-2 text-sm font-semibold text-[#fbfaee] hover:bg-[#5b403c]"
        >
          Search
        </button>
      </form>

      <section className="grid gap-4 md:grid-cols-2">
        {vehicles.length === 0 ? (
          <p className="text-sm text-[#504442]">No vehicles matched your filters.</p>
        ) : null}

        {vehicles.map((vehicle) => (
          <article key={vehicle.id} className="rounded-3xl bg-[#ffffff] p-5 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-serif text-xl text-[#271310]">
                {vehicle.manufacturer} {vehicle.model}
              </h2>
              <span className="rounded-full bg-[#f5f4e8] px-2 py-1 text-xs text-[#725a39] ring-1 ring-[#d3c3c0]/70">
                {vehicle.year}
              </span>
            </div>

            <p className="mt-2 text-sm text-[#504442]">Unique ID: {vehicle.uniqueIdentifier}</p>
            <p className="text-sm text-[#504442]">Plate: {vehicle.licensePlate ?? "Not set"}</p>
            <p className="text-sm text-[#504442]">Events: {vehicle._count.events} • Photos: {vehicle._count.photos}</p>
            <p className="mt-2 text-xs text-[#765f5c]">Added by {vehicle.createdBy.name ?? "Unknown"}</p>

            <Link
              href={`/vehicles/${vehicle.id}`}
              className="mt-4 inline-block text-sm font-semibold text-[#725a39] hover:text-[#271310]"
            >
              View Details
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
