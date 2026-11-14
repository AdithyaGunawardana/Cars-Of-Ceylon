"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { dangerButtonClass, inputClass, readApiError, secondaryButtonClass } from "@/lib/client-utils";

// Small moderator-only controls. Each action needs a written reason, which is stored in the audit log.

type ReasonFormProps = {
  label: string;
  submitLabel: string;
  requireReason: boolean;
  onSubmit: (reason: string) => Promise<string | null>;
};

function ReasonAction({ label, submitLabel, requireReason, onSubmit }: ReasonFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    setBusy(true);
    setError(null);
    const failure = await onSubmit(reason);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={secondaryButtonClass}>
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-2 rounded-2xl bg-[#f5f4e8] p-3 ring-1 ring-[#d3c3c0]/70">
      <input
        name="reason"
        required={requireReason}
        minLength={requireReason ? 3 : undefined}
        maxLength={1000}
        placeholder={requireReason ? "Reason (recorded in the audit log)" : "Reason (optional)"}
        className={inputClass}
      />
      {error ? <p role="alert" className="text-sm text-[#9e2a2b]">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={dangerButtonClass}>
          {busy ? "Working..." : submitLabel}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function HideContentControl({
  targetType,
  targetId,
  hidden,
}: {
  targetType: "VEHICLE" | "PHOTO" | "EVENT";
  targetId: string;
  hidden: boolean;
}) {
  return (
    <ReasonAction
      label={hidden ? "Unhide" : "Hide from public"}
      submitLabel={hidden ? "Confirm unhide" : "Confirm hide"}
      requireReason
      onSubmit={async (reason) => {
        const response = await fetch("/api/moderation/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId, hidden: !hidden, reason }),
        });
        return response.ok ? null : readApiError(response, "Action failed.");
      }}
    />
  );
}

export function BanUserControl({ userId, banned }: { userId: string; banned: boolean }) {
  return (
    <ReasonAction
      label={banned ? "Lift ban" : "Ban user"}
      submitLabel={banned ? "Confirm unban" : "Confirm ban"}
      requireReason={!banned}
      onSubmit={async (reason) => {
        const response = await fetch(`/api/moderation/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ banned: !banned, ...(reason ? { reason } : {}) }),
        });
        return response.ok ? null : readApiError(response, "Action failed.");
      }}
    />
  );
}

export function RestoreVehicleButton({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/vehicles/${vehicleId}/restore`, { method: "POST" });
    setBusy(false);
    if (!response.ok) {
      setError(await readApiError(response, "Restore failed."));
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-1">
      <button type="button" onClick={restore} disabled={busy} className={secondaryButtonClass}>
        {busy ? "Restoring..." : "Restore vehicle"}
      </button>
      {error ? <p role="alert" className="text-sm text-[#9e2a2b]">{error}</p> : null}
    </div>
  );
}
