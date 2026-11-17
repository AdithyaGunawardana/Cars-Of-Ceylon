import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api-auth";
import { accountResponseSchema, updateAccountSchema } from "@/lib/contracts/user-contracts";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { createS3Client } from "@/lib/storage";
import { getUploadStorageConfig } from "@/lib/upload-config";

const accountSelect = { id: true, name: true, email: true, image: true, profile: true, avatarKey: true, emailVerified: true } as const;

function toAccount(user: { id: string; name: string | null; email: string; image: string | null; profile: unknown; emailVerified: Date | null }) {
  const bio = user.profile && typeof user.profile === "object" ? (user.profile as { bio?: unknown }).bio : null;
  return accountResponseSchema.parse({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      bio: typeof bio === "string" ? bio : null,
      emailVerified: Boolean(user.emailVerified),
    },
  });
}

// Current user's own account details.
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: accountSelect });
  if (!user) return errorResponse("Unauthorized", 401);
  return NextResponse.json(toAccount(user));
}

// Edit name, bio and avatar URL. Email/role are intentionally not editable here.
export async function PATCH(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const parsed = updateAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account data", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id: auth.userId }, select: accountSelect });
  if (!existing) return errorResponse("Unauthorized", 401);

  const { name, bio, image } = parsed.data;
  // Replacing an uploaded avatar with a link (or removing it) retires the stored object.
  const retireUploadedAvatar = image !== undefined && image !== existing.image && Boolean(existing.avatarKey);
  const currentProfile =
    existing.profile && typeof existing.profile === "object" && !Array.isArray(existing.profile)
      ? (existing.profile as Record<string, unknown>)
      : {};

  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(image !== undefined ? { image: image || null, ...(retireUploadedAvatar ? { avatarKey: null } : {}) } : {}),
      ...(bio !== undefined ? { profile: { ...currentProfile, bio } } : {}),
    },
    select: accountSelect,
  });

  if (retireUploadedAvatar && existing.avatarKey) {
    const config = getUploadStorageConfig();
    if (config) {
      await createS3Client(config)
        .send(new DeleteObjectCommand({ Bucket: config.bucket, Key: existing.avatarKey }))
        .catch((error: unknown) => console.error("Failed to delete old avatar", existing.avatarKey, error));
    }
  }

  return NextResponse.json(toAccount(updated));
}
