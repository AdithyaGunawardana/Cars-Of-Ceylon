import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { followMutationResponseSchema, userIdParamsSchema } from "@/lib/contracts/user-contracts";
import { prisma } from "@/lib/prisma";

async function resolveTargetUser(profileUserId: string) {
  return prisma.user.findUnique({
    where: { id: profileUserId },
    select: { id: true },
  });
}

// Creates a follow edge from the signed-in viewer to another profile.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const parsedParams = userIdParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  if (parsedParams.data.id === auth.userId) {
    return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
  }

  const targetUser = await resolveTargetUser(parsedParams.data.id);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await prisma.follow.findFirst({
    where: {
      followerId: auth.userId,
      followeeId: parsedParams.data.id,
    },
  });

  if (!existing) {
    await prisma.follow.create({
      data: {
        followerId: auth.userId,
        followeeId: parsedParams.data.id,
      },
    });
  }

  return NextResponse.json(followMutationResponseSchema.parse({ following: true }));
}

// Removes a follow edge from the signed-in viewer to another profile.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const parsedParams = userIdParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  if (parsedParams.data.id === auth.userId) {
    return NextResponse.json({ error: "You cannot unfollow yourself." }, { status: 400 });
  }

  const targetUser = await resolveTargetUser(parsedParams.data.id);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.follow.deleteMany({
    where: {
      followerId: auth.userId,
      followeeId: parsedParams.data.id,
    },
  });

  return NextResponse.json(followMutationResponseSchema.parse({ following: false }));
}
