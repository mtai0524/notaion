// Desktop daily view: the web app's TUI (TuiView + DayToolbar, run through
// preact/compat) wired to the desktop store — local cache, offline outbox,
// Tauri downloads and the Ctrl+Alt+N quick capture.
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import TuiView from "../../../src/components/pages/Note/TuiView.jsx";
import DayToolbar from "../../../src/components/pages/Note/DayToolbar.jsx";
import "../../../src/components/pages/Note/DailyNoteApp.scss";
import { buildExport, notesToMarkdown } from "../../../shared/exportNotes.js";
import { getFetch } from "../lib/api.js";
import { buildNote } from "../lib/notes.js";
import { nowTime, parseKey, shiftDay, todayKey } from "../lib/dates.js";
import { tokenUserName } from "../lib/jwt.js";
import { onQuickCapture, saveDownload } from "../lib/native.js";

// Same folders as the web TUI.
const CATEGORIES = ["SYSTEM", "TASK", "IDEA", "LOG", "MEMO"];
const FOCUS_REFRESH_MS = 15_000;

// store status (idle | syncing | offline | error) → toolbar sync label
const SYNC_STATUS = { idle: "saved", syncing: "saving", offline: "offline", error: "error" };

const describeExport = (filename, stats) => {
  const parts = [`saved ${filename} to Downloads`, `${stats.notes} notes`];
  if (stats.files) parts.push(`${stats.files} files`);
  if (stats.failed.length) parts.push(`${stats.failed.length} file(s) not downloaded — original links kept`);
  return parts.join(" · ");
};

