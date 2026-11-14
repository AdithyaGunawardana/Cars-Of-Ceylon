import { describe, expect, it } from "vitest";
import { buildCorsRules, parseOrigins } from "./storage-cors";

describe("storage CORS rules", () => {
  it("normalizes and de-duplicates origins", () => {
    expect(parseOrigins("https://cars.example.com/, https://cars.example.com , http://localhost:3000/path")).toEqual([
      "https://cars.example.com",
      "http://localhost:3000",
    ]);
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it("rejects wildcards and malformed origins", () => {
    expect(() => parseOrigins("*")).toThrow(/wildcard/i);
    expect(() => parseOrigins("not a url")).toThrow();
  });

  it("allows PUT from exactly the listed origins with the signed headers", () => {
    const [rule] = buildCorsRules(["https://cars.example.com"]);
    expect(rule!.AllowedOrigins).toEqual(["https://cars.example.com"]);
    expect(rule!.AllowedMethods).toContain("PUT");
    expect(rule!.AllowedHeaders).toEqual(expect.arrayContaining(["Content-Type"]));
    expect(() => buildCorsRules([])).toThrow();
  });
});
