import { ApiError, refreshSession, request, resetApiClientState, setSignedOutHandler, signInWithPassword, signOutDevice } from "./api-client";
import type { StoredAuth } from "./token-store";

// In-memory stand-in for the keychain.
let mockStored: StoredAuth | null = null;
jest.mock("./token-store", () => ({
  loadStoredAuth: jest.fn(async () => mockStored),
  saveStoredAuth: jest.fn(async (auth: StoredAuth) => {
    mockStored = auth;
  }),
  clearStoredAuth: jest.fn(async () => {
    mockStored = null;
  }),
}));
jest.mock("expo-device", () => ({ manufacturer: "Samsung", modelName: "SM-S911B" }));

const USER = { id: "u1", name: "Nimal", email: "n@example.com", image: null, role: "USER" as const };

function pair(n: number, accessTtlMs = 15 * 60_000) {
  return {
    accessToken: `access-${n}`,
    accessTokenExpiresAt: new Date(Date.now() + accessTtlMs).toISOString(),
    refreshToken: `refresh-${n}`,
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    user: USER,
  };
}

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body ?? null } as Response;
}

const fetchMock = jest.fn();
beforeEach(() => {
  mockStored = null;
  resetApiClientState();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

function calls(pathPart: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(pathPart));
}
function authHeaderOf(call: unknown[]) {
  return ((call[1] as RequestInit).headers as Record<string, string>).Authorization;
}

describe("signing in", () => {
  it("sends credentials with the device name, stores the refresh token and then authenticates requests", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, pair(1))).mockResolvedValueOnce(reply(200, { ok: true }));

    const user = await signInWithPassword("n@example.com", "secret-pass");
    expect(user).toEqual(USER);
    expect(JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))).toEqual({ email: "n@example.com", password: "secret-pass", deviceName: "Samsung SM-S911B" });
    expect(mockStored?.refreshToken).toBe("refresh-1");

    await request("/api/account");
    expect(authHeaderOf(fetchMock.mock.calls[1]!)).toBe("Bearer access-1");
  });

  it("surfaces the server's message on bad credentials and stores nothing", async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { error: "Invalid email or password" }));
    await expect(signInWithPassword("n@example.com", "wrong")).rejects.toMatchObject({ message: "Invalid email or password", status: 401 });
    expect(mockStored).toBeNull();
  });
});

