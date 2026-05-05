import React, { useState, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, subDays } from 'date-fns';
import { 
  FaPlus, FaChevronLeft, FaChevronRight, FaTimes, 
  FaPalette, FaClock, FaTerminal, FaSun, FaMoon 
} from 'react-icons/fa';
import * as signalR from '@microsoft/signalr';
import Cookies from 'js-cookie';
import jwt_decode from 'jwt-decode';
import config from '../../../config';
import axiosInstance from '../../../axiosConfig';
import debounce from 'lodash.debounce';
import './DailyNoteApp.scss';

const COLORS = [
  { id: 'cyan', color: '#89ddff', rgb: '137, 221, 255' },
  { id: 'green', color: '#c3e88d', rgb: '195, 232, 141' },
  { id: 'yellow', color: '#ffcb6b', rgb: '255, 203, 107' },
  { id: 'pink', color: '#ff5370', rgb: '255, 83, 112' },
  { id: 'purple', color: '#c792ea', rgb: '199, 146, 234' },
  { id: 'white', color: '#a6accd', rgb: '166, 172, 205' },
];

const CATEGORIES = ['SYSTEM', 'TASK', 'IDEA', 'LOG', 'MEMO'];

const Note = ({ note, onUpdate, onDelete, onFocus }) => {
  const theme = COLORS.find(c => c.id === note.color) || COLORS[0];

  const cycleColor = (e) => {
    e.stopPropagation();
    const currentIndex = COLORS.findIndex(c => c.id === note.color);
    const nextIndex = (currentIndex + 1) % COLORS.length;
    onUpdate(note.id, { color: COLORS[nextIndex].id });
  };

  return (
    <Rnd
      size={{ width: note.width, height: note.height }}
      position={{ x: note.x, y: note.y }}
      onDragStop={(e, d) => onUpdate(note.id, { x: d.x, y: d.y })}
      onResizeStop={(e, direction, ref, delta, position) => {
        onUpdate(note.id, {
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          ...position,
        });
      }}
      dragHandleClassName="note-header"
      bounds="parent"
      minWidth={200}
      minHeight={150}
      style={{ zIndex: note.zIndex }}
      onDragStart={() => onFocus(note.id)}
      onResizeStart={() => onFocus(note.id)}
    >
      <div 
        className={`daily-note-card-cyber ${note.isFocused ? 'is-focused' : ''} ${note.isDeleting ? 'deleting' : ''}`}
        data-category={note.category}
        style={{ 
          '--accent-color': theme.color,
          '--accent-rgb': theme.rgb
        }}
        onClick={() => onFocus(note.id)}
      >
        <div className="note-header">
          <div className="header-left">
             <span className="timestamp">[ {note.timestamp} ]</span>
          </div>
          <div className="header-actions">
            <button className="action-btn color-btn" onClick={cycleColor}>
              <FaPalette />
            </button>
            <button className="action-btn delete-btn" onClick={() => onDelete(note.id)}>
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="note-body">
          <input 
            className="note-title-input"
            value={note.title || ''}
            onChange={(e) => onUpdate(note.id, { title: e.target.value })}
            placeholder=":: ENTRY_TITLE"
          />
          
          <textarea 
            className="note-content-area"
            value={note.content || ''}
            onChange={(e) => onUpdate(note.id, { content: e.target.value })}
            placeholder="> waiting for input..."
          />
        </div>
      </div>
    </Rnd>
  );
};