export function TuiApp({ store, token, onSignOut }) {
  const [date, setDate] = useState(todayKey);
  const [notes, setNotes] = useState(() => store.peekDay(todayKey()));
  const [allNotes, setAllNotes] = useState(() => store.peekAll());
  const [status, setStatus] = useState(() => store.getStatus().status);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [newNoteSignal, setNewNoteSignal] = useState(0);
  const dateRef = useRef(date);
  dateRef.current = date;
  const lastLoad = useRef(0);

  const refresh = useCallback(() => {
    setNotes(store.peekDay(dateRef.current));
    setAllNotes(store.peekAll());
  }, [store]);

  useEffect(() => store.subscribe(() => {
    setStatus(store.getStatus().status);
    refresh();
  }), [store, refresh]);
  useEffect(() => void store.flush(), [store, token]);

  const loadAsync = useCallback(async (day) => {
    lastLoad.current = Date.now();
    setLoading(true);
    try {
      await store.fetchDay(day);
      if (day === dateRef.current) setNotes(store.peekDay(day));
    } catch (err) {
      console.error(`[DESKTOP] Failed to load ${day}:`, err);
    } finally {
      if (day === dateRef.current) setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    setNotes(store.peekDay(date)); // instant paint from cache
    loadAsync(date);
  }, [date, loadAsync, store]);

  // Search / calendar / [[links]] corpus, refreshed in the background.
  useEffect(() => {
    store.fetchAll().then(setAllNotes).catch((err) => console.warn("[DESKTOP] Could not refresh all notes:", err));
  }, [store, token]);

  // Refresh when the window regains focus; roll "today" over after midnight.
  useEffect(() => {
    let lastToday = todayKey();
    const onFocus = () => {
      const today = todayKey();
      if (today !== lastToday && dateRef.current === lastToday) setDate(today);
      lastToday = today;
      if (Date.now() - lastLoad.current > FOCUS_REFRESH_MS) loadAsync(dateRef.current);
      store.flush();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadAsync, store]);

  // Ctrl+Alt+N (Rust shows the window): jump to today and open a new note.
  useEffect(() => {
    let off = () => {};
    onQuickCapture(() => {
      setDate(todayKey());
      setNewNoteSignal((n) => n + 1);
    }).then((fn) => (off = fn));
    return () => off();
  }, []);

  const findNote = (id) => store.peekDay(dateRef.current).find((n) => n.id === id);
  const save = (note) => {
    store.save(note);
    refresh();
  };

  const addNote = (template = "blank", overrides = {}) => {
    const isTodo = template === "todo";
    const note = {
      ...buildNote({
        title: isTodo ? "TODO LIST" : "",
        content: isTodo ? "- [ ] " : "",
        category: isTodo ? "TASK" : "MEMO",
        date: dateRef.current,
      }),
      ...overrides,
    };
    save(note);
    return note;
  };

  const updateNote = (id, patch) => {
    const note = findNote(id);
    if (note) save({ ...note, ...patch });
  };

  const deleteNote = (id) => {
    const note = findNote(id);
    if (!note) return;
    store.remove(note);
    refresh();
  };

  const duplicateNote = (note) => {
    const { id } = buildNote({ date: note.date });
    save({ ...note, id, timestamp: nowTime() });
  };

  // 0 = today, otherwise an offset from the viewed day.
  const moveNoteToDate = (id, offset) => {
    const note = findNote(id);
    const target = offset === 0 ? todayKey() : shiftDay(dateRef.current, offset);
    if (note && target !== note.date) save({ ...note, date: target });
  };

  const restoreNote = (note) => save({ ...note, isDeleted: false });

  const markedDates = useMemo(() => {
    const counts = {};
    allNotes.forEach((n) => { if (!n.isDeleted && n.date) counts[n.date] = (counts[n.date] || 0) + 1; });
    counts[date] = notes.length;
    if (!counts[date]) delete counts[date];
    return counts;
  }, [allNotes, notes, date]);

  const uploadFilesAsync = async (files) => (await store.upload(files)).map((a) => ({
    originalName: a.name,
    cloudUrl: a.url,
    contentType: a.contentType,
  }));

  const exportAllAsync = async (format, { onProgress } = {}) => {
    const all = await store.fetchAllFull();
    if (!all.length) throw new Error("no notes to export");
    const result = await buildExport(all, { format, fetchImpl: await getFetch(), onProgress });
    await saveDownload(result.filename, result.data, result.mime);
    return describeExport(result.filename, result.stats);
  };

  const downloadText = (filename, text) => saveDownload(filename, text, "text/markdown");

  // Toolbar export: surface the result in an alert (the TUI flashes its own).
  const runToolbarExportAsync = async (run) => {
    if (exporting) return;
    setExporting(true);
    try {
      alert(await run());
    } catch (err) {
      console.error("[DESKTOP] Export failed:", err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div class="daily-note-app dsk-app">
      <DayToolbar
        date={parseKey(date)}
        markedDates={markedDates}
        syncStatus={SYNC_STATUS[status] || "saved"}
        exporting={exporting}
        canExportDay={notes.length > 0}
        onDateChange={(d) => setDate(todayKey(d))}
        onExportDay={() => runToolbarExportAsync(async () => {
          await downloadText(`daily-note-${date}.md`, notesToMarkdown(date, notes));
          return `saved daily-note-${date}.md to Downloads`;
        })}
        onExportAll={(format) => runToolbarExportAsync(() => exportAllAsync(format))}
      >
        <button type="button" class="dsk-signout" title="Sign out" onClick={onSignOut}>
          @{tokenUserName(token) || "you"} ⏻
        </button>
      </DayToolbar>
      <main class="dn-main">
        <TuiView
          notes={notes}
          onAdd={addNote}
          onUpdate={updateNote}
          onDelete={deleteNote}
          onDuplicate={duplicateNote}
          onMoveToDate={moveNoteToDate}
          onChangeDate={(delta) => setDate((d) => shiftDay(d, delta))}
          dateLabel={date}
          categories={CATEGORIES}
          allNotes={allNotes}
          markedDates={markedDates}
          onRestore={restoreNote}
          onGoToDate={(d) => setDate(todayKey(d))}
          loading={loading}
          syncStatus={status === "syncing" ? "saving" : "saved"}
          onUploadFiles={uploadFilesAsync}
          onExportAll={exportAllAsync}
          onDownload={downloadText}
          newNoteSignal={newNoteSignal}
        />
      </main>
    </div>
  );
}
