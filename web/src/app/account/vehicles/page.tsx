import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/auth";
import { RestoreVehicleButton } from "@/components/moderation-actions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Deleted vehicles", robots: { index: false } };

const RETENTION_DAYS = 30;

export default async function DeletedVehiclesPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/vehicles");

  const vehicles = await prisma.vehicle.findMany({
    where: { createdByUserId: session.user.id, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: { id: true, manufacturer: true, model: true, year: true, uniqueIdentifier: true, deletedAt: true, deletedById: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Account</p>
        <h1 className="font-serif text-3xl text-[#271310]">Deleted vehicles</h1>
        <p className="mt-1 text-sm text-[#504442]">
          Deleted vehicles can be restored for {RETENTION_DAYS} days. After that they, and their timeline and photos, are
          permanently erased.
        </p>
      </div>

      {vehicles.length === 0 ? <p className="text-sm text-[#504442]">You have no deleted vehicles.</p> : null}

      <ul className="grid gap-3">
        {vehicles.map((vehicle) => {
          const deletedAt = vehicle.deletedAt!;
          const purgeOn = new Date(deletedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
          const restorable = vehicle.deletedById === session.user.id;
          return (
            <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#d3c3c0]/70">
              <div>
                <p className="font-serif text-lg text-[#271310]">
                  {vehicle.year} {vehicle.manufacturer} {vehicle.model}
                </p>
                <p className="text-xs text-[#765f5c]">
                  {vehicle.uniqueIdentifier} - erased on {purgeOn.toISOString().slice(0, 10)}
                </p>
                {!restorable ? <p className="mt-1 text-xs text-[#9e2a2b]">Removed by a moderator; only moderators can restore it.</p> : null}
              </div>
              {restorable ? <RestoreVehicleButton vehicleId={vehicle.id} /> : null}
            </li>
          );
        })}
      </ul>
      <Link href="/account" className="text-sm font-semibold text-[#725a39] hover:text-[#271310]">
        Back to settings
      </Link>
    </main>
  );
}
