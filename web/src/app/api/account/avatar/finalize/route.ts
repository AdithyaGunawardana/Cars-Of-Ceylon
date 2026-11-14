import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api-auth";
import { avatarFinalizeSchema } from "@/lib/contracts/user-contracts";
import { prisma } from "@/lib/prisma";
import { AVATAR_MAX_BYTES, createS3Client, isValidAvatarKey } from "@/lib/storage";
import { buildObjectUrl, getUploadStorageConfig, uploadRules } from "@/lib/upload-config";

// Verifies the uploaded object and makes it the user's avatar, removing the previously uploaded one.
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const parsed = avatarFinalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid avatar data", 400);

  const config = getUploadStorageConfig();
  if (!config) return errorResponse("Upload storage is not configured. Set UPLOAD_S3_* environment variables.", 503);

  // Only keys minted by upload-url for this user are accepted.
  if (!isValidAvatarKey(parsed.data.storageKey, auth.userId)) return errorResponse("Invalid storage key", 400);

  const client = createS3Client(config);
  let head;
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: parsed.data.storageKey }));
  } catch {
    return errorResponse("Uploaded file not found. Upload it before finalizing.", 400);
  }

  const allowedTypes: readonly string[] = uploadRules.allowedImageTypes;
  const sizeOk = typeof head.ContentLength === "number" && head.ContentLength > 0 && head.ContentLength <= AVATAR_MAX_BYTES;
  const typeOk = Boolean(head.ContentType && allowedTypes.includes(head.ContentType));
  if (!sizeOk || !typeOk) {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: parsed.data.storageKey })).catch(() => undefined);
    return errorResponse("Uploaded file violates size or type rules", 400);
  }

  const previous = await prisma.user.findUnique({ where: { id: auth.userId }, select: { avatarKey: true } });
  const image = buildObjectUrl(parsed.data.storageKey, config);
  await prisma.user.update({ where: { id: auth.userId }, data: { image, avatarKey: parsed.data.storageKey } });

  // Best effort: a failure leaves an orphan that `npm run storage:cleanup` collects.
  if (previous?.avatarKey && previous.avatarKey !== parsed.data.storageKey) {
    await client
      .send(new DeleteObjectCommand({ Bucket: config.bucket, Key: previous.avatarKey }))
      .catch((error: unknown) => console.error("Failed to delete old avatar", previous.avatarKey, error));
  }

  return NextResponse.json({ image });
}