const DailyNoteApp = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notesByDate, setNotesByDate] = useState({});
  const [topZIndex, setTopZIndex] = useState(10);
  const [selectedColor, setSelectedColor] = useState('cyan');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('daily-note-theme') || 'dark');
  const [connection, setConnection] = useState(null);
  const [userId, setUserId] = useState(null);
  
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const currentNotes = notesByDate[dateKey] || [];

  // Initialize Connection and Auth
  useEffect(() => {
    const token = Cookies.get('token');
    let uId = 'anonymous';
    if (token) {
      try {
        const decoded = jwt_decode(token);
        uId = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
      } catch (err) {
        console.error("Token decode error:", err);
      }
    }
    setUserId(uId);

    const hubUrl = `${config.API_LOCAL}/dailyNoteHub`;
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('daily-note-theme', newTheme);
  };

  // Handle SignalR listeners
  useEffect(() => {
    if (connection && userId) {
      connection.start()
        .then(() => {
          console.log("[SIGNALR] Connected to DailyNoteHub");
          connection.invoke("JoinGroup", userId);

          connection.on("NoteCreated", (newNote) => {
            if (newNote.date === dateKey) {
              setNotesByDate(prev => {
                const existing = prev[dateKey] || [];
                if (existing.some(n => n.id === newNote.id)) return prev;
                return { ...prev, [dateKey]: [...existing, { ...newNote, isFocused: false, isDeleting: false }] };
              });
            }
          });

          connection.on("NoteUpdated", (updatedNote) => {
            if (updatedNote.date === dateKey) {
              setNotesByDate(prev => {
                const updated = (prev[dateKey] || []).map(n => n.id === updatedNote.id ? { ...n, ...updatedNote } : n);
                return { ...prev, [dateKey]: updated };
              });
            }
          });

          connection.on("NoteDeleted", (noteId) => {
            setNotesByDate(prev => ({
              ...prev,
              [dateKey]: (prev[dateKey] || []).filter(n => n.id !== noteId)
            }));
          });

          connection.on("NotesBulkUpdated", (notes) => {
            if (notes.length > 0 && notes[0].date === dateKey) {
              setNotesByDate(prev => {
                const current = prev[dateKey] || [];
                const updated = current.map(cn => {
                  const match = notes.find(n => n.id === cn.id);
                  return match ? { ...cn, ...match } : cn;
                });
                return { ...prev, [dateKey]: updated };
              });
            }
          });
        })
        .catch(err => console.error("[SIGNALR] Connection failed:", err));

      return () => {
        connection.stop();
      };
    }
  }, [connection, userId, dateKey]);

  const fetchNotes = async (date) => {
    console.log(`[SYSTEM] Syncing notes for ${date}...`);
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/api/DailyNote/${date}`);
      setNotesByDate(prev => ({
        ...prev,
        [date]: response.data.map(n => ({ ...n, isFocused: false, isDeleting: false }))
      }));
      
      if (response.data.length > 0) {
        const maxZ = Math.max(...response.data.map(n => n.zIndex));
        setTopZIndex(prev => Math.max(prev, maxZ));
      }
    } catch (error) {
      console.error("[ERROR] Failed to fetch notes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes(dateKey);
  }, [dateKey]);

  const saveNotesToBackend = useCallback(
    debounce(async (notes) => {
      console.log("[SYSTEM] Auto-saving changes...");
      try {
        const cleanNotes = notes.map(({ isFocused, isDeleting, ...rest }) => rest);
        await axiosInstance.post('/api/DailyNote/bulk', cleanNotes);
      } catch (error) {
        console.error("[ERROR] Auto-save failed:", error);
      }
    }, 1000),
    []
  );

  const addNote = async () => {
    const newNote = {
      id: uuidv4(),
      title: '',
      content: '',
      color: selectedColor,
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      timestamp: format(new Date(), 'HH:mm:ss'),
      date: dateKey,
      x: 50 + (currentNotes.length * 30) % 400,
      y: 100 + (currentNotes.length * 30) % 300,
      width: 250,
      height: 200,
      zIndex: topZIndex + 1,
      isFocused: true
    };
    
    setTopZIndex(prev => prev + 1);
    setNotesByDate(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), newNote]
    }));

    try {
      const { isFocused, isDeleting, ...cleanNote } = newNote;
      await axiosInstance.post('/api/DailyNote', cleanNote);
    } catch (error) {
      console.error("[ERROR] Entry creation failed:", error);
    }
  };

  const updateNote = (id, updates) => {
    setNotesByDate(prev => {
      const updated = (prev[dateKey] || []).map(n => n.id === id ? { ...n, ...updates } : n);
      saveNotesToBackend(updated.map(n => ({ ...n, date: dateKey })));
      return {
        ...prev,
        [dateKey]: updated
      };
    });
  };

  const deleteNote = async (id) => {
    updateNote(id, { isDeleting: true });
    try {
      await axiosInstance.delete(`/api/DailyNote/${id}`);
      setTimeout(() => {
        setNotesByDate(prev => ({
          ...prev,
          [dateKey]: prev[dateKey].filter(n => n.id !== id)
        }));
      }, 300);
    } catch (error) {
      console.error("[ERROR] Deletion failed:", error);
      updateNote(id, { isDeleting: false });
    }
  };

  const focusNote = (id) => {
    setTopZIndex(prev => prev + 1);
    setNotesByDate(prev => {
      const updated = (prev[dateKey] || []).map(n => ({
        ...n,
        zIndex: n.id === id ? topZIndex + 1 : n.zIndex,
        isFocused: n.id === id
      }));
      saveNotesToBackend(updated.map(n => ({ ...n, date: dateKey })));
      return {
        ...prev,
        [dateKey]: updated
      };
    });
  };

  const navigateDate = (days) => {
    setCurrentDate(prev => days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days)));
  };

  return (
    <div className={`daily-note-app-container-cyber theme-${theme}`}>
      <header className="app-toolbar-cyber">
        <div className="date-navigator">
          <button className="nav-btn" onClick={() => navigateDate(-1)}><FaChevronLeft /></button>
          <div className="current-date-display">
            <h2>{format(currentDate, 'yyyy_MM_dd')}</h2>
            <span className="note-count">ACTIVE_ENTRIES: {currentNotes.length}</span>
          </div>
          <button className="nav-btn" onClick={() => navigateDate(1)}><FaChevronRight /></button>
        </div>

        <div className="toolbar-actions">
          <button className="nav-btn theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? <FaSun /> : <FaMoon />}
          </button>
          <div className="color-selector">
            {COLORS.map(c => (
              <button 
                key={c.id}
                className={`color-option ${selectedColor === c.id ? 'active' : ''}`}
                style={{ backgroundColor: c.color }}
                onClick={() => setSelectedColor(c.id)}
              />
            ))}
          </div>
          <button className="create-note-btn" onClick={addNote}>
            <FaPlus /> NEW_ENTRY
          </button>
        </div>
      </header>

      <main className="note-canvas-cyber">
        {currentNotes.length === 0 && !loading ? (
          <div className="empty-state-cyber">
            <div className="empty-icon"><FaTerminal /></div>
            <h3>NO_DATA_FOUND</h3>
            <p>Initialize a new entry to begin data logging.</p>
          </div>
        ) : (
          currentNotes.map(note => (
            <Note 
              key={note.id}
              note={note}
              onUpdate={updateNote}
              onDelete={deleteNote}
              onFocus={focusNote}
            />
          ))
        )}
      </main>
    </div>
  );
};

export default DailyNoteApp;
