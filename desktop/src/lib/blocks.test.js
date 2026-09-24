import { describe, it, expect } from "vitest";
import {
  parse, serialize, splitBlock, backspaceAtStart, insertAtCaret, insertAtGap, moveToGap,
  markdownShortcut, attachmentsToMarkdown,
} from "./blocks.js";

const md = (blocks) => serialize(blocks);
const img = { id: "img", type: "image", alt: "a.png", url: "https://x/a.png" };

describe("parse / serialize", () => {
  it("round-trips web markdown including images and files", () => {
    const src = "# Title\n- [ ] task\n![a.png](https://x/a.png)\n[doc.pdf](https://x/doc.pdf)\ntext";
    expect(md(parse(src))).toBe(src);
  });
  it("gives an empty note one writable paragraph", () => {
    expect(parse("")).toMatchObject([{ type: "paragraph", text: "" }]);
    expect(md(parse(""))).toBe("");
  });
  it("never saves upload placeholders", () => {
    expect(md([...parse("a"), { id: "u", type: "uploading", name: "x.png" }])).toBe("a");
  });
});

describe("splitBlock", () => {
  it("splits text at the caret; bullets and todos continue", () => {
    const r = splitBlock(parse("- [x] hello"), 0, 3);
    expect(md(r.blocks)).toBe("- [x] hel\n- [ ] lo");
    expect(r.focus.pos).toBe(0);
    expect(md(splitBlock(parse("# Head"), 0, 6).blocks)).toBe("# Head\n");
  });
  it("Enter on an empty bullet ends the list", () => {
    expect(splitBlock(parse("- "), 0, 0).blocks[0]).toMatchObject({ type: "paragraph", text: "" });
  });
});

describe("backspaceAtStart", () => {
  it("unstyles, then merges into the previous line", () => {
    const b = parse("one\n- two");
    const r1 = backspaceAtStart(b, 1);
    expect(md(r1.blocks)).toBe("one\ntwo");
    const r2 = backspaceAtStart(r1.blocks, 1);
    expect(md(r2.blocks)).toBe("onetwo");
    expect(r2.focus.pos).toBe(3);
  });
  it("removes an empty line after an image, never the image", () => {
    const b = [img, { id: "p", type: "paragraph", text: "" }];
    expect(backspaceAtStart(b, 1).blocks).toEqual([img]);
    expect(backspaceAtStart([img, { id: "p", type: "paragraph", text: "x" }], 1)).toBeNull();
  });
});

describe("insertAtCaret", () => {
  it("splits mid-text and puts the image at the caret", () => {
    const r = insertAtCaret(parse("hello world"), 0, 5, [img]);
    expect(md(r.blocks)).toBe("hello\n![a.png](https://x/a.png)\n world");
  });
  it("replaces an empty line and keeps a line to type after", () => {
    const r = insertAtCaret(parse("a\n"), 1, 0, [img]);
    expect(md(r.blocks)).toBe("a\n![a.png](https://x/a.png)\n");
    expect(r.blocks[2]).toMatchObject({ type: "paragraph", text: "" });
  });
  it("caret at start inserts above, at end inserts below", () => {
    expect(md(insertAtCaret(parse("x"), 0, 0, [img]).blocks)).toBe("![a.png](https://x/a.png)\nx");
    expect(md(insertAtCaret(parse("x"), 0, 1, [img]).blocks)).toBe("x\n![a.png](https://x/a.png)\n");
  });
});

describe("gaps", () => {
  it("inserts at a gap and moves blocks between gaps", () => {
    const b = parse("a\nb\nc");
    expect(md(insertAtGap(b, 1, [img]))).toBe("a\n![a.png](https://x/a.png)\nb\nc");
    expect(md(insertAtGap(b, 3, [img]))).toBe("a\nb\nc\n![a.png](https://x/a.png)\n");
    expect(md(moveToGap(b, 0, 3))).toBe("b\nc\na");
    expect(md(moveToGap(b, 2, 0))).toBe("c\na\nb");
    expect(moveToGap(b, 1, 2)).toBe(b); // dropped onto itself
  });
});

describe("markdownShortcut", () => {
  it("recognizes block prefixes", () => {
    expect(markdownShortcut("# x")).toMatchObject({ type: "h1", text: "x" });
    expect(markdownShortcut("### ")).toMatchObject({ type: "h3", text: "" });
    expect(markdownShortcut("[] buy")).toMatchObject({ type: "todo", checked: false, text: "buy" });
    expect(markdownShortcut("- [x] done")).toMatchObject({ type: "todo", checked: true });
    expect(markdownShortcut("- item")).toMatchObject({ type: "bullet", text: "item" });
    expect(markdownShortcut("> q")).toMatchObject({ type: "quote" });
    expect(markdownShortcut("```")).toMatchObject({ type: "code" });
    expect(markdownShortcut("plain")).toBeNull();
  });
});

describe("attachmentsToMarkdown", () => {
  it("writes image and file lines like the web", () => {
    expect(attachmentsToMarkdown([
      { type: "image", name: "a.png", url: "u1" },
      { type: "file", name: "b.pdf", url: "u2" },
    ])).toBe("![a.png](u1)\n[b.pdf](u2)");
  });
});
