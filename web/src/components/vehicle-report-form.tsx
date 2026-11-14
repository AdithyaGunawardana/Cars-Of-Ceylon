"use client";

import { FormEvent, useState } from "react";
import { readApiError, secondaryButtonClass, textareaClass } from "@/lib/client-utils";

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
    // React nulls event.currentTarget once the handler yields, so keep a reference for use after awaits.
    const formElement = event.currentTarget;
    setError(null);
    setSuccess(null);
    setLoading(true);

    const reason = String(new FormData(formElement).get("reason") ?? "").trim();

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, reason }),
      });

      if (!response.ok) {
        setError(await readApiError(response, "Failed to submit report."));
        return;
      }

      formElement.reset();
      setSuccess("Report submitted. A moderator will review it.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isSignedIn) {
    return <p className="text-sm text-[#504442]">Sign in to report issues with this vehicle history entry.</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-[1.5rem] bg-[#ffffff] p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70"
    >
      <h3 className="font-serif text-xl text-[#271310]">Report this vehicle</h3>
      <p className="text-xs text-[#765f5c]">Use this when timeline, ownership claims, or photos look inaccurate.</p>
      <textarea
        name="reason"
        placeholder="Explain the issue (minimum 5 characters)"
        required
        minLength={5}
        maxLength={2000}
        rows={4}
        className={textareaClass}
      />
      {error ? (
        <p role="alert" className="rounded-full bg-[#fff0ef] px-3 py-2 text-sm text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="rounded-full bg-[#f5f4e8] px-3 py-2 text-sm text-[#406c50] ring-1 ring-[#d3c3c0]/70">
          {success}
        </p>
      ) : null}
      <button type="submit" disabled={loading} className={`${secondaryButtonClass} w-fit`}>
        {loading ? "Submitting..." : "Submit Report"}
      </button>
    </form>
  );
}
