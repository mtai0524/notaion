import { useEffect } from 'react';
import * as signalR from '@microsoft/signalr';
import Cookies from 'js-cookie';
import jwt_decode from 'jwt-decode';
import config from '../../../config';

const userIdFromToken = () => {
  const token = Cookies.get('token');
  if (!token) return 'anonymous';
  try {
    return jwt_decode(token)['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
  } catch (err) {
    console.error('[SIGNALR] Token decode error:', err);
    return 'anonymous';
  }
};

// Merges a note pushed by the server into a day that is already loaded.
// Days not loaded yet are skipped: they fetch fresh when opened.
const upsertNote = (notesByDate, note) => {
  const list = notesByDate[note.date];
  if (!list) return notesByDate;
  const next = list.some((n) => n.id === note.id)
    ? list.map((n) => (n.id === note.id ? { ...n, ...note } : n))
    : [...list, note];
  return { ...notesByDate, [note.date]: next };
};

const removeNote = (notesByDate, noteId) => Object.fromEntries(
  Object.entries(notesByDate).map(([date, list]) => [date, list.filter((n) => n.id !== noteId)]),
);

// Keeps `notesByDate` in sync with changes made from other tabs/devices.
export const useNoteHub = (setNotesByDate) => {
  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${config.API_HOSTING}/dailyNoteHub`, {
        accessTokenFactory: () => Cookies.get('token'),
        withCredentials: true,
      })
      .withAutomaticReconnect()
      .build();

    const upsert = (note) => setNotesByDate((prev) => upsertNote(prev, note));

    connection.on('NoteCreated', upsert);
    connection.on('NoteRestored', upsert);
    connection.on('NoteUpdated', (note) => {
      if (note.isDeleted) setNotesByDate((prev) => removeNote(prev, note.id));
      else upsert(note);
    });
    connection.on('NoteDeleted', (noteId) => setNotesByDate((prev) => removeNote(prev, noteId)));
    connection.on('NotesBulkUpdated', (notes) => notes.forEach(upsert));

    connection.start()
      .then(() => connection.invoke('JoinGroup', userIdFromToken()))
      .catch((err) => console.error('[SIGNALR] Connection failed:', err));

    return () => { connection.stop(); };
  }, [setNotesByDate]);
};