describe("token refresh", () => {
  beforeEach(() => {
    mockStored = { refreshToken: "refresh-0", refreshTokenExpiresAt: "2099-01-01T00:00:00Z", user: USER };
  });

  it("refreshes before the first request when only a mockStored refresh token exists", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, pair(1))).mockResolvedValueOnce(reply(200, { items: [] }));
    await expect(request("/api/feed")).resolves.toEqual({ items: [] });
    expect(calls("/api/mobile/auth/refresh")).toHaveLength(1);
    expect(authHeaderOf(fetchMock.mock.calls[1]!)).toBe("Bearer access-1");
    expect(mockStored?.refreshToken).toBe("refresh-1");
  });

  it("refreshes proactively when the access token is about to expire", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, pair(1, 10_000))); // expires in 10s: inside the 30s margin
    await refreshSession();
    fetchMock.mockResolvedValueOnce(reply(200, pair(2))).mockResolvedValueOnce(reply(200, {}));
    await request("/api/account");
    expect(calls("/api/mobile/auth/refresh")).toHaveLength(2);
    expect(authHeaderOf(fetchMock.mock.calls[2]!)).toBe("Bearer access-2");
  });

  it("shares one refresh between concurrent requests (refresh tokens are single-use)", async () => {
    let release!: (value: Response) => void;
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/refresh")) return new Promise<Response>((resolve) => (release = resolve));
      return Promise.resolve(reply(200, { ok: true }));
    });

    const all = Promise.all([request("/api/a"), request("/api/b"), request("/api/c")]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    release(reply(200, pair(1)));
    await all;

    expect(calls("/api/mobile/auth/refresh")).toHaveLength(1);
    expect(calls("/api/a")).toHaveLength(1);
  });

  it("on a 401 refreshes once and retries the request once", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(200, pair(1))) // initial refresh
      .mockResolvedValueOnce(reply(401, { error: "Unauthorized" })) // request rejected
      .mockResolvedValueOnce(reply(200, pair(2))) // second refresh
      .mockResolvedValueOnce(reply(200, { ok: true })); // retry succeeds
    await expect(request("/api/account")).resolves.toEqual({ ok: true });
    expect(authHeaderOf(fetchMock.mock.calls[3]!)).toBe("Bearer access-2");
  });

  it("does not loop when the retry is also rejected", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(200, pair(1)))
      .mockResolvedValueOnce(reply(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(reply(200, pair(2)))
      .mockResolvedValueOnce(reply(401, { error: "Unauthorized" }));
    await expect(request("/api/account")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("clears credentials and notifies the app when the server rejects the refresh token", async () => {
    const onSignedOut = jest.fn();
    setSignedOutHandler(onSignedOut);
    fetchMock.mockResolvedValueOnce(reply(401, { error: "Session expired. Please sign in again." }));

    await expect(request("/api/account")).rejects.toMatchObject({ status: 401 });
    expect(mockStored).toBeNull();
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the network is down", async () => {
    const onSignedOut = jest.fn();
    setSignedOutHandler(onSignedOut);
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));

    await expect(request("/api/account")).rejects.toMatchObject({ status: 0 });
    expect(mockStored?.refreshToken).toBe("refresh-0");
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it("keeps the session on a server error during refresh", async () => {
    fetchMock.mockResolvedValueOnce(reply(500, { error: "boom" }));
    await expect(refreshSession()).rejects.toMatchObject({ status: 500 });
    expect(mockStored?.refreshToken).toBe("refresh-0");
  });

  it("fails fast when nobody is signed in", async () => {
    mockStored = null;
    await expect(request("/api/account")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("request", () => {
  it("skips auth entirely for public calls", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true }));
    await request("/api/auth/password/forgot", { json: { email: "a@b.co" } }, { auth: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authHeaderOf(fetchMock.mock.calls[0]!)).toBeUndefined();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe("POST");
  });

  it("builds a query string without blank values and returns undefined for 204", async () => {
    mockStored = { refreshToken: "r", refreshTokenExpiresAt: "2099-01-01T00:00:00Z", user: USER };
    fetchMock.mockResolvedValueOnce(reply(200, pair(1))).mockResolvedValueOnce(reply(204));
    const result = await request("/api/vehicles", { method: "DELETE" }, { query: { q: "mini", page: 2, color: "", year: undefined } });
    expect(result).toBeUndefined();
    const url = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(url.searchParams.get("q")).toBe("mini");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.has("color")).toBe(false);
    expect(url.searchParams.has("year")).toBe(false);
  });

  it("raises ApiError with the server message and details", async () => {
    mockStored = { refreshToken: "r", refreshTokenExpiresAt: "2099-01-01T00:00:00Z", user: USER };
    fetchMock.mockResolvedValueOnce(reply(200, pair(1))).mockResolvedValueOnce(reply(400, { error: "Invalid vehicle data", details: { fieldErrors: { year: ["bad"] } } }));
    await expect(request("/api/vehicles", { json: {} })).rejects.toMatchObject({ message: "Invalid vehicle data", status: 400, details: { fieldErrors: { year: ["bad"] } } });
  });

  it("explains a network failure in plain words", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    await expect(request("/api/vehicles", {}, { auth: false })).rejects.toMatchObject({ message: expect.stringMatching(/Could not reach the server/), status: 0 });
  });
});

describe("signing out", () => {
  it("forgets the credentials locally and revokes the refresh token on the server", async () => {
    mockStored = { refreshToken: "refresh-9", refreshTokenExpiresAt: "2099-01-01T00:00:00Z", user: USER };
    fetchMock.mockResolvedValueOnce(reply(204));
    await signOutDevice();
    expect(mockStored).toBeNull();
    expect(JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))).toEqual({ refreshToken: "refresh-9" });
  });

  it("still signs out locally if the server cannot be reached", async () => {
    mockStored = { refreshToken: "refresh-9", refreshTokenExpiresAt: "2099-01-01T00:00:00Z", user: USER };
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(signOutDevice()).resolves.toBeUndefined();
    expect(mockStored).toBeNull();
  });
});
