import { useEffect, useState } from "preact/hooks";
import { QUICK_HINTS } from "../lib/shortcuts.js";
import { CATEGORIES, checklistProgress, wordCount } from "../lib/notes.js";
import { applyEdit, continueList, insertTimeStamp, toggleTodo } from "../lib/editing.js";

export function Editor({ note, textareaRef, onChange, onCommit, onDelete, onBack }) {
  const [armDelete, setArmDelete] = useState(false);

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
        <button
          class={`btn small ${armDelete ? "danger" : "ghost"}`}
          onClick={() => (armDelete ? onDelete() : setArmDelete(true))}
        >
          {armDelete ? "Nhấn lần nữa để xoá" : "Xoá"}
        </button>
      </div>
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
      <div class="editor-foot muted">
        {wordCount(note.content)} từ
        {progress && ` · ${progress.done}/${progress.total} việc xong`}
      </div>
    </div>
  );
}
