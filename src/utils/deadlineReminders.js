const STORAGE_KEY = 'daily-note-reminders-fired';

export const markKey = (noteId, kind) => `${noteId}:${kind}`;

export const loadFiredSet = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

export const saveFiredSet = (set) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* quota — ignore */
  }
};

export const clearFiredForNote = (noteId) => {
  const set = loadFiredSet();
  set.delete(markKey(noteId, 'lead'));
  set.delete(markKey(noteId, 'due'));
  saveFiredSet(set);
};

// Pure: which reminder marks should fire for this note at `now`,
// excluding marks already in firedSet.
export const computeDueReminders = (note, now, firedSet) => {
  if (!note || !note.deadline || note.reminderDone || note.isCompleted) return [];

  const deadlineMs = new Date(note.deadline).getTime();
  if (Number.isNaN(deadlineMs)) return [];
  const nowMs = now.getTime();

  const out = [];
  const lead = note.reminderLeadMinutes;
  if (typeof lead === 'number' && lead > 0) {
    const leadMs = deadlineMs - lead * 60 * 1000;
    if (nowMs >= leadMs && !firedSet.has(markKey(note.id, 'lead'))) {
      out.push('lead');
    }
  }
  if (nowMs >= deadlineMs && !firedSet.has(markKey(note.id, 'due'))) {
    out.push('due');
  }
  return out;
};
