import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/auth";
import { VehicleContributionForms } from "@/components/vehicle-contribution-forms";
import { VehicleReportForm } from "@/components/vehicle-report-form";
import { prisma } from "@/lib/prisma";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAuthSession();

  // Load full detail payload for timeline and album rendering in a single query.
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      events: {
        orderBy: { createdAt: "desc" },
      },
      photos: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!vehicle) {
    notFound();
  }

  if (vehicle.visibility === "PRIVATE") {
    // Match API behavior: hide private records from non-owners.
    if (session?.user?.id !== vehicle.createdByUserId) {
      notFound();
    }
  }

  // Compute contribution permission once and pass it to both timeline and photo form controls.
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true },
      })
    : null;

  const canContribute = Boolean(
    currentUser &&
      (currentUser.id === vehicle.createdByUserId || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN"),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
      <Link href="/vehicles" className="text-sm font-semibold text-amber-300 hover:text-amber-200">
        Back to vehicles
      </Link>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">
              {vehicle.manufacturer} {vehicle.model}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">Year: {vehicle.year}</p>
            <p className="text-sm text-zinc-300">Unique ID: {vehicle.uniqueIdentifier}</p>
            <p className="text-sm text-zinc-300">License Plate: {vehicle.licensePlate ?? "Not set"}</p>
          </div>
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
            {vehicle.visibility}
          </span>
        </div>

        <p className="mt-4 text-sm text-zinc-200">{vehicle.description ?? "No description added yet."}</p>
        <p className="mt-3 text-xs text-zinc-400">Added by {vehicle.createdBy.name ?? vehicle.createdBy.email}</p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-xl font-semibold text-zinc-100">Timeline</h2>
        <div className="mt-4">
          <VehicleContributionForms
            vehicleId={vehicle.id}
            canContribute={canContribute}
            isSignedIn={Boolean(session?.user?.id)}
          />
        </div>
        <div className="mt-4 space-y-3">
          {vehicle.events.length === 0 ? <p className="text-sm text-zinc-300">No events yet.</p> : null}

          {vehicle.events.map((event) => (
            <article key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-sm font-semibold text-zinc-100">{event.title}</p>
              <p className="text-xs text-zinc-400">
                {event.type} • {new Date(event.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-zinc-300">{event.details ?? "No details provided."}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-xl font-semibold text-zinc-100">Photo Album</h2>
        {vehicle.photos.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-300">No photos uploaded yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {vehicle.photos.map((photo) => (
              <li key={photo.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-200">
                <p className="font-semibold">{photo.caption ?? "Untitled photo"}</p>
                <p className="text-xs text-zinc-400">{photo.url}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <VehicleReportForm vehicleId={vehicle.id} isSignedIn={Boolean(session?.user?.id)} />
    </main>
  );
}
