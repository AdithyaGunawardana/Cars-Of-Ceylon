import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

function req(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/vehicles", { method, headers: { host: "localhost:3000", ...headers } });
}

describe("proxy origin check", () => {
  it("passes safe methods through regardless of origin", () => {
    expect(proxy(req("GET", { origin: "https://evil.example" })).status).toBe(200);
  });

  it("passes requests without Origin (native mobile, curl)", () => {
    expect(proxy(req("POST")).status).toBe(200);
  });

  it("passes same-origin mutations", () => {
    expect(proxy(req("POST", { origin: "http://localhost:3000" })).status).toBe(200);
  });

  it("blocks cross-origin mutations with 403", async () => {
    const response = proxy(req("DELETE", { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("Cross-origin request blocked");
  });

  it("blocks malformed Origin values", () => {
    expect(proxy(req("PATCH", { origin: "null" })).status).toBe(403);
  });
});
