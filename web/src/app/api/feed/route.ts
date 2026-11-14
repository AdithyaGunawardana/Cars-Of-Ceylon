import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireSession } from "@/lib/api-auth";
import { listFollowFeed } from "@/lib/feed-queries";

const feedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// Activity from the people the signed-in user follows.
export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const parsed = feedQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse("Invalid query parameters", 400);

  return NextResponse.json(await listFollowFeed(auth.userId, parsed.data.page, parsed.data.pageSize));
}
