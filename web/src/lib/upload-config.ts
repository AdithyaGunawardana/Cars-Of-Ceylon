// Keep upload MIME checks strict and shared across API routes.
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const uploadRules = {
  // 10 MB keeps payloads manageable for web/mobile clients while supporting good image quality.
  maxBytes: 10 * 1024 * 1024,
  allowedImageTypes: ALLOWED_IMAGE_TYPES,
};

export function getUploadStorageConfig() {
  // Keep upload config resolution centralized so all routes enforce the same env contract.
  const endpoint = process.env.UPLOAD_S3_ENDPOINT;
  const region = process.env.UPLOAD_S3_REGION;
  const bucket = process.env.UPLOAD_S3_BUCKET;
  const accessKeyId = process.env.UPLOAD_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.UPLOAD_S3_SECRET_ACCESS_KEY;
  const publicBaseUrl = process.env.UPLOAD_S3_PUBLIC_BASE_URL;

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

export function buildObjectUrl(storageKey: string, config: ReturnType<typeof getUploadStorageConfig>) {
  if (!config) {
    throw new Error("Upload storage is not configured.");
  }

  // Prefer CDN/public gateway URL when provided; otherwise fall back to endpoint/bucket path URL.
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, "")}/${storageKey}`;
  }

  const normalizedEndpoint = config.endpoint.replace(/\/$/, "");
  return `${normalizedEndpoint}/${config.bucket}/${storageKey}`;
}
