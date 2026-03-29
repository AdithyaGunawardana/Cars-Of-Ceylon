import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";

const idSchema = z.object({
  id: z.string().min(1),
});

// Returns one vehicle with timeline/photos and enforces private visibility rules.
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const parsed = idSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: parsed.data.id },
    include: {
      createdBy: {
        select: { id: true, name: true },
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
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (vehicle.visibility === "PRIVATE") {
    const session = await getAuthSession();
    // Return 404 for unauthorized private access to avoid leaking record existence.
    const canViewPrivate = session?.user?.id === vehicle.createdByUserId;
    if (!canViewPrivate) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ vehicle });
}
