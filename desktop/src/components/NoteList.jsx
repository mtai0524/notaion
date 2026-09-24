import { useEffect, useRef } from "preact/hooks";
import { checklistProgress, mediaCount } from "../lib/notes.js";

export function NoteList({ notes, selectedId, onSelect, onOpen, onToggleDone }) {
  const listRef = useRef();

  // Keep the cursor row visible while moving with j/k.
  useEffect(() => {
    listRef.current?.querySelector(".row.sel")?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (!notes.length) {
    return <div class="note-list empty">~ chưa có ghi chú — nhấn <kbd>n</kbd> để ghi nhanh</div>;
  }
  return (
    <ul class="note-list" role="listbox" ref={listRef}>
      {notes.map((n) => {
        const progress = checklistProgress(n.content);
        const media = (n.attachments?.length || 0) + mediaCount(n.content);
        const sel = n.id === selectedId;
        return (
          <li
            key={n.id}
            role="option"
            aria-selected={sel}
            class={`row${sel ? " sel" : ""}${n.isCompleted ? " done" : ""}`}
            onMouseDown={(e) => {
              if (e.target.tagName !== "BUTTON") onSelect(n.id);
            }}
            onDblClick={() => onOpen(n.id)}
          >
            <button class="box" title="Đánh dấu xong (x)" onClick={() => onToggleDone(n)}>
              {n.isCompleted ? "[x]" : "[ ]"}
            </button>
            <span class="row-title">{n.title || "(không tiêu đề)"}</span>
            {progress && (
              <span class={`row-chip${progress.done === progress.total ? " ok" : ""}`}>▣ {progress.done}/{progress.total}</span>
            )}
            {media > 0 && <span class="row-chip">📎{media}</span>}
            <span class="row-cat">{(n.customCategory || n.category || "LOG").slice(0, 4)}</span>
            <span class="row-time">{n.timestamp?.slice(0, 5)}</span>
          </li>
        );
      })}
    </ul>
  );
}
