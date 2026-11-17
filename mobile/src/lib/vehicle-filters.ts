import type { VehicleFilters } from "./api";
import type { VehicleSort } from "./types";

export type FilterState = {
  q: string;
  manufacturer: string;
  model: string;
  yearFrom: string;
  yearTo: string;
  color: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  sort: VehicleSort | "";
};

export const emptyFilters: FilterState = {
  q: "",
  manufacturer: "",
  model: "",
  yearFrom: "",
  yearTo: "",
  color: "",
  fuelType: "",
  transmission: "",
  bodyType: "",
  sort: "",
};

export const SORT_OPTIONS: { value: VehicleSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "year_desc", label: "Year (new first)" },
  { value: "year_asc", label: "Year (old first)" },
  { value: "name", label: "Name" },
];

const YEAR = /^\d{4}$/;

// Turns the form into API query params. Values the API would reject (a 1-letter search, a half-typed year) are
// dropped instead of sent, so the list keeps working while the user types.
export function toQuery(filters: FilterState): VehicleFilters {
  const text = (value: string) => value.trim() || undefined;
  const year = (value: string) => (YEAR.test(value.trim()) ? value.trim() : undefined);
  const q = filters.q.trim();
  const yearFrom = year(filters.yearFrom);
  const yearTo = year(filters.yearTo);
  const inverted = yearFrom !== undefined && yearTo !== undefined && Number(yearFrom) > Number(yearTo);

  return {
    q: q.length >= 2 ? q : undefined,
    manufacturer: text(filters.manufacturer),
    model: text(filters.model),
    yearFrom: inverted ? undefined : yearFrom,
    yearTo: inverted ? undefined : yearTo,
    color: text(filters.color),
    fuelType: text(filters.fuelType),
    transmission: text(filters.transmission),
    bodyType: text(filters.bodyType),
    sort: filters.sort || undefined,
  };
}

export function activeFilterCount(filters: FilterState) {
  const { q, sort, ...rest } = filters;
  void q;
  void sort;
  return Object.values(rest).filter((value) => value.trim() !== "").length;
}
