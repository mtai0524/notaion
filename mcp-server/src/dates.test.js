import { describe, it, expect } from "vitest";
import { todayKey, nowTime } from "./dates.js";

describe("dates", () => {
  it("formats a date as yyyy-MM-dd in local time", () => {
    const d = new Date(2026, 6, 24, 9, 5, 3); // 2026-07-24 09:05:03 local
    expect(todayKey(d)).toBe("2026-07-24");
  });

  it("zero-pads single-digit month and day", () => {
    const d = new Date(2026, 0, 4, 0, 0, 0); // 2026-01-04
    expect(todayKey(d)).toBe("2026-01-04");
  });

  it("formats time as HH:mm:ss zero-padded", () => {
    const d = new Date(2026, 6, 24, 9, 5, 3);
    expect(nowTime(d)).toBe("09:05:03");
  });
});
