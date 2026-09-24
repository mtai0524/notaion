import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { buildNote } from "../lib/notes.js";
import { describeUploadError } from "../lib/attachments.js";
import { attachmentsToMarkdown } from "../lib/blocks.js";
import { formatDayLabel, shiftDay, todayKey } from "../lib/dates.js";
import { tokenUserName } from "../lib/jwt.js";
import { hideWindow, onQuickCapture } from "../lib/native.js";
import { applyTheme, loadTheme, nextTheme } from "../lib/theme.js";
import { Editor } from "./Editor.jsx";
import { NoteList } from "./NoteList.jsx";
import { SearchPalette } from "./SearchPalette.jsx";
import { HelpPanel } from "./HelpPanel.jsx";

const SAVE_DEBOUNCE_MS = 500;
const FOCUS_REFRESH_MS = 15_000;
const NARROW_MQ = window.matchMedia("(max-width: 640px)");

const HINTS = {
  list: "j/k:move  enter:edit  e:title  n:new  x:done  d:delete  [/]:day  t:today  c:calendar  /:search  T:theme  q:hide  ?:help",
  editor: "── INSERT ──  esc:normal  enter:new block  ctrl+v:paste image  ctrl+l:todo  ctrl+;:time  #/-/[]:format",
  capture: "── CAPTURE ──  enter:save  shift+enter:save & write  esc:clear/hide",
};

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export function DailyView({ store, token, onSignOut }) {
  const [date, setDate] = useState(todayKey);
  const [notes, setNotes] = useState(() => store.peekDay(todayKey()));
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const [sync, setSync] = useState(store.getStatus);
  const [capture, setCapture] = useState("");
  const [isNarrow, setIsNarrow] = useState(NARROW_MQ.matches);
  const [focus, setFocus] = useState({ pane: "list", insert: false, capture: false });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [theme, setTheme] = useState(loadTheme);

  const captureRef = useRef();
  const contentRef = useRef();
  const dateInputRef = useRef();
  const listPaneRef = useRef();
  const editorPaneRef = useRef();
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
  useEffect(() => listPaneRef.current?.focus(), []);

  // NORMAL / INSERT and the active pane follow DOM focus.
  useEffect(() => {
    const onFocusChange = () => {
      const a = document.activeElement;
      setFocus({
        pane: editorPaneRef.current?.contains(a) ? "editor" : "list",
        insert: isTyping(a),
        capture: a === captureRef.current,
      });
    };
    // focusout fires before the next element gains focus — read it a tick later.
    const onFocusOut = () => setTimeout(onFocusChange, 0);
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

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

  // Keep a valid selection: honor a pending jump (search), else the first note.
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

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 7000);
    return () => clearTimeout(t);
  }, [flash]);

  // ---- actions -----------------------------------------------------------
  const focusList = () => listPaneRef.current?.focus();
  const focusCapture = () => {
    const el = captureRef.current;
    if (!el) return;
    el.focus();
    el.select();
  };
  const focusEditor = () => selectedRef.current && contentRef.current?.focus();
  const focusTitle = () => editorPaneRef.current?.querySelector(".title-input")?.focus();

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
    setFlash(`đã xoá "${note.title || "(không tiêu đề)"}"`);
  };

  // Uploads are placed inline by the block editor; these handle the network
  // part, warnings, and the case where the note was closed mid-upload.
  const upload = async (files) => {
    const added = await store.upload(files);
    if (added.some((a) => a.local)) {
      setFlash("file > 10MB lưu trên server ứng dụng (không phải CDN) — có thể mất khi server cập nhật, hãy giữ bản sao");
    }
    return added;
  };
  const appendUploads = (note, atts) => {
    const inView = notesRef.current.find((n) => n.id === note.id);
    const cur = inView || store.peekDay(note.date).find((n) => n.id === note.id);
    if (!cur) return;
    const md = attachmentsToMarkdown(atts);
    const content = cur.content ? `${cur.content}\n${md}` : md;
    if (inView) update(note.id, { content }, true);
    else store.save({ ...cur, content });
  };

  const moveSelection = (delta) => {
    const list = notesRef.current;
    if (!list.length) return;
    const i = list.findIndex((n) => n.id === selectedRef.current?.id);
    const to = delta === Infinity ? list.length - 1 : delta === -Infinity ? 0 : (i < 0 ? -1 : i) + delta;
    commitAll();
    setSelectedId(list[Math.max(0, Math.min(list.length - 1, to))].id);
  };

  const pickSearch = (n) => {
    setSearchOpen(false);
    pendingSelect.current = n.id;
    if (n.date === dateRef.current) setSelectedId(n.id);
    else goDate(n.date);
    focusList(); // synchronously — a deferred focus could steal it from a newly opened overlay
  };

  const cycleTheme = () => {
    // Read the live value: fast repeated T presses can outrun the re-render.
    const t = nextTheme(document.documentElement.dataset.theme || theme);
    applyTheme(t);
    setTheme(t);
  };

  // ---- keyboard ----------------------------------------------------------
  const selected = notes.find((n) => n.id === selectedId) || null;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // One window listener that always calls the handler from the latest render:
  // re-subscribing in an effect runs after paint, so a fast second key (e.g.
  // "y" right after "d") could otherwise hit a handler with stale state.
  const keyHandler = useRef();
  useEffect(() => {
    const onKey = (e) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const confirmRef = useRef(false);
  confirmRef.current = confirmDelete;
  const askDelete = () => {
    confirmRef.current = true;
    setConfirmDelete(true);
  };

  keyHandler.current = (e) => {
      const k = e.key;
      // Global chords — work in every mode.
      if (k === "F1" || (e.ctrlKey && k === "/")) {
        e.preventDefault();
        setSearchOpen(false);
        return setHelpOpen((v) => !v);
      }
      if (e.ctrlKey && !e.altKey && /^[kKpP]$/.test(k)) {
        e.preventDefault();
        setHelpOpen(false);
        return setSearchOpen(true);
      }
      if (e.ctrlKey && !e.altKey && /^[nN]$/.test(k)) {
        e.preventDefault();
        return focusCapture();
      }
      if ((e.ctrlKey && /^[rR]$/.test(k)) || k === "F5") {
        e.preventDefault(); // no webview reload — refetch instead
        return load(dateRef.current);
      }
      if (e.altKey && (k === "ArrowLeft" || k === "ArrowRight")) {
        e.preventDefault();
        return goDate(shiftDay(dateRef.current, k === "ArrowLeft" ? -1 : 1));
      }
      if (e.altKey && k === "Home") {
        e.preventDefault();
        return goDate(todayKey());
      }
      if (e.altKey && (k === "ArrowUp" || k === "ArrowDown")) {
        e.preventDefault();
        return moveSelection(k === "ArrowUp" ? -1 : 1);
      }
      if (searchOpen || helpOpen) return;

      const active = document.activeElement;
      // INSERT → NORMAL
      if (k === "Escape" && editorPaneRef.current?.contains(active)) {
        e.preventDefault();
        commitAll();
        return focusList();
      }
      if (isTyping(active) || e.ctrlKey || e.altKey || e.metaKey) return;

      // NORMAL mode (vim-style)
      const sel = selectedRef.current;
      if (confirmRef.current) {
        e.preventDefault();
        confirmRef.current = false;
        if ((k === "y" || k === "Y") && sel) remove(sel);
        return setConfirmDelete(false);
      }
      const act = {
        j: () => moveSelection(1),
        ArrowDown: () => moveSelection(1),
        k: () => moveSelection(-1),
        ArrowUp: () => moveSelection(-1),
        g: () => moveSelection(-Infinity),
        G: () => moveSelection(Infinity),
        Enter: focusEditor,
        i: focusEditor,
        l: focusEditor,
        2: focusEditor,
        1: focusList,
        e: focusTitle,
        n: focusCapture,
        o: focusCapture,
        x: () => sel && update(sel.id, { isCompleted: !sel.isCompleted }, true),
        d: () => sel && askDelete(),
        "[": () => goDate(shiftDay(dateRef.current, -1)),
        "]": () => goDate(shiftDay(dateRef.current, 1)),
        t: () => goDate(todayKey()),
        c: () => dateInputRef.current?.showPicker?.(),
        "/": () => setSearchOpen(true),
        "?": () => setHelpOpen(true),
        T: cycleTheme,
        r: () => load(dateRef.current),
        q: () => hideWindow(),
      }[k];
      if (act) {
        e.preventDefault();
        act();
      }
  };

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
  const isToday = date === todayKey();
  const showEditorOnly = isNarrow && selected;
  const doneCount = notes.filter((n) => n.isCompleted).length;
  const mode = focus.insert ? "INSERT" : "NORMAL";
  const hint = focus.capture ? HINTS.capture : focus.pane === "editor" && focus.insert ? HINTS.editor : HINTS.list;

  let syncLabel = "synced";
  if (sync.status === "syncing") syncLabel = "syncing…";
  else if (sync.status === "offline") syncLabel = `offline · ${sync.pending} pending`;
  else if (sync.status === "error") syncLabel = sync.lastError;
  else if (sync.pending) syncLabel = "saving…";

  return (
    <div class={`tui${showEditorOnly ? " editor-only" : ""}`}>
      <div class="tui-body">
        <section
          class={`pane pane-list${focus.pane === "list" ? " focused" : ""}`}
          ref={listPaneRef}
          tabIndex={-1}
          onMouseDown={(e) => !isTyping(e.target) && e.target.tagName !== "BUTTON" && requestAnimationFrame(focusList)}
        >
          <span class="pane-title">
            <kbd>1</kbd>NOTES
            <button class="title-btn" title="Ngày trước ([)" onClick={() => goDate(shiftDay(date, -1))}>‹</button>
            <button class="title-btn date" title="Chọn ngày (c)" onClick={() => dateInputRef.current?.showPicker?.()}>
              {formatDayLabel(date)}
            </button>
            <button class="title-btn" title="Ngày sau (])" onClick={() => goDate(shiftDay(date, 1))}>›</button>
            {isToday ? <span class="title-dim">today</span> : (
              <button class="title-btn" title="Về hôm nay (t)" onClick={() => goDate(todayKey())}>today</button>
            )}
            {loading && <span class="title-dim spin">◌</span>}
          </span>
          <input
            ref={dateInputRef}
            type="date"
            class="hidden-date"
            value={date}
            onChange={(e) => e.currentTarget.value && goDate(e.currentTarget.value)}
            tabIndex={-1}
          />
          <label class="capture-line">
            <span class="prompt">❯</span>
            <input
              ref={captureRef}
              class="capture"
              value={capture}
              placeholder="ghi nhanh… (n)"
              onInput={(e) => setCapture(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && capture.trim()) {
                  e.preventDefault();
                  create(capture.trim(), { openEditor: e.shiftKey });
                  setCapture("");
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  if (capture) setCapture("");
                  else hideWindow();
                } else if (e.key === "ArrowDown" && !capture) {
                  e.preventDefault();
                  focusList();
                }
              }}
            />
          </label>
          {loadError && !notes.length && <div class="load-error">! {loadError}</div>}
          <NoteList
            notes={notes}
            selectedId={selectedId}
            onSelect={(id) => {
              commitAll();
              setSelectedId(id);
            }}
            onOpen={(id) => {
              setSelectedId(id);
              requestAnimationFrame(() => contentRef.current?.focus());
            }}
            onToggleDone={(n) => update(n.id, { isCompleted: !n.isCompleted }, true)}
          />
        </section>

        <section class={`pane pane-editor${focus.pane === "editor" ? " focused" : ""}`} ref={editorPaneRef}>
          <span class="pane-title">
            <kbd>2</kbd>EDITOR
            {isNarrow && selected && (
              <button class="title-btn" onClick={() => setSelectedId(null)}>‹ back</button>
            )}
          </span>
          <Editor
            key={selected?.id}
            note={selected}
            contentRef={contentRef}
            onChange={(patch, immediate) => selected && update(selected.id, patch, immediate)}
            onCommit={() => selected && dirty.current.has(selected.id) && commit(selected.id)}
            onDelete={() => selected && askDelete()}
            onUpload={upload}
            onUploadError={(err) => setFlash(describeUploadError(err))}
            onOrphanUpload={appendUploads}
            onRemoveAttachment={(url) =>
              selected &&
              update(selected.id, { attachments: (selected.attachments || []).filter((a) => a.url !== url) }, true)
            }
          />
        </section>
      </div>

      <footer class="tui-status">
        <span class={`mode ${mode.toLowerCase()}`}>{mode}</span>
        <span class="chip">◈ {focus.pane === "editor" ? "EDITOR" : "NOTES"}</span>
        {confirmDelete && selected ? (
          <span class="status-main danger">
            delete "{selected.title || "(không tiêu đề)"}"?{" "}
            <button class="chip danger" onClick={() => { remove(selected); setConfirmDelete(false); }}>Yes (y)</button>{" "}
            <button class="chip" onClick={() => setConfirmDelete(false)}>No (n / Esc)</button>
          </span>
        ) : flash ? (
          <span class="status-main flash" onClick={() => setFlash("")}>{flash}</span>
        ) : (
          <span class="status-main hint">{hint}</span>
        )}
        <span class="dim">{notes.length} notes · {doneCount} done</span>
        <span class={`sync ${sync.status}${sync.pending ? " pending" : ""}`} title={sync.lastError || ""}>● {syncLabel}</span>
        <button class="chip" title="Đổi theme (T)" onClick={cycleTheme}>◐ {theme}</button>
        <button class="chip" title="Trợ giúp (?)" onClick={() => setHelpOpen(true)}>?</button>
        <button class="chip" title="Đăng xuất" onClick={onSignOut}>{tokenUserName(token) || "user"} ⏻</button>
      </footer>

      {helpOpen && <HelpPanel onClose={() => { setHelpOpen(false); focusList(); }} />}
      {searchOpen && (
        <SearchPalette store={store} onPick={pickSearch} onClose={() => { setSearchOpen(false); focusList(); }} />
      )}
    </div>
  );
}
