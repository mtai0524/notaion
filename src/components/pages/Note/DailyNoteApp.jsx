import React, { useState, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, subDays } from 'date-fns';
import { 
  FaPlus, FaChevronLeft, FaChevronRight, FaTimes, 
  FaPalette, FaClock, FaTerminal, FaSun, FaMoon,
  FaSearch, FaWindowMinimize, FaWindowMaximize, FaListUl, FaCode, FaFileAlt,
  FaCopy, FaCheck, FaLayerGroup, FaClone, FaTh, FaTrashAlt, FaTag,
  FaTextHeight, FaGhost, FaBorderNone, FaCheckCircle, FaLongArrowAltDown, FaLongArrowAltUp,
  FaSun as FaGlow, FaCloud as FaBlur, FaAlignLeft, FaAlignCenter, FaAlignRight, FaCog,
  FaLink, FaUnlink
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
  const [showProps, setShowProps] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const theme = COLORS.find(c => c.id === note.color) || COLORS[0];
  const accentColor = note.customColor || theme.color;
  const accentRgb = note.customRgb || theme.rgb;

  const cycleColor = (e) => {
    e.stopPropagation();
    const currentIndex = COLORS.findIndex(c => c.id === note.color);
    const nextIndex = (currentIndex + 1) % COLORS.length;
    onUpdate(note.id, { 
      color: COLORS[nextIndex].id, 
      customColor: null, 
      customRgb: null 
    });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowProps(!showProps);
    onFocus(note.id);
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setShowProps(false);
      }
    };
    if (showProps) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showProps]);

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

  const toggleLink = (targetId) => {
    const currentLinks = note.linkedNoteIds ? note.linkedNoteIds.split(',') : [];
    let newLinks;
    if (currentLinks.includes(targetId)) {
      newLinks = currentLinks.filter(id => id !== targetId);
    } else {
      newLinks = [...currentLinks, targetId];
    }
    onUpdate(note.id, { linkedNoteIds: newLinks.join(',') });
  };

  const getTitleAlign = (val) => {
    if (val === 0 || val === 'Left') return 'left';
    if (val === 1 || val === 'Center') return 'center';
    if (val === 2 || val === 'Right') return 'right';
    return val || 'left';
  };

  const getBorderStyle = (val) => {
    if (val === 0 || val === 'Solid') return 'solid';
    if (val === 1 || val === 'Dashed') return 'dashed';
    return val || 'solid';
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
      style={{ 
        zIndex: note.zIndex, 
        position: 'absolute',
        opacity: note.opacity || 1
      }}
      onDragStart={() => onFocus(note.id)}
      onResizeStart={() => onFocus(note.id)}
    >
      <div 
        className={`daily-note-card-cyber ${note.isFocused ? 'is-focused' : ''} ${note.isDeleting ? 'deleting' : ''} ${note.isMinimized ? 'minimized' : ''} ${getBorderStyle(note.borderStyle) === 'dashed' ? 'border-dashed' : ''} ${note.isCompleted ? 'is-completed' : ''} ${note.glow ? 'glow-active' : ''} bg-pattern-${note.pattern === 1 ? 'dots' : note.pattern === 2 ? 'stripes' : 'none'}`}
        data-category={note.customCategory || note.category}
        style={{ 
          '--accent-color': accentColor,
          '--accent-rgb': accentRgb,
          '--note-font-size': note.fontSize || '0.85rem',
          '--note-opacity': note.opacity || 1,
          '--note-blur': `${(note.blur || 0) * 10}px`
        }}
        onClick={() => onFocus(note.id)}
        onContextMenu={handleContextMenu}
      >
        <div className="note-header">
          <div className="header-left">
             {!note.hideHeader && <span className="timestamp">[ {note.timestamp} ]</span>}
          </div>
          <div className="header-actions">
            <button className="action-btn config-btn" onClick={() => setShowProps(!showProps)}>
              <FaCog />
            </button>
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

        {showProps && (
          <div className="cyber-inspector-popup" onClick={(e) => e.stopPropagation()}>
             <div className="inspector-header">
               <FaTerminal className="term-icon" />
               <span>PROPERTY_INSPECTOR v1.0</span>
               <FaTimes className="close-icon" onClick={() => setShowProps(false)} />
             </div>
             
             <div className="inspector-content">
                <section className="ins-section">
                  <div className="ins-label">GEOMETRY_&_LAYOUT</div>
                  <div className="ins-row">
                    <div className="ins-field">
                      <label><FaTextHeight /> FONT</label>
                      <div className="ins-toggle-group">
                        {['0.7rem', '0.85rem', '1.1rem'].map(sz => (
                          <button key={sz} className={`ins-toggle ${note.fontSize === sz ? 'active' : ''}`} onClick={() => onUpdate(note.id, { fontSize: sz })}>
                            {sz === '0.7rem' ? 'S' : sz === '0.85rem' ? 'M' : 'L'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="ins-field">
                      <label>ALIGN</label>
                      <div className="ins-toggle-group">
                        <button className={`ins-toggle ${getTitleAlign(note.titleAlign) === 'left' ? 'active' : ''}`} onClick={() => onUpdate(note.id, { titleAlign: 0 })}><FaAlignLeft /></button>
                        <button className={`ins-toggle ${getTitleAlign(note.titleAlign) === 'center' ? 'active' : ''}`} onClick={() => onUpdate(note.id, { titleAlign: 1 })}><FaAlignCenter /></button>
                        <button className={`ins-toggle ${getTitleAlign(note.titleAlign) === 'right' ? 'active' : ''}`} onClick={() => onUpdate(note.id, { titleAlign: 2 })}><FaAlignRight /></button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="ins-section">
                  <div className="ins-label">AESTHETICS</div>
                  <div className="ins-grid">
                    <div className="ins-control" onClick={() => onUpdate(note.id, { glow: !note.glow })}>
                      <FaGlow className={note.glow ? 'active-icon' : ''} />
                      <span>GLOW</span>
                    </div>
                    <div className="ins-control" onClick={() => onUpdate(note.id, { blur: note.blur ? 0 : 1 })}>
                      <FaBlur className={note.blur ? 'active-icon' : ''} />
                      <span>GLASS</span>
                    </div>
                    <div className="ins-control" onClick={() => onUpdate(note.id, { borderStyle: getBorderStyle(note.borderStyle) === 'dashed' ? 0 : 1 })}>
                      <FaBorderNone className={getBorderStyle(note.borderStyle) === 'dashed' ? 'active-icon' : ''} />
                      <span>DASHED</span>
                    </div>
                    <div className="ins-control" onClick={() => onUpdate(note.id, { isCompleted: !note.isCompleted })}>
                      <FaCheckCircle className={note.isCompleted ? 'active-icon' : ''} />
                      <span>DONE</span>
                    </div>
                  </div>
                  
                  <div className="ins-field mt-2">
                    <label>PATTERN</label>
                    <div className="ins-toggle-group full-width">
                      {[
                        { label: 'NONE', val: 0 },
                        { label: 'DOTS', val: 1 },
                        { label: 'STRIPES', val: 2 }
                      ].map(p => (
                        <button key={p.val} className={`ins-toggle ${note.pattern === p.val ? 'active' : ''}`} onClick={() => onUpdate(note.id, { pattern: p.val })}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="ins-section">
                  <div className="ins-label">CONNECTIVITY</div>
                  <div className="ins-field">
                    <label><FaLink /> LINK_TO_NOTE</label>
                    <div className="link-scroll">
                      {window.allCurrentNotesGlobal?.filter(n => n.id !== note.id).map(n => (
                        <div key={n.id} className={`link-item ${(note.linkedNoteIds || '').split(',').includes(n.id) ? 'linked' : ''}`} onClick={() => toggleLink(n.id)}>
                          <span className="dot" /> {n.title || 'Untitled Entry'}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="ins-section">
                  <div className="ins-label">IDENTITY</div>
                  <div className="prop-input-wrap">
                    <FaTag className="input-icon" />
                    <input 
                      className="ins-input"
                      value={note.customCategory || ''}
                      onChange={(e) => onUpdate(note.id, { customCategory: e.target.value.toUpperCase() })}
                      placeholder="CUSTOM_LABEL..."
                    />
                  </div>
                  <div className="prop-input-wrap mt-1">
                    <FaPalette className="input-icon" />
                    <input 
                      className="ins-input"
                      value={note.customColor || ''}
                      onChange={(e) => onUpdate(note.id, { customColor: e.target.value, customRgb: '137, 221, 255' })}
                      placeholder="#HEX_COLOR"
                    />
                  </div>
                </section>

                <div className="ins-actions-footer">
                  <button className="ins-footer-btn danger" onClick={() => onDelete(note.id)}>
                    <FaTrashAlt /> DESTROY_DATA
                  </button>
                </div>
             </div>
          </div>
        )}

        {!note.isMinimized && (
          <div className="note-body">
            <input 
              className="note-title-input"
              value={note.title || ''}
              onChange={(e) => onUpdate(note.id, { title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder=":: ENTRY_TITLE"
              style={{ textAlign: getTitleAlign(note.titleAlign) }}
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
  const [showGrid, setShowGrid] = useState(true);
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

  const addNote = async (template = 'blank', x = null, y = null) => {
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
      x: x !== null ? x : (50 + (allCurrentNotes.length * 30) % 400),
      y: y !== null ? y : (100 + (allCurrentNotes.length * 30) % 300),
      width: 280,
      height: template === 'blank' ? 200 : 300,
      zIndex: topZIndex + 1,
      isFocused: true,
      isMinimized: false,
      opacity: 1,
      fontSize: '0.85rem',
      borderStyle: 'solid',
      isCompleted: false
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

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  const duplicateNote = (note) => {
    const { id, x, y, zIndex, isFocused, isDeleting, ...rest } = note;
    const newId = uuidv4();
    const duplicated = { 
      ...rest, 
      id: newId, 
      x: x + 20, 
      y: y + 20, 
      zIndex: topZIndex + 1,
      timestamp: format(new Date(), 'HH:mm:ss') 
    };
    
    setTopZIndex(prev => prev + 1);
    setNotesByDate(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), { ...duplicated, isFocused: true, isDeleting: false }]
    }));
    
    axiosInstance.post('/api/DailyNote', duplicated);
  };

  const sendToBack = (id) => {
    setNotesByDate(prev => {
      const updated = (prev[dateKey] || []).map(n => ({
        ...n,
        zIndex: n.id === id ? 1 : n.zIndex + 1
      }));
      saveNotesToBackend(updated.map(n => ({ ...n, date: dateKey })));
      return { ...prev, [dateKey]: updated };
    });
  };

  const clearAllNotes = async () => {
    if (window.confirm("ERASE ALL DATA FOR THIS DATE?")) {
      for (const note of allCurrentNotes) {
        await axiosInstance.delete(`/api/DailyNote/${note.id}`);
      }
      setNotesByDate(prev => ({ ...prev, [dateKey]: [] }));
    }
  };

  useEffect(() => {
    // No global context menu listener needed anymore for note props
  }, []);

  window.allCurrentNotesGlobal = allCurrentNotes;

  const renderNoteLinks = () => {
    return (
      <svg className="note-links-svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
        {allCurrentNotes.map(note => {
          const linkedIds = note.linkedNoteIds ? note.linkedNoteIds.split(',') : [];
          return linkedIds.map(targetId => {
            const targetNote = allCurrentNotes.find(n => n.id === targetId);
            if (!targetNote) return null;
            
            // Calculate center points
            const x1 = note.x + note.width / 2;
            const y1 = note.y + (note.isMinimized ? 20 : note.height / 2);
            const x2 = targetNote.x + targetNote.width / 2;
            const y2 = targetNote.y + (targetNote.isMinimized ? 20 : targetNote.height / 2);
            
            const noteColor = COLORS.find(c => c.id === note.color)?.color || '#89ddff';

            return (
              <g key={`${note.id}-${targetId}`}>
                <line 
                  x1={x1} y1={y1} x2={x2} y2={y2} 
                  stroke={noteColor} 
                  strokeWidth="2" 
                  strokeDasharray="5,5"
                  opacity="0.3"
                >
                  <animate attributeName="stroke-dashoffset" from="0" to="20" dur="2s" repeatCount="indefinite" />
                </line>
                <circle cx={x1} cy={y1} r="3" fill={noteColor} />
                <circle cx={x2} cy={y2} r="3" fill={noteColor} />
              </g>
            );
          });
        })}
      </svg>
    );
  };

  return (
    <div className={`daily-note-app-container-cyber theme-${theme} ${showGrid ? 'show-grid' : ''}`}>
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

      <main className="note-canvas-cyber" onContextMenu={handleContextMenu}>
        {renderNoteLinks()}
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
