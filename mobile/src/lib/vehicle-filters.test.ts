import { activeFilterCount, emptyFilters, toQuery } from "./vehicle-filters";

describe("toQuery", () => {
  it("drops everything blank", () => {
    expect(toQuery(emptyFilters)).toEqual({
      q: undefined,
      manufacturer: undefined,
      model: undefined,
      yearFrom: undefined,
      yearTo: undefined,
      color: undefined,
      fuelType: undefined,
      transmission: undefined,
      bodyType: undefined,
      sort: undefined,
    });
  });

  it("does not send a one-letter search (the API requires 2+)", () => {
    expect(toQuery({ ...emptyFilters, q: "a" }).q).toBeUndefined();
    expect(toQuery({ ...emptyFilters, q: " ab " }).q).toBe("ab");
  });

  it("only sends complete four-digit years", () => {
    expect(toQuery({ ...emptyFilters, yearFrom: "19", yearTo: "1975" })).toMatchObject({ yearFrom: undefined, yearTo: "1975" });
  });

  it("drops an inverted year range instead of triggering a 400", () => {
    expect(toQuery({ ...emptyFilters, yearFrom: "1990", yearTo: "1960" })).toMatchObject({ yearFrom: undefined, yearTo: undefined });
  });

  it("passes enum filters and sort through", () => {
    expect(toQuery({ ...emptyFilters, fuelType: "DIESEL", transmission: "MANUAL", bodyType: "VAN", sort: "year_desc", color: " Blue " })).toMatchObject({
      fuelType: "DIESEL",
      transmission: "MANUAL",
      bodyType: "VAN",
      sort: "year_desc",
      color: "Blue",
    });
  });
});

describe("activeFilterCount", () => {
  it("counts filters but not the search box or sort", () => {
    expect(activeFilterCount({ ...emptyFilters, q: "austin", sort: "name" })).toBe(0);
    expect(activeFilterCount({ ...emptyFilters, manufacturer: "Austin", fuelType: "PETROL" })).toBe(2);
  });
});
