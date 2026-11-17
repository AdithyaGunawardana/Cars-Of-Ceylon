import { vi } from "vitest";

// The only thing stubbed in integration tests is the signed-in identity. Everything else is real.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(async () => {
    const userId = (globalThis as { __testUserId?: string | null }).__testUserId;
    const issuedAt = (globalThis as { __testIssuedAt?: number }).__testIssuedAt;
    return userId ? { user: { id: userId }, ...(issuedAt !== undefined ? { issuedAt } : {}) } : null;
  }),
  authOptions: {},
}));
