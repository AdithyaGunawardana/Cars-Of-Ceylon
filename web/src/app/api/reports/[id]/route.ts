import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { reportIdParamsSchema, updateReportStatusRequestSchema } from "@/lib/contracts/report-contracts";
import { prisma } from "@/lib/prisma";

// Moderators/admins can transition report status and record who handled the decision.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (currentUser.role !== "MODERATOR" && currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.report.findUnique({
    where: { id: parsedParams.data.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const report = await prisma.report.update({
    where: { id: parsedParams.data.id },
    data: {
      status: parsedBody.data.status,
      moderatedById: currentUser.id,
    },
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
