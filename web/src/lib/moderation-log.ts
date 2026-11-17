import type { ModerationAction, ModerationTarget, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LogClient = Pick<Prisma.TransactionClient, "moderationLog">;

export type ModerationLogEntry = {
  actorId: string;
  action: ModerationAction;
  targetType: ModerationTarget;
  targetId: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
};

// Pass the transaction client so the audit row commits atomically with the action it records.
export function writeModerationLog(client: LogClient, entry: ModerationLogEntry) {
  return client.moderationLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason ?? null,
      metadata: entry.metadata,
    },
  });
}

export type ModerationLogQuery = {
  page: number;
  pageSize: number;
  action?: ModerationAction;
  targetType?: ModerationTarget;
  targetId?: string;
};

// Single implementation behind GET /api/moderation/log and the /moderation/log page.
export async function listModerationLog(query: ModerationLogQuery) {
  const { page, pageSize, action, targetType, targetId } = query;
  const where: Prisma.ModerationLogWhereInput = {
    ...(action ? { action } : {}),
    ...(targetType ? { targetType } : {}),
    ...(targetId ? { targetId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.moderationLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, name: true } } },
    }),
    prisma.moderationLog.count({ where }),
  ]);

  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}
