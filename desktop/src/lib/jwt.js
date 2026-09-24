// Minimal JWT payload reader — no signature check, we only need `exp` and
// display claims. The API does not reject expired tokens on DailyNote routes
// (no [Authorize]; it silently falls back to the "anonymous" user), so the
// client must refuse to use a token past its expiry.

const NAME_CLAIM = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";

export const decodeJwt = (token) => {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/** True when the token is missing, malformed, or expires within `skewSec`. */
export const isTokenExpired = (token, now = Date.now(), skewSec = 60) => {
  const payload = token && decodeJwt(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= now + skewSec * 1000;
};

export const tokenUserName = (token) => {
  const p = token && decodeJwt(token);
  return p?.[NAME_CLAIM] || p?.unique_name || p?.name || "";
};
