import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteItemAsync, fetchItemsAsync, saveItemAsync, saveItemsAsync, syncErrorMessage } from './englishApi';

// The server is the source of truth (so the notaion MCP server sees the same
// data); localStorage is a cache for the first paint.
export const ENGLISH_KEY = 'english-data';
// Set once this browser's pre-sync data has been uploaded.
export const SYNCED_KEY = 'english-synced';
const EMPTY = { cards: [], sentences: [], texts: [], writings: [] };
const SAVE_DELAY_MS = 600;

export const loadData = () => {
  try {
    const raw = localStorage.getItem(ENGLISH_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch (err) {
    console.error('[ENGLISH] Could not read cached data:', err);
    return EMPTY;
  }
};

const cacheData = (data) => {
  try {
    localStorage.setItem(ENGLISH_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('[ENGLISH] Could not cache data:', err);
  }
};

const countItems = (data) => Object.values(data).reduce((sum, items) => sum + items.length, 0);

// Uploads data saved in this browser before sync existed, then reads the server.
const loadFromServerAsync = async () => {
  if (!localStorage.getItem(SYNCED_KEY)) {
    const local = loadData();
    if (countItems(local) > 0) await saveItemsAsync(local);
    localStorage.setItem(SYNCED_KEY, '1');
  }
  return { ...EMPTY, ...(await fetchItemsAsync()) };
};

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const useEnglishData = () => {
  const [data, setData] = useState(loadData);
  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState('');
  const dataRef = useRef(data);
  const timers = useRef(new Map());
  dataRef.current = data;

  const report = useCallback((err) => {
    console.error('[ENGLISH] Sync failed:', err);
    setSyncError(syncErrorMessage(err));
  }, []);

  const runAsync = useCallback(async (request) => {
    try {
      await request();
      setSyncError('');
    } catch (err) {
      report(err);
    }
  }, [report]);

  const saveNow = useCallback((list, id) => {
    timers.current.delete(id);
    const item = dataRef.current[list].find((entry) => entry.id === id);
    if (item) runAsync(() => saveItemAsync(list, item));
  }, [runAsync]);

  useEffect(() => {
    cacheData(data);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    loadFromServerAsync()
      .then((server) => { if (!cancelled) setData(server); })
      .catch(report)
      .finally(() => { if (!cancelled) setSyncing(false); });
    return () => { cancelled = true; };
  }, [report]);

  // Leaving the page sends edits still waiting for their debounce.
  useEffect(() => () => {
    timers.current.forEach(({ timer, list }, id) => {
      clearTimeout(timer);
      saveNow(list, id);
    });
  }, [saveNow]);

  // Returns the new item's id.
  const add = useCallback((list, fields) => {
    const item = { id: newId(), createdAt: Date.now(), ...fields };
    setData((current) => ({ ...current, [list]: [item, ...current[list]] }));
    runAsync(() => saveItemAsync(list, item));
    return item.id;
  }, [runAsync]);

  // Saved after SAVE_DELAY_MS without further edits to the same item.
  const update = useCallback((list, id, patch) => {
    const next = { ...dataRef.current, [list]: dataRef.current[list].map((item) => (item.id === id ? { ...item, ...patch } : item)) };
    dataRef.current = next;
    setData(next);
    clearTimeout(timers.current.get(id)?.timer);
    timers.current.set(id, { list, timer: setTimeout(() => saveNow(list, id), SAVE_DELAY_MS) });
  }, [saveNow]);

  const remove = useCallback((list, id) => {
    clearTimeout(timers.current.get(id)?.timer);
    timers.current.delete(id);
    setData((current) => ({ ...current, [list]: current[list].filter((item) => item.id !== id) }));
    runAsync(() => deleteItemAsync(list, id));
  }, [runAsync]);

  return { data, syncing, syncError, add, update, remove };
};
