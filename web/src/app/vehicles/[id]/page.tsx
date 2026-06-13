import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/auth";
import { VehicleContributionForms } from "@/components/vehicle-contribution-forms";
import { VehicleManagementForm } from "@/components/vehicle-management-form";
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

  // Same policy as contribution actions: owner/moderator/admin can manage metadata.
  const canManageVehicle = canContribute;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
      <Link href="/vehicles" className="text-sm font-semibold text-[#725a39] hover:text-[#271310]">
        Back to vehicles
      </Link>

      <section className="rounded-[1.5rem] bg-[#ffffff] p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Vehicle record</p>
            <h1 className="font-serif text-3xl text-[#271310]">
              {vehicle.manufacturer} {vehicle.model}
            </h1>
            <p className="mt-2 text-sm text-[#504442]">Year: {vehicle.year}</p>
            <p className="text-sm text-[#504442]">Unique ID: {vehicle.uniqueIdentifier}</p>
            <p className="text-sm text-[#504442]">License Plate: {vehicle.licensePlate ?? "Not set"}</p>
          </div>
          <span className="rounded-full bg-[#f5f4e8] px-3 py-1 text-xs text-[#725a39] ring-1 ring-[#d3c3c0]/70">
            {vehicle.visibility}
          </span>
        </div>

        <p className="mt-4 text-sm text-[#271310]">{vehicle.description ?? "No description added yet."}</p>
        <p className="mt-3 text-xs text-[#765f5c]">
          Added by{" "}
          <Link href={`/users/${vehicle.createdBy.id}`} className="text-[#725a39] hover:text-[#271310]">
            {vehicle.createdBy.name ?? vehicle.createdBy.email}
          </Link>
        </p>
      </section>

      <section className="rounded-[1.5rem] bg-[#ffffff] p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <h2 className="font-serif text-xl text-[#271310]">Timeline</h2>
        <div className="mt-4">
          <VehicleContributionForms
            vehicleId={vehicle.id}
            canContribute={canContribute}
            isSignedIn={Boolean(session?.user?.id)}
          />
        </div>
        <div className="mt-4 space-y-3">
          {vehicle.events.length === 0 ? <p className="text-sm text-[#504442]">No events yet.</p> : null}

          {vehicle.events.map((event) => (
            <article key={event.id} className="rounded-2xl bg-[#f5f4e8] p-4 ring-1 ring-[#d3c3c0]/70">
              <p className="text-sm font-semibold text-[#271310]">{event.title}</p>
              <p className="text-xs text-[#765f5c]">
                {event.type} • {new Date(event.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-[#504442]">{event.details ?? "No details provided."}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-[#ffffff] p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <h2 className="font-serif text-xl text-[#271310]">Photo Album</h2>
        {vehicle.photos.length === 0 ? (
          <p className="mt-3 text-sm text-[#504442]">No photos uploaded yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {vehicle.photos.map((photo) => (
              <li key={photo.id} className="rounded-2xl bg-[#f5f4e8] p-3 text-sm text-[#271310] ring-1 ring-[#d3c3c0]/70">
                <p className="font-semibold">{photo.caption ?? "Untitled photo"}</p>
                <p className="text-xs text-[#765f5c]">{photo.url}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManageVehicle ? (
        <VehicleManagementForm
          vehicleId={vehicle.id}
          initialValues={{
            uniqueIdentifier: vehicle.uniqueIdentifier,
            licensePlate: vehicle.licensePlate,
            manufacturer: vehicle.manufacturer,
            model: vehicle.model,
            year: vehicle.year,
            description: vehicle.description,
            visibility: vehicle.visibility,
          }}
        />
      ) : null}

      <VehicleReportForm vehicleId={vehicle.id} isSignedIn={Boolean(session?.user?.id)} />
    </main>
  );
}
