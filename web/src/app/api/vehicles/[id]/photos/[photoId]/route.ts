import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { canManageVehicle } from "@/lib/authz";
import { photoIdParamsSchema, updatePhotoRequestSchema } from "@/lib/contracts/photo-contracts";
import { prisma } from "@/lib/prisma";
import { createS3Client } from "@/lib/storage";
import { getUploadStorageConfig } from "@/lib/upload-config";

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

// Shared lookup: authenticated user + photo scoped to the vehicle in the URL + manage permission.
async function authorize(context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const parsedParams = photoIdParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return { error: NextResponse.json({ error: "Invalid photo id" }, { status: 400 }) };
  }

  const [photo, currentUser] = await Promise.all([
    prisma.vehiclePhoto.findUnique({
      where: { id: parsedParams.data.photoId },
      select: { id: true, vehicleId: true, storageKey: true, vehicle: { select: { createdByUserId: true } } },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } }),
  ]);

  // Photo must belong to the vehicle in the URL, otherwise treat as missing.
  if (!photo || photo.vehicleId !== parsedParams.data.id) {
    return { error: NextResponse.json({ error: "Photo not found" }, { status: 404 }) };
  }
  if (!currentUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageVehicle(currentUser, photo.vehicle)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { photo };
}

// Edit a photo caption (owner/moderator/admin).
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorize(context);
  if (auth.error) return auth.error;

  const payload = await request.json().catch(() => null);
  const parsedBody = updatePhotoRequestSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid photo data", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const photo = await prisma.vehiclePhoto.update({
    where: { id: auth.photo.id },
    data: { caption: parsedBody.data.caption || null },
  });

  return NextResponse.json({ photo });
}

// Delete a photo record and, best-effort, its stored object (owner/moderator/admin).
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await authorize(context);
  if (auth.error) return auth.error;

  await prisma.vehiclePhoto.delete({ where: { id: auth.photo.id } });

  // The DB row is the source of truth; a failed object delete only leaves an orphan to clean up later.
  const storageConfig = getUploadStorageConfig();
  if (storageConfig) {
    await createS3Client(storageConfig)
      .send(new DeleteObjectCommand({ Bucket: storageConfig.bucket, Key: auth.photo.storageKey }))
      .catch((error: unknown) => console.error("Failed to delete photo object", auth.photo.storageKey, error));
  }

  return new NextResponse(null, { status: 204 });
}
