import { GetBucketCorsCommand, PutBucketCorsCommand, type CORSRule, type S3Client } from "@aws-sdk/client-s3";

// Browsers upload photos straight to the bucket with a presigned PUT, so the bucket must allow the site origin.
// (MinIO allows this by default, which is why local development and the E2E suite work without it.)

export function parseOrigins(raw: string | undefined) {
  const origins = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (value === "*") throw new Error("A wildcard origin is not allowed; list the exact site origins.");
      return new URL(value).origin;
    });
  return [...new Set(origins)];
}

export function buildCorsRules(origins: string[]): CORSRule[] {
  if (origins.length === 0) throw new Error("At least one origin is required.");
  return [
    {
      AllowedOrigins: origins,
      // PUT for presigned uploads; GET/HEAD so image previews and canvas reads work from the site.
      AllowedMethods: ["PUT", "GET", "HEAD"],
      // The presigned URL signs content-type and content-length, which the browser sends as headers.
      AllowedHeaders: ["Content-Type", "Content-Length", "x-amz-*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ];
}

export async function applyBucketCors(s3: S3Client, bucket: string, origins: string[]) {
  const rules = buildCorsRules(origins);
  await s3.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: rules } }));
  const applied = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
  return applied.CORSRules ?? [];
}
