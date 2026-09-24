// Remember where to return after login (survives the OAuth round-trip in the
// same tab). Only same-origin paths are accepted.
const KEY = "afterLoginPath";

export const setAfterLoginPath = (path) => sessionStorage.setItem(KEY, path);

export const consumeAfterLoginPath = (fallback = "/daily-note") => {
  const path = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return path && path.startsWith("/") && !path.startsWith("//") ? path : fallback;
};
