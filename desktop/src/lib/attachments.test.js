import { describe, it, expect, vi } from "vitest";
import { uploadAttachments, toAttachment, nameClipboardFile, describeUploadError } from "./attachments.js";
import { HttpError } from "./api.js";

const MB = 1024 * 1024;
const fakeFile = (name, type, size) => ({ name, type, size });
// FormData.append(name, blob, filename) needs a real Blob; fake the size.
class SizedBlob extends Blob {
  constructor(name, type, size) {
    super(["x"], { type });
    this._name = name;
    this._size = size;
  }
  get name() { return this._name; }
  get size() { return this._size ?? super.size; }
}

describe("uploadAttachments", () => {
  it("routes by Cloudinary limit and keeps input order", async () => {
    const api = { postForm: vi.fn() };
    api.postForm
      .mockResolvedValueOnce([{ originalName: "small.png", contentType: "image/png", sizeInBytes: 10, cloudUrl: "https://cdn/small.png" }])
      .mockResolvedValueOnce([{ originalName: "big.pdf", contentType: "application/pdf", sizeInBytes: 20 * MB, savedName: "abc big.pdf" }]);
    const files = [
      new SizedBlob("big.pdf", "application/pdf", 20 * MB),
      new SizedBlob("small.png", "image/png"),
    ];
    const out = await uploadAttachments(api, files);
    expect(api.postForm.mock.calls.map((c) => c[0])).toEqual(["/api/files/upload/cloudinary", "/api/files/upload"]);
    expect(out.map((a) => a.name)).toEqual(["big.pdf", "small.png"]);
    expect(out[0]).toMatchObject({ type: "file", local: true });
    expect(out[0].url).toMatch(/\/api\/files\/download\/abc%20big\.pdf$/);
    expect(out[1]).toMatchObject({ type: "image", url: "https://cdn/small.png", local: false });
  });
});

describe("toAttachment", () => {
  it("matches the web attachment shape", () => {
    expect(toAttachment({ originalName: "a.jpg", contentType: "image/jpeg", sizeInBytes: 5, cloudUrl: "u" })).toEqual({
      type: "image", url: "u", name: "a.jpg", size: 5, contentType: "image/jpeg", local: false,
    });
  });
});

describe("nameClipboardFile", () => {
  it("renames generic clipboard images, keeps real names", () => {
    const pasted = new File(["x"], "image.png", { type: "image/png" });
    expect(nameClipboardFile(pasted, new Date("2026-09-24T10:11:12Z")).name).toBe("paste-20260924101112.png");
    const real = fakeFile("report.pdf", "application/pdf", 1);
    expect(nameClipboardFile(real)).toBe(real);
  });
});

describe("describeUploadError", () => {
  it("surfaces server messages and 413", () => {
    expect(describeUploadError(new HttpError(413, ""))).toMatch(/quá lớn/);
    expect(describeUploadError(new HttpError(400, JSON.stringify({ message: "Invalid file" })))).toBe("Upload thất bại (400): Invalid file");
    expect(describeUploadError(new Error("fetch failed"))).toMatch(/fetch failed/);
  });
});
