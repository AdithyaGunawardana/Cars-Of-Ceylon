import "dotenv/config";
import { purgeExpiredRefreshTokens } from "../src/lib/mobile-tokens";
import { createS3Client } from "../src/lib/storage";
import { runStorageCleanup } from "../src/lib/storage-cleanup";
import { getUploadStorageConfig } from "../src/lib/upload-config";

// Usage: npm run storage:cleanup            (dry run, prints what would be removed)
//        npm run storage:cleanup -- --apply (actually deletes)
//        --purge-after-days=30  --grace-hours=24
function numberFlag(name: string, fallback: number) {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid --${name}`);
  return value;
}

async function main() {
  const config = getUploadStorageConfig();
  if (!config) throw new Error("Upload storage is not configured (UPLOAD_S3_* env vars).");

  const report = await runStorageCleanup({
    s3: createS3Client(config),
    bucket: config.bucket,
    apply: process.argv.includes("--apply"),
    purgeDeletedAfterDays: numberFlag("purge-after-days", 30),
    orphanGraceMs: numberFlag("grace-hours", 24) * 60 * 60 * 1000,
  });

  console.log(report.apply ? "Applied cleanup:" : "Dry run (pass --apply to delete):");
  console.log(`  vehicles to purge: ${report.purgedVehicleIds.length}`);
  console.log(`  orphaned objects:  ${report.orphanedObjects.length}`);
  for (const key of report.orphanedObjects.slice(0, 20)) console.log(`    ${key}`);
  if (report.orphanedObjects.length > 20) console.log(`    ... and ${report.orphanedObjects.length - 20} more`);
  console.log(`  objects deleted:   ${report.deletedObjectCount}`);
  if (report.apply) console.log(`  expired mobile refresh tokens removed: ${await purgeExpiredRefreshTokens()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
