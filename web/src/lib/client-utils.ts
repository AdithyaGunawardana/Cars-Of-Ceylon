// Small browser-side helpers shared by interactive components.

export const inputClass =
  "w-full rounded-full border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]";
export const textareaClass =
  "w-full rounded-2xl border border-[#d3c3c0] bg-[#fbfaee] px-3 py-2 text-sm text-[#271310] placeholder:text-[#765f5c]";
export const primaryButtonClass =
  "rounded-full bg-[#271310] px-4 py-2 text-sm font-semibold text-[#fbfaee] hover:bg-[#3e2723] disabled:opacity-60";
export const secondaryButtonClass =
  "rounded-full border border-[#d3c3c0] px-4 py-2 text-sm font-semibold text-[#271310] hover:bg-[#f5f4e8] disabled:opacity-60";
export const dangerButtonClass =
  "rounded-full border border-[#9e2a2b]/40 px-4 py-2 text-sm font-semibold text-[#9e2a2b] hover:bg-[#fff0ef] disabled:opacity-60";

export const EVENT_TYPE_OPTIONS = [
  { value: "NOTE", label: "Note" },
  { value: "SERVICE", label: "Service" },
  { value: "OWNERSHIP_CHANGE", label: "Ownership change" },
  { value: "ACCIDENT", label: "Accident" },
  { value: "MODIFICATION", label: "Modification" },
  { value: "INSPECTION", label: "Inspection" },
] as const;

// Pull the API error message out of a failed response, falling back to a friendly default.
export async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string; details?: unknown } | null;
  return payload?.error ?? fallback;
}

// <input type="datetime-local"> yields "YYYY-MM-DDTHH:mm" (no zone); the API requires a full ISO datetime.
export function localInputToIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Convert an ISO datetime back into the local "YYYY-MM-DDTHH:mm" form datetime-local inputs expect.
export function isoToLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

// Only render links that are plain web URLs.
export function isHttpUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}
