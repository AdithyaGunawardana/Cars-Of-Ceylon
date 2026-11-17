"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import {
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  readApiError,
  secondaryButtonClass,
} from "@/lib/client-utils";

// Client-side pre-checks for fast feedback; the server enforces the real limits.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

type Stage = "idle" | "preparing" | "uploading" | "finalizing" | "done" | "error";

type UploadSession = { uploadUrl: string; storageKey: string };

// Tracks how far the last attempt got so Retry resumes at the failed step instead of starting over.
type PendingUpload = {
  file: File;
  caption: string | null;
  session: UploadSession | null;
  uploaded: boolean;
};

class CancelledError extends Error {}

const stageLabels: Record<Stage, string> = {
  idle: "",
  preparing: "Preparing upload...",
  uploading: "Uploading...",
  finalizing: "Saving photo...",
  done: "Photo added.",
  error: "",
};

function putWithProgress(
  session: UploadSession,
  file: File,
  onProgress: (percent: number) => void,
  xhrRef: { current: XMLHttpRequest | null },
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", session.uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("File upload failed.")));
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.onabort = () => reject(new CancelledError("Upload cancelled."));
    xhr.send(file);
  });
}

type Props = {
  vehicleId: string;
  canContribute: boolean;
  isSignedIn: boolean;
};

export function PhotoUploadForm({ vehicleId, canContribute, isSignedIn }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef<PendingUpload | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Retry is only offered when a real upload attempt failed (not for validation errors).
  const [canRetry, setCanRetry] = useState(false);

  const active = stage === "preparing" || stage === "uploading" || stage === "finalizing";

  async function run() {
    const pending = pendingRef.current;
    if (!pending) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setCanRetry(false);

    try {
      if (!pending.session) {
        setStage("preparing");
        const response = await fetch(`/api/vehicles/${vehicleId}/photos/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: pending.file.name, fileType: pending.file.type, fileSize: pending.file.size }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await readApiError(response, "Failed to initialize upload."));
        pending.session = (await response.json()) as UploadSession;
      }

      if (!pending.uploaded) {
        setStage("uploading");
        setProgress(0);
        try {
          await putWithProgress(pending.session, pending.file, setProgress, xhrRef);
        } catch (uploadError) {
          // Signed URLs expire after minutes, so a retry should ask for a fresh one.
          pending.session = null;
          throw uploadError;
        }
        pending.uploaded = true;
        setProgress(100);
      }

      setStage("finalizing");
      const finalize = await fetch(`/api/vehicles/${vehicleId}/photos/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey: pending.session.storageKey, caption: pending.caption }),
        signal: controller.signal,
      });
      if (!finalize.ok) throw new Error(await readApiError(finalize, "Failed to save photo."));
      // Consume the body so the request completes cleanly (an unread body is reported as aborted if the page navigates).
      await finalize.json().catch(() => null);

      pendingRef.current = null;
      formRef.current?.reset();
      setStage("done");
      router.refresh();
    } catch (caught) {
      const cancelled = caught instanceof CancelledError || (caught instanceof DOMException && caught.name === "AbortError");
      setError(cancelled ? "Upload cancelled." : caught instanceof Error ? caught.message : "Upload failed.");
      setStage("error");
      setCanRetry(true);
    } finally {
      controllerRef.current = null;
      xhrRef.current = null;
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    const caption = String(form.get("caption") ?? "").trim() || null;

    if (!(file instanceof File) || file.size === 0) {
      setError("Select an image file first.");
      setStage("error");
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG or WebP images are allowed.");
      setStage("error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large. Maximum size is 10 MB.");
      setStage("error");
      return;
    }

    pendingRef.current = { file, caption, session: null, uploaded: false };
    void run();
  }

  function handleCancel() {
    controllerRef.current?.abort();
    xhrRef.current?.abort();
  }

  function handleDiscard() {
    pendingRef.current = null;
    formRef.current?.reset();
    setError(null);
    setCanRetry(false);
    setStage("idle");
    setProgress(0);
  }

  if (!isSignedIn) {
    return <p className="text-sm text-[#504442]">Sign in to upload photos.</p>;
  }

  if (!canContribute) {
    return <p className="text-sm text-[#504442]">Only the owner or moderators can upload photos.</p>;
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-2xl bg-[#f5f4e8] p-4 ring-1 ring-[#d3c3c0]/70"
    >
      <h3 className="font-serif text-lg text-[#271310]">Upload photo</h3>
      <label className="grid gap-1 text-xs text-[#504442]">
        Image (JPEG, PNG or WebP, up to 10 MB)
        <input
          name="file"
          type="file"
          required
          disabled={active}
          accept="image/jpeg,image/png,image/webp"
          className={inputClass}
        />
      </label>
      <label className="grid gap-1 text-xs text-[#504442]">
        Caption (optional)
        <input name="caption" disabled={active} maxLength={500} placeholder="Caption" className={inputClass} />
      </label>

      <div aria-live="polite" className="grid gap-2">
        {stageLabels[stage] ? <p className="text-xs text-[#504442]">{stageLabels[stage]}</p> : null}
        {stage === "uploading" ? (
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 w-full overflow-hidden rounded-full bg-[#d3c3c0]/60"
          >
            <div className="h-full bg-[#725a39] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-full bg-[#fff0ef] px-3 py-2 text-xs text-[#9e2a2b] ring-1 ring-[#d3c3c0]/70">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {active ? (
          <button type="button" onClick={handleCancel} className={dangerButtonClass}>
            Cancel upload
          </button>
        ) : stage === "error" && canRetry ? (
          <>
            <button type="button" onClick={() => void run()} className={primaryButtonClass}>
              Retry
            </button>
            <button type="button" onClick={handleDiscard} className={secondaryButtonClass}>
              Discard
            </button>
          </>
        ) : (
          <button type="submit" className={primaryButtonClass}>
            Upload photo
          </button>
        )}
      </div>
    </form>
  );
}
