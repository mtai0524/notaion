export function loadConfig(env = process.env) {
  const email = env.NOTAION_EMAIL;
  const password = env.NOTAION_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Missing credentials: set NOTAION_EMAIL and NOTAION_PASSWORD in the MCP server env."
    );
  }
  return {
    apiUrl: env.NOTAION_API_URL || "https://notaion.runasp.net",
    email,
    password,
  };
}
