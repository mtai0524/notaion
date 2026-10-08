import { describe, it, expect } from "vitest";
import { motion, vertical, operatorRange, cut, createHistory, normalMax, clampNormal } from "./vim.js";

describe("normalMax / clampNormal", () => {
  it("NORMAL mode never rests past the last char of the line", () => {
    expect(normalMax("abc", 0)).toBe(2);
    expect(normalMax("", 0)).toBe(0);
    expect(normalMax("ab\ncde", 4)).toBe(5);
    expect(clampNormal("abc", 3)).toBe(2);
    expect(clampNormal("ab\ncde", 2)).toBe(1); // sitting on the newline → last char of line 1
  });
});

describe("motion", () => {
  const t = "hello brave world";
  it("h / l stay inside the line", () => {
    expect(motion(t, 0, "h")).toEqual({ pos: 0, cross: null });
    expect(motion(t, 3, "l", 4)).toEqual({ pos: 7, cross: null });
    expect(motion(t, 15, "l", 9)).toEqual({ pos: 16, cross: null });
    expect(motion("ab\ncd", 3, "h", 5)).toEqual({ pos: 3, cross: null }); // doesn't wrap to the previous line
  });
  it("0 ^ $ jump within the line", () => {
    expect(motion("ab\ncde", 5, "0").pos).toBe(3);
    expect(motion("ab\ncde", 3, "$").pos).toBe(5);
    expect(motion(t, 4, "^").pos).toBe(0);
  });
  it("w / b / e move by word and report crossing blocks", () => {
    expect(motion(t, 0, "w").pos).toBe(6);
    expect(motion(t, 0, "w", 2).pos).toBe(12);
    expect(motion(t, 12, "w")).toEqual({ pos: 16, cross: "next" }); // last word → continue on the next block
    expect(motion(t, 12, "b").pos).toBe(6);
    expect(motion(t, 0, "b")).toEqual({ pos: 0, cross: "prev" });
    expect(motion(t, 0, "e").pos).toBe(4);
    expect(motion(t, 4, "e").pos).toBe(10);
    expect(motion(t, 16, "e").cross).toBe("next");
  });
  it("returns null for non-motions", () => {
    expect(motion(t, 0, "z")).toBeNull();
  });
});

describe("vertical", () => {
  const code = "one\ntwo\nthree";
  it("keeps the column and reports the edges", () => {
    expect(vertical(code, 1, 1)).toBe(5);   // o|ne → t|wo
    expect(vertical(code, 5, 1)).toBe(9);   // → t|hree
    expect(vertical(code, 9, 1)).toBeNull(); // last line
    expect(vertical(code, 9, -1)).toBe(5);
    expect(vertical(code, 1, -1)).toBeNull(); // first line
    expect(vertical("abcdef\nxy", 5, 1)).toBe(8); // short next line: clamp to its last char
  });
});

describe("operatorRange / cut", () => {
  it("covers the text each motion would", () => {
    expect(operatorRange("foo bar baz", 4, "w")).toEqual({ from: 4, to: 8 });
    expect(operatorRange("foo bar baz", 8, "w")).toEqual({ from: 8, to: 11 });
    expect(operatorRange("foo bar", 1, "$")).toEqual({ from: 1, to: 7 });
    expect(operatorRange("foo bar", 4, "0")).toEqual({ from: 0, to: 4 });
    expect(operatorRange("foo bar", 4, "b")).toEqual({ from: 0, to: 4 });
    expect(operatorRange("foo bar", 0, "x")).toBeNull();
    // cw changes only the word (keeps the space); dw takes the space as well
    expect(operatorRange("foo bar", 0, "w", "c")).toEqual({ from: 0, to: 3 });
    expect(operatorRange("foo bar", 0, "w", "d")).toEqual({ from: 0, to: 4 });
    expect(operatorRange("foo  bar", 3, "w", "c")).toEqual({ from: 3, to: 5 }); // on blanks cw behaves like dw
  });
  it("cut removes and returns the slice", () => {
    expect(cut("foo bar baz", 4, 8)).toEqual({ text: "foo baz", removed: "bar " });
  });
});

describe("history", () => {
  const s = (md, i = 0, pos = 0) => ({ md, i, pos });
  it("undo / redo walk the snapshots", () => {
    const h = createHistory();
    h.push(s("a")); h.push(s("b"));
    expect(h.undo(s("c")).md).toBe("b");
    expect(h.undo(s("b")).md).toBe("a");
    expect(h.undo(s("a"))).toBeNull();
    expect(h.redo(s("a")).md).toBe("b");
    expect(h.redo(s("b")).md).toBe("c");
    expect(h.redo(s("c"))).toBeNull();
  });
  it("ignores a duplicate of the newest snapshot and drops redo on a new edit", () => {
    const h = createHistory();
    h.push(s("a")); h.push(s("a"));
    expect(h.size).toBe(1);
    h.undo(s("b"));
    h.push(s("x"));
    expect(h.redo(s("x"))).toBeNull();
  });
  it("caps its size", () => {
    const h = createHistory(3);
    ["a", "b", "c", "d", "e"].forEach((m) => h.push(s(m)));
    expect(h.size).toBe(3);
  });
});
