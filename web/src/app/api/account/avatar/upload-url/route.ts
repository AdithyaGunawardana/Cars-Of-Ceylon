import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api-auth";
import { avatarUploadUrlSchema } from "@/lib/contracts/user-contracts";
import { rateLimit } from "@/lib/rate-limit";
import { AVATAR_MAX_BYTES, buildAvatarKeyPrefix, createS3Client, extensionByMimeType } from "@/lib/storage";
import { getUploadStorageConfig, uploadRules } from "@/lib/upload-config";

// Issues a short-lived signed URL so the browser can upload the avatar straight to object storage.
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`avatar-upload:${auth.userId}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return errorResponse("Too many uploads. Please try again later.", 429, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const parsed = avatarUploadUrlSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid upload request", 400);

  if (!uploadRules.allowedImageTypes.includes(parsed.data.fileType as (typeof uploadRules.allowedImageTypes)[number])) {
    return errorResponse("Unsupported file type", 400);
  }
  if (parsed.data.fileSize > AVATAR_MAX_BYTES) {
    return errorResponse(`File too large. Max is ${AVATAR_MAX_BYTES} bytes.`, 400);
  }

  const config = getUploadStorageConfig();
  if (!config) return errorResponse("Upload storage is not configured. Set UPLOAD_S3_* environment variables.", 503);

  const storageKey = `${buildAvatarKeyPrefix(auth.userId)}${Date.now()}-${randomUUID()}.${extensionByMimeType[parsed.data.fileType]}`;
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ContentType: parsed.data.fileType,
    ContentLength: parsed.data.fileSize,
  });
  const uploadUrl = await getSignedUrl(createS3Client(config), command, {
    expiresIn: 300,
    signableHeaders: new Set(["content-type"]),
  });

  return NextResponse.json({ uploadUrl, storageKey, expiresInSeconds: 300, maxBytes: AVATAR_MAX_BYTES });
}
