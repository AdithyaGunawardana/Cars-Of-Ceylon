"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ReportStatus = "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";

type ReportItem = {
  id: string;
  reason: string;
  status: ReportStatus;
  createdAt: string | Date;
  vehicle: {
    id: string;
    uniqueIdentifier: string;
    manufacturer: string;
    model: string;
    year: number;
  };
  createdBy: {
    id: string;
    name: string | null;
  };
  moderatedBy: {
    id: string;
    name: string | null;
  } | null;
};

type Props = {
  reports: ReportItem[];
};

export function ModerationReportsBoard({ reports }: Props) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange(reportId: string, status: Exclude<ReportStatus, "PENDING">) {
    setError(null);
    setUpdatingId(reportId);

    const response = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Failed to update report status.");
      setUpdatingId(null);
      return;
    }

    setUpdatingId(null);
    // Refresh server-rendered report queue after status updates.
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
      <h2 className="text-xl font-semibold text-zinc-100">Report Queue</h2>
      <p className="mt-2 text-sm text-zinc-300">Review and transition moderation reports.</p>

      {error ? <p className="mt-3 rounded-md border border-red-700 bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {reports.length === 0 ? <p className="text-sm text-zinc-300">No reports found for this filter.</p> : null}

        {reports.map((report) => (
          <article key={report.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {report.vehicle.manufacturer} {report.vehicle.model} ({report.vehicle.year})
                </p>
                <p className="text-xs text-zinc-400">UID: {report.vehicle.uniqueIdentifier}</p>
              </div>
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{report.status}</span>
            </div>

            <p className="mt-3 text-sm text-zinc-200">{report.reason}</p>
            <p className="mt-2 text-xs text-zinc-400">
              Reported by {report.createdBy.name ?? "Unknown"} • {new Date(report.createdAt).toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400">Last moderated by {report.moderatedBy?.name ?? "Not yet moderated"}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={updatingId === report.id}
                onClick={() => handleStatusChange(report.id, "REVIEWING")}
                className="rounded-md border border-sky-700 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-950 disabled:opacity-60"
              >
                Mark Reviewing
              </button>
              <button
                type="button"
                disabled={updatingId === report.id}
                onClick={() => handleStatusChange(report.id, "RESOLVED")}
                className="rounded-md border border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-950 disabled:opacity-60"
              >
                Resolve
              </button>
              <button
                type="button"
                disabled={updatingId === report.id}
                onClick={() => handleStatusChange(report.id, "REJECTED")}
                className="rounded-md border border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-950 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
