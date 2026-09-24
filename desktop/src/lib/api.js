import { API_URL, IS_TAURI } from "./config.js";
import { isTokenExpired } from "./jwt.js";

export class AuthError extends Error {}

// Inside Tauri, route requests through the Rust HTTP client (plugin-http):
// no CORS preflight and no webview origin quirks. In a plain browser (vite dev
// without Tauri) fall back to window.fetch.
let fetchPromise;
const getFetch = () =>
  (fetchPromise ??= IS_TAURI
    ? import("@tauri-apps/plugin-http").then((m) => m.fetch)
    : Promise.resolve(window.fetch.bind(window)));

export async function signIn(login, password, fetchImpl) {
  const f = fetchImpl || (await getFetch());
  const res = await f(`${API_URL}/api/account/SignIn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: login, username: login, password }),
  });
  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok) throw new Error(data?.message || `Đăng nhập thất bại (${res.status})`);
  if (!data?.token) throw new Error("Phản hồi đăng nhập thiếu token");
  return data.token;
}

/**
 * Authenticated JSON client. `getToken` returns the current JWT; an expired
 * token or a 401 throws AuthError so the UI can drop back to the login screen
 * instead of silently writing to the server's "anonymous" user.
 */
export function createApi(getToken, fetchImpl) {
  return async function api(method, path, body) {
    const token = getToken();
    if (isTokenExpired(token)) throw new AuthError("Phiên đăng nhập đã hết hạn");
    const f = fetchImpl || (await getFetch());
    const res = await f(`${API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401) throw new AuthError("Phiên đăng nhập đã hết hạn");
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
}
