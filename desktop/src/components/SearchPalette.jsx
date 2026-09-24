import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { searchNotes, previewLine } from "../lib/notes.js";
import { formatDayLabel } from "../lib/dates.js";

let lastFetch = 0;

export function SearchPalette({ store, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [corpus, setCorpus] = useState(() => store.peekAll());
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const listRef = useRef();

  // Search the local index immediately; refresh it at most once a minute.
  useEffect(() => {
    if (Date.now() - lastFetch < 60_000 && corpus.length) return;
    setLoading(true);
    store
      .fetchAll()
      .then((all) => {
        lastFetch = Date.now();
        setCorpus(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => searchNotes(corpus, query), [corpus, query]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) onPick(results[active]);
  };

  return (
    <div class="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="palette">
        <input
          class="palette-input"
          autoFocus
          placeholder={`Tìm trong ${corpus.length} ghi chú…${loading ? " (đang tải)" : ""}`}
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        <ul class="palette-list" ref={listRef}>
          {results.map((n, i) => (
            <li
              key={n.id}
              class={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={() => onPick(n)}
            >
              <div class="palette-title">{n.title || "(không tiêu đề)"}</div>
              <div class="palette-sub muted">
                {formatDayLabel(n.date)} · {previewLine(n.content)}
              </div>
            </li>
          ))}
          {query && !results.length && <li class="muted palette-none">Không tìm thấy</li>}
        </ul>
      </div>
    </div>
  );
}
