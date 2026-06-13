import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { userProfileResponseSchema } from "@/lib/contracts/user-contracts";

vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    vehicle: {
      findMany: vi.fn(),
    },
    follow: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

describe("GET /api/users/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the user does not exist", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const response = await GET(new Request("http://localhost/api/users/u1"), {
      params: Promise.resolve({ id: "u1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("User not found");
  });

  it("returns profile data and keeps private vehicles visible for the owner", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: "u1",
        name: "Owner",
        email: "owner@example.com",
        image: null,
        profile: { bio: "Keeping records" },
      } as never)
      .mockResolvedValueOnce({ id: "u1", role: "USER" } as never);
    vi.mocked(prisma.vehicle.findMany).mockResolvedValue([
      {
        id: "v1",
        uniqueIdentifier: "ABC-1",
        licensePlate: "CAB-1234",
        manufacturer: "Toyota",
        model: "Corolla",
        year: 1999,
        visibility: "PRIVATE",
        _count: { events: 2, photos: 1 },
      },
    ] as never);
    vi.mocked(prisma.follow.count).mockResolvedValueOnce(3 as never).mockResolvedValueOnce(7 as never);

    const response = await GET(new Request("http://localhost/api/users/u1"), {
      params: Promise.resolve({ id: "u1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(userProfileResponseSchema.safeParse(payload).success).toBe(true);
    expect(payload.relationship).toEqual({ isSelf: true, isFollowing: false });
    expect(payload.stats).toEqual({ vehicleCount: 1, followerCount: 3, followingCount: 7 });
    expect(payload.vehicles).toHaveLength(1);
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdByUserId: "u1",
        },
      }),
    );
    expect(prisma.follow.findFirst).not.toHaveBeenCalled();
  });
});
