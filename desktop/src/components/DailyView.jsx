import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { buildNote } from "../lib/notes.js";
import { formatDayLabel, shiftDay, todayKey } from "../lib/dates.js";
import { tokenUserName } from "../lib/jwt.js";
import { hideWindow, onQuickCapture } from "../lib/native.js";
import { Editor } from "./Editor.jsx";
import { NoteList } from "./NoteList.jsx";
import { SearchPalette } from "./SearchPalette.jsx";
import { Mark } from "./Mark.jsx";

const SAVE_DEBOUNCE_MS = 500;
const FOCUS_REFRESH_MS = 15_000;
const NARROW_MQ = window.matchMedia("(max-width: 640px)");

export function DailyView({ store, token, onSignOut }) {
  const [date, setDate] = useState(todayKey);
  const [notes, setNotes] = useState(() => store.peekDay(todayKey()));
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sync, setSync] = useState(store.getStatus);
  const [capture, setCapture] = useState("");
  const [isNarrow, setIsNarrow] = useState(NARROW_MQ.matches);

  const captureRef = useRef();
  const contentRef = useRef();
  const dateInputRef = useRef();
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const dateRef = useRef(date);
  dateRef.current = date;
  const dirty = useRef(new Map()); // note id -> debounce timer
  const lastLoad = useRef(0);
  const pendingSelect = useRef(null);

  useEffect(() => store.subscribe(() => setSync(store.getStatus())), [store]);
  useEffect(() => {
    const onChange = (e) => setIsNarrow(e.matches);
    NARROW_MQ.addEventListener("change", onChange);
    return () => NARROW_MQ.removeEventListener("change", onChange);
  }, []);
  useEffect(() => void store.flush(), [store, token]);

  // ---- persistence -------------------------------------------------------
  const commit = useCallback((id, note) => {
    clearTimeout(dirty.current.get(id));
    dirty.current.delete(id);
    const n = note || notesRef.current.find((x) => x.id === id);
    if (n) store.save(n);
  }, [store]);
  const commitAll = useCallback(() => [...dirty.current.keys()].forEach((id) => commit(id)), [commit]);

  const update = (id, patch, immediate = false) => {
    const cur = notesRef.current.find((n) => n.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    notesRef.current = notesRef.current.map((n) => (n.id === id ? next : n));
    setNotes(notesRef.current);
    if (immediate) return commit(id, next);
    clearTimeout(dirty.current.get(id));
    dirty.current.set(id, setTimeout(() => commit(id), SAVE_DEBOUNCE_MS));
  };

  // ---- loading -----------------------------------------------------------
  const load = useCallback(async (d) => {
    lastLoad.current = Date.now();
    setLoading(true);
    try {
      const fresh = await store.fetchDay(d);
      if (d !== dateRef.current) return;
      // Keep in-flight local edits (still debouncing) over server copies.
      const local = new Map(notesRef.current.filter((n) => dirty.current.has(n.id)).map((n) => [n.id, n]));
      setNotes(fresh.map((n) => local.get(n.id) || n));
      setLoadError("");
    } catch (err) {
      if (d === dateRef.current) setLoadError(err.message || "Không tải được");
    } finally {
      if (d === dateRef.current) setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    setNotes(store.peekDay(date)); // instant paint from cache
    load(date);
  }, [date, load, store]);

  // Keep a valid selection: honor a pending jump (search), else first note on wide layouts.
  useEffect(() => {
    if (pendingSelect.current && notes.some((n) => n.id === pendingSelect.current)) {
      setSelectedId(pendingSelect.current);
      pendingSelect.current = null;
    } else if (!notes.some((n) => n.id === selectedId)) {
      setSelectedId(!NARROW_MQ.matches && notes[0] ? notes[0].id : null);
    }
  }, [notes]);

  const goDate = (d) => {
    commitAll();
    if (d !== dateRef.current) setDate(d);
  };

  // Refresh when the window regains focus; roll "today" over after midnight.
  useEffect(() => {
    let lastToday = todayKey();
    const onFocus = () => {
      const t = todayKey();
      if (t !== lastToday && dateRef.current === lastToday) goDate(t);
      lastToday = t;
      if (Date.now() - lastLoad.current > FOCUS_REFRESH_MS) load(dateRef.current);
      store.flush();
    };
    const onBlur = () => commitAll();
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [load, commitAll, store]);

  // ---- actions -----------------------------------------------------------
  const focusCapture = () => {
    const el = captureRef.current;
    if (!el) return;
    el.focus();
    el.select();
  };

  const create = (title, { openEditor = false } = {}) => {
    const n = buildNote({ title, date: dateRef.current });
    notesRef.current = [n, ...notesRef.current];
    setNotes(notesRef.current);
    store.save(n);
    setSelectedId(n.id);
    if (openEditor) requestAnimationFrame(() => contentRef.current?.focus());
  };

  const remove = (note) => {
    clearTimeout(dirty.current.get(note.id));
    dirty.current.delete(note.id);
    const idx = notesRef.current.findIndex((n) => n.id === note.id);
    const rest = notesRef.current.filter((n) => n.id !== note.id);
    notesRef.current = rest;
    setNotes(rest);
    setSelectedId(rest[Math.min(idx, rest.length - 1)]?.id ?? null);
    store.remove(note);
  };

  const moveSelection = (delta) => {
    const list = notesRef.current;
    if (!list.length) return;
    const i = list.findIndex((n) => n.id === selectedId);
    const next = list[Math.max(0, Math.min(list.length - 1, (i < 0 ? -1 : i) + delta))];
    commitAll();
    setSelectedId(next.id);
  };

  const pickSearch = (n) => {
    setSearchOpen(false);
    pendingSelect.current = n.id;
    if (n.date === dateRef.current) setSelectedId(n.id);
    else goDate(n.date);
  };

  // ---- keyboard ----------------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key;
      if (e.ctrlKey && !e.altKey && (k === "k" || k === "K" || k === "p" || k === "P")) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.ctrlKey && !e.altKey && (k === "n" || k === "N")) {
        e.preventDefault();
        focusCapture();
      } else if ((e.ctrlKey && (k === "r" || k === "R")) || k === "F5") {
        e.preventDefault(); // no webview reload — refetch instead
        load(dateRef.current);
      } else if (e.altKey && k === "ArrowLeft") {
        e.preventDefault();
        goDate(shiftDay(dateRef.current, -1));
      } else if (e.altKey && k === "ArrowRight") {
        e.preventDefault();
        goDate(shiftDay(dateRef.current, 1));
      } else if (e.altKey && k === "Home") {
        e.preventDefault();
        goDate(todayKey());
      } else if (e.altKey && (k === "ArrowUp" || k === "ArrowDown")) {
        e.preventDefault();
        moveSelection(k === "ArrowUp" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    let off = () => {};
    onQuickCapture(() => {
      commitAll();
      if (dateRef.current !== todayKey()) setDate(todayKey());
      requestAnimationFrame(focusCapture);
    }).then((fn) => (off = fn));
    return () => off();
  }, [commitAll]);

  // ---- render ------------------------------------------------------------
  const selected = notes.find((n) => n.id === selectedId) || null;
  const isToday = date === todayKey();
  const showEditorOnly = isNarrow && selected;

  let syncLabel = "Đã đồng bộ";
  if (sync.status === "syncing") syncLabel = "Đang đồng bộ…";
  else if (sync.status === "offline") syncLabel = `Offline · ${sync.pending} thay đổi chờ gửi`;
  else if (sync.status === "error") syncLabel = sync.lastError;
  else if (sync.pending) syncLabel = "Đang lưu…";

  return (
    <div class={`app${showEditorOnly ? " editor-only" : ""}`}>
      <header class="topbar">
        <span class="brand" title="Notaion Daily"><Mark size={18} /></span>
        <button class="icon-btn" title="Ngày trước (Alt+←)" onClick={() => goDate(shiftDay(date, -1))}>‹</button>
        <button
          class="date-label"
          title="Chọn ngày"
          onClick={() => dateInputRef.current?.showPicker?.()}
        >
          {formatDayLabel(date)}
          {isToday && <span class="today-dot">hôm nay</span>}
        </button>
        <input
          ref={dateInputRef}
          type="date"
          class="hidden-date"
          value={date}
          onChange={(e) => e.currentTarget.value && goDate(e.currentTarget.value)}
          tabIndex={-1}
        />
        <button class="icon-btn" title="Ngày sau (Alt+→)" onClick={() => goDate(shiftDay(date, 1))}>›</button>
        {!isToday && (
          <button class="btn small ghost" title="Alt+Home" onClick={() => goDate(todayKey())}>Hôm nay</button>
        )}
        <span class="spacer" />
        {loading && <span class="spinner" title="Đang tải" />}
        <button class="btn small ghost" onClick={() => setSearchOpen(true)} title="Tìm kiếm (Ctrl+K)">
          Tìm <kbd>Ctrl K</kbd>
        </button>
      </header>

      <div class="main">
        <aside class="sidebar">
          <input
            ref={captureRef}
            class="capture"
            value={capture}
            placeholder="Ghi nhanh…  Enter lưu · Shift+Enter viết tiếp"
            onInput={(e) => setCapture(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && capture.trim()) {
                e.preventDefault();
                create(capture.trim(), { openEditor: e.shiftKey });
                setCapture("");
              } else if (e.key === "Escape") {
                if (capture) setCapture("");
                else hideWindow();
              } else if (e.key === "ArrowDown" && !capture) {
                e.preventDefault();
                moveSelection(1);
              }
            }}
          />
          {loadError && !notes.length && <div class="load-error">{loadError}</div>}
          <NoteList
            notes={notes}
            selectedId={selectedId}
            onSelect={(id) => {
              commitAll();
              setSelectedId(id);
            }}
            onToggleDone={(n) => update(n.id, { isCompleted: !n.isCompleted }, true)}
          />
        </aside>

        <main class="editor-pane">
          <Editor
            note={selected}
            textareaRef={contentRef}
            onChange={(patch, immediate) => selected && update(selected.id, patch, immediate)}
            onCommit={() => selected && dirty.current.has(selected.id) && commit(selected.id)}
            onDelete={() => selected && remove(selected)}
            onBack={isNarrow ? () => setSelectedId(null) : null}
          />
        </main>
      </div>

      <footer class="statusbar">
        <span class={`sync-dot ${sync.status}${sync.pending ? " pending" : ""}`} />
        <span>{syncLabel}</span>
        <span class="muted">· {notes.length} ghi chú</span>
        <span class="spacer" />
        <span class="muted">{tokenUserName(token)}</span>
        <button class="link" onClick={onSignOut}>Đăng xuất</button>
      </footer>

      {searchOpen && (
        <SearchPalette store={store} onPick={pickSearch} onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}
