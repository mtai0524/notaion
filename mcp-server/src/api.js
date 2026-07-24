export function createApi({ apiUrl, auth }, fetchImpl = fetch) {
  async function doFetch(method, path, body, token) {
    return fetchImpl(`${apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  return async function apiFetch(method, path, body) {
    let token = await auth.getToken();
    let res = await doFetch(method, path, body, token);

    if (res.status === 401) {
      auth.invalidate();
      token = await auth.getToken();
      res = await doFetch(method, path, body, token);
    }

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return text ? JSON.parse(text) : null;
  };
}
