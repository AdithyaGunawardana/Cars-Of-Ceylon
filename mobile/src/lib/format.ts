import type { VehicleAttributes } from "./types";

export function labelForOption(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

export const ATTRIBUTE_LABELS: Record<keyof VehicleAttributes, string> = {
  color: "Colour",
  fuelType: "Fuel",
  transmission: "Transmission",
  bodyType: "Body type",
  engineCc: "Engine (cc)",
  odometerKm: "Odometer (km)",
};

const ENUM_ATTRIBUTES = new Set(["fuelType", "transmission", "bodyType"]);

// Label/value pairs for the attributes that are set, in a stable order.
export function attributeRows(attributes: VehicleAttributes | null | undefined): { label: string; value: string }[] {
  if (!attributes) return [];
  const order = Object.keys(ATTRIBUTE_LABELS) as (keyof VehicleAttributes)[];
  return order.flatMap((key) => {
    const raw = attributes[key];
    if (raw === undefined || raw === null || raw === "") return [];
    const value = ENUM_ATTRIBUTES.has(key) ? labelForOption(String(raw)) : typeof raw === "number" ? raw.toLocaleString("en-US") : String(raw);
    return [{ label: ATTRIBUTE_LABELS[key], value }];
  });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Matches the web contract: only http(s) links are accepted as event sources.
export function isHttpUrl(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}
