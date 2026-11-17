import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAuthSession } from "@/auth";
import { VehicleAttributeFields } from "@/components/vehicle-attribute-fields";
import { inputClass, primaryButtonClass, secondaryButtonClass, textareaClass } from "@/lib/client-utils";
import { createVehicleRequestSchema } from "@/lib/contracts/vehicle-contracts";
import { prisma } from "@/lib/prisma";
import { attributesFromFormData } from "@/lib/vehicle-attributes";

export const metadata: Metadata = { title: "Add vehicle", robots: { index: false } };

// Form fields arrive as strings, so only `year` needs coercion on top of the shared API contract.
const formSchema = createVehicleRequestSchema.extend({
  year: z.coerce.number().int().min(1886).max(2100),
});

// Server action for authenticated vehicle creation.
async function createVehicle(formData: FormData) {
  "use server";

  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/vehicles/new");
  }

  // Suspended accounts may still hold a valid session cookie; the API guard checks this too.
  const account = await prisma.user.findUnique({ where: { id: session.user.id }, select: { bannedAt: true } });
  if (!account || account.bannedAt) {
    redirect("/vehicles/new?error=suspended");
  }

  const rawValues = {
    uniqueIdentifier: formData.get("uniqueIdentifier"),
    licensePlate: formData.get("licensePlate") || null,
    manufacturer: formData.get("manufacturer"),
    model: formData.get("model"),
    year: formData.get("year"),
    description: formData.get("description") || null,
    attributes: attributesFromFormData(formData),
  };

  const parsed = formSchema.safeParse(rawValues);
  if (!parsed.success) {
    redirect("/vehicles/new?error=validation");
  }

  let vehicleId: string;
  try {
    // Create vehicle and first timeline event atomically so each record has an initial history entry.
    const vehicle = await prisma.vehicle.create({
      data: {
        ...parsed.data,
        attributes: parsed.data.attributes ?? undefined,
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
    vehicleId = vehicle.id;
  } catch (error) {
    // Prisma P2002 covers uniqueIdentifier/licensePlate uniqueness violations.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/vehicles/new?error=duplicate");
    }

    redirect("/vehicles/new?error=unknown");
  }

  // redirect() works by throwing, so it must stay outside the try/catch above or the catch would swallow it.
  revalidatePath("/vehicles");
  redirect(`/vehicles/${vehicleId}`);
}

const ERROR_MESSAGES: Record<string, string> = {
  validation: "Please check your inputs and try again.",
  duplicate: "A vehicle with this unique identifier or license plate already exists.",
  suspended: "Your account is suspended and cannot add vehicles.",
  unknown: "Something went wrong while saving the vehicle.",
};

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
        <h1 className="font-serif text-3xl text-[#271310]">Add Vehicle</h1>
        <p className="text-sm text-[#504442]">You need to sign in before creating a vehicle record.</p>
        <Link href="/login?callbackUrl=/vehicles/new" className={`${primaryButtonClass} w-fit`}>
          Sign in
        </Link>
      </main>
    );
  }

  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-10 md:px-10">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Archive</p>
        <h1 className="font-serif text-3xl text-[#271310]">Add Vehicle</h1>
        <p className="mt-1 text-sm text-[#504442]">Create a new vehicle profile with a unique identifier and history base.</p>
      </div>

      {errorMessage ? (
        <p role="alert" className="rounded-full bg-[#fff0ef] px-4 py-2 text-sm text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">
          {errorMessage}
        </p>
      ) : null}

      <form action={createVehicle} className="grid gap-3 rounded-[1.5rem] bg-white p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
        <input name="uniqueIdentifier" placeholder="Unique Identifier (required)" required className={inputClass} />
        <input name="licensePlate" placeholder="License Plate" className={inputClass} />
        <input name="manufacturer" placeholder="Manufacturer" required className={inputClass} />
        <input name="model" placeholder="Model" required className={inputClass} />
        <input name="year" placeholder="Year" type="number" required min={1886} max={2100} className={inputClass} />
        <textarea name="description" placeholder="Vehicle description/history" rows={5} className={textareaClass} />
        <VehicleAttributeFields />
        <div className="flex gap-3 pt-2">
          <button type="submit" className={primaryButtonClass}>
            Save Vehicle
          </button>
          <Link href="/vehicles" className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
