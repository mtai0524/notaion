import { describe, it, expect } from "vitest";
import { continueList, toggleTodo, insertTimeStamp } from "./editing.js";

// "|" marks the caret in fixtures.
const split = (s) => ({ text: s.replace("|", ""), caret: s.indexOf("|") });
const join = (r) => r && r.text.slice(0, r.caret) + "|" + r.text.slice(r.caret);
const run = (fn, s) => {
  const { text, caret } = split(s);
  return join(fn(text, caret));
};

describe("continueList", () => {
  it("continues bullets, todos (unchecked) and numbers", () => {
    expect(run(continueList, "- a|")).toBe("- a\n- |");
    expect(run(continueList, "  - [x] done|")).toBe("  - [x] done\n  - [ ] |");
    expect(run(continueList, "9. nine|")).toBe("9. nine\n10. |");
  });
  it("ends the list on an empty item", () => {
    expect(run(continueList, "- a\n- |")).toBe("- a\n|");
  });
  it("does nothing outside lists or mid-line", () => {
    expect(run(continueList, "plain|")).toBeNull();
    expect(run(continueList, "- a|b")).toBeNull();
  });
});

describe("toggleTodo", () => {
  it("cycles plain → todo → done → todo", () => {
    expect(run(toggleTodo, "task|")).toBe("- [ ] task|");
    expect(run(toggleTodo, "- [ ] task|")).toBe("- [x] task|");
    expect(run(toggleTodo, "- [x] task|")).toBe("- [ ] task|");
  });
  it("converts a bullet and keeps indentation, touching only the caret line", () => {
    expect(run(toggleTodo, "a\n  - it|em\nb")).toBe("a\n  - [ ] it|em\nb");
  });
});

describe("insertTimeStamp", () => {
  it("inserts [HH:MM] at caret", () => {
    const r = insertTimeStamp("ab", 1, new Date(2026, 0, 1, 7, 5));
    expect(join(r)).toBe("a[07:05] |b");
  });
});
