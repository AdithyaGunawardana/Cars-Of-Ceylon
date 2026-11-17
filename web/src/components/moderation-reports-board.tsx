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
  moderatedAt: string | Date | null;
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
    <section className="rounded-[1.5rem] bg-white p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
      <h2 className="font-serif text-xl text-[#271310]">Report Queue</h2>
      <p className="mt-2 text-sm text-[#504442]">Review and transition moderation reports.</p>

      {error ? <p className="mt-3 rounded-full bg-[#fff0ef] px-3 py-2 text-sm text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {reports.length === 0 ? <p className="text-sm text-[#504442]">No reports found for this filter.</p> : null}

        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl bg-[#f5f4e8] p-4 ring-1 ring-[#d3c3c0]/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#271310]">
                  {report.vehicle.manufacturer} {report.vehicle.model} ({report.vehicle.year})
                </p>
                <p className="text-xs text-[#765f5c]">UID: {report.vehicle.uniqueIdentifier}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs text-[#725a39] ring-1 ring-[#d3c3c0]/70">{report.status}</span>
            </div>

            <p className="mt-3 text-sm text-[#271310]">{report.reason}</p>
            <p className="mt-2 text-xs text-[#765f5c]">
              Reported by {report.createdBy.name ?? "Unknown"} • {new Date(report.createdAt).toLocaleString()}
            </p>
            <p className="text-xs text-[#765f5c]">Last moderated by {report.moderatedBy?.name ?? "Not yet moderated"}{report.moderatedAt ? ` • ${new Date(report.moderatedAt).toLocaleString()}` : ""}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {/* Mirror server workflow: PENDING -> REVIEWING -> RESOLVED | REJECTED. */}
              <button
                type="button"
                disabled={updatingId === report.id || report.status !== "PENDING"}
                onClick={() => handleStatusChange(report.id, "REVIEWING")}
                className="rounded-full border border-[#d3c3c0] px-3 py-1.5 text-xs font-semibold text-[#271310] hover:bg-white disabled:opacity-60"
              >
                {report.status === "PENDING" ? "Mark Reviewing" : "Reviewing"}
              </button>
              <button
                type="button"
                disabled={updatingId === report.id || report.status !== "REVIEWING"}
                onClick={() => handleStatusChange(report.id, "RESOLVED")}
                className="rounded-full bg-[#271310] px-3 py-1.5 text-xs font-semibold text-[#fbfaee] hover:bg-[#3e2723] disabled:opacity-60"
              >
                Resolve
              </button>
              <button
                type="button"
                disabled={updatingId === report.id || report.status !== "REVIEWING"}
                onClick={() => handleStatusChange(report.id, "REJECTED")}
                className="rounded-full border border-[#9e2a2b]/40 px-3 py-1.5 text-xs font-semibold text-[#9e2a2b] hover:bg-[#fff0ef] disabled:opacity-60"
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
