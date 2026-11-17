import { S3Client } from "@aws-sdk/client-s3";
import { getUploadStorageConfig } from "@/lib/upload-config";

type StorageConfig = NonNullable<ReturnType<typeof getUploadStorageConfig>>;

// Extension is derived from the validated MIME type, never from the client-supplied filename.
export const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function createS3Client(config: StorageConfig) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // The SDK's default ("WHEN_SUPPORTED") bakes a CRC32 of an *empty* body into presigned PUT URLs
    // (x-amz-checksum-crc32=AAAAAA==). Servers that validate checksums, including AWS S3 and R2, then reject the
    // browser's real upload. Only add checksums where an operation requires them (DeleteObjects still gets one).
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

// Keys are scoped to vehicle AND uploader so finalize can prove the caller requested the upload.
export function buildStorageKeyPrefix(vehicleId: string, userId: string) {
  return `vehicles/${vehicleId}/${userId}/`;
}

// Avatars live under avatars/<userId>/ and are replaced (not accumulated) when the user uploads a new one.
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export function buildAvatarKeyPrefix(userId: string) {
  return `avatars/${userId}/`;
}

export function isValidAvatarKey(storageKey: string, userId: string) {
  const prefix = buildAvatarKeyPrefix(userId);
  return storageKey.startsWith(prefix) && KEY_TAIL_PATTERN.test(storageKey.slice(prefix.length));
}

const KEY_TAIL_PATTERN = /^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function isValidStorageKey(storageKey: string, vehicleId: string, userId: string) {
  const prefix = buildStorageKeyPrefix(vehicleId, userId);
  return storageKey.startsWith(prefix) && KEY_TAIL_PATTERN.test(storageKey.slice(prefix.length));
}
