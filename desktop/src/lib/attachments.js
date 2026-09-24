// File/image attachments — same storage and note shape as the web app
// (src/services/fileService.js + DailyNoteApp handleAttachmentUpload), so
// attachments added here show up on the web canvas and vice versa.
import { API_URL } from "./config.js";
import { AuthError, HttpError } from "./api.js";

const MB = 1024 * 1024;
// Cloudinary Free hard caps; bigger files go to the app server instead.
const CLOUDINARY_LIMITS = { image: 10 * MB, video: 100 * MB, raw: 10 * MB };
const kind = (f) => (f.type?.startsWith("image/") ? "image" : f.type?.startsWith("video/") ? "video" : "raw");
const exceedsCloudinary = (f) => f.size > CLOUDINARY_LIMITS[kind(f)];

/** Server file metadata → note.attachments entry (web-compatible). */
export function toAttachment(meta) {
  const url = meta.cloudUrl || `${API_URL}/api/files/download/${encodeURIComponent(meta.savedName)}`;
  return {
    type: (meta.contentType || "").startsWith("image/") ? "image" : "file",
    url,
    name: meta.originalName,
    size: meta.sizeInBytes,
    contentType: meta.contentType,
    local: !meta.cloudUrl, // on the app server, not the CDN — may vanish on redeploy
  };
}

const formOf = (files) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f, f.name));
  return fd;
};

/** Upload files; returns attachment entries in input order. */
export async function uploadAttachments(api, files) {
  const cloud = files.filter((f) => !exceedsCloudinary(f));
  const local = files.filter(exceedsCloudinary);
  const [a, b] = await Promise.all([
    cloud.length ? api.postForm("/api/files/upload/cloudinary", formOf(cloud)) : [],
    local.length ? api.postForm("/api/files/upload", formOf(local)) : [],
  ]);
  const metas = [...(a || []), ...(b || [])];
  const byName = new Map(metas.map((m) => [m.originalName, m]));
  const ordered = files.map((f) => byName.get(f.name)).filter(Boolean);
  return (ordered.length === metas.length ? ordered : metas).map(toAttachment);
}

/** Clipboard images have generic names ("image.png"); make them unique. */
export function nameClipboardFile(file, now = new Date()) {
  if (file.name && file.name !== "image.png") return file;
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return new File([file], `paste-${stamp}.${ext}`, { type: file.type });
}

export function describeUploadError(err) {
  if (err instanceof AuthError) return err.message;
  if (err instanceof HttpError) {
    if (err.status === 413) return "File quá lớn — server từ chối (413).";
    let msg = "";
    try {
      const d = JSON.parse(err.body);
      msg = d?.error?.message || d?.message || d?.title || "";
    } catch {
      msg = String(err.body || "").slice(0, 160);
    }
    return `Upload thất bại (${err.status})${msg ? `: ${msg}` : ""}`;
  }
  return `Không upload được: ${err?.message || "lỗi mạng"}`;
}

export const formatSize = (bytes) => {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / MB).toFixed(1)}MB`;
};
