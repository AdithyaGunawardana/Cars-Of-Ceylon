import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/auth";
import { EventCreateForm } from "@/components/event-create-form";
import { PhotoAlbum } from "@/components/photo-album";
import { PhotoUploadForm } from "@/components/photo-upload-form";
import { TimelineEventList } from "@/components/timeline-event-list";
import { VehicleManagementForm } from "@/components/vehicle-management-form";
import { VehicleReportForm } from "@/components/vehicle-report-form";
import { canManageVehicle as userCanManageVehicle, canViewVehicle } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { eventOrderBy } from "@/lib/vehicle-queries";

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
        select: { id: true, name: true },
      },
      events: {
        orderBy: eventOrderBy,
      },
      photos: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!vehicle) {
    notFound();
  }

  // Compute permissions once and pass them to the contribution/management controls.
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true },
      })
    : null;

  // Match API behavior: private records are visible to owner, moderators and admins only.
  if (!canViewVehicle(currentUser, vehicle)) {
    notFound();
  }

  const canContribute = userCanManageVehicle(currentUser, vehicle);

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
            {vehicle.createdBy.name ?? "Unnamed member"}
          </Link>
        </p>
      </section>

      <section className="rounded-[1.5rem] bg-[#ffffff] p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <h2 className="font-serif text-xl text-[#271310]">Timeline</h2>
        <div className="mt-4">
          <TimelineEventList
            vehicleId={vehicle.id}
            canManage={canContribute}
            events={vehicle.events.map((event) => ({
              id: event.id,
              type: event.type,
              title: event.title,
              details: event.details,
              sourceUrl: event.sourceUrl,
              occurredAt: event.occurredAt?.toISOString() ?? null,
              createdAt: event.createdAt.toISOString(),
            }))}
          />
        </div>
        <div className="mt-6">
          <EventCreateForm
            vehicleId={vehicle.id}
            canContribute={canContribute}
            isSignedIn={Boolean(session?.user?.id)}
          />
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-[#ffffff] p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <h2 className="font-serif text-xl text-[#271310]">Photo Album</h2>
        <PhotoAlbum
          vehicleId={vehicle.id}
          vehicleName={`${vehicle.manufacturer} ${vehicle.model}`}
          canManage={canContribute}
          photos={vehicle.photos.map((photo) => ({ id: photo.id, url: photo.url, caption: photo.caption }))}
        />
        <div className="mt-6">
          <PhotoUploadForm
            vehicleId={vehicle.id}
            canContribute={canContribute}
            isSignedIn={Boolean(session?.user?.id)}
          />
        </div>
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
