import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/auth";
import { EventCreateForm } from "@/components/event-create-form";
import { HideContentControl, RestoreVehicleButton } from "@/components/moderation-actions";
import { PhotoAlbum } from "@/components/photo-album";
import { PhotoUploadForm } from "@/components/photo-upload-form";
import { TimelineEventList } from "@/components/timeline-event-list";
import { VehicleManagementForm } from "@/components/vehicle-management-form";
import { VehicleReportForm } from "@/components/vehicle-report-form";
import { canManageVehicle as userCanManageVehicle, canViewVehicle, isModerator } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getPublicVehicleSeo, truncate } from "@/lib/seo";
import { ATTRIBUTE_LABELS, labelForOption, readAttributes, type VehicleAttributes } from "@/lib/vehicle-attributes";
import { getVehicleDetail, redactHiddenContent } from "@/lib/vehicle-queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const vehicle = await getPublicVehicleSeo(id);
  // Non-public records are never described in metadata and are kept out of search indexes.
  if (!vehicle) return { title: "Vehicle", robots: { index: false, follow: false } };

  const title = `${vehicle.year} ${vehicle.manufacturer} ${vehicle.model}`;
  const description = truncate(
    vehicle.description?.trim() || `History, timeline and photos of this ${title} (${vehicle.uniqueIdentifier}).`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: `/vehicles/${vehicle.id}` },
    openGraph: { title, description, type: "article", url: `/vehicles/${vehicle.id}` },
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAuthSession();

  // Load full detail payload for timeline and album rendering in a single query.
  const found = await getVehicleDetail(id);

  if (!found) {
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
  if (!canViewVehicle(currentUser, found)) {
    notFound();
  }

  const canContribute = userCanManageVehicle(currentUser, found);
  // Hidden photos/events are filtered out for everyone who cannot manage the vehicle.
  const vehicle = redactHiddenContent(found, canContribute);

  // Same policy as contribution actions: owner/moderator/admin can manage metadata.
  const canManageVehicle = canContribute;

  const viewerIsModerator = isModerator(currentUser);
  const attributes = readAttributes(vehicle.attributes);
  const attributeEntries = (Object.keys(ATTRIBUTE_LABELS) as (keyof VehicleAttributes)[]).flatMap((key) => {
    const value = attributes[key];
    if (value === undefined) return [];
    const text = typeof value === "number" ? value.toLocaleString("en-US") : key === "color" ? value : labelForOption(String(value));
    return [[key, text] as const];
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
      <Link href="/vehicles" className="text-sm font-semibold text-[#725a39] hover:text-[#271310]">
        Back to vehicles
      </Link>

      {vehicle.deletedAt ? (
        <p role="status" className="rounded-2xl bg-[#fff0ef] px-4 py-3 text-sm text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">
          This vehicle was deleted on {vehicle.deletedAt.toISOString().slice(0, 10)} and is only visible to moderators.
        </p>
      ) : null}
      {vehicle.hiddenAt ? (
        <p role="status" className="rounded-2xl bg-[#fff7e6] px-4 py-3 text-sm text-[#725a39] ring-1 ring-[#d3c3c0]/70">
          This vehicle is hidden from the public by a moderator. Only its owner and moderators can see it.
        </p>
      ) : null}
      {viewerIsModerator ? (
        <section aria-label="Moderator actions" className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-[#d3c3c0]/70">
          <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Moderator actions</p>
          <div className="flex flex-wrap items-start gap-2">
            {vehicle.deletedAt ? (
              <RestoreVehicleButton vehicleId={vehicle.id} />
            ) : (
              <HideContentControl targetType="VEHICLE" targetId={vehicle.id} hidden={Boolean(vehicle.hiddenAt)} />
            )}
          </div>
        </section>
      ) : null}

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
        {attributeEntries.length > 0 ? (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3" aria-label="Specifications">
            {attributeEntries.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs uppercase tracking-[0.18em] text-[#725a39]">{ATTRIBUTE_LABELS[key]}</dt>
                <dd className="text-[#271310]">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
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
            canModerate={viewerIsModerator}
            events={vehicle.events.map((event) => ({
              id: event.id,
              type: event.type,
              title: event.title,
              details: event.details,
              sourceUrl: event.sourceUrl,
              occurredAt: event.occurredAt?.toISOString() ?? null,
              createdAt: event.createdAt.toISOString(),
              hiddenAt: event.hiddenAt?.toISOString() ?? null,
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
          canModerate={viewerIsModerator}
          photos={vehicle.photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            caption: photo.caption,
            hiddenAt: photo.hiddenAt?.toISOString() ?? null,
          }))}
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
            attributes,
          }}
        />
      ) : null}

      <VehicleReportForm vehicleId={vehicle.id} isSignedIn={Boolean(session?.user?.id)} />
    </main>
  );
}
