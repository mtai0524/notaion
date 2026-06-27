// TEMPORARY frontend-only deadline store.
//
// The backend `DailyNotes` table does not yet have the Deadline /
// ReminderLeadMinutes / ReminderDone columns (the EF migration has not been
// applied), so deadlines set on a note are silently dropped by the API.
//
// This module persists those fields in localStorage so the reminder
// notification flow can be tested end-to-end on the frontend alone.
//
// REMOVE this file and its call sites once the backend migration is applied
// and `/api/DailyNote/all` returns the deadline fields. See:
//   - src/hooks/useDeadlineReminders.js  (overlayDeadlines / markOverlayDone)
//   - src/components/pages/Note/DailyNoteApp.jsx (handleSetDeadline / handleSetLead)

const KEY = 'daily-note-deadlines-local';

const readAll = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeAll = (map) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota — ignore */
  }
};

// Merge deadline fields for one note. Pass deadline:null to clear the entry.
export const setLocalDeadline = (noteId, fields) => {
  if (!noteId) return;
  const map = readAll();
  if (fields.deadline === null) {
    delete map[noteId];
  } else {
    map[noteId] = { ...(map[noteId] || {}), ...fields };
  }
  writeAll(map);
};

export const markLocalReminderDone = (noteId) => {
  const map = readAll();
  if (map[noteId]) {
    map[noteId] = { ...map[noteId], reminderDone: true };
    writeAll(map);
  }
};

// Overlay the local deadline fields onto the notes fetched from the API.
// Notes that only exist in the local store (e.g. not yet round-tripped) are
// appended so they still get reminders.
export const overlayDeadlines = (notes) => {
  const map = readAll();
  const byId = new Map(notes.map((n) => [n.id, n]));
  const merged = notes.map((n) =>
    map[n.id] ? { ...n, ...map[n.id] } : n
  );
  for (const [id, fields] of Object.entries(map)) {
    if (!byId.has(id)) {
      merged.push({ id, title: 'Note', date: '', ...fields });
    }
  }
  return merged;
};
