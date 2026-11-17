import type { VehicleInput } from "./api";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, type VehicleAttributes, type VehicleDetail } from "./types";

// Form state is all strings (text inputs); buildVehicleInput turns it into the validated API payload.
// Limits mirror web/src/lib/contracts/vehicle-contracts.ts so mistakes are caught before a round trip.

export type VehicleFormFields = {
  uniqueIdentifier: string;
  licensePlate: string;
  manufacturer: string;
  model: string;
  year: string;
  description: string;
  color: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  engineCc: string;
  odometerKm: string;
};

export const emptyVehicleFields: VehicleFormFields = {
  uniqueIdentifier: "",
  licensePlate: "",
  manufacturer: "",
  model: "",
  year: "",
  description: "",
  color: "",
  fuelType: "",
  transmission: "",
  bodyType: "",
  engineCc: "",
  odometerKm: "",
};

export function fieldsFromVehicle(vehicle: VehicleDetail): VehicleFormFields {
  const attributes = vehicle.attributes ?? {};
  return {
    uniqueIdentifier: vehicle.uniqueIdentifier,
    licensePlate: vehicle.licensePlate ?? "",
    manufacturer: vehicle.manufacturer,
    model: vehicle.model,
    year: String(vehicle.year),
    description: vehicle.description ?? "",
    color: attributes.color ?? "",
    fuelType: attributes.fuelType ?? "",
    transmission: attributes.transmission ?? "",
    bodyType: attributes.bodyType ?? "",
    engineCc: attributes.engineCc === undefined ? "" : String(attributes.engineCc),
    odometerKm: attributes.odometerKm === undefined ? "" : String(attributes.odometerKm),
  };
}

export type BuildResult<T> = { ok: true; value: T } | { ok: false; error: string };

function lengthError(label: string, value: string, min: number, max: number) {
  if (value.length < min) return `${label} must be at least ${min} character${min === 1 ? "" : "s"}.`;
  if (value.length > max) return `${label} must be at most ${max} characters.`;
  return null;
}

function wholeNumber(label: string, raw: string, min: number, max: number): BuildResult<number> {
  if (!/^\d+$/.test(raw)) return { ok: false, error: `${label} must be a whole number.` };
  const value = Number(raw);
  if (value < min || value > max) return { ok: false, error: `${label} must be between ${min} and ${max}.` };
  return { ok: true, value };
}

export function buildVehicleInput(fields: VehicleFormFields): BuildResult<VehicleInput> {
  const uniqueIdentifier = fields.uniqueIdentifier.trim();
  const licensePlate = fields.licensePlate.trim();
  const manufacturer = fields.manufacturer.trim();
  const model = fields.model.trim();
  const description = fields.description.trim();
  const color = fields.color.trim();

  const problem =
    lengthError("Unique ID", uniqueIdentifier, 2, 40) ??
    (licensePlate ? lengthError("License plate", licensePlate, 2, 20) : null) ??
    lengthError("Manufacturer", manufacturer, 2, 80) ??
    lengthError("Model", model, 1, 80) ??
    lengthError("Description", description, 0, 5000) ??
    (color ? lengthError("Colour", color, 1, 40) : null);
  if (problem) return { ok: false, error: problem };

  const year = wholeNumber("Year", fields.year.trim(), 1886, 2100);
  if (!year.ok) return year;

  const attributes: VehicleAttributes = {};
  if (color) attributes.color = color;
  if (fields.fuelType) {
    if (!(FUEL_TYPES as readonly string[]).includes(fields.fuelType)) return { ok: false, error: "Choose a valid fuel type." };
    attributes.fuelType = fields.fuelType as VehicleAttributes["fuelType"];
  }
  if (fields.transmission) {
    if (!(TRANSMISSIONS as readonly string[]).includes(fields.transmission)) return { ok: false, error: "Choose a valid transmission." };
    attributes.transmission = fields.transmission as VehicleAttributes["transmission"];
  }
  if (fields.bodyType) {
    if (!(BODY_TYPES as readonly string[]).includes(fields.bodyType)) return { ok: false, error: "Choose a valid body type." };
    attributes.bodyType = fields.bodyType as VehicleAttributes["bodyType"];
  }
  if (fields.engineCc.trim()) {
    const engineCc = wholeNumber("Engine size", fields.engineCc.trim(), 1, 20000);
    if (!engineCc.ok) return engineCc;
    attributes.engineCc = engineCc.value;
  }
  if (fields.odometerKm.trim()) {
    const odometerKm = wholeNumber("Odometer", fields.odometerKm.trim(), 0, 5_000_000);
    if (!odometerKm.ok) return odometerKm;
    attributes.odometerKm = odometerKm.value;
  }

  return {
    ok: true,
    value: {
      uniqueIdentifier,
      licensePlate: licensePlate || null,
      manufacturer,
      model,
      year: year.value,
      description: description || null,
      attributes: Object.keys(attributes).length > 0 ? attributes : null,
    },
  };
}
