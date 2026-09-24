import { useRef } from "preact/hooks";
import { QUICK_HINTS } from "../lib/shortcuts.js";
import { CATEGORIES, checklistProgress, wordCount } from "../lib/notes.js";
import { formatSize } from "../lib/attachments.js";
import { openExternal } from "../lib/native.js";
import { BlockEditor } from "./BlockEditor.jsx";

export function Editor({
  note, contentRef, onChange, onCommit, onDelete,
  onUpload, onUploadError, onOrphanUpload, onRemoveAttachment,
}) {
  const fileInputRef = useRef();

  if (!note) {
    return (
      <div class="editor empty">
        <pre class="empty-art">{"┌──────────────────────────┐\n│   no note selected       │\n└──────────────────────────┘"}</pre>
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
  const words = wordCount(note.content);
  const category = note.customCategory || note.category || "LOG";

  return (
    <div class="editor">
      <input
        class="title-input"
        value={note.title || ""}
        placeholder="(không tiêu đề)"
        onInput={(e) => onChange({ title: e.currentTarget.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "ArrowDown") {
            e.preventDefault();
            contentRef.current?.focus();
          }
        }}
        onBlur={onCommit}
      />
      <div class="meta">
        <label class="tag" title="Đổi loại">
          <select
            value={note.customCategory ? "" : category}
            onChange={(e) => onChange({ category: e.currentTarget.value, customCategory: null }, true)}
          >
            {note.customCategory && <option value="">{note.customCategory}</option>}
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <span>· {note.timestamp || "--:--"} ·</span>
        <button
          class={`meta-btn${note.isCompleted ? " ok" : ""}`}
          title="Đánh dấu xong (x)"
          onClick={() => onChange({ isCompleted: !note.isCompleted }, true)}
        >
          {note.isCompleted ? "[x] done" : "[ ] open"}
        </button>
        <span>· {words}w · ~{Math.max(1, Math.ceil(words / 200))}m read</span>
        {progress && <span class={progress.done === progress.total ? "ok" : ""}>· ▣ {progress.done}/{progress.total}</span>}
        <span class="spacer" />
        <button
          class="chip"
          title="Chèn ảnh / file tại con trỏ (hoặc Ctrl+V, kéo thả)"
          onMouseDown={(e) => e.preventDefault() /* keep the caret where it is */}
          onClick={() => fileInputRef.current?.click()}
        >
          📎 attach
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
        <button class="chip danger-hover" title="Xoá ghi chú (d)" onClick={onDelete}>✕ del</button>
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
                <button class="att-name" title={`Mở ${a.name}`} onClick={() => openExternal(a.url)}>📄 {a.name}</button>
                <span class="dim">{formatSize(a.size)}</span>
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
    </div>
  );
}
