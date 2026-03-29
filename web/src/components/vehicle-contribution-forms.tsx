"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = {
  vehicleId: string;
  canContribute: boolean;
  isSignedIn: boolean;
};

export function VehicleContributionForms({ vehicleId, canContribute, isSignedIn }: Props) {
  const router = useRouter();
  // Keep event/photo form states isolated so each form can fail independently.
  const [eventError, setEventError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  async function handleCreateEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEventError(null);
    setEventLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      type: String(form.get("type") ?? "NOTE"),
      title: String(form.get("title") ?? ""),
      details: String(form.get("details") ?? "") || null,
      sourceUrl: String(form.get("sourceUrl") ?? "") || null,
      occurredAt: String(form.get("occurredAt") ?? "") || null,
    };

    const response = await fetch(`/api/vehicles/${vehicleId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setEventError(result?.error ?? "Failed to add event.");
      setEventLoading(false);
      return;
    }

    e.currentTarget.reset();
    setEventLoading(false);
    // Refresh server-rendered vehicle detail data after successful mutation.
    router.refresh();
  }

  async function handleCreatePhoto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhotoError(null);
    setPhotoLoading(true);

    const form = new FormData(e.currentTarget);
    const caption = String(form.get("caption") ?? "") || null;
    const file = form.get("file");

    if (!(file instanceof File)) {
      setPhotoError("Select an image file first.");
      setPhotoLoading(false);
      return;
    }

    if (!file.type) {
      setPhotoError("Unable to detect file type.");
      setPhotoLoading(false);
      return;
    }

    // Upload flow: request signed URL -> upload file directly -> finalize metadata in app DB.
    const uploadSessionResponse = await fetch(`/api/vehicles/${vehicleId}/photos/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    });

    if (!uploadSessionResponse.ok) {
      const result = await uploadSessionResponse.json().catch(() => null);
      setPhotoError(result?.error ?? "Failed to initialize upload.");
      setPhotoLoading(false);
      return;
    }

    const uploadSession = (await uploadSessionResponse.json()) as {
      uploadUrl: string;
      storageKey: string;
    };

    const objectUploadResponse = await fetch(uploadSession.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!objectUploadResponse.ok) {
      setPhotoError("File upload failed.");
      setPhotoLoading(false);
      return;
    }

    const payload = {
      storageKey: uploadSession.storageKey,
      caption,
    };

    const response = await fetch(`/api/vehicles/${vehicleId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setPhotoError(result?.error ?? "Failed to add photo.");
      setPhotoLoading(false);
      return;
    }

    e.currentTarget.reset();
    setPhotoLoading(false);
    router.refresh();
  }

  if (!isSignedIn) {
    return <p className="text-sm text-zinc-300">Sign in to contribute events and photos.</p>;
  }

  if (!canContribute) {
    return <p className="text-sm text-zinc-300">Only the owner or moderators can add events and photos.</p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={handleCreateEvent} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Add Timeline Event</h3>
        <select name="type" defaultValue="NOTE" className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
          <option value="NOTE">Note</option>
          <option value="SERVICE">Service</option>
          <option value="OWNERSHIP_CHANGE">Ownership Change</option>
          <option value="ACCIDENT">Accident</option>
          <option value="MODIFICATION">Modification</option>
          <option value="INSPECTION">Inspection</option>
        </select>
        <input name="title" required placeholder="Event title" className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
        <textarea name="details" rows={3} placeholder="Event details" className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
        <input name="sourceUrl" placeholder="Source URL (optional)" className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
        <input name="occurredAt" type="datetime-local" className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
        {eventError ? <p className="mt-2 text-xs text-red-300">{eventError}</p> : null}
        <button type="submit" disabled={eventLoading} className="mt-3 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300 disabled:opacity-60">
          {eventLoading ? "Saving..." : "Save Event"}
        </button>
      </form>

      <form onSubmit={handleCreatePhoto} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Upload Photo</h3>
        <input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp"
          className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        />
        <input name="caption" placeholder="Caption (optional)" className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
        {photoError ? <p className="mt-2 text-xs text-red-300">{photoError}</p> : null}
        <button type="submit" disabled={photoLoading} className="mt-3 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-300 disabled:opacity-60">
          {photoLoading ? "Saving..." : "Save Photo"}
        </button>
      </form>
    </div>
  );
}
