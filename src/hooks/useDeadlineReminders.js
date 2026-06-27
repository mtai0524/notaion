import { useEffect, useRef } from 'react';
import axiosInstance from '../axiosConfig';
import {
  computeDueReminders,
  loadFiredSet,
  saveFiredSet,
  markKey,
} from '../utils/deadlineReminders';
// TEMPORARY: frontend-only deadline overlay until the backend migration lands.
import { overlayDeadlines, markLocalReminderDone } from '../utils/deadlineLocalStore';

const POLL_MS = 30 * 1000;

// App-wide deadline scheduler. Mount once near the app root.
// `enabled` gates polling (e.g. only when logged in).
export const useDeadlineReminders = (enabled) => {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        // The API call may fail or omit deadline fields; the local overlay
        // still drives reminders. Don't let a fetch error skip the overlay.
        let apiNotes = [];
        try {
          const res = await axiosInstance.get('/api/DailyNote/all');
          apiNotes = Array.isArray(res.data) ? res.data : [];
        } catch (err) {
          console.warn('[reminders] /all fetch failed, using local overlay only', err);
        }
        const notes = overlayDeadlines(apiNotes);
        const now = new Date();
        const fired = loadFiredSet();
        let changed = false;

        for (const note of notes) {
          const due = computeDueReminders(note, now, fired);
          for (const kind of due) {
            window.dispatchEvent(
              new CustomEvent('notaion:deadline-reminder', {
                detail: {
                  noteId: note.id,
                  title: note.title || note.content || 'Untitled note',
                  date: note.date,
                  deadline: note.deadline,
                  kind,
                },
              })
            );
            fired.add(markKey(note.id, kind));
            changed = true;
          }
          if (due.includes('due')) {
            // TEMPORARY: mark done in the local overlay (backend can't store it yet).
            markLocalReminderDone(note.id);
            try {
              await axiosInstance.post('/api/DailyNote', { ...note, reminderDone: true });
            } catch (err) {
              console.warn('[reminders] failed to mark reminderDone', err);
            }
          }
        }
        if (changed) saveFiredSet(fired);
      } catch (err) {
        console.warn('[reminders] poll failed', err);
      } finally {
        runningRef.current = false;
      }
    };

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, [enabled]);
};
