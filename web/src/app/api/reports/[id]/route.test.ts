import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { updateReportSuccessSchema } from "@/lib/contracts/report-contracts";

// Mock auth so each test controls moderator authorization.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    moderationLog: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    report: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
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
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => fn(prisma)) as never);
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

  function patchRequest(status: string) {
    return new Request("http://localhost/api/reports/r1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  it("moves a PENDING report to REVIEWING and records moderator and timestamp", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "m1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "m1", role: "MODERATOR" } as never);
    vi.mocked(prisma.report.findUnique).mockResolvedValue({ id: "r1", status: "PENDING" } as never);
    vi.mocked(prisma.report.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.report.findUniqueOrThrow).mockResolvedValue({ id: "r1", status: "REVIEWING" } as never);

    const response = await PATCH(patchRequest("REVIEWING"), { params: Promise.resolve({ id: "r1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateReportSuccessSchema.safeParse(payload).success).toBe(true);
    expect(prisma.report.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", status: "PENDING" },
      data: { status: "REVIEWING", moderatedById: "m1", moderatedAt: expect.any(Date) },
    });
  });

  it("allows REVIEWING -> RESOLVED", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "m1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "m1", role: "MODERATOR" } as never);
    vi.mocked(prisma.report.findUnique).mockResolvedValue({ id: "r1", status: "REVIEWING" } as never);
    vi.mocked(prisma.report.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.report.findUniqueOrThrow).mockResolvedValue({ id: "r1", status: "RESOLVED" } as never);

    const response = await PATCH(patchRequest("RESOLVED"), { params: Promise.resolve({ id: "r1" }) });
    expect(response.status).toBe(200);
  });

  it.each([
    ["PENDING", "RESOLVED"],
    ["PENDING", "REJECTED"],
    ["RESOLVED", "REVIEWING"],
    ["REJECTED", "RESOLVED"],
    ["REVIEWING", "REVIEWING"],
  ])("rejects invalid transition %s -> %s with 409", async (from, to) => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "m1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "m1", role: "MODERATOR" } as never);
    vi.mocked(prisma.report.findUnique).mockResolvedValue({ id: "r1", status: from } as never);

    const response = await PATCH(patchRequest(to), { params: Promise.resolve({ id: "r1" }) });

    expect(response.status).toBe(409);
    expect(prisma.report.updateMany).not.toHaveBeenCalled();
  });

  it("returns 409 when another moderator changed the status first", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "m1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "m1", role: "MODERATOR" } as never);
    vi.mocked(prisma.report.findUnique).mockResolvedValue({ id: "r1", status: "PENDING" } as never);
    vi.mocked(prisma.report.updateMany).mockResolvedValue({ count: 0 } as never);

    const response = await PATCH(patchRequest("REVIEWING"), { params: Promise.resolve({ id: "r1" }) });

    expect(response.status).toBe(409);
  });
});
