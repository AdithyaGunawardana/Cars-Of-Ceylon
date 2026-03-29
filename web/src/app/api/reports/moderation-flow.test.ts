import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReportSuccessSchema, updateReportSuccessSchema } from "@/lib/contracts/report-contracts";

// Mock auth to switch identities between reporter and moderator in one test flow.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

const reportsStore: Array<{
  id: string;
  vehicleId: string;
  createdById: string;
  reason: string;
  status: "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";
  moderatedById: string | null;
}> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    vehicle: {
      findUnique: vi.fn(),
    },
    report: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { POST as createReport } from "./route";
import { PATCH as updateReport } from "./[id]/route";

function setupModerationFlowMocks() {
  // Reporter session is consumed by POST, moderator session is consumed by PATCH.
  vi.mocked(getAuthSession)
    .mockResolvedValueOnce({ user: { id: "u-reporter" } } as never)
    .mockResolvedValueOnce({ user: { id: "u-moderator" } } as never);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.vehicle.findUnique as any).mockResolvedValue({ id: "vehicle-1" });
  (prisma.report.count as any).mockResolvedValue(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.user.findUnique as any).mockImplementation(async (args: any) => {
    if (args.where.id === "u-moderator") {
      return { id: "u-moderator", role: "MODERATOR" };
    }

    return { id: "u-reporter", role: "USER" };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.report.create as any).mockImplementation(async (args: any) => {
    const next = {
      id: "report-1",
      vehicleId: String(args.data.vehicleId ?? ""),
      createdById: String(args.data.createdById ?? ""),
      reason: String(args.data.reason ?? ""),
      status: (args.data.status ?? "PENDING") as "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED",
      moderatedById: null,
    };
    reportsStore.push(next);
    return { id: next.id };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.report.findUnique as any).mockImplementation(async (args: any) => {
    const report = reportsStore.find((item) => item.id === args.where.id);
    return report ? { id: report.id } : null;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.report.update as any).mockImplementation(async (args: any) => {
    const report = reportsStore.find((item) => item.id === args.where.id);
    if (!report) {
      return null;
    }

    report.status = args.data.status as "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";
    report.moderatedById = String(args.data.moderatedById ?? "");
    return { id: report.id };
  });
}

describe("Moderation flow integration-style test", () => {
  beforeEach(() => {
    // Reset in-memory report state and all mocked behavior between runs.
    reportsStore.length = 0;
    vi.clearAllMocks();
  });

  it("creates report as user and resolves it as moderator", async () => {
    setupModerationFlowMocks();

    const createRequest = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId: "vehicle-1", reason: "Timeline includes incorrect ownership claim." }),
    });

    const createResponse = await createReport(createRequest);
    const createPayload = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createReportSuccessSchema.safeParse(createPayload).success).toBe(true);
    expect(reportsStore).toHaveLength(1);
    expect(reportsStore[0]?.status).toBe("PENDING");

    // Step 2: moderator resolves the same report.
    const patchRequest = new Request("http://localhost/api/reports/report-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    });

    const patchResponse = await updateReport(patchRequest, {
      params: Promise.resolve({ id: "report-1" }),
    });
    const patchPayload = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(updateReportSuccessSchema.safeParse(patchPayload).success).toBe(true);
    expect(reportsStore[0]?.status).toBe("RESOLVED");
    expect(reportsStore[0]?.moderatedById).toBe("u-moderator");
  });

  it("creates report as user and rejects it as moderator", async () => {
    setupModerationFlowMocks();

    const createRequest = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId: "vehicle-1", reason: "Photos look unrelated to this vehicle." }),
    });

    const createResponse = await createReport(createRequest);
    const createPayload = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createReportSuccessSchema.safeParse(createPayload).success).toBe(true);
    expect(reportsStore[0]?.status).toBe("PENDING");

    const patchRequest = new Request("http://localhost/api/reports/report-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED" }),
    });

    const patchResponse = await updateReport(patchRequest, {
      params: Promise.resolve({ id: "report-1" }),
    });
    const patchPayload = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(updateReportSuccessSchema.safeParse(patchPayload).success).toBe(true);
    expect(reportsStore[0]?.status).toBe("REJECTED");
    expect(reportsStore[0]?.moderatedById).toBe("u-moderator");
  });
});
