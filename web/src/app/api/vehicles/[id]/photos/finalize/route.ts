import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildObjectUrl, getUploadStorageConfig } from "@/lib/upload-config";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const createPhotoSchema = z.object({
  storageKey: z.string().trim().min(1).max(512),
  caption: z.string().trim().max(500).optional().nullable(),
});

// Finalizes an uploaded object by writing photo metadata to the database.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsedBody = createPhotoSchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid photo data", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const [vehicle, currentUser] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: parsedParams.data.id }, select: { id: true, createdByUserId: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } }),
  ]);

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mirror event contribution policy: owner, moderator, or admin can add media entries.
  const canContribute =
    vehicle.createdByUserId === currentUser.id || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN";

  if (!canContribute) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storageConfig = getUploadStorageConfig();
  if (!storageConfig) {
    return NextResponse.json(
      { error: "Upload storage is not configured. Set UPLOAD_S3_* environment variables." },
      { status: 503 },
    );
  }

  // Rebuild the canonical URL on the server to avoid trusting client-provided public URLs.
  const url = buildObjectUrl(parsedBody.data.storageKey, storageConfig);

  const photo = await prisma.vehiclePhoto.create({
    data: {
      vehicleId: vehicle.id,
      userId: currentUser.id,
      url,
      storageKey: parsedBody.data.storageKey,
      caption: parsedBody.data.caption,
    },
  });

  return NextResponse.json({ photo }, { status: 201 });
}
