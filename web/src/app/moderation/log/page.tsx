import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/auth";
import { isModerator } from "@/lib/authz";
import { moderationLogQuerySchema } from "@/lib/contracts/moderation-contracts";
import { listModerationLog } from "@/lib/moderation-log";
import { prisma } from "@/lib/prisma";

const ACTION_LABELS: Record<string, string> = {
  REPORT_REVIEWING: "Report moved to reviewing",
  REPORT_RESOLVED: "Report resolved",
  REPORT_REJECTED: "Report rejected",
  VEHICLE_DELETE: "Vehicle deleted",
  VEHICLE_RESTORE: "Vehicle restored",
  CONTENT_HIDE: "Content hidden",
  CONTENT_UNHIDE: "Content unhidden",
  USER_BAN: "User banned",
  USER_UNBAN: "User unbanned",
};

function targetHref(targetType: string, targetId: string) {
  if (targetType === "VEHICLE") return `/vehicles/${targetId}`;
  if (targetType === "USER") return `/users/${targetId}`;
  return null;
}

export default async function ModerationLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/moderation/log");

  const viewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  if (!isModerator(viewer)) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-10 md:px-10">
        <h1 className="font-serif text-3xl text-[#271310]">Moderation log</h1>
        <p className="mt-2 text-sm text-[#504442]">Only moderators and admins can view the audit log.</p>
      </main>
    );
  }

  const raw = await searchParams;
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const parsed = moderationLogQuerySchema.safeParse({
    action: single(raw.action) || undefined,
    targetType: single(raw.targetType) || undefined,
    page: single(raw.page) || undefined,
  });
  const query = parsed.success ? parsed.data : moderationLogQuerySchema.parse({});
  const { items, pagination } = await listModerationLog(query);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (query.action) params.set("action", query.action);
    if (query.targetType) params.set("targetType", query.targetType);
    params.set("page", String(page));
    return `/moderation/log?${params.toString()}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#725a39]">Moderation</p>
          <h1 className="font-serif text-3xl text-[#271310]">Audit log</h1>
        </div>
        <Link href="/moderation/reports" className="text-sm font-semibold text-[#725a39] hover:text-[#271310]">
          Back to reports
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm text-[#504442]">
        <label className="grid gap-1">
          Action
          <select name="action" defaultValue={query.action ?? ""} className="rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2">
            <option value="">All</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-full bg-[#271310] px-4 py-2 text-sm font-semibold text-[#fbfaee] hover:bg-[#3e2723]">
          Filter
        </button>
      </form>

      <section className="rounded-[1.5rem] bg-white p-2 ring-1 ring-[#d3c3c0]/70">
        {items.length === 0 ? <p className="p-4 text-sm text-[#504442]">No moderation activity yet.</p> : null}
        <ul className="divide-y divide-[#d3c3c0]/60">
          {items.map((entry) => {
            const href = targetHref(entry.targetType, entry.targetId);
            return (
              <li key={entry.id} className="grid gap-1 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#271310]">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  <time dateTime={entry.createdAt.toISOString()} className="text-xs text-[#765f5c]">
                    {entry.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </time>
                </div>
                <p className="text-[#504442]">
                  By {entry.actor?.name ?? "a removed account"} on {entry.targetType.toLowerCase()}{" "}
                  {href ? (
                    <Link href={href} className="text-[#725a39] hover:text-[#271310]">{entry.targetId}</Link>
                  ) : (
                    <span>{entry.targetId}</span>
                  )}
                </p>
                {entry.reason ? <p className="text-[#271310]">Reason: {entry.reason}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>

      {pagination.totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {pagination.page > 1 ? <Link href={pageHref(pagination.page - 1)} className="text-[#725a39]">Previous</Link> : <span />}
          <span className="text-[#504442]">Page {pagination.page} of {pagination.totalPages}</span>
          {pagination.page < pagination.totalPages ? <Link href={pageHref(pagination.page + 1)} className="text-[#725a39]">Next</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
