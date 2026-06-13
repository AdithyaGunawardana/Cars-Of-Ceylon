import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { userIdParamsSchema, userProfileResponseSchema } from "@/lib/contracts/user-contracts";
import { loadUserProfile } from "@/lib/user-profile";

// Returns a public or owner-aware user profile payload for web/mobile clients.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const parsedParams = userIdParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const session = await getAuthSession();
  const profile = await loadUserProfile(parsedParams.data.id, session?.user?.id);

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(userProfileResponseSchema.parse(profile));
}
