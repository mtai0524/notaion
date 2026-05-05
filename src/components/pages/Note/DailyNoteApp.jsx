import React, { useState, useEffect, useCallback, useRef } from 'react';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, subDays } from 'date-fns';
import { 
  FaPlus, FaChevronLeft, FaChevronRight, FaTimes, 
  FaPalette, FaTag, FaClock, FaTrash 
} from 'react-icons/fa';
import './DailyNoteApp.scss';

const COLORS = [
  { id: 'yellow', bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  { id: 'blue', bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  { id: 'green', bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  { id: 'pink', bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  { id: 'purple', bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  { id: 'white', bg: '#ffffff', border: '#e5e7eb', text: '#374151' },
];

const CATEGORIES = ['Work', 'Idea', 'Reminder', 'Personal'];

const Note = ({ note, onUpdate, onDelete, onFocus }) => {
  const [isResizing, setIsResizing] = useState(false);
  const color = COLORS.find(c => c.id === note.color) || COLORS[0];

  const handleResize = (e, { size }) => {
    onUpdate(note.id, { width: size.width, height: size.height });
  };

  const cycleColor = (e) => {
    e.stopPropagation();
    const currentIndex = COLORS.findIndex(c => c.id === note.color);
    const nextIndex = (currentIndex + 1) % COLORS.length;
    onUpdate(note.id, { color: COLORS[nextIndex].id });
  };

  return (
    <Draggable
      handle=".note-header"
      bounds="parent"
      position={{ x: note.x, y: note.y }}
      onStop={(e, data) => onUpdate(note.id, { x: data.x, y: data.y })}
      onStart={() => onFocus(note.id)}
      disabled={isResizing}
    >
      <div 
        className={`daily-note-card ${note.isDeleting ? 'deleting' : ''}`}
        style={{ 
          zIndex: note.zIndex,
          width: note.width,
          height: note.height,
          backgroundColor: color.bg,
          borderColor: color.border,
          color: color.text,
          boxShadow: note.isFocused ? '0 10px 25px rgba(0,0,0,0.2)' : '0 4px 10px rgba(0,0,0,0.1)'
        }}
        onClick={() => onFocus(note.id)}
      >
        <div className="note-header" style={{ borderBottomColor: `${color.border}44` }}>
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
            value={note.title}
            onChange={(e) => onUpdate(note.id, { title: e.target.value })}
            placeholder="Title..."
            style={{ color: color.text }}
          />
          
          <div className="category-tag">
            <FaTag size={10} /> {note.category}
          </div>

          <textarea 
            className="note-content-area"
            value={note.content}
            onChange={(e) => onUpdate(note.id, { content: e.target.value })}
            placeholder="Write something..."
            style={{ color: color.text }}
          />
        </div>

        <Resizable
          width={note.width}
          height={note.height}
          onResize={handleResize}
          onResizeStart={() => setIsResizing(true)}
          onResizeStop={() => setIsResizing(false)}
          handle={<div className="resize-handle" />}
          minConstraints={[160, 120]}
          maxConstraints={[600, 600]}
        >
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20 }} />
        </Resizable>
      </div>
    </Draggable>
  );
};

const DailyNoteApp = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notesByDate, setNotesByDate] = useState({});
  const [topZIndex, setTopZIndex] = useState(10);
  const [selectedColor, setSelectedColor] = useState('yellow');
  
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const currentNotes = notesByDate[dateKey] || [];

  const addNote = () => {
    const newNote = {
      id: uuidv4(),
      title: '',
      content: '',
      color: selectedColor,
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      timestamp: format(new Date(), 'HH:mm'),
      x: Math.random() * 200,
      y: Math.random() * 200,
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
  };

  const updateNote = (id, updates) => {
    setNotesByDate(prev => ({
      ...prev,
      [dateKey]: prev[dateKey].map(n => n.id === id ? { ...n, ...updates } : n)
    }));
  };

  const deleteNote = (id) => {
    // Smooth delete animation
    updateNote(id, { isDeleting: true });
    setTimeout(() => {
      setNotesByDate(prev => ({
        ...prev,
        [dateKey]: prev[dateKey].filter(n => n.id !== id)
      }));
    }, 300);
  };

  const focusNote = (id) => {
    setTopZIndex(prev => prev + 1);
    setNotesByDate(prev => ({
      ...prev,
      [dateKey]: prev[dateKey].map(n => ({
        ...n,
        zIndex: n.id === id ? topZIndex + 1 : n.zIndex,
        isFocused: n.id === id
      }))
    }));
  };

  const navigateDate = (days) => {
    setCurrentDate(prev => days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days)));
  };

  return (
    <div className="daily-note-app-container">
      <header className="app-toolbar">
        <div className="date-navigator">
          <button className="nav-btn" onClick={() => navigateDate(-1)}><FaChevronLeft /></button>
          <div className="current-date-display">
            <h2>{format(currentDate, 'eeee, MMMM do')}</h2>
            <span>{currentNotes.length} notes today</span>
          </div>
          <button className="nav-btn" onClick={() => navigateDate(1)}><FaChevronRight /></button>
        </div>

        <div className="toolbar-actions">
          <div className="color-dots">
            {COLORS.map(c => (
              <button 
                key={c.id}
                className={`color-dot ${selectedColor === c.id ? 'active' : ''}`}
                style={{ backgroundColor: c.bg, borderColor: c.border }}
                onClick={() => setSelectedColor(c.id)}
              />
            ))}
          </div>
          <button className="add-note-btn" onClick={addNote}>
            <FaPlus /> New Note
          </button>
        </div>
      </header>

      <main className="note-canvas">
        {currentNotes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No notes for this day</h3>
            <p>Click "New Note" to capture your thoughts!</p>
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
