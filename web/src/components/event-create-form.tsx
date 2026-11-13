"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  EVENT_TYPE_OPTIONS,
  inputClass,
  localInputToIso,
  primaryButtonClass,
  readApiError,
  textareaClass,
} from "@/lib/client-utils";

type Props = {
  vehicleId: string;
  canContribute: boolean;
  isSignedIn: boolean;
};

// Form for adding a timeline event. Photo uploads live in PhotoUploadForm.
export function EventCreateForm({ vehicleId, canContribute, isSignedIn }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    setError(null);
    setLoading(true);

    const form = new FormData(formElement);
    const payload = {
      type: String(form.get("type") ?? "NOTE"),
      title: String(form.get("title") ?? "").trim(),
      details: String(form.get("details") ?? "").trim() || null,
      sourceUrl: String(form.get("sourceUrl") ?? "").trim() || null,
      occurredAt: localInputToIso(String(form.get("occurredAt") ?? "")),
    };

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(await readApiError(response, "Failed to add event."));
        return;
      }

      formElement.reset();
      // Refresh server-rendered vehicle detail data after a successful mutation.
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isSignedIn) {
    return <p className="text-sm text-[#504442]">Sign in to add timeline events.</p>;
  }

  if (!canContribute) {
    return <p className="text-sm text-[#504442]">Only the owner or moderators can add events.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl bg-[#f5f4e8] p-4 ring-1 ring-[#d3c3c0]/70">
      <h3 className="font-serif text-lg text-[#271310]">Add timeline event</h3>
      <label className="grid gap-1 text-xs text-[#504442]">
        Type
        <select name="type" defaultValue="NOTE" className={inputClass}>
          {EVENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-[#504442]">
        Title
        <input name="title" required minLength={2} maxLength={140} placeholder="Event title" className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs text-[#504442]">
        Details
        <textarea name="details" rows={3} maxLength={5000} placeholder="What happened?" className={textareaClass} />
      </label>
      <label className="grid gap-1 text-xs text-[#504442]">
        Source URL (optional, http/https)
        <input name="sourceUrl" type="url" placeholder="https://" className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs text-[#504442]">
        When did it happen? (optional)
        <input name="occurredAt" type="datetime-local" className={inputClass} />
      </label>
      {error ? (
        <p role="alert" className="rounded-full bg-[#fff0ef] px-3 py-2 text-xs text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={loading} className={`${primaryButtonClass} w-fit`}>
        {loading ? "Saving..." : "Save event"}
      </button>
    </form>
  );
}
