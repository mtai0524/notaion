import { useEffect, useRef, useState } from "preact/hooks";
import { QUICK_HINTS } from "../lib/shortcuts.js";
import { CATEGORIES, checklistProgress, wordCount } from "../lib/notes.js";
import { formatSize } from "../lib/attachments.js";
import { openExternal } from "../lib/native.js";
import { BlockEditor } from "./BlockEditor.jsx";

export function Editor({
  note, contentRef, onChange, onCommit, onDelete, onBack,
  onUpload, onUploadError, onOrphanUpload, onRemoveAttachment,
}) {
  const [armDelete, setArmDelete] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    if (!armDelete) return;
    const t = setTimeout(() => setArmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [armDelete]);

  if (!note) {
    return (
      <div class="editor empty">
        <p>Chọn một ghi chú, hoặc gõ vào ô <kbd>Ghi nhanh</kbd> rồi <kbd>Enter</kbd>.</p>
        <ul class="hints">
          {QUICK_HINTS.map(([k, desc]) => (
            <li key={k}><kbd>{k}</kbd> {desc}</li>
          ))}
        </ul>
      </div>
    );
  }

  // Canvas attachments added on the web (note.attachments). New uploads from
  // desktop go inline into the content instead, at the caret / drop line.
  const legacy = note.attachments || [];
  const progress = checklistProgress(note.content);
  const category = note.customCategory || note.category || "LOG";

  return (
    <div class="editor">
      <div class="editor-head">
        {onBack && (
          <button class="icon-btn back" onClick={onBack} title="Quay lại danh sách">‹</button>
        )}
        <input
          class="title-input"
          value={note.title || ""}
          placeholder="Tiêu đề"
          onInput={(e) => onChange({ title: e.currentTarget.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "ArrowDown") {
              e.preventDefault();
              contentRef.current?.focus();
            }
          }}
          onBlur={onCommit}
        />
      </div>
      <div class="editor-meta">
        <label class="check">
          <input
            type="checkbox"
            checked={!!note.isCompleted}
            onChange={(e) => onChange({ isCompleted: e.currentTarget.checked }, true)}
          />
          Xong
        </label>
        <select
          value={note.customCategory ? "" : category}
          onChange={(e) => onChange({ category: e.currentTarget.value, customCategory: null }, true)}
        >
          {note.customCategory && <option value="">{note.customCategory}</option>}
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span class="muted">{note.timestamp?.slice(0, 5)}</span>
        <span class="spacer" />
        <button
          class="btn small ghost"
          title="Chèn ảnh / file tại con trỏ (hoặc Ctrl+V, kéo thả)"
          onMouseDown={(e) => e.preventDefault() /* keep the caret where it is */}
          onClick={() => fileInputRef.current?.click()}
        >
          📎 Đính kèm
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = [...e.currentTarget.files];
            e.currentTarget.value = "";
            if (files.length) contentRef.current?.insertFiles(files);
          }}
        />
        <button
          class={`btn small ${armDelete ? "danger" : "ghost"}`}
          onClick={() => (armDelete ? onDelete() : setArmDelete(true))}
        >
          {armDelete ? "Nhấn lần nữa để xoá" : "Xoá"}
        </button>
      </div>

      {legacy.length > 0 && (
        <div class="attachments">
          {legacy.map((a) =>
            a.type === "image" ? (
              <div class="att-image" key={a.url}>
                <img src={a.url} alt={a.name} title={`${a.name} — click để mở`} onClick={() => openExternal(a.url)} />
                <button class="att-remove" title="Gỡ" onClick={() => onRemoveAttachment(a.url)}>×</button>
              </div>
            ) : (
              <div class="att-chip" key={a.url}>
                <button class="link att-name" title={`Mở ${a.name}`} onClick={() => openExternal(a.url)}>📄 {a.name}</button>
                <span class="muted">{formatSize(a.size)}</span>
                {a.local && <span class="att-local" title="Lưu trên server ứng dụng thay vì CDN — có thể mất khi server cập nhật.">LOCAL</span>}
                <button class="att-remove inline" title="Gỡ" onClick={() => onRemoveAttachment(a.url)}>×</button>
              </div>
            )
          )}
        </div>
      )}

      <div class="editor-scroll">
        <BlockEditor
          content={note.content || ""}
          apiRef={contentRef}
          onChange={(content) => onChange({ content })}
          onCommit={onCommit}
          onUpload={onUpload}
          onUploadError={onUploadError}
          onOrphanUpload={(atts) => onOrphanUpload(note, atts)}
        />
      </div>
      <div class="editor-foot muted">
        {wordCount(note.content)} từ
        {progress && ` · ${progress.done}/${progress.total} việc xong`}
      </div>
    </div>
  );
}
