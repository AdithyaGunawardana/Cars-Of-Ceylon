import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async () => "hashed-password"),
  },
}));

import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/lib/rate-limit";
import { POST } from "./route";

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
  });

  it("returns 400 for invalid registration data", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Invalid registration data");
  });

  it("returns 409 when the email is already registered", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as never);

    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Jane",
          email: "jane@example.com",
          password: "password123",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Email is already registered");
  });

  it("creates a hashed user record for a new account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "u-new",
      name: "Jane",
      email: "jane@example.com",
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Jane",
          email: "jane@example.com",
          password: "password123",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.user.id).toBe("u-new");
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Jane",
          email: "jane@example.com",
          passwordHash: "hashed-password",
        }),
      }),
    );
  });

  function registerRequest(email: string, ip = "9.9.9.9") {
    return new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ name: "Jane", email, password: "password123" }),
    });
  }

  it("normalizes email to lowercase before lookup and storage", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "u-new" } as never);

    const response = await POST(registerRequest("  Jane@Example.COM "));

    expect(response.status).toBe(201);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "jane@example.com" } }));
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "jane@example.com" }) }),
    );
  });

  it("returns 429 after 10 attempts from one IP within the window", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as never);

    for (let i = 0; i < 10; i += 1) {
      expect((await POST(registerRequest(`a${i}@example.com`))).status).toBe(409);
    }

    const blocked = await POST(registerRequest("late@example.com"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);

    // A different IP is unaffected.
    expect((await POST(registerRequest("other@example.com", "8.8.8.8"))).status).toBe(409);
  });
});
