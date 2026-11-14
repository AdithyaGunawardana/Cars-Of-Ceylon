import { z } from "zod";

// Structured vehicle attributes stored in Vehicle.attributes (JSON). One definition drives the create/edit
// forms, API validation, detail page display and list filters.

export const FUEL_TYPES = ["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "LPG", "OTHER"] as const;
export const TRANSMISSIONS = ["MANUAL", "AUTOMATIC", "OTHER"] as const;
export const BODY_TYPES = [
  "SEDAN",
  "HATCHBACK",
  "SUV",
  "WAGON",
  "COUPE",
  "CONVERTIBLE",
  "VAN",
  "PICKUP",
  "TRUCK",
  "MOTORCYCLE",
  "OTHER",
] as const;

export const vehicleAttributesSchema = z
  .object({
    color: z.string().trim().min(1).max(40).optional(),
    fuelType: z.enum(FUEL_TYPES).optional(),
    transmission: z.enum(TRANSMISSIONS).optional(),
    bodyType: z.enum(BODY_TYPES).optional(),
    engineCc: z.number().int().min(1).max(20000).optional(),
    odometerKm: z.number().int().min(0).max(5_000_000).optional(),
  })
  .strict();

export type VehicleAttributes = z.infer<typeof vehicleAttributesSchema>;

export const ATTRIBUTE_LABELS: Record<keyof VehicleAttributes, string> = {
  color: "Colour",
  fuelType: "Fuel",
  transmission: "Transmission",
  bodyType: "Body type",
  engineCc: "Engine (cc)",
  odometerKm: "Odometer (km)",
};

export function labelForOption(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

// Form fields arrive as strings; blank inputs mean "not set". Returns null when nothing was provided.
export function attributesFromFormData(form: { get(name: string): FormDataEntryValue | null }) {
  const read = (name: string) => {
    const value = form.get(`attr_${name}`);
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
  };
  const number = (name: string) => {
    const value = read(name);
    return value === undefined ? undefined : Number(value);
  };

  const raw = {
    color: read("color"),
    fuelType: read("fuelType"),
    transmission: read("transmission"),
    bodyType: read("bodyType"),
    engineCc: number("engineCc"),
    odometerKm: number("odometerKm"),
  };
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined));
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

// Safe read of the stored JSON for display: drops anything that no longer matches the schema.
export function readAttributes(value: unknown): VehicleAttributes {
  const parsed = vehicleAttributesSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}
