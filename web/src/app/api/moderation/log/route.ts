import { NextResponse } from "next/server";
import { errorResponse, requireSession, resolveModerator } from "@/lib/api-auth";
import { moderationLogQuerySchema } from "@/lib/contracts/moderation-contracts";
import { listModerationLog } from "@/lib/moderation-log";

// Paginated, filterable audit trail for moderators and admins.
export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const moderator = await resolveModerator(auth.userId);
  if (!moderator.ok) return moderator.response;

  const parsed = moderationLogQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return errorResponse("Invalid query", 400);
  }

  return NextResponse.json(await listModerationLog(parsed.data));
}
