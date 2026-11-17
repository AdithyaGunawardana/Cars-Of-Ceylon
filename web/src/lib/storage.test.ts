import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";
import { createS3Client } from "./storage";

const config = {
  endpoint: "https://storage.example.com",
  region: "us-east-1",
  bucket: "bucket",
  accessKeyId: "key",
  secretAccessKey: "secret",
  publicBaseUrl: undefined,
};

describe("createS3Client presigned uploads", () => {
  it("does not bake an empty-body checksum into presigned PUT URLs", async () => {
    // Regression: with the SDK default, URLs carried x-amz-checksum-crc32=AAAAAA== (CRC32 of an empty body), which
    // AWS S3 / R2 validate against the real upload and reject. Local MinIO ignores it, so only this test catches it.
    const url = new URL(
      await getSignedUrl(
        createS3Client(config),
        new PutObjectCommand({ Bucket: "bucket", Key: "vehicles/v/u/1-x.png", ContentType: "image/png", ContentLength: 4 }),
        { expiresIn: 300, signableHeaders: new Set(["content-type"]) },
      ),
    );

    const checksumParams = [...url.searchParams.keys()].filter((key) => /checksum/i.test(key));
    expect(checksumParams).toEqual([]);
    // Still a proper SigV4 presigned URL that signs the content type.
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
  });
});
