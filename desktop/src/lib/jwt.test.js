import { describe, it, expect } from "vitest";
import { decodeJwt, isTokenExpired, tokenUserName } from "./jwt.js";

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const makeToken = (payload) => `${b64url({ alg: "HS256" })}.${b64url(payload)}.sig`;
const NAME = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";

describe("jwt", () => {
  it("decodes UTF-8 claims", () => {
    const t = makeToken({ [NAME]: "Nguyễn", exp: 1 });
    expect(decodeJwt(t)[NAME]).toBe("Nguyễn");
    expect(tokenUserName(t)).toBe("Nguyễn");
  });
  it("treats missing, malformed and expiring tokens as expired", () => {
    const now = 1_000_000_000_000;
    expect(isTokenExpired(null, now)).toBe(true);
    expect(isTokenExpired("garbage", now)).toBe(true);
    expect(isTokenExpired(makeToken({ exp: now / 1000 + 30 }), now)).toBe(true); // inside 60s skew
    expect(isTokenExpired(makeToken({ exp: now / 1000 + 3600 }), now)).toBe(false);
  });
});
