import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { photoUploadUrlRequestSchema, photoVehicleParamsSchema } from "@/lib/contracts/photo-contracts";
import { prisma } from "@/lib/prisma";
import { buildObjectUrl, getUploadStorageConfig, uploadRules } from "@/lib/upload-config";

// Issues a short-lived signed URL so clients can upload directly to object storage.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = photoVehicleParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsedBody = photoUploadUrlRequestSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid upload request", details: parsedBody.error.flatten() }, { status: 400 });
  }

  // Enforce server-side limits so clients cannot bypass UI-side checks.
  if (!uploadRules.allowedImageTypes.includes(parsedBody.data.fileType as (typeof uploadRules.allowedImageTypes)[number])) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (parsedBody.data.fileSize > uploadRules.maxBytes) {
    return NextResponse.json({ error: `File too large. Max is ${uploadRules.maxBytes} bytes.` }, { status: 400 });
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

  const safeExtension = parsedBody.data.fileName.includes(".")
    ? parsedBody.data.fileName.split(".").pop()?.toLowerCase() || "bin"
    : "bin";

  // Use a namespaced, collision-resistant key so uploads remain traceable per vehicle.
  const storageKey = `vehicles/${vehicle.id}/${Date.now()}-${randomUUID()}.${safeExtension}`;

  const client = new S3Client({
    endpoint: storageConfig.endpoint,
    region: storageConfig.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: storageConfig.bucket,
    Key: storageKey,
    ContentType: parsedBody.data.fileType,
  });

  // Short-lived URL keeps direct uploads secure while avoiding proxying binary data through Next.js.
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const publicUrl = buildObjectUrl(storageKey, storageConfig);

  return NextResponse.json({
    uploadUrl,
    storageKey,
    publicUrl,
    expiresInSeconds: 300,
    maxBytes: uploadRules.maxBytes,
  });
}
