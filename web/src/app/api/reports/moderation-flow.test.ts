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

type PrismaMockArgs = {
  where?: { id?: string };
  data?: {
    vehicleId?: string;
    createdById?: string;
    reason?: string;
    status?: "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";
    moderatedById?: string;
  };
};

type PrismaMockRecord = {
  id: string;
  role?: "USER" | "MODERATOR" | "ADMIN";
};

type MockedMethod<TArgs, TResult> = {
  mockResolvedValue: (value: TResult) => void;
  mockImplementation: (implementation: (args: TArgs) => TResult | Promise<TResult>) => void;
};

const vehicleFindUniqueMock = prisma.vehicle.findUnique as unknown as MockedMethod<PrismaMockArgs, PrismaMockRecord | null>;
const reportCountMock = prisma.report.count as unknown as MockedMethod<never, number>;
const userFindUniqueMock = prisma.user.findUnique as unknown as MockedMethod<PrismaMockArgs, PrismaMockRecord | null>;
const reportCreateMock = prisma.report.create as unknown as MockedMethod<PrismaMockArgs, PrismaMockRecord>;
const reportFindUniqueMock = prisma.report.findUnique as unknown as MockedMethod<PrismaMockArgs, PrismaMockRecord | null>;
const reportUpdateMock = prisma.report.update as unknown as MockedMethod<PrismaMockArgs, PrismaMockRecord | null>;

function setupModerationFlowMocks() {
  // Reporter session is consumed by POST, moderator session is consumed by PATCH.
  vi.mocked(getAuthSession)
    .mockResolvedValueOnce({ user: { id: "u-reporter" } } as never)
    .mockResolvedValueOnce({ user: { id: "u-moderator" } } as never);

  vehicleFindUniqueMock.mockResolvedValue({ id: "vehicle-1" });
  reportCountMock.mockResolvedValue(0);

  userFindUniqueMock.mockImplementation(async (args) => {
    if (args.where?.id === "u-moderator") {
      return { id: "u-moderator", role: "MODERATOR" };
    }

    return { id: "u-reporter", role: "USER" };
  });

  reportCreateMock.mockImplementation(async (args) => {
    const data = args.data ?? {};
    const next = {
      id: "report-1",
      vehicleId: String(data.vehicleId ?? ""),
      createdById: String(data.createdById ?? ""),
      reason: String(data.reason ?? ""),
      status: (data.status ?? "PENDING") as "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED",
      moderatedById: null,
    };
    reportsStore.push(next);
    return { id: next.id };
  });

  reportFindUniqueMock.mockImplementation(async (args) => {
    const report = reportsStore.find((item) => item.id === args.where?.id);
    return report ? { id: report.id } : null;
  });

  reportUpdateMock.mockImplementation(async (args) => {
    const data = args.data ?? {};
    const report = reportsStore.find((item) => item.id === args.where?.id);
    if (!report) {
      return null;
    }

    report.status = data.status as "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";
    report.moderatedById = String(data.moderatedById ?? "");
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
