import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type UserRole } from "@prisma/client";
import type { ZodType } from "zod";
import { resetRateLimits } from "@/lib/rate-limit";
import { truncateAll } from "./test-env";

// Separate client for arranging/inspecting data; the app under test uses its own via @/lib/prisma.
export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

export type TestUser = { id: string; email: string; name: string; role: UserRole };

export async function resetState() {
  await truncateAll();
  resetRateLimits();
  actAs(null);
}

export async function createUser(role: UserRole = "USER", name = "Test User"): Promise<TestUser> {
  const email = `${role.toLowerCase()}.${randomUUID().slice(0, 8)}@example.com`;
  const user = await db.user.create({ data: { email, name, role, passwordHash: "not-a-real-hash" } });
  return { id: user.id, email, name, role };
}

export function actAs(user: Pick<TestUser, "id"> | null) {
  (globalThis as { __testUserId?: string | null }).__testUserId = user?.id ?? null;
}

type CallOptions = { method?: string; json?: unknown; query?: Record<string, string | number>; headers?: Record<string, string> };

// Invoke a route handler exactly like Next would, returning status + parsed JSON.
export async function call<TContext>(
  handler: (request: Request, context: TContext) => Promise<Response>,
  options: CallOptions & { params?: Record<string, string> } = {},
) {
  const url = new URL("http://localhost/api/test");
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, String(value));

  const request = new Request(url, {
    method: options.method ?? (options.json !== undefined ? "POST" : "GET"),
    headers: { ...(options.json !== undefined ? { "Content-Type": "application/json" } : {}), ...options.headers },
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
  });

  const response = await handler(request, { params: Promise.resolve(options.params ?? {}) } as TContext);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body: body as Record<string, any>, headers: response.headers }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Assert a response body matches a strict wire schema, with a readable failure message.
export function expectSchema<T>(schema: ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Response did not match schema:\n${JSON.stringify(result.error.issues, null, 2)}`);
  }
  return result.data;
}

export async function createVehicle(owner: Pick<TestUser, "id">, overrides: Record<string, unknown> = {}) {
  const suffix = randomUUID().slice(0, 8);
  return db.vehicle.create({
    data: {
      uniqueIdentifier: `IT-${suffix}`,
      manufacturer: "Austin",
      model: "A40",
      year: 1960,
      createdByUserId: owner.id,
      ...overrides,
    },
  });
}
