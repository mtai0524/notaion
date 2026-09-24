import { checklistProgress, previewLine } from "../lib/notes.js";

export function NoteList({ notes, selectedId, onSelect, onToggleDone }) {
  if (!notes.length) {
    return <div class="note-list empty muted">Chưa có ghi chú nào trong ngày.</div>;
  }
  return (
    <ul class="note-list" role="listbox">
      {notes.map((n) => {
        const progress = checklistProgress(n.content);
        return (
          <li
            key={n.id}
            role="option"
            aria-selected={n.id === selectedId}
            class={`note-item${n.id === selectedId ? " selected" : ""}${n.isCompleted ? " done" : ""}`}
            onMouseDown={(e) => {
              if (e.target.tagName !== "INPUT") onSelect(n.id);
            }}
          >
            <input
              type="checkbox"
              checked={!!n.isCompleted}
              title="Đánh dấu xong"
              onChange={() => onToggleDone(n)}
            />
            <div class="note-item-body">
              <div class="note-item-title">{n.title || <span class="muted">(không tiêu đề)</span>}</div>
              {previewLine(n.content) && <div class="note-item-preview">{previewLine(n.content)}</div>}
              <div class="note-item-meta">
                <span class={`tag tag-${(n.customCategory ? "custom" : n.category || "log").toLowerCase()}`}>
                  {n.customCategory || n.category || "LOG"}
                </span>
                {n.timestamp && <span>{n.timestamp.slice(0, 5)}</span>}
                {progress && <span>☑ {progress.done}/{progress.total}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
