export function createAuth(config, fetchImpl = fetch) {
  let token = null;

  async function signIn() {
    const res = await fetchImpl(`${config.apiUrl}/api/account/SignIn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: config.email,
        username: config.email,
        password: config.password,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SignIn failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    if (!data?.token) throw new Error("SignIn response missing token");
    token = data.token;
    return token;
  }

  return {
    async getToken() {
      if (token) return token;
      return signIn();
    },
    invalidate() {
      token = null;
    },
  };
}
