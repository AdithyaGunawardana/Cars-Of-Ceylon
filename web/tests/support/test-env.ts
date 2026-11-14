import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand, S3Client } from "@aws-sdk/client-s3";
import { Client } from "pg";

// Shared by Vitest integration tests and Playwright: a dedicated Postgres database and S3 bucket so test
// runs never touch development data.

export const WEB_ROOT = path.resolve(__dirname, "../..");
export const TEST_DB_NAME = "cars_of_ceylon_test";
export const TEST_BUCKET = "cars-of-ceylon-test";

function readDotEnv(): Record<string, string> {
  const file = path.join(WEB_ROOT, ".env");
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/.exec(line);
    if (match) out[match[1]!] = match[2]!;
  }
  return out;
}

function resolveBaseUrl() {
  // CI sets INTEGRATION_DATABASE_URL; locally we reuse the credentials/port from web/.env.
  const base =
    process.env.INTEGRATION_DATABASE_URL ??
    process.env.DATABASE_URL ??
    readDotEnv().DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/postgres";
  return new URL(base);
}

export function getTestDatabaseUrl() {
  const url = resolveBaseUrl();
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

function getAdminDatabaseUrl() {
  const url = resolveBaseUrl();
  url.pathname = "/postgres";
  url.search = "";
  return url.toString();
}

export function getTestS3Config() {
  return {
    endpoint: process.env.INTEGRATION_S3_ENDPOINT ?? "http://localhost:9000",
    region: "us-east-1",
    bucket: TEST_BUCKET,
    accessKeyId: process.env.INTEGRATION_S3_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.INTEGRATION_S3_SECRET_KEY ?? "minioadmin",
  };
}

// Environment variables the app under test needs (used by Vitest `env` and the Playwright web server).
export function getAppTestEnv(): Record<string, string> {
  const s3 = getTestS3Config();
  return {
    DATABASE_URL: getTestDatabaseUrl(),
    AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
    UPLOAD_S3_ENDPOINT: s3.endpoint,
    UPLOAD_S3_REGION: s3.region,
    UPLOAD_S3_BUCKET: s3.bucket,
    UPLOAD_S3_ACCESS_KEY_ID: s3.accessKeyId,
    UPLOAD_S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
    UPLOAD_S3_PUBLIC_BASE_URL: `${s3.endpoint}/${s3.bucket}`,
  };
}

export function createTestS3Client() {
  const s3 = getTestS3Config();
  return new S3Client({
    endpoint: s3.endpoint,
    region: s3.region,
    forcePathStyle: true,
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
  });
}

async function ensureDatabase() {
  const admin = new Client({ connectionString: getAdminDatabaseUrl() });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB_NAME]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    }
  } finally {
    await admin.end();
  }
}

function migrateDatabase() {
  execSync("npx prisma migrate deploy", {
    cwd: WEB_ROOT,
    env: { ...process.env, DATABASE_URL: getTestDatabaseUrl() },
    stdio: "pipe",
  });
}

async function ensureBucket() {
  const client = createTestS3Client();
  const { bucket } = getTestS3Config();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  // Anonymous read mirrors the dev bucket so <img> tags can load uploaded photos.
  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      }),
    }),
  );
}

export async function ensureTestInfra() {
  await ensureDatabase();
  migrateDatabase();
  await ensureBucket();
}

// Wipe all application data between tests. Cascades through every table that references User.
export async function truncateAll() {
  const client = new Client({ connectionString: getTestDatabaseUrl() });
  await client.connect();
  try {
    await client.query('TRUNCATE TABLE "User", "VerificationToken" CASCADE');
  } finally {
    await client.end();
  }
}
