import { attributeRows, formatDate, isHttpUrl, labelForOption } from "./format";

describe("format helpers", () => {
  it("humanises enum values", () => {
    expect(labelForOption("OWNERSHIP_CHANGE")).toBe("Ownership change");
    expect(labelForOption("PETROL")).toBe("Petrol");
  });

  it("lists only the attributes that are set, in a stable order", () => {
    expect(attributeRows({ odometerKm: 54000, color: "Red", fuelType: "HYBRID" })).toEqual([
      { label: "Colour", value: "Red" },
      { label: "Fuel", value: "Hybrid" },
      { label: "Odometer (km)", value: "54,000" },
    ]);
    expect(attributeRows(null)).toEqual([]);
    expect(attributeRows({})).toEqual([]);
  });

  it("shows zero values (a brand-new car has 0 km)", () => {
    expect(attributeRows({ odometerKm: 0 })).toEqual([{ label: "Odometer (km)", value: "0" }]);
  });

  it("formats dates and tolerates bad input", () => {
    expect(formatDate("2024-03-05T10:00:00.000Z")).toMatch(/2024/);
    expect(formatDate(null)).toBe("");
    expect(formatDate("not a date")).toBe("");
  });

  it("only treats http(s) links as safe sources", () => {
    expect(isHttpUrl("https://example.com/a")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("example.com")).toBe(false);
  });
});
