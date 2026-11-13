"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  EVENT_TYPE_OPTIONS,
  dangerButtonClass,
  inputClass,
  isHttpUrl,
  isoToLocalInput,
  localInputToIso,
  primaryButtonClass,
  readApiError,
  secondaryButtonClass,
  textareaClass,
} from "@/lib/client-utils";

export type TimelineEvent = {
  id: string;
  type: string;
  title: string;
  details: string | null;
  sourceUrl: string | null;
  occurredAt: string | null;
  createdAt: string;
};

type Props = {
  vehicleId: string;
  events: TimelineEvent[];
  canManage: boolean;
};

const typeLabels: Record<string, string> = Object.fromEntries(EVENT_TYPE_OPTIONS.map((o) => [o.value, o.label]));
typeLabels.CREATED = "Created";

// Timeline with inline edit/delete controls for users who can manage the vehicle.
export function TimelineEventList({ vehicleId, events, canManage }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  async function handleSave(e: FormEvent<HTMLFormElement>, eventId: string) {
    e.preventDefault();
    setError(null);
    setBusyId(eventId);

    const form = new FormData(e.currentTarget);
    const payload = {
      type: String(form.get("type") ?? "NOTE"),
      title: String(form.get("title") ?? "").trim(),
      details: String(form.get("details") ?? "").trim() || null,
      sourceUrl: String(form.get("sourceUrl") ?? "").trim() || null,
      occurredAt: localInputToIso(String(form.get("occurredAt") ?? "")),
    };

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError({ id: eventId, message: await readApiError(response, "Failed to update event.") });
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setError({ id: eventId, message: "Network error. Please try again." });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(eventId: string, title: string) {
    if (!window.confirm(`Delete the event "${title}"? This cannot be undone.`)) return;
    setError(null);
    setBusyId(eventId);

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/events/${eventId}`, { method: "DELETE" });
      if (!response.ok) {
        setError({ id: eventId, message: await readApiError(response, "Failed to delete event.") });
        return;
      }
      router.refresh();
    } catch {
      setError({ id: eventId, message: "Network error. Please try again." });
    } finally {
      setBusyId(null);
    }
  }

  if (events.length === 0) {
    return <p className="text-sm text-[#504442]">No events yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const isEditing = editingId === event.id;
        const busy = busyId === event.id;
        const when = event.occurredAt ?? event.createdAt;

        return (
          <li key={event.id} className="rounded-2xl bg-[#f5f4e8] p-4 ring-1 ring-[#d3c3c0]/70">
            {isEditing ? (
              <form onSubmit={(e) => handleSave(e, event.id)} className="grid gap-3">
                <select name="type" defaultValue={event.type} aria-label="Event type" className={inputClass}>
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  {event.type === "CREATED" ? <option value="CREATED">Created</option> : null}
                </select>
                <input
                  name="title"
                  defaultValue={event.title}
                  required
                  minLength={2}
                  maxLength={140}
                  aria-label="Title"
                  className={inputClass}
                />
                <textarea
                  name="details"
                  defaultValue={event.details ?? ""}
                  rows={3}
                  maxLength={5000}
                  aria-label="Details"
                  className={textareaClass}
                />
                <input
                  name="sourceUrl"
                  type="url"
                  defaultValue={event.sourceUrl ?? ""}
                  placeholder="https://"
                  aria-label="Source URL"
                  className={inputClass}
                />
                <input
                  name="occurredAt"
                  type="datetime-local"
                  defaultValue={isoToLocalInput(event.occurredAt)}
                  aria-label="Occurred at"
                  className={inputClass}
                />
                {error?.id === event.id ? (
                  <p role="alert" className="rounded-full bg-[#fff0ef] px-3 py-2 text-xs text-[#9e2a2b]">
                    {error.message}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className={primaryButtonClass}>
                    {busy ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(null);
                      setError(null);
                    }}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#271310]">{event.title}</p>
                    <p className="text-xs text-[#765f5c]">
                      {typeLabels[event.type] ?? event.type} •{" "}
                      <time dateTime={when}>{new Date(when).toLocaleString()}</time>
                      {event.occurredAt ? "" : " (date added)"}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(event.id);
                          setError(null);
                        }}
                        className={secondaryButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(event.id, event.title)}
                        className={dangerButtonClass}
                      >
                        {busy ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-[#504442]">{event.details ?? "No details provided."}</p>
                {isHttpUrl(event.sourceUrl) ? (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-2 inline-block text-xs font-semibold text-[#725a39] hover:text-[#271310]"
                  >
                    Source
                  </a>
                ) : null}
                {error?.id === event.id ? (
                  <p role="alert" className="mt-2 text-xs text-[#9e2a2b]">
                    {error.message}
                  </p>
                ) : null}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
