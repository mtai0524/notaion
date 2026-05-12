import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  FaLink, FaUnlink, FaEye, FaEyeSlash, FaSyncAlt, FaRulerCombined, FaFont,
  FaSlidersH, FaLayerGroup as FaStack, FaLock, FaUnlock, FaHighlighter,
  FaDrawPolygon, FaCompressArrowsAlt, FaExpandArrowsAlt
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

const Note = ({ note, onUpdate, onDelete, onFocus, appTheme }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('STYLE');

  const theme = COLORS.find(c => c.id === note.color) || COLORS[0];
  const accentColor = note.customColor || theme.color;
  const accentRgb = note.customRgb || theme.rgb;

  // Resolve text color: customTextColorHex > accent > customTextColor preset > theme default
  const resolvedTextColor = note.customTextColorHex
    || (note.customTextColor === 'accent'
      ? accentColor
      : (note.customTextColor && note.customTextColor !== 'null' && note.customTextColor !== null
        ? note.customTextColor
        : (note.noteTheme === 1 || note.noteTheme === 2
          ? '#000000'                                        // light/sticky note → black
          : (appTheme === 'light' ? '#0f172a' : '#a6accd')  // follow app theme
        )
      )
    );

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
      if (e.key === 'Escape') setShowProps(false);
    };
    if (showProps) window.addEventListener('keydown', handleEsc);
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
      disableResizing={note.isMinimized || note.locked}
      dragHandleClassName="note-header"
      minWidth={200}
      minHeight={note.isMinimized ? 40 : 150}
      bounds={false}
      disableDragging={note.locked}
      style={{
        zIndex: note.zIndex,
        position: 'absolute',
        opacity: note.opacity || 1
      }}
      onDragStart={() => onFocus(note.id)}
      onResizeStart={() => onFocus(note.id)}
    >
      <div
        className={`daily-note-card-cyber ${note.isFocused ? 'is-focused' : ''} ${note.isDeleting ? 'deleting' : ''} ${note.isMinimized ? 'minimized' : ''} ${getBorderStyle(note.borderStyle) === 'dashed' ? 'border-dashed' : ''} ${note.isCompleted ? 'is-completed' : ''} ${note.glow ? 'glow-active' : ''} ${note.highlighted ? 'is-highlighted' : ''} ${note.compact ? 'is-compact' : ''} bg-pattern-${note.pattern === 1 ? 'dots' : note.pattern === 2 ? 'stripes' : note.pattern === 3 ? 'grid' : note.pattern === 4 ? 'cross' : 'none'} note-theme-${note.noteTheme === 1 ? 'light' : (note.noteTheme === 2 ? 'sticky' : 'dark')}`}
        data-category={note.customCategory || note.category}
        style={{
          '--accent-color': accentColor,
          '--accent-rgb': accentRgb,
          '--note-font-size': note.fontSize || '0.85rem',
          '--note-opacity': note.opacity || 1,
          '--note-blur': `${(note.blurIntensity || 5) * (note.blur || 0)}px`,
          '--custom-text-color': resolvedTextColor,
          '--note-border-width': `${note.borderWidth || 1}px`,
          '--note-border-radius': `${note.borderRadius || 0}px`,
          '--note-line-height': note.lineHeight || 1.6,
          '--note-font-family': note.fontFamily || "'JetBrains Mono', 'Fira Code', monospace",
          '--note-glow-radius': `${note.glowRadius || 20}px`,
          transform: `rotate(${note.rotation || 0}deg)`,
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
              <div className="header-left-group">
                <FaCog className="term-icon" />
                <span>INSPECTOR_V2</span>
              </div>
              <FaTimes className="close-icon" onClick={() => setShowProps(false)} />
            </div>

            {/* ── TAB NAVIGATION ── */}
            <div className="inspector-tabs">
              {['STYLE', 'TEXT', 'LAYOUT', 'MISC'].map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="inspector-content">
              {/* ── STYLE TAB ── */}
              {activeTab === 'STYLE' && (
                <>
                  <section className="ins-section">
                    <div className="ins-label">THEME_&_EFFECTS</div>
                    <div className="ins-grid ins-grid-5">
                      <div className="ins-control" onClick={() => onUpdate(note.id, { noteTheme: note.noteTheme === 0 ? 1 : (note.noteTheme === 1 ? 2 : 0) })}>
                        {note.noteTheme === 0 ? <FaMoon className="active-icon" /> : (note.noteTheme === 1 ? <FaSun /> : <FaFileAlt />)}
                        <span>{note.noteTheme === 0 ? 'DARK' : (note.noteTheme === 1 ? 'LIGHT' : 'STICKY')}</span>
                      </div>
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
                      <div className="ins-control" onClick={() => onUpdate(note.id, { highlighted: !note.highlighted })}>
                        <FaHighlighter className={note.highlighted ? 'active-icon' : ''} />
                        <span>HL</span>
                      </div>
                    </div>

                    {(note.blur > 0 || note.glow) && (
                      <div className="ins-field mt-2">
                        {note.blur > 0 && (
                          <div className="slider-row">
                            <label><FaBlur /> GLASS: {(note.blurIntensity || 5)}px</label>
                            <input type="range" min="1" max="20" step="1" value={note.blurIntensity || 5} className="ins-slider" onChange={(e) => onUpdate(note.id, { blurIntensity: Number(e.target.value) })} />
                          </div>
                        )}
                        {note.glow && (
                          <div className="slider-row mt-1">
                            <label><FaGlow /> GLOW: {note.glowRadius || 20}px</label>
                            <input type="range" min="5" max="60" step="5" value={note.glowRadius || 20} className="ins-slider" onChange={(e) => onUpdate(note.id, { glowRadius: Number(e.target.value) })} />
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="ins-section">
                    <div className="ins-label">COLORS_&_PATTERNS</div>
                    <div className="ins-field">
                      <label>ACCENT_PRESET</label>
                      <div className="ins-color-swatches">
                        {COLORS.map(c => (
                          <button key={c.id} className={`swatch ${note.color === c.id && !note.customColor ? 'active' : ''}`} style={{ background: c.color }} onClick={() => onUpdate(note.id, { color: c.id, customColor: null, customRgb: null })} />
                        ))}
                      </div>
                    </div>
                    <div className="ins-field mt-2">
                      <label>PATTERN_OVERLAY</label>
                      <div className="ins-toggle-group full-width">
                        {['NONE', 'DOTS', 'LINES', 'GRID', 'CROSS'].map((p, i) => (
                          <button key={p} className={`ins-toggle ${note.pattern === i ? 'active' : ''}`} onClick={() => onUpdate(note.id, { pattern: i })}>{p}</button>
                        ))}
                      </div>
                    </div>
                    <div className="ins-row mt-2">
                      <div className="ins-field">
                        <label>CUSTOM_ACCENT</label>
                        <div className="ins-color-input-row">
                          <input type="color" className="ins-color-picker" value={note.customColor || accentColor} onChange={(e) => { const hex = e.target.value; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16); onUpdate(note.id, { customColor: hex, customRgb: `${r}, ${g}, ${b}` }); }} />
                          <input className="ins-input" value={note.customColor || ''} onChange={(e) => onUpdate(note.id, { customColor: e.target.value })} placeholder="#HEX" />
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* ── TEXT TAB ── */}
              {activeTab === 'TEXT' && (
                <>
                  <section className="ins-section">
                    <div className="ins-label">TYPOGRAPHY</div>
                    <div className="ins-field">
                      <label><FaFont /> FONT_FAMILY</label>
                      <div className="ins-toggle-group full-width">
                        {[{ label: 'MONO', val: "'JetBrains Mono', monospace" }, { label: 'SANS', val: "'Inter', sans-serif" }, { label: 'SERIF', val: "'Georgia', serif" }, { label: 'CODE', val: "'Fira Code', monospace" }].map(f => (
                          <button key={f.label} className={`ins-toggle ${note.fontFamily === f.val ? 'active' : ''}`} onClick={() => onUpdate(note.id, { fontFamily: f.val })}>{f.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="ins-row mt-2">
                      <div className="ins-field">
                        <label>FONT_SIZE</label>
                        <div className="ins-toggle-group">
                          {['0.7rem', '0.85rem', '1.0rem', '1.2rem'].map((sz, i) => (
                            <button key={sz} className={`ins-toggle ${note.fontSize === sz ? 'active' : ''}`} onClick={() => onUpdate(note.id, { fontSize: sz })}>{['XS', 'S', 'M', 'L'][i]}</button>
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
                    <div className="ins-field mt-2">
                      <label>LINE_HEIGHT: {note.lineHeight || 1.6}</label>
                      <input type="range" min="1.0" max="2.4" step="0.1" value={note.lineHeight || 1.6} className="ins-slider" onChange={(e) => onUpdate(note.id, { lineHeight: Number(e.target.value) })} />
                    </div>
                  </section>
                  <section className="ins-section">
                    <div className="ins-label">TEXT_COLOR</div>
                    <div className="ins-toggle-group full-width">
                      {[{ label: 'AUTO', val: null }, { label: 'WHITE', val: '#ffffff' }, { label: 'BLACK', val: '#000000' }, { label: 'ACCENT', val: 'accent' }].map(tc => (
                        <button key={tc.label} className={`ins-toggle ${note.customTextColor === tc.val ? 'active' : ''}`} onClick={() => onUpdate(note.id, { customTextColor: tc.val, customTextColorHex: null })}>{tc.label}</button>
                      ))}
                    </div>
                    <div className="ins-field mt-2">
                      <label>CUSTOM_COLOR</label>
                      <div className="ins-color-input-row">
                        <input type="color" className="ins-color-picker" value={note.customTextColorHex || '#ffffff'} onChange={(e) => onUpdate(note.id, { customTextColor: e.target.value, customTextColorHex: e.target.value })} />
                        <input className="ins-input" value={note.customTextColorHex || ''} onChange={(e) => onUpdate(note.id, { customTextColor: e.target.value, customTextColorHex: e.target.value })} placeholder="#HEX" />
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* ── LAYOUT TAB ── */}
              {activeTab === 'LAYOUT' && (
                <>
                  <section className="ins-section">
                    <div className="ins-label">TRANSFORM_&_VISUALS</div>
                    <div className="ins-field">
                      <label><FaEye /> OPACITY: {Math.round((note.opacity || 1) * 100)}%</label>
                      <input type="range" min="0.1" max="1" step="0.05" value={note.opacity || 1} className="ins-slider" onChange={(e) => onUpdate(note.id, { opacity: Number(e.target.value) })} />
                    </div>
                    <div className="ins-field mt-2">
                      <label><FaRulerCombined /> BORDER_WIDTH: {note.borderWidth || 1}px</label>
                      <input type="range" min="1" max="6" step="1" value={note.borderWidth || 1} className="ins-slider" onChange={(e) => onUpdate(note.id, { borderWidth: Number(e.target.value) })} />
                    </div>
                    <div className="ins-field mt-2">
                      <label><FaSlidersH /> CORNER_RADIUS: {note.borderRadius || 0}px</label>
                      <input type="range" min="0" max="24" step="2" value={note.borderRadius || 0} className="ins-slider" onChange={(e) => onUpdate(note.id, { borderRadius: Number(e.target.value) })} />
                    </div>
                    <div className="ins-field mt-2">
                      <label>ROTATION: {note.rotation || 0}°</label>
                      <input type="range" min="-15" max="15" step="1" value={note.rotation || 0} className="ins-slider" onChange={(e) => onUpdate(note.id, { rotation: Number(e.target.value) })} />
                    </div>
                  </section>
                  <section className="ins-section">
                    <div className="ins-label">BEHAVIOR</div>
                    <div className="ins-grid ins-grid-5">
                      <div className="ins-control" onClick={() => onUpdate(note.id, { hideHeader: !note.hideHeader })}>
                        {note.hideHeader ? <FaEyeSlash className="active-icon" /> : <FaEye />}
                        <span>HEADER</span>
                      </div>
                      <div className="ins-control" onClick={() => onUpdate(note.id, { isCompleted: !note.isCompleted })}>
                        <FaCheckCircle className={note.isCompleted ? 'active-icon' : ''} />
                        <span>DONE</span>
                      </div>
                      <div className="ins-control" onClick={() => onUpdate(note.id, { locked: !note.locked })}>
                        {note.locked ? <FaLock className="active-icon" /> : <FaUnlock />}
                        <span>LOCK</span>
                      </div>
                      <div className="ins-control" onClick={() => onUpdate(note.id, { pinned: !note.pinned })}>
                        <FaDrawPolygon className={note.pinned ? 'active-icon' : ''} />
                        <span>PIN</span>
                      </div>
                      <div className="ins-control" onClick={() => onUpdate(note.id, { compact: !note.compact })}>
                        <FaCompressArrowsAlt className={note.compact ? 'active-icon' : ''} />
                        <span>COMPACT</span>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* ── MISC TAB ── */}
              {activeTab === 'MISC' && (
                <>
                  <section className="ins-section">
                    <div className="ins-label">IDENTITY</div>
                    <div className="ins-field">
                      <label>CATEGORY_PRESETS</label>
                      <div className="ins-cat-grid">
                        {CATEGORIES.map(cat => (
                          <button key={cat} className={`cat-option ${(note.customCategory || note.category) === cat ? 'active' : ''}`} onClick={() => onUpdate(note.id, { customCategory: cat, category: cat })}>{cat}</button>
                        ))}
                      </div>
                    </div>
                    <div className="prop-input-wrap mt-1">
                      <FaTag className="input-icon" />
                      <input className="ins-input" value={note.customCategory || ''} onChange={(e) => onUpdate(note.id, { customCategory: e.target.value.toUpperCase() })} placeholder="CUSTOM_LABEL..." />
                    </div>
                  </section>
                  <section className="ins-section">
                    <div className="ins-label">CONNECTIVITY</div>
                    <div className="link-scroll">
                      {window.allCurrentNotesGlobal?.filter(n => n.id !== note.id).map(n => (
                        <div key={n.id} className={`link-item ${(note.linkedNoteIds || '').split(',').includes(n.id) ? 'linked' : ''}`} onClick={() => toggleLink(n.id)}>
                          <span className="dot" /> {n.title || 'Untitled Entry'}
                        </div>
                      ))}
                    </div>
                  </section>
                  <div className="ins-actions-footer">
                    <div className="ins-footer-grid">
                      <button className="ins-footer-btn secondary" onClick={() => onUpdate(note.id, { rotation: 0, opacity: 1, borderWidth: 1, borderRadius: 0, blur: 0, glow: false, customTextColor: null, customTextColorHex: null })}>
                        <FaSyncAlt /> RESET_STYLE
                      </button>
                      <button className="ins-footer-btn danger" onClick={() => onDelete(note.id)}>
                        <FaTrashAlt /> DESTROY
                      </button>
                    </div>
                  </div>
                </>
              )}
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
  const [searchParams] = useSearchParams();
  const urlDateStr = searchParams.get('date');

  const [currentDate, setCurrentDate] = useState(() => {
    if (urlDateStr) {
      const parsed = new Date(urlDateStr);
      if (!isNaN(parsed)) return parsed;
    }
    return new Date();
  });

  useEffect(() => {
    if (urlDateStr) {
      const parsed = new Date(urlDateStr);
      if (!isNaN(parsed)) setCurrentDate(parsed);
    }
  }, [urlDateStr]);

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

  // Default text color based on current app theme
  const defaultTextColor = (t) => t === 'light' ? '#0f172a' : '#a6accd';

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

    const hubUrl = `${config.API_HOSTING}/dailyNoteHub`;
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => Cookies.get('token'),
        withCredentials: true
      })
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('daily-note-theme', newTheme);
  };

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
      borderStyle: 0,
      isCompleted: false,
      // ✅ Set text color theo app theme hiện tại
      customTextColor: defaultTextColor(theme),
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

  window.allCurrentNotesGlobal = allCurrentNotes;

  const getAnchorPoints = (n) => {
    const h = n.isMinimized ? 40 : n.height;
    return [
      { x: n.x + n.width / 2, y: n.y, side: 'top' },
      { x: n.x + n.width / 2, y: n.y + h, side: 'bottom' },
      { x: n.x, y: n.y + h / 2, side: 'left' },
      { x: n.x + n.width, y: n.y + h / 2, side: 'right' }
    ];
  };

  const renderNoteLinks = () => {
    return (
      <svg className="note-links-svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {allCurrentNotes.map(note => {
          const linkedIds = note.linkedNoteIds ? note.linkedNoteIds.split(',') : [];
          return linkedIds.map(targetId => {
            const targetNote = allCurrentNotes.find(n => n.id === targetId);
            if (!targetNote) return null;

            const p1Arr = getAnchorPoints(note);
            const p2Arr = getAnchorPoints(targetNote);

            let bestP1 = p1Arr[0], bestP2 = p2Arr[0], minDist = Infinity;

            p1Arr.forEach(p1 => {
              p2Arr.forEach(p2 => {
                const d = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
                if (d < minDist) {
                  minDist = d;
                  bestP1 = p1;
                  bestP2 = p2;
                }
              });
            });

            const noteColor = COLORS.find(c => c.id === note.color)?.color || '#89ddff';

            return (
              <g key={`${note.id}-${targetId}`} filter="url(#glow)">
                <path
                  d={`M ${bestP1.x} ${bestP1.y} L ${bestP2.x} ${bestP2.y}`}
                  stroke={noteColor}
                  strokeWidth="3"
                  strokeDasharray="8,8"
                  fill="none"
                  opacity="0.6"
                >
                  <animate attributeName="stroke-dashoffset" from="0" to="32" dur="1.5s" repeatCount="indefinite" />
                </path>
                <rect x={bestP1.x - 4} y={bestP1.y - 4} width="8" height="8" fill={noteColor} />
                <rect x={bestP2.x - 4} y={bestP2.y - 4} width="8" height="8" fill={noteColor} />
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
          <>
            {currentNotes.map(note => (
              <Note
                key={note.id}
                note={note}
                onUpdate={updateNote}
                onDelete={deleteNote}
                onFocus={focusNote}
                appTheme={theme}
              />
            ))}
            <div style={{
              position: 'absolute',
              top: Math.max(...(allCurrentNotes.length > 0 ? allCurrentNotes.map(n => n.y + (n.height || 200)) : [0])) + 500,
              left: 0,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: 'none'
            }} />
          </>
        )}
      </main>
    </div>
  );
};

export default DailyNoteApp;