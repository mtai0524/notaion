import React, { useState, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, subDays } from 'date-fns';
import { 
  FaPlus, FaChevronLeft, FaChevronRight, FaTimes, 
  FaPalette, FaClock, FaTerminal, FaSun, FaMoon,
  FaSearch, FaWindowMinimize, FaWindowMaximize, FaListUl, FaCode, FaFileAlt,
  FaCopy, FaCheck
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
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const theme = COLORS.find(c => c.id === note.color) || COLORS[0];

  const cycleColor = (e) => {
    e.stopPropagation();
    const currentIndex = COLORS.findIndex(c => c.id === note.color);
    const nextIndex = (currentIndex + 1) % COLORS.length;
    onUpdate(note.id, { color: COLORS[nextIndex].id });
  };

  const toggleMinimize = (e) => {
    e.stopPropagation();
    onUpdate(note.id, { isMinimized: !note.isMinimized });
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(note.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditing = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    onFocus(note.id);
  };

  return (
    <Rnd
      size={{ 
        width: note.width, 
        height: note.isMinimized ? 40 : note.height 
      }}
      position={{ x: note.x, y: note.y }}
      onDragStop={(e, d) => {
        onUpdate(note.id, { x: d.x, y: d.y });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        if (!note.isMinimized) {
          onUpdate(note.id, {
            width: parseInt(ref.style.width),
            height: parseInt(ref.style.height),
            ...position,
          });
        }
      }}
      disableResizing={note.isMinimized}
      dragHandleClassName="note-header"
      bounds=".note-canvas-cyber"
      minWidth={200}
      minHeight={note.isMinimized ? 40 : 150}
      style={{ zIndex: note.zIndex, position: 'absolute' }}
      onDragStart={() => onFocus(note.id)}
      onResizeStart={() => onFocus(note.id)}
    >
      <div 
        className={`daily-note-card-cyber ${note.isFocused ? 'is-focused' : ''} ${note.isDeleting ? 'deleting' : ''} ${note.isMinimized ? 'minimized' : ''}`}
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
            <button className={`action-btn copy-btn ${copied ? 'active' : ''}`} onClick={handleCopy} title="Copy Content">
              {copied ? <FaCheck /> : <FaCopy />}
            </button>
            <button className="action-btn minimize-btn" onClick={toggleMinimize} title="Minimize/Maximize">
              {note.isMinimized ? <FaWindowMaximize /> : <FaWindowMinimize />}
            </button>
            <button className="action-btn color-btn" onClick={cycleColor}>
              <FaPalette />
            </button>
            <button className="action-btn delete-btn" onClick={() => onDelete(note.id)}>
              <FaTimes />
            </button>
          </div>
        </div>

        {!note.isMinimized && (
          <div className="note-body">
            <input 
              className="note-title-input"
              value={note.title || ''}
              onChange={(e) => onUpdate(note.id, { title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder=":: ENTRY_TITLE"
            />
            
            <div className="content-container" onClick={startEditing}>
              {isEditing ? (
                <textarea 
                  className="note-content-area"
                  value={note.content || ''}
                  onChange={(e) => onUpdate(note.id, { content: e.target.value })}
                  placeholder="> waiting for input..."
                  autoFocus
                  onBlur={() => setIsEditing(false)}
                />
              ) : (
                <div className="markdown-preview">
                  {note.content ? (
                    <ReactMarkdown>{note.content}</ReactMarkdown>
                  ) : (
                    <span className="placeholder-text">{'> waiting for input...'}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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
  const [syncStatus, setSyncStatus] = useState('saved');
  const [theme, setTheme] = useState(() => localStorage.getItem('daily-note-theme') || 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [connection, setConnection] = useState(null);
  const [userId, setUserId] = useState(null);
  
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const allCurrentNotes = notesByDate[dateKey] || [];
  const currentNotes = allCurrentNotes.filter(n => 
    n.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      setSyncStatus('saving');
      console.log("[SYSTEM] Auto-saving changes...");
      try {
        const cleanNotes = notes.map(({ isFocused, isDeleting, ...rest }) => rest);
        await axiosInstance.post('/api/DailyNote/bulk', cleanNotes);
        setSyncStatus('saved');
      } catch (error) {
        console.error("[ERROR] Auto-save failed:", error);
        setSyncStatus('error');
      }
    }, 1000),
    []
  );

  const addNote = async (template = 'blank') => {
    let content = '';
    let title = '';
    let category = 'MEMO';

    if (template === 'todo') {
      title = 'TODO LIST';
      content = '- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3';
      category = 'TASK';
    } else if (template === 'meeting') {
      title = 'MEETING NOTES';
      content = 'Date: ' + format(new Date(), 'yyyy-MM-dd') + '\nParticipants:\nTopics:\n- \nAction Items:';
      category = 'LOG';
    } else if (template === 'code') {
      title = 'SNIPPET';
      content = '```javascript\n\n```';
      category = 'SYSTEM';
    }

    const newNote = {
      id: uuidv4(),
      title,
      content,
      color: selectedColor,
      category,
      timestamp: format(new Date(), 'HH:mm:ss'),
      date: dateKey,
      x: 50 + (allCurrentNotes.length * 30) % 400,
      y: 100 + (allCurrentNotes.length * 30) % 300,
      width: 280,
      height: template === 'blank' ? 200 : 300,
      zIndex: topZIndex + 1,
      isFocused: true,
      isMinimized: false
    };
    
    setTopZIndex(prev => prev + 1);
    setNotesByDate(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), newNote]
    }));

    try {
      const { isFocused, isDeleting, ...cleanNote } = newNote;
      setSyncStatus('saving');
      await axiosInstance.post('/api/DailyNote', cleanNote);
      setSyncStatus('saved');
    } catch (error) {
      console.error("[ERROR] Entry creation failed:", error);
      setSyncStatus('error');
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
    if (id === null) {
      setNotesByDate(prev => ({
        ...prev,
        [dateKey]: (prev[dateKey] || []).map(n => ({ ...n, isFocused: false }))
      }));
      return;
    }

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
            <div className="status-indicator-container">
               <span className="note-count">ACTIVE_ENTRIES: {currentNotes.length}</span>
               <span className={`sync-status ${syncStatus}`}>
                 {syncStatus === 'saving' && ' [ SYNCING... ]'}
                 {syncStatus === 'saved' && ' [ SYNC_COMPLETE ]'}
                 {syncStatus === 'error' && ' [ SYNC_ERROR ]'}
               </span>
            </div>
          </div>
          <button className="nav-btn" onClick={() => navigateDate(1)}><FaChevronRight /></button>
        </div>

        <div className="toolbar-actions">
          <div className="search-box-cyber">
            <FaSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="SEARCH_NOTES..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button className="nav-btn theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? <FaSun /> : <FaMoon />}
          </button>
          
          <div className="template-actions">
             <button className="tpl-btn" onClick={() => addNote('todo')} title="Add To-do List"><FaListUl /></button>
             <button className="tpl-btn" onClick={() => addNote('meeting')} title="Add Meeting Notes"><FaFileAlt /></button>
             <button className="tpl-btn" onClick={() => addNote('code')} title="Add Code Snippet"><FaCode /></button>
          </div>

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
          <button className="create-note-btn" onClick={() => addNote('blank')}>
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
