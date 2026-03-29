"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Visibility = "PUBLIC" | "PRIVATE";

type Props = {
  vehicleId: string;
  initialValues: {
    uniqueIdentifier: string;
    licensePlate: string | null;
    manufacturer: string;
    model: string;
    year: number;
    description: string | null;
    visibility: Visibility;
  };
};

export function VehicleManagementForm({ vehicleId, initialValues }: Props) {
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSuccess(null);
    setSaving(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      uniqueIdentifier: String(form.get("uniqueIdentifier") ?? "").trim(),
      licensePlate: String(form.get("licensePlate") ?? "").trim() || null,
      manufacturer: String(form.get("manufacturer") ?? "").trim(),
      model: String(form.get("model") ?? "").trim(),
      year: Number(form.get("year") ?? 0),
      description: String(form.get("description") ?? "").trim() || null,
      visibility: String(form.get("visibility") ?? "PUBLIC") as Visibility,
    };

    const response = await fetch(`/api/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setSaveError(result?.error ?? "Failed to update vehicle.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSuccess("Vehicle updated successfully.");
    // Refresh detail data so UI reflects latest metadata and permissions.
    router.refresh();
  }

  async function handleDelete() {
    // If confirmation UI not shown, show it first.
    if (!showDeleteConfirm) {
      setDeleteError(null);
      setSuccess(null);
      setShowDeleteConfirm(true);
      return;
    }

    // Verify user typed "DELETE" exactly.
    if (deleteConfirmation !== "DELETE") {
      setDeleteError("Type 'DELETE' exactly to confirm removal.");
      return;
    }

    setDeleteError(null);
    setSuccess(null);
    setDeleting(true);

    const response = await fetch(`/api/vehicles/${vehicleId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setDeleteError(result?.error ?? "Failed to delete vehicle.");
      setDeleting(false);
      return;
    }

    // After deletion, return to archive listing.
    router.push("/vehicles");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
      <h2 className="text-xl font-semibold text-zinc-100">Manage Vehicle</h2>
      <p className="mt-1 text-sm text-zinc-300">Edit vehicle metadata or remove this entry.</p>

      <form onSubmit={handleSave} className="mt-4 grid gap-3">
        <input
          name="uniqueIdentifier"
          required
          defaultValue={initialValues.uniqueIdentifier}
          placeholder="Unique Identifier"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="licensePlate"
          defaultValue={initialValues.licensePlate ?? ""}
          placeholder="License Plate"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="manufacturer"
          required
          defaultValue={initialValues.manufacturer}
          placeholder="Manufacturer"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="model"
          required
          defaultValue={initialValues.model}
          placeholder="Model"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="year"
          type="number"
          required
          min={1886}
          max={2100}
          defaultValue={initialValues.year}
          placeholder="Year"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <select
          name="visibility"
          defaultValue={initialValues.visibility}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="PUBLIC">PUBLIC</option>
          <option value="PRIVATE">PRIVATE</option>
        </select>
        <textarea
          name="description"
          rows={4}
          defaultValue={initialValues.description ?? ""}
          placeholder="Vehicle description"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />

        {saveError ? <p className="text-sm text-red-300">{saveError}</p> : null}
        {deleteError ? <p className="text-sm text-red-300">{deleteError}</p> : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-950 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-950 disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete Vehicle"}
            </button>
          ) : null}
        </div>

        {/* Delete confirmation prompt */}
        {showDeleteConfirm ? (
          <div className="mt-3 rounded-lg border border-red-700 bg-red-950/30 p-4">
            <p className="text-sm text-red-200 font-semibold">
              This will permanently delete this vehicle and all related timeline events and photos.
            </p>
            <p className="mt-2 text-sm text-red-100">
              To confirm, type <code className="bg-red-900/50 px-1 rounded">DELETE</code> below:
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type DELETE"
              className="mt-2 w-full rounded-md border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-100 placeholder-red-700 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmation !== "DELETE"}
                className="rounded-md border border-red-600 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-900 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmation("");
                }}
                disabled={deleting}
                className="rounded-md border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-950 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
