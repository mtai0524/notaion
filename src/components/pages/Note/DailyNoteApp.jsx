import React, { useState, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, subDays } from 'date-fns';
import { 
  FaPlus, FaChevronLeft, FaChevronRight, FaTimes, 
  FaPalette, FaClock, FaTag 
} from 'react-icons/fa';
import axiosInstance from '../../../axiosConfig';
import debounce from 'lodash.debounce';
import './DailyNoteApp.scss';

const COLORS = [
  { id: 'white', bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' },
  { id: 'yellow', bg: '#fffbeb', border: '#fef3c7', text: '#92400e' },
  { id: 'blue', bg: '#eff6ff', border: '#dbeafe', text: '#1e40af' },
  { id: 'green', bg: '#f0fdf4', border: '#dcfce7', text: '#166534' },
  { id: 'pink', bg: '#fdf2f8', border: '#fce7f3', text: '#9d174d' },
  { id: 'purple', bg: '#faf5ff', border: '#f3e8ff', text: '#6b21a8' },
];

const CATEGORIES = ['Work', 'Idea', 'Reminder', 'Personal'];

const Note = ({ note, onUpdate, onDelete, onFocus }) => {
  const color = COLORS.find(c => c.id === note.color) || COLORS[0];

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
      minWidth={180}
      minHeight={120}
      style={{ zIndex: note.zIndex }}
      onDragStart={() => onFocus(note.id)}
      onResizeStart={() => onFocus(note.id)}
    >
      <div 
        className={`daily-note-card-basic ${note.isDeleting ? 'deleting' : ''}`}
        style={{ 
          backgroundColor: color.bg,
          borderColor: color.border,
          color: color.text,
          boxShadow: note.isFocused ? '0 8px 20px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)'
        }}
        onClick={() => onFocus(note.id)}
      >
        <div className="note-header" style={{ borderBottomColor: `${color.border}` }}>
          <div className="header-left">
             <span className="timestamp"><FaClock /> {note.timestamp}</span>
          </div>
          <div className="header-actions">
            <button className="action-btn color-btn" onClick={cycleColor} title="Cycle Color">
              <FaPalette />
            </button>
            <button className="action-btn delete-btn" onClick={() => onDelete(note.id)} title="Delete">
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="note-body">
          <input 
            className="note-title-input"
            value={note.title || ''}
            onChange={(e) => onUpdate(note.id, { title: e.target.value })}
            placeholder="Title"
            style={{ color: color.text }}
          />
          
          <div className="category-tag-basic">
            <FaTag size={10} /> {note.category}
          </div>

          <textarea 
            className="note-content-area"
            value={note.content || ''}
            onChange={(e) => onUpdate(note.id, { content: e.target.value })}
            placeholder="Write something..."
            style={{ color: color.text }}
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
  const [selectedColor, setSelectedColor] = useState('white');
  const [loading, setLoading] = useState(false);
  
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const currentNotes = notesByDate[dateKey] || [];

  const fetchNotes = async (date) => {
    console.log(`[DailyNote] Fetching notes for ${date}...`);
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/api/DailyNote/${date}`);
      console.log(`[DailyNote] Fetched ${response.data.length} notes.`);
      setNotesByDate(prev => ({
        ...prev,
        [date]: response.data.map(n => ({ ...n, isFocused: false, isDeleting: false }))
      }));
      
      if (response.data.length > 0) {
        const maxZ = Math.max(...response.data.map(n => n.zIndex));
        setTopZIndex(prev => Math.max(prev, maxZ));
      }
    } catch (error) {
      console.error("[DailyNote] Error fetching notes:", error.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes(dateKey);
  }, [dateKey]);

  const saveNotesToBackend = useCallback(
    debounce(async (notes) => {
      console.log("[DailyNote] Bulk saving notes...", notes);
      try {
        const cleanNotes = notes.map(({ isFocused, isDeleting, ...rest }) => rest);
        await axiosInstance.post('/api/DailyNote/bulk', cleanNotes);
        console.log("[DailyNote] Bulk save successful.");
      } catch (error) {
        console.error("[DailyNote] Error saving notes:", error.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
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
      timestamp: format(new Date(), 'HH:mm'),
      date: dateKey,
      x: 50 + (currentNotes.length * 20) % 300,
      y: 150 + (currentNotes.length * 20) % 200,
      width: 220,
      height: 180,
      zIndex: topZIndex + 1,
      isFocused: true
    };
    
    setTopZIndex(prev => prev + 1);
    setNotesByDate(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), newNote]
    }));

    console.log("[DailyNote] Creating new note...", newNote);
    try {
      const { isFocused, isDeleting, ...cleanNote } = newNote;
      await axiosInstance.post('/api/DailyNote', cleanNote);
      console.log("[DailyNote] Note created.");
    } catch (error) {
      console.error("[DailyNote] Error creating note:", error.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
    }
  };

  const updateNote = (id, updates) => {
    setNotesByDate(prev => {
      const updated = prev[dateKey].map(n => n.id === id ? { ...n, ...updates } : n);
      saveNotesToBackend(updated.map(n => ({ ...n, date: dateKey })));
      return {
        ...prev,
        [dateKey]: updated
      };
    });
  };

  const deleteNote = async (id) => {
    console.log(`[DailyNote] Deleting note ${id}...`);
    updateNote(id, { isDeleting: true });
    
    try {
      await axiosInstance.delete(`/api/DailyNote/${id}`);
      console.log("[DailyNote] Note deleted from backend.");
      setTimeout(() => {
        setNotesByDate(prev => ({
          ...prev,
          [dateKey]: prev[dateKey].filter(n => n.id !== id)
        }));
      }, 300);
    } catch (error) {
      console.error("[DailyNote] Error deleting note:", error.response?.data ? JSON.stringify(error.response.data, null, 2) : error);
      updateNote(id, { isDeleting: false });
    }
  };

  const focusNote = (id) => {
    setTopZIndex(prev => prev + 1);
    setNotesByDate(prev => {
      const updated = prev[dateKey].map(n => ({
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
    <div className="daily-note-app-container-basic">
      <header className="app-toolbar-basic">
        <div className="date-navigator">
          <button className="nav-btn" onClick={() => navigateDate(-1)}><FaChevronLeft /></button>
          <div className="current-date-display">
            <h2>{format(currentDate, 'eeee, MMMM do')}</h2>
            <span className="note-count">{currentNotes.length} notes</span>
          </div>
          <button className="nav-btn" onClick={() => navigateDate(1)}><FaChevronRight /></button>
        </div>

        <div className="toolbar-actions">
          <div className="color-selector">
            {COLORS.map(c => (
              <button 
                key={c.id}
                className={`color-option ${selectedColor === c.id ? 'active' : ''}`}
                style={{ backgroundColor: c.bg, borderColor: c.border }}
                onClick={() => setSelectedColor(c.id)}
              />
            ))}
          </div>
          <button className="create-note-btn" onClick={addNote}>
            <FaPlus /> New Note
          </button>
        </div>
      </header>

      <main className="note-canvas-basic">
        {loading && currentNotes.length === 0 ? (
          <div className="loading-state">Loading notes...</div>
        ) : currentNotes.length === 0 ? (
          <div className="empty-state-basic">
            <div className="empty-icon">📝</div>
            <h3>Keep track of your day</h3>
            <p>Add a note to start organized.</p>
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
