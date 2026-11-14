import { NextResponse } from "next/server";
import { requireSession, resolveModerator } from "@/lib/api-auth";
import { reportIdParamsSchema, updateReportStatusRequestSchema } from "@/lib/contracts/report-contracts";
import { canTransitionReport } from "@/lib/authz";
import { writeModerationLog } from "@/lib/moderation-log";
import { prisma } from "@/lib/prisma";

// Moderators/admins can transition report status and record who handled the decision.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const parsedParams = reportIdParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsedBody = updateReportStatusRequestSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid report update", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const moderator = await resolveModerator(auth.userId);
  if (!moderator.ok) return moderator.response;
  const currentUser = moderator.user;

  const existing = await prisma.report.findUnique({
    where: { id: parsedParams.data.id },
    select: { id: true, status: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Enforce PENDING -> REVIEWING -> RESOLVED | REJECTED.
  if (!canTransitionReport(existing.status, parsedBody.data.status)) {
    return NextResponse.json(
      { error: `Cannot move report from ${existing.status} to ${parsedBody.data.status}.` },
      { status: 409 },
    );
  }

  // Compare-and-set on the old status so two moderators cannot both apply conflicting transitions.
  // The audit row commits atomically with the transition.
  const actionByStatus = { REVIEWING: "REPORT_REVIEWING", RESOLVED: "REPORT_RESOLVED", REJECTED: "REPORT_REJECTED" } as const;
  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.report.updateMany({
      where: { id: existing.id, status: existing.status },
      data: { status: parsedBody.data.status, moderatedById: currentUser.id, moderatedAt: new Date() },
    });
    if (result.count > 0) {
      await writeModerationLog(tx, {
        actorId: currentUser.id,
        action: actionByStatus[parsedBody.data.status],
        targetType: "REPORT",
        targetId: existing.id,
        metadata: { from: existing.status, to: parsedBody.data.status },
      });
    }
    return result;
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "Report was updated by someone else. Refresh and retry." }, { status: 409 });
  }

  const report = await prisma.report.findUniqueOrThrow({
    where: { id: existing.id },
    include: {
      vehicle: {
        select: {
          id: true,
          uniqueIdentifier: true,
          manufacturer: true,
          model: true,
          year: true,
        },
      },
      createdBy: {
        select: { id: true, name: true },
      },
      moderatedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ report });
}
