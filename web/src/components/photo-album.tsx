"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  readApiError,
  secondaryButtonClass,
} from "@/lib/client-utils";

export type AlbumPhoto = {
  id: string;
  url: string;
  caption: string | null;
};

type Props = {
  vehicleId: string;
  vehicleName: string;
  photos: AlbumPhoto[];
  canManage: boolean;
};

// Thumbnail grid with a keyboard-accessible lightbox plus caption edit/delete for managers.
export function PhotoAlbum({ vehicleId, vehicleName, photos, canManage }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = openIndex !== null && openIndex < photos.length;

  // Keep the native <dialog> in sync with React state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const step = useCallback(
    (delta: number) => setOpenIndex((index) => (index === null ? null : (index + delta + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  async function handleCaptionSave(e: FormEvent<HTMLFormElement>, photoId: string) {
    e.preventDefault();
    setError(null);
    setBusyId(photoId);
    const caption = String(new FormData(e.currentTarget).get("caption") ?? "").trim() || null;

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      if (!response.ok) {
        setError(await readApiError(response, "Failed to update caption."));
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(photoId: string) {
    if (!window.confirm("Delete this photo? This cannot be undone.")) return;
    setError(null);
    setBusyId(photoId);

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/photos/${photoId}`, { method: "DELETE" });
      if (!response.ok) {
        setError(await readApiError(response, "Failed to delete photo."));
        return;
      }
      setOpenIndex(null);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (photos.length === 0) {
    return <p className="mt-3 text-sm text-[#504442]">No photos uploaded yet.</p>;
  }

  const current = open ? photos[openIndex] : null;

  return (
    <div className="mt-4">
      {error ? (
        <p role="alert" className="mb-3 rounded-full bg-[#fff0ef] px-3 py-2 text-sm text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">
          {error}
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {photos.map((photo, index) => {
          const isEditing = editingId === photo.id;
          const busy = busyId === photo.id;
          return (
            <li key={photo.id} className="overflow-hidden rounded-2xl bg-[#f5f4e8] ring-1 ring-[#d3c3c0]/70">
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                className="block aspect-[4/3] w-full overflow-hidden bg-[#d3c3c0]/40"
                aria-label={`Open photo: ${photo.caption ?? `${vehicleName} photo ${index + 1}`}`}
              >
                {/* Plain <img>: photos are served from the storage host, not optimized by next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? `${vehicleName} photo ${index + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>

              <div className="p-3">
                {isEditing ? (
                  <form onSubmit={(e) => handleCaptionSave(e, photo.id)} className="grid gap-2">
                    <input
                      name="caption"
                      defaultValue={photo.caption ?? ""}
                      maxLength={500}
                      aria-label="Caption"
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={busy} className={primaryButtonClass}>
                        {busy ? "Saving..." : "Save"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className={secondaryButtonClass}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="text-sm text-[#271310]">{photo.caption ?? "Untitled photo"}</p>
                    {canManage ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(photo.id);
                            setError(null);
                          }}
                          className={secondaryButtonClass}
                        >
                          Caption
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDelete(photo.id)}
                          className={dangerButtonClass}
                        >
                          {busy ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpenIndex(null)}
        onClick={(event) => {
          // Clicking the backdrop (the dialog element itself) closes the lightbox.
          if (event.target === dialogRef.current) setOpenIndex(null);
        }}
        aria-label="Photo viewer"
        className="m-auto max-h-[92vh] max-w-[92vw] rounded-2xl bg-[#fbfaee] p-3 backdrop:bg-black/70"
      >
        {current ? (
          <div className="grid gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.caption ?? `${vehicleName} photo ${openIndex! + 1}`}
              className="max-h-[75vh] max-w-full rounded-xl object-contain"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[#271310]">{current.caption ?? "Untitled photo"}</p>
              <div className="flex gap-2">
                {photos.length > 1 ? (
                  <>
                    <button type="button" onClick={() => step(-1)} className={secondaryButtonClass}>
                      Previous
                    </button>
                    <button type="button" onClick={() => step(1)} className={secondaryButtonClass}>
                      Next
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => setOpenIndex(null)} className={primaryButtonClass}>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
