import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReportSuccessSchema, updateReportSuccessSchema } from "@/lib/contracts/report-contracts";

// Mock auth to switch identities between reporter and moderator in one test flow.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

type Status = "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";

const reportsStore: Array<{
  id: string;
  vehicleId: string;
  createdById: string;
  reason: string;
  status: Status;
  moderatedById: string | null;
  moderatedAt: Date | null;
}> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    moderationLog: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    vehicle: { findUnique: vi.fn() },
    report: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/lib/rate-limit";
import { POST as createReport } from "./route";
import { PATCH as updateReport } from "./[id]/route";

type Args = {
  where?: { id?: string; status?: Status };
  data?: {
    vehicleId?: string;
    createdById?: string;
    reason?: string;
    status?: Status;
    moderatedById?: string;
    moderatedAt?: Date;
  };
};

type MockedMethod<TArgs, TResult> = {
  mockResolvedValue: (value: TResult) => void;
  mockImplementation: (implementation: (args: TArgs) => TResult | Promise<TResult>) => void;
};

const mocked = <TArgs, TResult>(fn: unknown) => fn as MockedMethod<TArgs, TResult>;

function setupModerationFlowMocks() {
  // Reporter session is consumed by POST; moderator session by each following PATCH.
  vi.mocked(getAuthSession)
    .mockResolvedValueOnce({ user: { id: "u-reporter" } } as never)
    .mockResolvedValue({ user: { id: "u-moderator" } } as never);

  mocked<Args, unknown>(prisma.vehicle.findUnique).mockResolvedValue({
    id: "vehicle-1",
    visibility: "PUBLIC",
    createdByUserId: "u-owner",
  });

  mocked<Args, unknown>(prisma.user.findUnique).mockImplementation(async (args) =>
    args.where?.id === "u-moderator" ? { id: "u-moderator", role: "MODERATOR" } : { id: "u-reporter", role: "USER" },
  );

  mocked<Args, unknown>(prisma.report.findFirst).mockImplementation(async () => null);

  mocked<Args, unknown>(prisma.report.create).mockImplementation(async (args) => {
    const data = args.data ?? {};
    const next = {
      id: "report-1",
      vehicleId: String(data.vehicleId ?? ""),
      createdById: String(data.createdById ?? ""),
      reason: String(data.reason ?? ""),
      status: (data.status ?? "PENDING") as Status,
      moderatedById: null,
      moderatedAt: null,
    };
    reportsStore.push(next);
    return { id: next.id };
  });

  mocked<Args, unknown>(prisma.report.findUnique).mockImplementation(async (args) => {
    const report = reportsStore.find((item) => item.id === args.where?.id);
    return report ? { id: report.id, status: report.status } : null;
  });

  // Compare-and-set: only applies when the stored status still matches.
  mocked<Args, unknown>(prisma.report.updateMany).mockImplementation(async (args) => {
    const report = reportsStore.find((item) => item.id === args.where?.id && item.status === args.where?.status);
    if (!report) {
      return { count: 0 };
    }
    report.status = args.data?.status as Status;
    report.moderatedById = args.data?.moderatedById ?? null;
    report.moderatedAt = args.data?.moderatedAt ?? null;
    return { count: 1 };
  });

  mocked<Args, unknown>(prisma.report.findUniqueOrThrow).mockImplementation(async (args) => {
    const report = reportsStore.find((item) => item.id === args.where?.id);
    if (!report) throw new Error("not found");
    return { id: report.id, status: report.status };
  });
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patchStatus(status: Status) {
  return updateReport(jsonRequest("http://localhost/api/reports/report-1", "PATCH", { status }), {
    params: Promise.resolve({ id: "report-1" }),
  });
}

describe("Moderation flow integration-style test", () => {
  beforeEach(() => {
    // Reset in-memory report state and all mocked behavior between runs.
    reportsStore.length = 0;
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => fn(prisma)) as never);
    resetRateLimits();
  });

  it("creates report as user, then moderator reviews and resolves it", async () => {
    setupModerationFlowMocks();

    const createResponse = await createReport(
      jsonRequest("http://localhost/api/reports", "POST", {
        vehicleId: "vehicle-1",
        reason: "Timeline includes incorrect ownership claim.",
      }),
    );
    const createPayload = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createReportSuccessSchema.safeParse(createPayload).success).toBe(true);
    expect(reportsStore[0]?.status).toBe("PENDING");

    // PENDING cannot jump straight to a final state.
    expect((await patchStatus("RESOLVED")).status).toBe(409);
    expect(reportsStore[0]?.status).toBe("PENDING");

    const reviewing = await patchStatus("REVIEWING");
    expect(reviewing.status).toBe(200);
    expect(reportsStore[0]?.status).toBe("REVIEWING");

    const resolved = await patchStatus("RESOLVED");
    const resolvedPayload = await resolved.json();

    expect(resolved.status).toBe(200);
    expect(updateReportSuccessSchema.safeParse(resolvedPayload).success).toBe(true);
    expect(reportsStore[0]?.status).toBe("RESOLVED");
    expect(reportsStore[0]?.moderatedById).toBe("u-moderator");
    expect(reportsStore[0]?.moderatedAt).toBeInstanceOf(Date);

    // Final states are terminal.
    expect((await patchStatus("REVIEWING")).status).toBe(409);
  });

  it("creates report as user, then moderator reviews and rejects it", async () => {
    setupModerationFlowMocks();

    const createResponse = await createReport(
      jsonRequest("http://localhost/api/reports", "POST", {
        vehicleId: "vehicle-1",
        reason: "Photos look unrelated to this vehicle.",
      }),
    );

    expect(createResponse.status).toBe(201);
    expect(reportsStore[0]?.status).toBe("PENDING");

    expect((await patchStatus("REVIEWING")).status).toBe(200);

    const rejected = await patchStatus("REJECTED");
    const rejectedPayload = await rejected.json();

    expect(rejected.status).toBe(200);
    expect(updateReportSuccessSchema.safeParse(rejectedPayload).success).toBe(true);
    expect(reportsStore[0]?.status).toBe("REJECTED");
    expect(reportsStore[0]?.moderatedById).toBe("u-moderator");
  });
});
