import Link from "next/link";
import { type Prisma } from "@prisma/client";
import { getAuthSession } from "@/auth";
import { ModerationReportsBoard } from "@/components/moderation-reports-board";
import { prisma } from "@/lib/prisma";

export default async function ModerationReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; pageSize?: string }>;
}) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-10 md:px-10">
        <h1 className="text-3xl font-bold text-zinc-100">Moderation Reports</h1>
        <p className="text-sm text-zinc-300">You need to sign in to access moderation tools.</p>
        <Link
          href="/api/auth/signin?callbackUrl=/moderation/reports"
          className="w-fit rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!currentUser || (currentUser.role !== "MODERATOR" && currentUser.role !== "ADMIN")) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-10 md:px-10">
        <h1 className="text-3xl font-bold text-zinc-100">Moderation Reports</h1>
        <p className="rounded-md border border-red-700 bg-red-950/60 px-3 py-2 text-sm text-red-200">
          You do not have permission to access this page.
        </p>
      </main>
    );
  }

  const params = await searchParams;
  const status = params.status;
  const page = Number(params.page ?? "1");
  const pageSize = Number(params.pageSize ?? "20");
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : 20;

  // Build an optional status filter for queue views.
  const statusFilter =
    status === "PENDING" || status === "REVIEWING" || status === "RESOLVED" || status === "REJECTED"
      ? status
      : null;

  const where: Prisma.ReportWhereInput = statusFilter ? { status: statusFilter } : {};

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
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
    }),
    prisma.report.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-zinc-100">Moderation Reports</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href="/moderation/reports" className="rounded-md border border-zinc-700 px-3 py-1 text-zinc-200 hover:bg-zinc-800">
            All
          </Link>
          <Link href="/moderation/reports?status=PENDING" className="rounded-md border border-zinc-700 px-3 py-1 text-zinc-200 hover:bg-zinc-800">
            Pending
          </Link>
          <Link href="/moderation/reports?status=REVIEWING" className="rounded-md border border-zinc-700 px-3 py-1 text-zinc-200 hover:bg-zinc-800">
            Reviewing
          </Link>
          <Link href="/moderation/reports?status=RESOLVED" className="rounded-md border border-zinc-700 px-3 py-1 text-zinc-200 hover:bg-zinc-800">
            Resolved
          </Link>
          <Link href="/moderation/reports?status=REJECTED" className="rounded-md border border-zinc-700 px-3 py-1 text-zinc-200 hover:bg-zinc-800">
            Rejected
          </Link>
        </div>
      </div>

      <ModerationReportsBoard reports={items} />

      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
        <p>
          Page {safePage} of {totalPages} ({total} total)
        </p>
        <div className="flex gap-2">
          <Link
            href={`/moderation/reports?page=${Math.max(1, safePage - 1)}${status ? `&status=${status}` : ""}`}
            className="rounded-md border border-zinc-700 px-3 py-1 hover:bg-zinc-800"
          >
            Previous
          </Link>
          <Link
            href={`/moderation/reports?page=${Math.min(totalPages, safePage + 1)}${status ? `&status=${status}` : ""}`}
            className="rounded-md border border-zinc-700 px-3 py-1 hover:bg-zinc-800"
          >
            Next
          </Link>
        </div>
      </div>
    </main>
  );
}
