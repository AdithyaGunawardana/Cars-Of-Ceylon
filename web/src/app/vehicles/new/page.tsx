import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";

const formSchema = z.object({
  uniqueIdentifier: z.string().trim().min(2).max(40),
  licensePlate: z.string().trim().min(2).max(20).optional().nullable(),
  manufacturer: z.string().trim().min(2).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.coerce.number().int().min(1886).max(2100),
  description: z.string().trim().max(5000).optional().nullable(),
});

async function createVehicle(formData: FormData) {
  "use server";

  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/vehicles/new");
  }

  const rawValues = {
    uniqueIdentifier: formData.get("uniqueIdentifier"),
    licensePlate: formData.get("licensePlate") || null,
    manufacturer: formData.get("manufacturer"),
    model: formData.get("model"),
    year: formData.get("year"),
    description: formData.get("description") || null,
  };

  const parsed = formSchema.safeParse(rawValues);
  if (!parsed.success) {
    redirect("/vehicles/new?error=validation");
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        ...parsed.data,
        createdByUserId: session.user.id,
        events: {
          create: {
            userId: session.user.id,
            type: "CREATED",
            title: "Vehicle entry created",
            details: "Initial vehicle record added.",
          },
        },
      },
    });

    revalidatePath("/vehicles");
    redirect(`/vehicles/${vehicle.id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/vehicles/new?error=duplicate");
    }

    redirect("/vehicles/new?error=unknown");
  }
}

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10 md:px-10">
        <h1 className="text-3xl font-bold text-zinc-100">Add Vehicle</h1>
        <p className="text-sm text-zinc-300">You need to sign in before creating a vehicle record.</p>
        <Link
          href="/api/auth/signin?callbackUrl=/vehicles/new"
          className="w-fit rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300"
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-10 md:px-10">
      <h1 className="text-3xl font-bold text-zinc-100">Add Vehicle</h1>
      <p className="text-sm text-zinc-300">Create a new vehicle profile with a unique identifier and history base.</p>

      {params.error === "validation" ? (
        <p className="rounded-md border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          Please check your inputs and try again.
        </p>
      ) : null}
      {params.error === "duplicate" ? (
        <p className="rounded-md border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          A vehicle with this unique identifier or license plate already exists.
        </p>
      ) : null}
      {params.error === "unknown" ? (
        <p className="rounded-md border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          Something went wrong while saving the vehicle.
        </p>
      ) : null}

      <form action={createVehicle} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <input
          name="uniqueIdentifier"
          placeholder="Unique Identifier (required)"
          required
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="licensePlate"
          placeholder="License Plate"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="manufacturer"
          placeholder="Manufacturer"
          required
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="model"
          placeholder="Model"
          required
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="year"
          placeholder="Year"
          type="number"
          required
          min={1886}
          max={2100}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <textarea
          name="description"
          placeholder="Vehicle description/history"
          rows={5}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300"
          >
            Save Vehicle
          </button>
          <Link
            href="/vehicles"
            className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
