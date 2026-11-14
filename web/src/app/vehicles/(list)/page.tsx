import Link from "next/link";

import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/client-utils";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, labelForOption } from "@/lib/vehicle-attributes";
import { listPublicVehicles, parseVehicleListParams } from "@/lib/vehicle-queries";

// Every filter that must survive pagination links.
const FILTER_KEYS = [
  "q", "search", "manufacturer", "model", "year", "yearFrom", "yearTo", "sort", "color", "fuelType", "transmission", "bodyType",
] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// Public vehicle archive with server-side filtering and pagination (shares logic with GET /api/vehicles).
export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const parsed = parseVehicleListParams(params);
  // Invalid filters (e.g. year=abc) fall back to defaults instead of crashing the page.
  const filtersInvalid = !parsed.success;
  const query = parsed.success ? parsed.data : parseVehicleListParams({}).data!;

  const { items: vehicles, pagination } = await listPublicVehicles(query);

  // Preserve active filters in pagination links.
  function pageHref(page: number) {
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = firstValue(params[key])?.trim();
      if (value) next.set(key, value);
    }
    next.set("page", String(page));
    return `/vehicles?${next.toString()}`;
  }

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

      <form className="grid gap-3 rounded-3xl bg-[#f5f4e8] p-4 shadow-[0_14px_35px_rgba(27,28,21,0.05)] ring-1 ring-[#d3c3c0]/70">
        <input
          name="q"
          type="search"
          defaultValue={firstValue(params.q)}
          aria-label="Search the archive"
          placeholder="Search make, model, story, plate..."
          className={inputClass}
        />
        <div className="grid gap-3 md:grid-cols-5">
          <input name="search" defaultValue={firstValue(params.search)} placeholder="Plate / Unique ID" className={inputClass} />
          <input name="manufacturer" defaultValue={firstValue(params.manufacturer)} placeholder="Manufacturer" className={inputClass} />
          <input name="model" defaultValue={firstValue(params.model)} placeholder="Model" className={inputClass} />
          <input name="year" defaultValue={firstValue(params.year)} placeholder="Year" className={inputClass} />
          <label className="grid gap-1 text-xs text-[#504442]">
            Sort by
            <select name="sort" defaultValue={firstValue(params.sort) ?? ""} className={inputClass}>
              <option value="">Default</option>
              <option value="newest">Newest added</option>
              <option value="oldest">Oldest added</option>
              <option value="year_desc">Year, newest first</option>
              <option value="year_asc">Year, oldest first</option>
              <option value="name">Make and model</option>
              <option value="relevance">Best match</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <label className="grid gap-1 text-xs text-[#504442]">
            Year from
            <input name="yearFrom" type="number" min={1886} max={2100} defaultValue={firstValue(params.yearFrom)} className={inputClass} />
          </label>
          <label className="grid gap-1 text-xs text-[#504442]">
            Year to
            <input name="yearTo" type="number" min={1886} max={2100} defaultValue={firstValue(params.yearTo)} className={inputClass} />
          </label>
          <label className="grid gap-1 text-xs text-[#504442]">
            Colour
            <input name="color" defaultValue={firstValue(params.color)} className={inputClass} />
          </label>
          <label className="grid gap-1 text-xs text-[#504442]">
            Fuel
            <select name="fuelType" defaultValue={firstValue(params.fuelType) ?? ""} className={inputClass}>
              <option value="">Any</option>
              {FUEL_TYPES.map((value) => <option key={value} value={value}>{labelForOption(value)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-[#504442]">
            Transmission
            <select name="transmission" defaultValue={firstValue(params.transmission) ?? ""} className={inputClass}>
              <option value="">Any</option>
              {TRANSMISSIONS.map((value) => <option key={value} value={value}>{labelForOption(value)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-[#504442]">
            Body type
            <select name="bodyType" defaultValue={firstValue(params.bodyType) ?? ""} className={inputClass}>
              <option value="">Any</option>
              {BODY_TYPES.map((value) => <option key={value} value={value}>{labelForOption(value)}</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={primaryButtonClass}>Search</button>
          <Link href="/vehicles" className={secondaryButtonClass}>Reset</Link>
        </div>
      </form>

      {filtersInvalid ? (
        <p className="rounded-full bg-[#fff0ef] px-4 py-2 text-sm text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">
          Some filters were invalid and were ignored.
        </p>
      ) : null}

      <p className="text-sm text-[#504442]">
        {pagination.total} vehicle{pagination.total === 1 ? "" : "s"} found
      </p>

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

      {pagination.totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between rounded-full bg-[#f5f4e8] px-5 py-3 text-sm text-[#504442] ring-1 ring-[#d3c3c0]/70">
          {pagination.page > 1 ? (
            <Link href={pageHref(pagination.page - 1)} className="font-semibold text-[#725a39] hover:text-[#271310]">
              Previous
            </Link>
          ) : (
            <span className="opacity-40">Previous</span>
          )}
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          {pagination.page < pagination.totalPages ? (
            <Link href={pageHref(pagination.page + 1)} className="font-semibold text-[#725a39] hover:text-[#271310]">
              Next
            </Link>
          ) : (
            <span className="opacity-40">Next</span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
