import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { searchNotes, previewLine } from "../lib/notes.js";
import { formatDayLabel } from "../lib/dates.js";

let lastFetch = 0;

export function SearchPalette({ store, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [corpus, setCorpus] = useState(() => store.peekAll());
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const listRef = useRef();
  const inputRef = useRef();
  // Preact does not emulate React's autoFocus for elements mounted later.
  // Layout effect: focus before paint so keys typed right after "/" land here.
  useLayoutEffect(() => inputRef.current?.focus(), []);

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
      <div class="palette pane focused">
        <span class="pane-title"><kbd>/</kbd>SEARCH · {results.length}/{corpus.length}{loading ? " · loading…" : ""}</span>
        <label class="palette-line">
        <span class="prompt">/</span>
        <input
          ref={inputRef}
          class="palette-input"
          placeholder="tìm mọi ngày… (không phân biệt dấu)"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        </label>
        <ul class="palette-list" ref={listRef}>
          {results.map((n, i) => (
            <li
              key={n.id}
              class={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={() => onPick(n)}
            >
              <div class="palette-title">{n.title || "(không tiêu đề)"}</div>
              <div class="palette-sub">
                {formatDayLabel(n.date)} · {previewLine(n.content)}
              </div>
            </li>
          ))}
          {query && !results.length && <li class="palette-none">~ không tìm thấy</li>}
        </ul>
      </div>
    </div>
  );
}
