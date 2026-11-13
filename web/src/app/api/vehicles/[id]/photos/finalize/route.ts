import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireSession, resolveVehicleManager } from "@/lib/api-auth";
import { photoFinalizeRequestSchema, photoVehicleParamsSchema } from "@/lib/contracts/photo-contracts";
import { prisma } from "@/lib/prisma";
import { createS3Client, isValidStorageKey } from "@/lib/storage";
import { buildObjectUrl, getUploadStorageConfig, uploadRules } from "@/lib/upload-config";

// Finalizes an uploaded object by writing photo metadata to the database.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const parsedParams = photoVehicleParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsedBody = photoFinalizeRequestSchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid photo data", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const access = await resolveVehicleManager(parsedParams.data.id, auth.userId);
  if (!access.ok) return access.response;
  const { vehicle, user: currentUser } = access;

  const storageConfig = getUploadStorageConfig();
  if (!storageConfig) {
    return NextResponse.json(
      { error: "Upload storage is not configured. Set UPLOAD_S3_* environment variables." },
      { status: 503 },
    );
  }

  // Only keys minted by upload-url for this vehicle and this user are accepted.
  if (!isValidStorageKey(parsedBody.data.storageKey, vehicle.id, currentUser.id)) {
    return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
  }

  // Verify the object really exists and still satisfies upload rules before recording it.
  const client = createS3Client(storageConfig);
  let head;
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: storageConfig.bucket, Key: parsedBody.data.storageKey }));
  } catch {
    return NextResponse.json({ error: "Uploaded file not found. Upload it before finalizing." }, { status: 400 });
  }

  const allowedTypes: readonly string[] = uploadRules.allowedImageTypes;
  const sizeOk = typeof head.ContentLength === "number" && head.ContentLength > 0 && head.ContentLength <= uploadRules.maxBytes;
  const typeOk = Boolean(head.ContentType && allowedTypes.includes(head.ContentType));
  if (!sizeOk || !typeOk) {
    // Remove the offending object so it cannot be served from the public bucket.
    await client
      .send(new DeleteObjectCommand({ Bucket: storageConfig.bucket, Key: parsedBody.data.storageKey }))
      .catch(() => undefined);
    return NextResponse.json({ error: "Uploaded file violates size or type rules" }, { status: 400 });
  }

  // Rebuild the canonical URL on the server to avoid trusting client-provided public URLs.
  const url = buildObjectUrl(parsedBody.data.storageKey, storageConfig);

  try {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This upload has already been finalized" }, { status: 409 });
    }
    throw error;
  }
}
