"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { VehicleAttributeFields } from "@/components/vehicle-attribute-fields";
import {
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  readApiError,
  secondaryButtonClass,
  textareaClass,
} from "@/lib/client-utils";
import { attributesFromFormData, type VehicleAttributes } from "@/lib/vehicle-attributes";

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
    attributes: VehicleAttributes;
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
      // null clears all specifications.
      attributes: attributesFromFormData(form),
    };

    const response = await fetch(`/api/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setSaveError(await readApiError(response, "Failed to update vehicle."));
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
      setDeleteError(await readApiError(response, "Failed to delete vehicle."));
      setDeleting(false);
      return;
    }

    // After deletion, return to the owner's deleted list where it can be restored.
    router.push("/account/vehicles");
    router.refresh();
  }

  return (
    <section className="rounded-[1.5rem] bg-white p-6 shadow-[0_20px_50px_rgba(27,28,21,0.06)] ring-1 ring-[#d3c3c0]/70">
      <h2 className="font-serif text-xl text-[#271310]">Manage Vehicle</h2>
      <p className="mt-1 text-sm text-[#504442]">Edit vehicle metadata or remove this entry.</p>

      <form onSubmit={handleSave} className="mt-4 grid gap-3">
        <input name="uniqueIdentifier" required defaultValue={initialValues.uniqueIdentifier} placeholder="Unique Identifier" className={inputClass} />
        <input name="licensePlate" defaultValue={initialValues.licensePlate ?? ""} placeholder="License Plate" className={inputClass} />
        <input name="manufacturer" required defaultValue={initialValues.manufacturer} placeholder="Manufacturer" className={inputClass} />
        <input name="model" required defaultValue={initialValues.model} placeholder="Model" className={inputClass} />
        <input name="year" type="number" required min={1886} max={2100} defaultValue={initialValues.year} placeholder="Year" className={inputClass} />
        <select name="visibility" defaultValue={initialValues.visibility} aria-label="Visibility" className={inputClass}>
          <option value="PUBLIC">PUBLIC</option>
          <option value="PRIVATE">PRIVATE</option>
        </select>
        <textarea name="description" rows={4} defaultValue={initialValues.description ?? ""} placeholder="Vehicle description" className={textareaClass} />
        <VehicleAttributeFields values={initialValues.attributes} />

        {saveError ? <p role="alert" className="text-sm text-[#9e2a2b]">{saveError}</p> : null}
        {deleteError ? <p role="alert" className="text-sm text-[#9e2a2b]">{deleteError}</p> : null}
        {success ? <p role="status" className="text-sm text-[#2f5d2a]">{success}</p> : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {!showDeleteConfirm ? (
            <button type="button" onClick={handleDelete} disabled={deleting} className={dangerButtonClass}>
              {deleting ? "Deleting..." : "Delete Vehicle"}
            </button>
          ) : null}
        </div>

        {/* Delete confirmation prompt */}
        {showDeleteConfirm ? (
          <div className="mt-3 rounded-2xl bg-[#fff0ef] p-4 ring-1 ring-[#9e2a2b]/30">
            <p className="text-sm font-semibold text-[#9e2a2b]">
              This removes the vehicle from the archive. You can restore it from your deleted vehicles for 30 days, after
              which it and its timeline and photos are permanently erased.
            </p>
            <p className="mt-2 text-sm text-[#271310]">
              To confirm, type <code className="rounded bg-white px-1">DELETE</code> below:
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type DELETE"
              className={`${inputClass} mt-2`}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmation !== "DELETE"}
                className={dangerButtonClass}
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
                className={secondaryButtonClass}
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
