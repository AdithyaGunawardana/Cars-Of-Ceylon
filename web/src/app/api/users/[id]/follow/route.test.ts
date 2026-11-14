import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { followMutationResponseSchema } from "@/lib/contracts/user-contracts";

vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    follow: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DELETE, POST } from "./route";

describe("/api/users/:id/follow route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the caller is not signed in", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null as never);

    const response = await POST(new Request("http://localhost/api/users/u2/follow", { method: "POST" }), {
      params: Promise.resolve({ id: "u2" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 400 when attempting to follow yourself", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);

    const response = await POST(new Request("http://localhost/api/users/u1/follow", { method: "POST" }), {
      params: Promise.resolve({ id: "u1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("You cannot follow yourself.");
  });

  it("creates a follow edge for a valid target", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2" } as never);
    vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never);

    const response = await POST(new Request("http://localhost/api/users/u2/follow", { method: "POST" }), {
      params: Promise.resolve({ id: "u2" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(followMutationResponseSchema.safeParse(payload).success).toBe(true);
    expect(payload.following).toBe(true);
    expect(prisma.follow.create).toHaveBeenCalledWith({
      data: {
        followerId: "u1",
        followeeId: "u2",
      },
    });
  });

  it("deletes a follow edge for a valid target", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2" } as never);

    const response = await DELETE(new Request("http://localhost/api/users/u2/follow", { method: "DELETE" }), {
      params: Promise.resolve({ id: "u2" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(followMutationResponseSchema.safeParse(payload).success).toBe(true);
    expect(payload.following).toBe(false);
    expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
      where: {
        followerId: "u1",
        followeeId: "u2",
      },
    });
  });
});
