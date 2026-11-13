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
  });
}

// Keys are scoped to vehicle AND uploader so finalize can prove the caller requested the upload.
export function buildStorageKeyPrefix(vehicleId: string, userId: string) {
  return `vehicles/${vehicleId}/${userId}/`;
}

const KEY_TAIL_PATTERN = /^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function isValidStorageKey(storageKey: string, vehicleId: string, userId: string) {
  const prefix = buildStorageKeyPrefix(vehicleId, userId);
  return storageKey.startsWith(prefix) && KEY_TAIL_PATTERN.test(storageKey.slice(prefix.length));
}
