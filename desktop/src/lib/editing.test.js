import { describe, it, expect } from "vitest";
import { insertTimeStamp } from "./editing.js";

describe("insertTimeStamp", () => {
  it("inserts [HH:MM] at caret", () => {
    const r = insertTimeStamp("ab", 1, new Date(2026, 0, 1, 7, 5));
    expect(r.text.slice(0, r.caret) + "|" + r.text.slice(r.caret)).toBe("a[07:05] |b");
  });
});
