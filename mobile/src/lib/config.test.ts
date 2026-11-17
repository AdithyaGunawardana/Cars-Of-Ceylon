import { assertSecureBaseUrl, mediaUrl, resolveApiBaseUrl } from "./config";

describe("assertSecureBaseUrl", () => {
  it("accepts https everywhere", () => {
    expect(assertSecureBaseUrl("https://api.example.com", false, false)).toBe("https://api.example.com");
  });

  it("accepts plain http only in development or when explicitly allowed", () => {
    expect(assertSecureBaseUrl("http://192.168.1.5:3000", true, false)).toBe("http://192.168.1.5:3000");
    expect(assertSecureBaseUrl("http://192.168.1.5:3000", false, true)).toBe("http://192.168.1.5:3000");
  });

  it("refuses plain http in a release build", () => {
    expect(() => assertSecureBaseUrl("http://api.example.com", false, false)).toThrow(/insecure/);
    expect(() => assertSecureBaseUrl("http://localhost:3000", false, false)).toThrow(/https/);
  });
});

describe("resolveApiBaseUrl", () => {
  it("prefers the explicit env value and trims trailing slashes", () => {
    expect(resolveApiBaseUrl("https://api.example.com/", "192.168.1.5:8081")).toBe("https://api.example.com");
  });

  it("uses the Expo dev server's LAN host on port 3000 when nothing is configured", () => {
    expect(resolveApiBaseUrl(undefined, "192.168.1.5:8081")).toBe("http://192.168.1.5:3000");
    expect(resolveApiBaseUrl("  ", "10.0.0.7:19000")).toBe("http://10.0.0.7:3000");
  });

  it("falls back to localhost for emulators and unknown hosts", () => {
    expect(resolveApiBaseUrl(undefined, undefined)).toBe("http://localhost:3000");
    expect(resolveApiBaseUrl(undefined, "localhost:8081")).toBe("http://localhost:3000");
    expect(resolveApiBaseUrl(undefined, "127.0.0.1:8081")).toBe("http://localhost:3000");
  });
});

describe("mediaUrl", () => {
  it("rewrites localhost media to the API host so a phone can load it", () => {
    expect(mediaUrl("http://localhost:9000/bucket/a.jpg", "http://192.168.1.5:3000")).toBe("http://192.168.1.5:9000/bucket/a.jpg");
  });

  it("leaves real hosts, missing values and relative paths alone", () => {
    expect(mediaUrl("https://cdn.example.com/a.jpg", "http://192.168.1.5:3000")).toBe("https://cdn.example.com/a.jpg");
    expect(mediaUrl("http://localhost:9000/a.jpg", "http://localhost:3000")).toBe("http://localhost:9000/a.jpg");
    expect(mediaUrl(null)).toBeUndefined();
    expect(mediaUrl("/relative.jpg")).toBe("/relative.jpg");
  });
});
