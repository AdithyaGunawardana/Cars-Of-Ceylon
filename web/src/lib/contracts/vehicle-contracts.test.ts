import { describe, expect, it } from "vitest";
import { createVehicleEventRequestSchema, updateVehicleEventRequestSchema } from "@/lib/contracts/vehicle-contracts";

const base = { type: "NOTE" as const, title: "Service done" };

describe("event sourceUrl", () => {
  it.each(["https://example.com/a", "http://example.com"])("accepts %s", (sourceUrl) => {
    expect(createVehicleEventRequestSchema.safeParse({ ...base, sourceUrl }).success).toBe(true);
    expect(updateVehicleEventRequestSchema.safeParse({ sourceUrl }).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>1</script>", "ftp://example.com", "file:///etc/passwd"])(
    "rejects %s",
    (sourceUrl) => {
      expect(createVehicleEventRequestSchema.safeParse({ ...base, sourceUrl }).success).toBe(false);
      expect(updateVehicleEventRequestSchema.safeParse({ sourceUrl }).success).toBe(false);
    },
  );

  it("still allows null/omitted", () => {
    expect(createVehicleEventRequestSchema.safeParse({ ...base, sourceUrl: null }).success).toBe(true);
    expect(createVehicleEventRequestSchema.safeParse(base).success).toBe(true);
  });
});
