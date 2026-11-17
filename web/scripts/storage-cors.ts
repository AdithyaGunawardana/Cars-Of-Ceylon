import "dotenv/config";
import { createS3Client } from "../src/lib/storage";
import { applyBucketCors, parseOrigins } from "../src/lib/storage-cors";
import { getUploadStorageConfig } from "../src/lib/upload-config";

// Usage: UPLOAD_CORS_ORIGINS=https://cars.example.com npm run storage:cors
// Falls back to AUTH_URL when UPLOAD_CORS_ORIGINS is not set.
async function main() {
  const config = getUploadStorageConfig();
  if (!config) throw new Error("Upload storage is not configured (UPLOAD_S3_* env vars).");

  const origins = parseOrigins(process.env.UPLOAD_CORS_ORIGINS ?? process.env.AUTH_URL);
  if (origins.length === 0) throw new Error("Set UPLOAD_CORS_ORIGINS (comma separated) or AUTH_URL.");

  const rules = await applyBucketCors(createS3Client(config), config.bucket, origins);
  console.log(`CORS applied to bucket "${config.bucket}":`);
  console.log(JSON.stringify(rules, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error: { Code?: string; name?: string; message?: string }) => {
    if (error?.Code === "NotImplemented") {
      console.error(
        "This storage server does not support per-bucket CORS (MinIO configures CORS globally, e.g. MINIO_API_CORS_ALLOW_ORIGIN).\n" +
          "Use this script against AWS S3 or Cloudflare R2.",
      );
    } else {
      console.error(error);
    }
    process.exit(1);
  });
