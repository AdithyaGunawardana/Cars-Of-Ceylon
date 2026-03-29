"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type EventType = "CREATED" | "OWNERSHIP_CHANGE" | "SERVICE" | "ACCIDENT" | "MODIFICATION" | "INSPECTION" | "NOTE";

type VehicleEventItem = {
  id: string;
  type: EventType;
  title: string;
  details: string | null;
  sourceUrl: string | null;
  occurredAt: Date | null;
  createdAt: Date;
};

type Props = {
  vehicleId: string;
  events: VehicleEventItem[];
  canManageEvents: boolean;
};

export function VehicleEventsBoard({ vehicleId, events, canManageEvents }: Props) {
  const router = useRouter();
  // Local UI state tracks which card is being edited or mutated.
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdateEvent(eventId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setUpdatingEventId(eventId);

    // Read latest form values from the event editor currently on screen.
    const form = new FormData(event.currentTarget);
    const payload = {
      type: String(form.get("type") ?? "NOTE"),
      title: String(form.get("title") ?? "").trim(),
      details: String(form.get("details") ?? "").trim() || null,
      sourceUrl: String(form.get("sourceUrl") ?? "").trim() || null,
      occurredAt: String(form.get("occurredAt") ?? "").trim() || null,
    };

    const response = await fetch(`/api/vehicles/${vehicleId}/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Failed to update event.");
      setUpdatingEventId(null);
      return;
    }

    // Re-fetch server data so timeline list stays source-of-truth from backend.
    setUpdatingEventId(null);
    setEditingEventId(null);
    router.refresh();
  }

  async function handleDeleteEvent(eventId: string) {
    // Keep an explicit browser confirm before destructive event removal.
    const confirmed = window.confirm("Delete this timeline event?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setDeletingEventId(eventId);

    const response = await fetch(`/api/vehicles/${vehicleId}/events/${eventId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Failed to delete event.");
      setDeletingEventId(null);
      return;
    }

    // Refresh to remove the deleted card from server-rendered timeline.
    setDeletingEventId(null);
    router.refresh();
  }

  if (events.length === 0) {
    return <p className="text-sm text-zinc-300">No events yet.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-red-300">{error}</p> : null}

      {events.map((event) => {
        const isEditing = editingEventId === event.id;
        const isBusy = updatingEventId === event.id || deletingEventId === event.id;

        return (
          <article key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            {isEditing ? (
              <form onSubmit={(formEvent) => handleUpdateEvent(event.id, formEvent)} className="space-y-2">
                <select
                  name="type"
                  defaultValue={event.type}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="NOTE">Note</option>
                  <option value="SERVICE">Service</option>
                  <option value="OWNERSHIP_CHANGE">Ownership Change</option>
                  <option value="ACCIDENT">Accident</option>
                  <option value="MODIFICATION">Modification</option>
                  <option value="INSPECTION">Inspection</option>
                  <option value="CREATED">Created</option>
                </select>
                <input
                  name="title"
                  required
                  defaultValue={event.title}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
                <textarea
                  name="details"
                  rows={3}
                  defaultValue={event.details ?? ""}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
                <input
                  name="sourceUrl"
                  defaultValue={event.sourceUrl ?? ""}
                  placeholder="Source URL (optional)"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
                <input
                  name="occurredAt"
                  type="datetime-local"
                  defaultValue={event.occurredAt ? new Date(event.occurredAt).toISOString().slice(0, 16) : ""}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={updatingEventId === event.id}
                    className="rounded-md border border-emerald-700 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-950 disabled:opacity-60"
                  >
                    {updatingEventId === event.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setEditingEventId(null)}
                    className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-sm font-semibold text-zinc-100">{event.title}</p>
                <p className="text-xs text-zinc-400">
                  {event.type} • {new Date(event.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-zinc-300">{event.details ?? "No details provided."}</p>

                {event.sourceUrl ? (
                  <p className="mt-2 text-xs text-zinc-400 break-all">Source: {event.sourceUrl}</p>
                ) : null}

                {canManageEvents ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setError(null);
                        setEditingEventId(event.id);
                      }}
                      className="rounded-md border border-amber-700 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-950 disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDeleteEvent(event.id)}
                      className="rounded-md border border-red-700 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-950 disabled:opacity-60"
                    >
                      {deletingEventId === event.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
