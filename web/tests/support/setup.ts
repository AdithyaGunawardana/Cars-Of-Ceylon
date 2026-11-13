import { vi } from "vitest";

// The only thing stubbed in integration tests is the signed-in identity. Everything else is real.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(async () => {
    const userId = (globalThis as { __testUserId?: string | null }).__testUserId;
    return userId ? { user: { id: userId } } : null;
  }),
  authOptions: {},
}));
