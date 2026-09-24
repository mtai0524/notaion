import { useEffect, useRef, useState } from "preact/hooks";
import { QUICK_HINTS } from "../lib/shortcuts.js";
import { CATEGORIES, checklistProgress, wordCount } from "../lib/notes.js";
import { formatSize } from "../lib/attachments.js";
import { openExternal } from "../lib/native.js";
import { applyEdit, continueList, insertTimeStamp, toggleTodo } from "../lib/editing.js";

export function Editor({ note, textareaRef, onChange, onCommit, onDelete, onBack, onAttach, onRemoveAttachment, uploading }) {
  const [armDelete, setArmDelete] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => setArmDelete(false), [note?.id]);
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

  const onKeyDown = (e) => {
    const el = e.currentTarget;
    const caret = el.selectionStart;
    const collapsed = caret === el.selectionEnd;
    let r = null;
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && collapsed) r = continueList(el.value, caret);
    else if (e.ctrlKey && (e.key === "l" || e.key === "L")) r = toggleTodo(el.value, caret);
    else if (e.ctrlKey && e.key === ";") r = insertTimeStamp(el.value, caret);
    else if (e.key === "Tab" && !e.shiftKey && collapsed) r = { text: el.value.slice(0, caret) + "  " + el.value.slice(caret), caret: caret + 2 };
    if (r) {
      e.preventDefault();
      applyEdit(el, r);
    }
  };

  // Screenshots / copied images -> upload. Skip when the clipboard also has
  // plain text (e.g. copying from Word/Excel), so normal text paste still works.
  const onPaste = (e) => {
    const items = [...(e.clipboardData?.items || [])];
    if (items.some((i) => i.type === "text/plain")) return;
    const files = items.filter((i) => i.kind === "file").map((i) => i.getAsFile()).filter(Boolean);
    if (files.length) {
      e.preventDefault();
      onAttach(files);
    }
  };
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  const dropProps = {
    onDragOver: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
    },
    onDrop: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragOver(false);
      onAttach([...e.dataTransfer.files]);
    },
  };

  const attachments = note.attachments || [];
  const images = attachments.filter((a) => a.type === "image");
  const others = attachments.filter((a) => a.type !== "image");
  const progress = checklistProgress(note.content);
  const category = note.customCategory || note.category || "LOG";

  return (
    <div class={`editor${dragOver ? " drag-over" : ""}`} onPaste={onPaste} {...dropProps}>
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
              textareaRef.current?.focus();
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
            onChange={(e) => {
              onChange({ isCompleted: e.currentTarget.checked }, true);
            }}
          />
          Xong
        </label>
        <select
          value={note.customCategory ? "" : category}
          onChange={(e) => {
            onChange({ category: e.currentTarget.value, customCategory: null }, true);
          }}
        >
          {note.customCategory && <option value="">{note.customCategory}</option>}
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span class="muted">{note.timestamp?.slice(0, 5)}</span>
        <span class="spacer" />
        {uploading > 0 && <span class="muted uploading">Đang tải lên…</span>}
        <button class="btn small ghost" title="Đính kèm ảnh / file (hoặc dán Ctrl+V, kéo thả)" onClick={() => fileInputRef.current?.click()}>
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
            if (files.length) onAttach(files);
          }}
        />
        <button
          class={`btn small ${armDelete ? "danger" : "ghost"}`}
          onClick={() => (armDelete ? onDelete() : setArmDelete(true))}
        >
          {armDelete ? "Nhấn lần nữa để xoá" : "Xoá"}
        </button>
      </div>
      {attachments.length > 0 && (
        <div class="attachments">
          {images.map((a) => (
            <div class="att-image" key={a.url}>
              <img src={a.url} alt={a.name} title={`${a.name} — click để mở`} onClick={() => openExternal(a.url)} />
              <button class="att-remove" title="Gỡ" onClick={() => onRemoveAttachment(a.url)}>×</button>
            </div>
          ))}
          {others.map((a) => (
            <div class="att-chip" key={a.url}>
              <button class="link att-name" title={`Mở ${a.name}`} onClick={() => openExternal(a.url)}>📄 {a.name}</button>
              <span class="muted">{formatSize(a.size)}</span>
              {a.local && (
                <span class="att-local" title="Quá 10MB nên lưu trên server ứng dụng thay vì CDN — có thể mất khi server cập nhật.">LOCAL</span>
              )}
              <button class="att-remove inline" title="Gỡ" onClick={() => onRemoveAttachment(a.url)}>×</button>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        class="content-input"
        value={note.content || ""}
        placeholder={"Viết gì đó…\n\n- [ ] việc cần làm   (Ctrl+L)\n[09:30] ghi log      (Ctrl+;)"}
        spellcheck={false}
        onInput={(e) => onChange({ content: e.currentTarget.value })}
        onKeyDown={onKeyDown}
        onBlur={onCommit}
      />
      {dragOver && <div class="drop-hint">Thả file để đính kèm</div>}
      <div class="editor-foot muted">
        {wordCount(note.content)} từ
        {progress && ` · ${progress.done}/${progress.total} việc xong`}
      </div>
    </div>
  );
}
