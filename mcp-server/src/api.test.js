import { describe, it, expect, vi } from "vitest";
import { createApi } from "./api.js";

function jsonRes(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (data === undefined ? "" : JSON.stringify(data)),
  };
}

function fakeAuth(tokens = ["t1", "t2"]) {
  let i = 0;
  return {
    getToken: vi.fn(async () => tokens[Math.min(i, tokens.length - 1)]),
    invalidate: vi.fn(() => { i += 1; }),
  };
}

describe("createApi", () => {
  it("attaches bearer token and returns parsed json", async () => {
    const auth = fakeAuth();
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, [{ id: "a" }]));
    const api = createApi({ apiUrl: "https://api.test", auth }, fetchImpl);

    const out = await api("GET", "/api/DailyNote/all");
    expect(out).toEqual([{ id: "a" }]);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.test/api/DailyNote/all");
    expect(opts.headers.Authorization).toBe("Bearer t1");
  });

  it("retries once on 401 with a refreshed token", async () => {
    const auth = fakeAuth(["t1", "t2"]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRes(401, "expired"))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    const api = createApi({ apiUrl: "https://api.test", auth }, fetchImpl);

    const out = await api("POST", "/api/DailyNote", { id: "x" });
    expect(out).toEqual({ ok: true });
    expect(auth.invalidate).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe("Bearer t2");
  });

  it("returns null on empty body", async () => {
    const auth = fakeAuth();
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200));
    const api = createApi({ apiUrl: "https://api.test", auth }, fetchImpl);
    expect(await api("DELETE", "/api/DailyNote/x")).toBeNull();
  });

  it("throws on non-2xx after retry", async () => {
    const auth = fakeAuth();
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(500, "boom"));
    const api = createApi({ apiUrl: "https://api.test", auth }, fetchImpl);
    await expect(api("GET", "/api/DailyNote/all")).rejects.toThrow(/HTTP 500/);
  });
});
