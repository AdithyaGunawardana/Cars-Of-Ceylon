import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  manufacturer?: string;
  model?: string;
  year?: string;
  search?: string;
};

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const manufacturer = params.manufacturer?.trim() || undefined;
  const model = params.model?.trim() || undefined;
  const search = params.search?.trim() || undefined;
  const year = params.year ? Number(params.year) : undefined;

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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Vehicle Archive</h1>
          <p className="mt-1 text-sm text-zinc-300">Browse and search Sri Lankan vehicle history records.</p>
        </div>
        <Link
          href="/vehicles/new"
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300"
        >
          Add Vehicle
        </Link>
      </header>

      <form className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:grid-cols-5">
        <input
          name="search"
          defaultValue={params.search}
          placeholder="Plate / Unique ID"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="manufacturer"
          defaultValue={params.manufacturer}
          placeholder="Manufacturer"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="model"
          defaultValue={params.model}
          placeholder="Model"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="year"
          defaultValue={params.year}
          placeholder="Year"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
        >
          Search
        </button>
      </form>

      <section className="grid gap-4 md:grid-cols-2">
        {vehicles.length === 0 ? (
          <p className="text-sm text-zinc-300">No vehicles matched your filters.</p>
        ) : null}

        {vehicles.map((vehicle) => (
          <article key={vehicle.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-semibold text-zinc-100">
                {vehicle.manufacturer} {vehicle.model}
              </h2>
              <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                {vehicle.year}
              </span>
            </div>

            <p className="mt-2 text-sm text-zinc-300">Unique ID: {vehicle.uniqueIdentifier}</p>
            <p className="text-sm text-zinc-300">Plate: {vehicle.licensePlate ?? "Not set"}</p>
            <p className="text-sm text-zinc-300">Events: {vehicle._count.events} • Photos: {vehicle._count.photos}</p>
            <p className="mt-2 text-xs text-zinc-400">Added by {vehicle.createdBy.name ?? "Unknown"}</p>

            <Link
              href={`/vehicles/${vehicle.id}`}
              className="mt-4 inline-block text-sm font-semibold text-amber-300 hover:text-amber-200"
            >
              View Details
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
