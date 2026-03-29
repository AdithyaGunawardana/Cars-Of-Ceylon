import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { updateReportSuccessSchema } from "@/lib/contracts/report-contracts";

// Mock auth so each test controls moderator authorization.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    report: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

describe("PATCH /api/reports/:id", () => {
  beforeEach(() => {
    // Reset mocks between scenarios.
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null as never);

    const request = new Request("http://localhost/api/reports/r1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "r1" }) });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 403 for non-moderator users", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);

    const request = new Request("http://localhost/api/reports/r1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "r1" }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Forbidden");
  });

  it("returns 404 when report does not exist", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "m1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "m1", role: "MODERATOR" } as never);
    vi.mocked(prisma.report.findUnique).mockResolvedValue(null as never);

    const request = new Request("http://localhost/api/reports/r1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEWING" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "r1" }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Report not found");
  });

  it("updates report status for moderators", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "m1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "m1", role: "MODERATOR" } as never);
    vi.mocked(prisma.report.findUnique).mockResolvedValue({ id: "r1" } as never);
    vi.mocked(prisma.report.update).mockResolvedValue({ id: "r1" } as never);

    const request = new Request("http://localhost/api/reports/r1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "r1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateReportSuccessSchema.safeParse(payload).success).toBe(true);
    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: {
          status: "RESOLVED",
          moderatedById: "m1",
        },
      }),
    );
  });
});
