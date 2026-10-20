import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import debounce from 'lodash.debounce';
import axiosInstance from '../../../axiosConfig';
import { setLocalDeadline } from '../../../utils/deadlineLocalStore';
import { clearFiredForNote } from '../../../utils/deadlineReminders';
import DayToolbar from './DayToolbar';
import TuiView from './TuiView';
import { useNoteHub } from './useNoteHub';
import { notesToMarkdown, downloadTextFile, loadDayCounts, saveDayCounts } from './noteUtils';
import { exportAllNotes, describeExport } from './exportAll';
import { uploadFilesToCloudinary } from '../../../services/fileService';
import './DailyNoteApp.scss';

const CATEGORIES = ['SYSTEM', 'TASK', 'IDEA', 'LOG', 'MEMO'];
const FULLSCREEN_KEY = 'daily-note-fullscreen';

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed) ? null : parsed;
};

const DailyNoteApp = () => {
  const [searchParams] = useSearchParams();
  const urlDate = searchParams.get('date');

  const [currentDate, setCurrentDate] = useState(() => parseDate(urlDate) || new Date());
  const [notesByDate, setNotesByDate] = useState({});
  const [allNotes, setAllNotes] = useState([]);
  const [cachedDayCounts, setCachedDayCounts] = useState(loadDayCounts);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('saved');
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(() => localStorage.getItem(FULLSCREEN_KEY) === 'on');
  const rootRef = useRef(null);

  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const currentNotes = (notesByDate[dateKey] || []).filter((n) => !n.isDeleted);

  useEffect(() => {
    const parsed = parseDate(urlDate);
    if (parsed) setCurrentDate(parsed);
  }, [urlDate]);

  useEffect(() => {
    localStorage.setItem(FULLSCREEN_KEY, fullscreen ? 'on' : 'off');
    document.body.classList.toggle('dn-fullscreen', fullscreen);
    return () => document.body.classList.remove('dn-fullscreen');
  }, [fullscreen]);

  // Ctrl+Shift+F hides the site header + date toolbar so the TUI fills the screen.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key.toLowerCase() !== 'f') return;
      e.preventDefault();
      setFullscreen((v) => !v);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const setDayNotes = (date, update) => {
    setNotesByDate((prev) => ({ ...prev, [date]: update(prev[date] || []) }));
  };

  useNoteHub(setNotesByDate);

  useEffect(() => {
    const fetchNotesAsync = async () => {
      setLoading(true);
      try {
        const response = await axiosInstance.get(`/api/DailyNote/${dateKey}`);
        setNotesByDate((prev) => ({ ...prev, [dateKey]: response.data.filter((n) => !n.isDeleted) }));
      } catch (error) {
        console.error(`[DAILY-NOTE] Failed to fetch notes for ${dateKey}:`, error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotesAsync();
  }, [dateKey]);

  // Every note, all days: powers the calendar dots, Telescope and cross-day
  // [[links]]. Deferred until the browser is idle so it never delays first paint.
  const fetchAllNotesAsync = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/api/DailyNote/all');
      const notes = Array.isArray(response.data) ? response.data : [];
      const counts = {};
      notes.forEach((n) => { if (!n.isDeleted && n.date) counts[n.date] = (counts[n.date] || 0) + 1; });
      setAllNotes(notes);
      setCachedDayCounts(counts);
      saveDayCounts(counts);
    } catch (error) {
      console.error('[DAILY-NOTE] Failed to fetch all notes:', error);
    }
  }, []);

  useEffect(() => {
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => fetchAllNotesAsync(), { timeout: 3000 })
      : window.setTimeout(() => fetchAllNotesAsync(), 1200);
    return () => {
      if (window.requestIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [fetchAllNotesAsync]);

  // 'yyyy-MM-dd' -> note count. Days loaded this session win over the cache.
  const markedDates = useMemo(() => {
    const counts = { ...cachedDayCounts };
    Object.entries(notesByDate).forEach(([date, list]) => {
      counts[date] = list.filter((n) => !n.isDeleted).length;
    });
    Object.keys(counts).forEach((date) => { if (!counts[date]) delete counts[date]; });
    return counts;
  }, [cachedDayCounts, notesByDate]);

  const saveNotesToBackend = useCallback(
    debounce(async (notes) => {
      setSyncStatus('saving');
      try {
        await axiosInstance.post('/api/DailyNote/bulk', notes);
        setSyncStatus('saved');
      } catch (error) {
        console.error('[DAILY-NOTE] Auto-save failed:', error);
        setSyncStatus('error');
      }
    }, 1000),
    [],
  );

  const createNoteAsync = async (note) => {
    setDayNotes(note.date, (list) => [...list, note]);
    setSyncStatus('saving');
    try {
      await axiosInstance.post('/api/DailyNote', note);
      setSyncStatus('saved');
    } catch (error) {
      console.error('[DAILY-NOTE] Note creation failed:', error);
      setSyncStatus('error');
    }
    return note;
  };

  const addNoteAsync = (template = 'blank', overrides = {}) => createNoteAsync({
    id: uuidv4(),
    title: template === 'todo' ? 'TODO LIST' : '',
    content: template === 'todo' ? '- [ ] ' : '',
    category: template === 'todo' ? 'TASK' : 'MEMO',
    timestamp: format(new Date(), 'HH:mm:ss'),
    date: dateKey,
    isCompleted: false,
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const duplicateNote = (note) => {
    createNoteAsync({ ...note, id: uuidv4(), timestamp: format(new Date(), 'HH:mm:ss') });
  };

  const updateNote = (id, updates) => {
    const stamp = { updatedAt: new Date().toISOString() };
    setNotesByDate((prev) => {
      const updated = (prev[dateKey] || []).map((n) => (n.id === id ? { ...n, ...updates, ...stamp } : n));
      saveNotesToBackend(updated.map((n) => ({ ...n, date: dateKey })));
      return { ...prev, [dateKey]: updated };
    });
  };

  const deleteNoteAsync = async (id) => {
    setDayNotes(dateKey, (list) => list.filter((n) => n.id !== id));
    // Drop any locally stored deadline so the reminder engine forgets the note.
    setLocalDeadline(id, { deadline: null });
    clearFiredForNote(id);
    setSyncStatus('saving');
    try {
      await axiosInstance.delete(`/api/DailyNote/${id}`);
      setSyncStatus('saved');
    } catch (error) {
      console.error(`[DAILY-NOTE] Failed to delete note ${id}:`, error);
      setSyncStatus('error');
    }
  };

  const restoreNoteAsync = async (note) => {
    const restored = { ...note, isDeleted: false, updatedAt: new Date().toISOString() };
    setDayNotes(restored.date || dateKey, (list) => [...list.filter((n) => n.id !== note.id), restored]);
    setSyncStatus('saving');
    try {
      await axiosInstance.post(`/api/DailyNote/${note.id}/restore`);
      setSyncStatus('saved');
    } catch (error) {
      console.error(`[DAILY-NOTE] Failed to restore note ${note.id}:`, error);
      setSyncStatus('error');
    }
  };

  // Re-date a note: 0 = today, otherwise an offset from the viewed day.
  const moveNoteToDate = (id, dayOffset) => {
    const note = (notesByDate[dateKey] || []).find((n) => n.id === id);
    if (!note) return;
    const targetKey = format(dayOffset === 0 ? new Date() : addDays(currentDate, dayOffset), 'yyyy-MM-dd');
    if (targetKey === dateKey) return;
    const moved = { ...note, date: targetKey, updatedAt: new Date().toISOString() };
    setDayNotes(dateKey, (list) => list.filter((n) => n.id !== id));
    setDayNotes(targetKey, (list) => [...list, moved]);
    saveNotesToBackend([moved]);
  };

  const exportAllWithSummaryAsync = async (fileFormat, options) => describeExport(await exportAllNotes(fileFormat, options));

  const exportDay = () => {
    downloadTextFile(`daily-note-${dateKey}.md`, notesToMarkdown(dateKey, currentNotes));
  };

  const exportEverythingAsync = async (fileFormat) => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportAllNotes(fileFormat);
      if (result.stats.failed.length) alert(describeExport(result));
    } catch (err) {
      console.error('[DAILY-NOTE] Export failed:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Fill from this container's top edge to the viewport bottom so the TUI
  // panels scroll internally instead of the page. No bottom gap: the status
  // bar lines up with the floating chat button (10px from the bottom).
  useEffect(() => {
    const apply = () => {
      const el = rootRef.current;
      if (!el) return;
      const height = Math.max(0, Math.round(window.innerHeight - el.getBoundingClientRect().top));
      el.style.setProperty('--dn-avail-h', `${height}px`);
    };
    apply();
    window.addEventListener('resize', apply);
    const timer = setTimeout(apply, 300);
    return () => {
      window.removeEventListener('resize', apply);
      clearTimeout(timer);
    };
  }, [fullscreen]);

  return (
    <div ref={rootRef} className={`daily-note-app ${fullscreen ? 'app-fullscreen' : ''}`}>
      <DayToolbar
        date={currentDate}
        markedDates={markedDates}
        syncStatus={syncStatus}
        exporting={exporting}
        canExportDay={currentNotes.length > 0}
        onDateChange={setCurrentDate}
        onExportDay={exportDay}
        onExportAll={exportEverythingAsync}
      />

      <main className="dn-main">
        <TuiView
          notes={currentNotes}
          onAdd={addNoteAsync}
          onUpdate={updateNote}
          onDelete={deleteNoteAsync}
          onDuplicate={duplicateNote}
          onMoveToDate={moveNoteToDate}
          onChangeDate={(days) => setCurrentDate((d) => addDays(d, days))}
          dateLabel={dateKey}
          categories={CATEGORIES}
          allNotes={allNotes}
          markedDates={markedDates}
          onRestore={restoreNoteAsync}
          onGoToDate={setCurrentDate}
          loading={loading}
          syncStatus={syncStatus}
          fullscreenOn={fullscreen}
          onToggleFullscreen={() => setFullscreen((v) => !v)}
          onUploadFiles={uploadFilesToCloudinary}
          onExportAll={exportAllWithSummaryAsync}
          onDownload={downloadTextFile}
        />
      </main>
    </div>
  );
};

export default DailyNoteApp;
