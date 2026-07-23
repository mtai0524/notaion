# Image/File filename + right-click context menu (Notion page)

Date: 2026-07-23

## Problem

In the notion page editor (`CustomEditorProvider.jsx`, TipTap), uploaded images are
inserted with `setImage({ src })` only — the original filename from the upload
response (`fileData.originalName`) is discarded. There is no right-click menu on
images or file attachments to download, copy the link, open, or delete them.

## Goal

1. Store the original filename with uploaded images.
2. Add a right-click (context menu) popup on both **images** and **file
   attachments** with: **Download**, **Copy link**, **Open in new tab**, **Delete**.
3. The filename is shown only inside the context menu (as its header) — not as an
   on-image caption.

## Architecture

TipTap NodeViews (React) for both node types, plus one shared popup component.

### 1. Image → custom NodeView
Replace `Image.configure({ allowBase64: false })` with `Image.extend(...)`:
- Add a `name` attribute, persisted to HTML as `data-name` so it round-trips
  through the `/api/Page/{id}` save/load.
- `addNodeView() => ReactNodeViewRenderer(ImageNodeView)`.
- `ImageNodeView` renders `<img>` inside `NodeViewWrapper` and wires
  `onContextMenu` to open the shared menu.

### 2. FileAttachment → add NodeView
Keep existing `parseHTML`/`renderHTML` (serialization unchanged). Add
`addNodeView() => ReactNodeViewRenderer(FileAttachmentNodeView)` that re-renders
the existing 📁 card and wires `onContextMenu`. Left-click still opens the file.

### 3. MediaContextMenu (shared)
Absolutely-positioned popup, portaled to `document.body`, clamped to the viewport,
closes on outside click / Esc / scroll. Header = filename. Items: Download, Copy
link, Open in new tab, Delete. Style: square, monochrome, no glow (per UI prefs);
Delete uses red text.
- Download → reuse `downloadFile(savedName, originalName, cloudUrl)` from
  `fileService.js` (uses Cloudinary `fl_attachment` for correct original name).
- Copy link → `navigator.clipboard.writeText`.
- Open in new tab → `window.open(url, "_blank")`.
- Delete → `deleteNode()` prop provided by the NodeView.

### 4. Insert path
The three upload handlers (paste / drop / slash) change image insertion to
`setImage({ src: fileUrl, name: fileData.originalName })`.

## Files
- New: `src/components/layouts/MenuBar/ImageNodeView.jsx`
- New: `src/components/layouts/MenuBar/FileAttachmentNodeView.jsx`
- New: `src/components/layouts/MenuBar/MediaContextMenu.jsx` (+ small CSS)
- Edit: `src/components/layouts/MenuBar/CustomEditorProvider.jsx`

## Notes / scope
- Images uploaded *before* this change have no stored name → menu header falls
  back to "Image". Only new uploads carry the original name.
- No backend changes.
