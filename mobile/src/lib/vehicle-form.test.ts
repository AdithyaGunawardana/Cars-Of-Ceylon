import { buildVehicleInput, emptyVehicleFields, fieldsFromVehicle, type VehicleFormFields } from "./vehicle-form";
import type { VehicleDetail } from "./types";

const valid: VehicleFormFields = {
  ...emptyVehicleFields,
  uniqueIdentifier: "CHS-1001",
  manufacturer: "Austin",
  model: "A40",
  year: "1960",
};

describe("buildVehicleInput", () => {
  it("builds a minimal payload and sends null for blank optional fields", () => {
    expect(buildVehicleInput(valid)).toEqual({
      ok: true,
      value: { uniqueIdentifier: "CHS-1001", licensePlate: null, manufacturer: "Austin", model: "A40", year: 1960, description: null, attributes: null },
    });
  });

  it("trims text and converts attribute strings to the right types", () => {
    const result = buildVehicleInput({
      ...valid,
      uniqueIdentifier: "  CHS-1001 ",
      licensePlate: " CAB-1234 ",
      description: "  Original paint ",
      color: " Red ",
      fuelType: "PETROL",
      transmission: "MANUAL",
      bodyType: "SEDAN",
      engineCc: "1200",
      odometerKm: "54000",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        uniqueIdentifier: "CHS-1001",
        licensePlate: "CAB-1234",
        manufacturer: "Austin",
        model: "A40",
        year: 1960,
        description: "Original paint",
        attributes: { color: "Red", fuelType: "PETROL", transmission: "MANUAL", bodyType: "SEDAN", engineCc: 1200, odometerKm: 54000 },
      },
    });
  });

  it.each([
    [{ uniqueIdentifier: "x" }, /Unique ID/],
    [{ manufacturer: "A" }, /Manufacturer/],
    [{ model: "" }, /Model/],
    [{ licensePlate: "x" }, /License plate/],
    [{ year: "abcd" }, /Year must be a whole number/],
    [{ year: "1800" }, /Year must be between/],
    [{ year: "2101" }, /Year must be between/],
    [{ engineCc: "0" }, /Engine size/],
    [{ engineCc: "12.5" }, /Engine size must be a whole number/],
    [{ odometerKm: "-5" }, /Odometer/],
    [{ fuelType: "STEAM" }, /fuel type/],
    [{ bodyType: "BOAT" }, /body type/],
    [{ description: "x".repeat(5001) }, /Description/],
  ])("rejects invalid input %j", (override, message) => {
    const result = buildVehicleInput({ ...valid, ...override });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it("accepts the boundary values the API accepts", () => {
    expect(buildVehicleInput({ ...valid, year: "1886", engineCc: "20000", odometerKm: "0" }).ok).toBe(true);
    expect(buildVehicleInput({ ...valid, year: "2100", odometerKm: "5000000" }).ok).toBe(true);
  });
});

describe("fieldsFromVehicle", () => {
  it("round-trips a vehicle through the form", () => {
    const vehicle = {
      id: "v1",
      uniqueIdentifier: "CHS-1001",
      licensePlate: null,
      manufacturer: "Austin",
      model: "A40",
      year: 1960,
      description: "Nice",
      attributes: { color: "Red", engineCc: 1200, odometerKm: 0 },
      createdBy: { id: "u1" },
      events: [],
      photos: [],
    } as VehicleDetail;
    const fields = fieldsFromVehicle(vehicle);
    expect(fields).toMatchObject({ licensePlate: "", year: "1960", color: "Red", engineCc: "1200", odometerKm: "0", fuelType: "" });

    const rebuilt = buildVehicleInput(fields);
    expect(rebuilt.ok && rebuilt.value.attributes).toEqual({ color: "Red", engineCc: 1200, odometerKm: 0 });
  });
});
