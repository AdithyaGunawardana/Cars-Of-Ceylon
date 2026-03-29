"use client";

import { FormEvent, useState } from "react";

type Props = {
  vehicleId: string;
  isSignedIn: boolean;
};

export function VehicleReportForm({ vehicleId, isSignedIn }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason") ?? "").trim();

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, reason }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Failed to submit report.");
      setLoading(false);
      return;
    }

    event.currentTarget.reset();
    setSuccess("Report submitted. A moderator will review it.");
    setLoading(false);
  }

  if (!isSignedIn) {
    return (
      <p className="text-sm text-zinc-300">
        Sign in to report issues with this vehicle history entry.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-base font-semibold text-zinc-100">Report This Vehicle</h3>
      <p className="text-xs text-zinc-400">Use this when timeline, ownership claims, or photos look inaccurate.</p>
      <textarea
        name="reason"
        placeholder="Explain the issue (minimum 5 characters)"
        required
        minLength={5}
        maxLength={2000}
        rows={4}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-fit rounded-md border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-950 disabled:opacity-60"
      >
        {loading ? "Submitting..." : "Submit Report"}
      </button>
    </form>
  );
}
