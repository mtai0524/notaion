// Date keys are local-time "yyyy-MM-dd" strings, the same format the API and
// the web app use for DailyNote.date.

const pad = (n) => String(n).padStart(2, "0");

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const nowTime = (d = new Date()) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export const parseKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const shiftDay = (key, delta) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + delta);
  return todayKey(d);
};

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** "T5, 24/09/2026" — compact Vietnamese label for the header. */
export const formatDayLabel = (key) => {
  const d = parseKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
