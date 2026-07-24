import { describe, it, expect, vi } from "vitest";
import { createAuth } from "./auth.js";

const cfg = { apiUrl: "https://api.test", email: "u@test.io", password: "pw" };

function okSignIn(token = "jwt-1") {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ token }),
  });
}

describe("createAuth", () => {
  it("signs in once and caches the token", async () => {
    const fetchImpl = okSignIn("jwt-1");
    const auth = createAuth(cfg, fetchImpl);

    expect(await auth.getToken()).toBe("jwt-1");
    expect(await auth.getToken()).toBe("jwt-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.test/api/account/SignIn");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      email: "u@test.io",
      username: "u@test.io",
      password: "pw",
    });
  });

  it("re-signs-in after invalidate", async () => {
    const fetchImpl = okSignIn("jwt-1");
    const auth = createAuth(cfg, fetchImpl);
    await auth.getToken();
    auth.invalidate();
    await auth.getToken();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws on non-2xx signin", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "bad creds",
    });
    const auth = createAuth(cfg, fetchImpl);
    await expect(auth.getToken()).rejects.toThrow(/401/);
  });
});
