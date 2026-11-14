import { DeleteObjectsCommand, ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";

type CleanupOptions = {
  s3: S3Client;
  bucket: string;
  // false (default) only reports what would be removed.
  apply?: boolean;
  // Uploads younger than this are never treated as orphans: the client may still be about to finalize them.
  orphanGraceMs?: number;
  // Soft-deleted vehicles older than this are permanently removed along with their photo objects.
  purgeDeletedAfterDays?: number;
  now?: Date;
};

export type CleanupReport = {
  apply: boolean;
  orphanedObjects: string[];
  purgedVehicleIds: string[];
  deletedObjectCount: number;
};

const DEFAULT_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PURGE_AFTER_DAYS = 30;
const DELETE_BATCH = 1000;

async function deleteObjects(s3: S3Client, bucket: string, keys: string[]) {
  let deleted = 0;
  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    const batch = keys.slice(i, i + DELETE_BATCH);
    const result = await s3.send(
      new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }),
    );
    deleted += batch.length - (result.Errors?.length ?? 0);
  }
  return deleted;
}

// Objects under vehicles/ that no VehiclePhoto row references and that are old enough to be abandoned uploads
// (presigned PUT that never finalized, or an object left behind when a delete failed).
export async function findOrphanedObjects(options: Pick<CleanupOptions, "s3" | "bucket" | "orphanGraceMs" | "now">) {
  const cutoff = (options.now ?? new Date()).getTime() - (options.orphanGraceMs ?? DEFAULT_ORPHAN_GRACE_MS);
  const orphans: string[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await options.s3.send(
      new ListObjectsV2Command({ Bucket: options.bucket, Prefix: "vehicles/", ContinuationToken: continuationToken }),
    );
    const candidates = (page.Contents ?? [])
      .filter((object) => object.Key && object.LastModified && object.LastModified.getTime() < cutoff)
      .map((object) => object.Key!);

    if (candidates.length > 0) {
      const referenced = await prisma.vehiclePhoto.findMany({
        where: { storageKey: { in: candidates } },
        select: { storageKey: true },
      });
      const referencedKeys = new Set(referenced.map((photo) => photo.storageKey));
      orphans.push(...candidates.filter((key) => !referencedKeys.has(key)));
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return orphans;
}

// Permanently removes vehicles that have been soft-deleted for longer than the retention window.
// Objects are deleted before rows so a failure leaves rows (retryable) rather than untracked objects.
export async function purgeDeletedVehicles(options: CleanupOptions) {
  const days = options.purgeDeletedAfterDays ?? DEFAULT_PURGE_AFTER_DAYS;
  const cutoff = new Date((options.now ?? new Date()).getTime() - days * 24 * 60 * 60 * 1000);

  const vehicles = await prisma.vehicle.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true, photos: { select: { storageKey: true } } },
  });

  const keys = vehicles.flatMap((vehicle) => vehicle.photos.map((photo) => photo.storageKey));
  if (!options.apply) {
    return { vehicleIds: vehicles.map((vehicle) => vehicle.id), keys, deletedObjects: 0 };
  }

  const deletedObjects = keys.length > 0 ? await deleteObjects(options.s3, options.bucket, keys) : 0;
  if (deletedObjects < keys.length) {
    throw new Error(`Only ${deletedObjects}/${keys.length} objects were deleted; vehicles were kept so the purge can be retried.`);
  }
  // Photos, events and reports cascade with the vehicle; the moderation log keeps its own history.
  await prisma.vehicle.deleteMany({ where: { id: { in: vehicles.map((vehicle) => vehicle.id) } } });

  return { vehicleIds: vehicles.map((vehicle) => vehicle.id), keys, deletedObjects };
}

export async function runStorageCleanup(options: CleanupOptions): Promise<CleanupReport> {
  const apply = options.apply ?? false;

  // Purge first so the objects it removes are not also reported as orphans.
  const purge = await purgeDeletedVehicles({ ...options, apply });
  const orphanedObjects = await findOrphanedObjects(options);
  // In dry-run mode purge keys are still referenced by rows, so there is no overlap to worry about.

  const deletedFromOrphans = apply && orphanedObjects.length > 0 ? await deleteObjects(options.s3, options.bucket, orphanedObjects) : 0;

  return {
    apply,
    orphanedObjects,
    purgedVehicleIds: purge.vehicleIds,
    deletedObjectCount: purge.deletedObjects + deletedFromOrphans,
  };
}
