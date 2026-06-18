import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  FaDrawPolygon, FaCompressArrowsAlt, FaExpandArrowsAlt, FaBrain,
  FaImage, FaPaperclip, FaDownload, FaUndo, FaTrash, FaChevronDown,
  FaEllipsisH, FaKeyboard, FaQuestionCircle
} from 'react-icons/fa';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Dropdown } from 'antd';
import * as signalR from '@microsoft/signalr';
import Cookies from 'js-cookie';
import jwt_decode from 'jwt-decode';
import config from '../../../config';
import axiosInstance from '../../../axiosConfig';
import { uploadFilesToCloudinary } from '../../../services/fileService';
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

// Anime/scenic-themed canvas backgrounds. Gradients ship by default because they
// always render reliably; users can paste any image URL via the "Custom URL" input.
const CANVAS_BG_TEMPLATES = [
  { id: 'none', name: 'OFF', value: null },
  { id: 'sakura', name: 'SAKURA', value: 'linear-gradient(135deg, #ffd1dc 0%, #ff9aa2 50%, #ffaaa5 100%)' },
  { id: 'cyber', name: 'CYBER', value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { id: 'sunset', name: 'SUNSET', value: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)' },
  { id: 'ocean', name: 'OCEAN', value: 'linear-gradient(135deg, #2980b9 0%, #6dd5fa 50%, #ffffff 100%)' },
  { id: 'matrix', name: 'MATRIX', value: 'linear-gradient(135deg, #000000 0%, #003300 100%)' },
  { id: 'aurora', name: 'AURORA', value: 'linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%)' },
  { id: 'midnight', name: 'NIGHT', value: 'radial-gradient(ellipse at top, #1b2735 0%, #090a0f 100%)' },
];

// ── Drawing Preview Component ──
const DrawingPreview = ({ data, color, onClick }) => {
  if (!data) return null;
  return (
    <div className="k-drawing-preview" style={{ borderColor: `${color}33` }} onClick={onClick}>
      <div className="k-drawing-icon">
        <FaPalette style={{ color }} />
        <span style={{ color }}>Click to Edit Drawing</span>
      </div>
    </div>
  );
};

// ── Main Drawing Canvas Component ──
function DrawingCanvas({ data, onChange, color }) {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    if (data) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = data;
    }
  }, [data]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color || '#82a1ff';
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = (e) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="drawing-canvas-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{ cursor: 'crosshair', width: '100%', height: '100%', display: 'block' }}
      />
      <button onClick={clearCanvas} style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid #fff', color: '#fff', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}>CLEAR</button>
    </div>
  );
}

const Note = ({ note, onUpdate, onDelete, onFocus, onDuplicate, onSendToBack, appTheme, locateNote }) => {
  // Built-in + user-created categories shown as quick presets.
  const presetCategories = [...CATEGORIES, ...loadCustomCategories().filter(c => !CATEGORIES.includes(c))];
  const [isEditing, setIsEditing] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('STYLE');
  const [, forceTick] = useState(0);
  const [uploading, setUploading] = useState(false);
  const imgInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const savedSelectionRef = useRef({ start: 0, end: 0 });
  const [formatMenu, setFormatMenu] = useState(null); // { x, y } or null

  // Local draft for the textarea — avoids re-rendering the entire notes tree on every keystroke.
  // Only flushed to parent (and the debounced backend save) on blur or after a typing pause.
  const [draftContent, setDraftContent] = useState(note.content || '');
  const draftRef = useRef(draftContent);
  const flushTimerRef = useRef(null);

  // Resync draft when the note prop changes from outside (e.g. SignalR update) and we're not editing.
  useEffect(() => {
    if (!isEditing) {
      setDraftContent(note.content || '');
      draftRef.current = note.content || '';
    }
  }, [note.content, isEditing]);

  const flushDraft = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (draftRef.current !== (note.content || '')) {
      onUpdate(note.id, { content: draftRef.current });
    }
  }, [note.id, note.content, onUpdate]);

  const handleDraftChange = (e) => {
    const value = e.target.value;
    setDraftContent(value);
    draftRef.current = value;
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushDraft, 400);
  };

  // Apply markdown formatting at the textarea's current selection.
  // mode: 'wrap' (left/right around selection), 'linePrefix' (prepend to each line), 'replace' (insert text)
  const applyFormat = useCallback((spec) => {
    const ta = textareaRef.current;
    // Use live selection if textarea is mounted, else fall back to the saved range
    // captured when the format menu opened (textarea may have been unmounted by blur).
    const liveStart = ta ? ta.selectionStart : savedSelectionRef.current.start;
    const liveEnd = ta ? ta.selectionEnd : savedSelectionRef.current.end;
    const start = liveStart;
    const end = liveEnd;
    const value = draftRef.current ?? '';
    const selected = value.slice(start, end);
    let next = value;
    let nextStart = start;
    let nextEnd = end;

    if (spec.mode === 'wrap') {
      const { left, right = left, placeholder = '' } = spec;
      const inner = selected || placeholder;
      next = value.slice(0, start) + left + inner + right + value.slice(end);
      nextStart = start + left.length;
      nextEnd = nextStart + inner.length;
    } else if (spec.mode === 'linePrefix') {
      const { prefix } = spec;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const block = value.slice(lineStart, end);
      const transformed = block
        .split('\n')
        .map((ln) => (ln.startsWith(prefix) ? ln : prefix + ln))
        .join('\n');
      next = value.slice(0, lineStart) + transformed + value.slice(end);
      nextStart = lineStart;
      nextEnd = lineStart + transformed.length;
    } else if (spec.mode === 'replace') {
      const { text } = spec;
      next = value.slice(0, start) + text + value.slice(end);
      nextStart = start + text.length;
      nextEnd = nextStart;
    }

    setDraftContent(next);
    draftRef.current = next;
    savedSelectionRef.current = { start: nextStart, end: nextEnd };
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushDraft, 400);
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(nextStart, nextEnd);
    });
  }, [flushDraft]);

  const FORMAT_ACTIONS = {
    bold:      { mode: 'wrap', left: '**', placeholder: 'bold', key: 'Ctrl+B' },
    italic:    { mode: 'wrap', left: '*', placeholder: 'italic', key: 'Ctrl+I' },
    code:      { mode: 'wrap', left: '`', placeholder: 'code', key: 'Ctrl+E' },
    strike:    { mode: 'wrap', left: '~~', placeholder: 'strike', key: 'Ctrl+Shift+X' },
    highlight: { mode: 'wrap', left: '==', placeholder: 'highlight', key: 'Ctrl+Shift+H' },
    link:      { mode: 'wrap', left: '[', right: '](url)', placeholder: 'text', key: 'Ctrl+K' },
    image:     { mode: 'replace', text: '![alt](https://)', key: 'Ctrl+Shift+I' },
    h1:        { mode: 'linePrefix', prefix: '# ', key: 'Ctrl+Alt+1' },
    h2:        { mode: 'linePrefix', prefix: '## ', key: 'Ctrl+Alt+2' },
    h3:        { mode: 'linePrefix', prefix: '### ', key: 'Ctrl+Alt+3' },
    bullet:    { mode: 'linePrefix', prefix: '- ', key: 'Ctrl+Shift+L' },
    numbered:  { mode: 'linePrefix', prefix: '1. ', key: 'Ctrl+Shift+O' },
    quote:     { mode: 'linePrefix', prefix: '> ', key: 'Ctrl+Shift+Q' },
    task:      { mode: 'linePrefix', prefix: '- [ ] ', key: 'Ctrl+Shift+T' },
    codeblock: { mode: 'wrap', left: '\n```\n', right: '\n```\n', placeholder: 'code', key: 'Ctrl+/' },
    hr:        { mode: 'replace', text: '\n---\n', key: 'Ctrl+Shift+-' },
  };

  const runFormat = useCallback((id) => {
    const spec = FORMAT_ACTIONS[id];
    if (spec) applyFormat(spec);
  }, [applyFormat]);

  const handleEditorKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    const shift = e.shiftKey;
    const alt = e.altKey;
    let id = null;
    if (!shift && !alt && k === 'b') id = 'bold';
    else if (!shift && !alt && k === 'i') id = 'italic';
    else if (!shift && !alt && k === 'e') id = 'code';
    else if (!shift && !alt && k === 'k') id = 'link';
    else if (!shift && !alt && k === '/') id = 'codeblock';
    else if (shift && !alt && k === 'x') id = 'strike';
    else if (shift && !alt && k === 'h') id = 'highlight';
    else if (shift && !alt && k === 'i') id = 'image';
    else if (shift && !alt && k === 'l') id = 'bullet';
    else if (shift && !alt && k === 'o') id = 'numbered';
    else if (shift && !alt && k === 'q') id = 'quote';
    else if (shift && !alt && k === 't') id = 'task';
    else if (shift && !alt && (k === '-' || k === '_')) id = 'hr';
    else if (alt && !shift && k === '1') id = 'h1';
    else if (alt && !shift && k === '2') id = 'h2';
    else if (alt && !shift && k === '3') id = 'h3';
    else if (!shift && !alt && k === 'enter') {
      e.preventDefault();
      onUpdate(note.id, { isFullscreen: !note.isFullscreen });
      return;
    }
    if (id) {
      e.preventDefault();
      runFormat(id);
    }
  };

  const openFormatMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ta = textareaRef.current;
    if (ta) {
      savedSelectionRef.current = { start: ta.selectionStart, end: ta.selectionEnd };
    } else if (!isEditing) {
      // Not in edit mode yet — switch in so the format actions land on a real textarea.
      setIsEditing(true);
      const len = (draftRef.current || '').length;
      savedSelectionRef.current = { start: len, end: len };
    }
    setFormatMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!formatMenu) return;
    const close = () => setFormatMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [formatMenu]);

  useEffect(() => () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushDraft();
    }
  }, [flushDraft]);

  // Re-render fullscreen note when window resizes so it tracks viewport size.
  useEffect(() => {
    if (!note.isFullscreen) return;
    const onResize = () => forceTick(t => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [note.isFullscreen]);

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const handleAttachmentUpload = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await uploadFilesToCloudinary(list);
      const newAttachments = uploaded.map(f => ({
        type: (f.contentType || '').startsWith('image/') ? 'image' : 'file',
        url: f.cloudUrl,
        name: f.originalName,
        size: f.sizeInBytes,
        contentType: f.contentType,
      }));
      onUpdate(note.id, { attachments: [...(note.attachments || []), ...newAttachments] });
    } catch (err) {
      console.error('[NOTE-UPLOAD-ERROR]', err);
      alert('Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) pastedFiles.push(f);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleAttachmentUpload(pastedFiles);
    }
  };

  const removeAttachment = (url) => {
    onUpdate(note.id, { attachments: (note.attachments || []).filter(a => a.url !== url) });
  };

  const imageAttachments = (note.attachments || []).filter(a => a.type === 'image');
  const fileAttachments = (note.attachments || []).filter(a => a.type !== 'image');

  const theme = COLORS.find(c => c.id === note.color) || COLORS[0];
  const accentColor = note.customColor || theme.color;
  const accentRgb = note.customRgb || theme.rgb;

  // Resolve text color: customTextColorHex > accent > customTextColor preset > theme default
  // Treat the legacy "default" values (#0f172a / #a6accd) as unset so older notes
  // follow the current theme instead of staying locked to creation-time color.
  const THEME_DEFAULT_SENTINELS = ['#0f172a', '#a6accd'];
  const hasRealCustomColor = note.customTextColor
    && note.customTextColor !== 'null'
    && note.customTextColor !== null
    && !THEME_DEFAULT_SENTINELS.includes(String(note.customTextColor).toLowerCase());
  const resolvedTextColor = note.customTextColorHex
    || (note.customTextColor === 'accent'
      ? accentColor
      : (hasRealCustomColor
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

  const teachAI = async () => {
    if (!note.content) {
      alert("Note content is empty!");
      return;
    }
    try {
      await axiosInstance.post('/api/Chat/update-ai-memory', {
        content: `[USER_NOTE]: ${note.title || 'Untitled'}\n${note.content}`,
        userName: 'minhtai'
      });
      alert("AI has learned this note content!");
    } catch (err) {
      console.error("[TEACH-AI-ERROR]", err);
      alert("Failed to teach AI. Ensure you have the required permissions.");
    }
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

  // Popup defaults: slide-in drawer docked to the right edge, full viewport height.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const defaultPopupW = vw < 720
    ? Math.max(280, Math.round(vw * 0.92))
    : Math.min(640, Math.max(420, Math.round(vw * 0.42)));
  const defaultPopupH = vh;
  const popupW = Math.min(note.popupWidth || defaultPopupW, vw);
  const popupH = Math.min(note.popupHeight || defaultPopupH, vh);
  const defaultPopupX = Math.max(0, vw - popupW);
  const defaultPopupY = 0;
  const popupX = note.popupX != null ? Math.min(note.popupX, vw - popupW) : defaultPopupX;
  const popupY = note.popupY != null ? Math.min(note.popupY, vh - popupH) : defaultPopupY;

  return (
    <>
      {note.isFullscreen && (
        <div
          className="note-fullscreen-backdrop"
          onClick={() => onUpdate(note.id, { isFullscreen: false })}
        />
      )}
    <Rnd
      size={
        note.isFullscreen
          ? { width: popupW, height: popupH }
          : { width: note.width, height: note.isMinimized ? 40 : note.height }
      }
      position={
        note.isFullscreen
          ? { x: popupX, y: popupY }
          : { x: Math.max(0, note.x || 0), y: Math.max(0, note.y || 0) }
      }
      onDragStop={(e, d) => {
        if (note.isFullscreen) {
          onUpdate(note.id, { popupX: d.x, popupY: d.y });
          return;
        }
        onUpdate(note.id, { x: Math.max(0, d.x), y: Math.max(0, d.y) });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        if (note.isFullscreen) {
          onUpdate(note.id, {
            popupWidth: parseInt(ref.style.width),
            popupHeight: parseInt(ref.style.height),
            popupX: position.x,
            popupY: position.y,
          });
          return;
        }
        if (!note.isMinimized) {
          onUpdate(note.id, {
            width: parseInt(ref.style.width),
            height: parseInt(ref.style.height),
            x: Math.max(0, position.x),
            y: Math.max(0, position.y),
          });
        }
      }}
      disableResizing={note.isMinimized || note.locked || note.isFullscreen}
      dragHandleClassName="note-header"
      minWidth={note.isFullscreen ? 360 : 200}
      minHeight={note.isMinimized ? 40 : (note.isFullscreen ? 280 : 150)}
      bounds={false}
      disableDragging={note.locked || note.isFullscreen}
      style={{
        zIndex: note.isFullscreen ? 9999 : note.zIndex,
        position: note.isFullscreen ? 'fixed' : 'absolute',
        opacity: note.opacity || 1
      }}
      onDragStart={() => onFocus(note.id)}
      onResizeStart={() => onFocus(note.id)}
    >
      <div
        id={`note-card-${note.id}`}
        className={`daily-note-card-cyber ${note.isSelected ? 'is-selected' : ''} ${note.isFocused ? 'is-focused' : ''} ${note.isDeleting ? 'deleting' : ''} ${note.isMinimized ? 'minimized' : ''} ${getBorderStyle(note.borderStyle) === 'dashed' ? 'border-dashed' : ''} ${note.isCompleted ? 'is-completed' : ''} ${note.glow ? 'glow-active' : ''} ${note.highlighted ? 'is-highlighted' : ''} ${note.compact ? 'is-compact' : ''} ${note.hideCategory ? 'category-hidden' : ''} ${note.isFullscreen ? 'is-fullscreen-popup' : ''} bg-pattern-${note.pattern === 1 ? 'dots' : note.pattern === 2 ? 'stripes' : note.pattern === 3 ? 'grid' : note.pattern === 4 ? 'cross' : 'none'} note-theme-${note.noteTheme === 1 ? 'light' : (note.noteTheme === 2 ? 'sticky' : 'dark')}`}
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
        <div className={`note-header ${note.hideHeader ? 'header-hidden' : ''}`}>
          <div className="header-left">
            {!note.hideHeader && <span className="timestamp">[ {note.timestamp} ]</span>}
            {!note.hideHeader && note.updatedAt && (
              <span className="timestamp updated-at" title={`Last edited: ${new Date(note.updatedAt).toLocaleString()}`}>
                ~ {format(new Date(note.updatedAt), 'HH:mm')}
              </span>
            )}
          </div>
          <div className="header-actions">
            <button className={`action-btn drawing-btn ${showDrawing ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setShowDrawing(!showDrawing); }} title="Doodle / Draw">
              <FaPalette />
            </button>
            <button className="action-btn config-btn" onClick={() => setShowProps(!showProps)} title="Settings">
              <FaCog />
            </button>
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              overlayClassName={`note-overflow-dropdown theme-${appTheme}`}
              dropdownRender={() => (
                <div className="note-overflow-menu" onClick={(e) => e.stopPropagation()}>
                  <button className={`overflow-item ${copied ? 'is-active' : ''}`} onClick={handleCopy}>
                    {copied ? <FaCheck /> : <FaCopy />} <span>{copied ? 'Copied' : 'Copy content'}</span>
                  </button>
                  <button
                    className="overflow-item"
                    onClick={(e) => { e.stopPropagation(); imgInputRef.current?.click(); }}
                    disabled={uploading}
                  >
                    <FaImage /> <span>Upload image</span>
                  </button>
                  <button
                    className="overflow-item"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    disabled={uploading}
                  >
                    <FaPaperclip /> <span>Upload file</span>
                  </button>
                  <button className="overflow-item" onClick={toggleMinimize}>
                    {note.isMinimized ? <FaWindowMaximize /> : <FaWindowMinimize />}
                    <span>{note.isMinimized ? 'Maximize' : 'Minimize'}</span>
                  </button>
                  <button
                    className="overflow-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      const turningOn = !note.isFullscreen;
                      onUpdate(note.id, turningOn
                        ? { isFullscreen: true, popupX: null, popupY: null, popupWidth: null, popupHeight: null }
                        : { isFullscreen: false });
                    }}
                  >
                    {note.isFullscreen ? <FaCompressArrowsAlt /> : <FaExpandArrowsAlt />}
                    <span>{note.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
                  </button>
                  <button className="overflow-item" onClick={cycleColor}>
                    <FaPalette /> <span>Cycle color</span>
                  </button>
                  {onDuplicate && (
                    <button className="overflow-item" onClick={(e) => { e.stopPropagation(); onDuplicate(note); }}>
                      <FaClone /> <span>Duplicate</span>
                    </button>
                  )}
                  {onSendToBack && (
                    <button className="overflow-item" onClick={(e) => { e.stopPropagation(); onSendToBack(note.id); }}>
                      <FaLayerGroup /> <span>Send to back</span>
                    </button>
                  )}
                </div>
              )}
            >
              <button className="action-btn more-btn" onClick={(e) => e.stopPropagation()} title="More actions">
                <FaEllipsisH />
              </button>
            </Dropdown>
            <button className="action-btn delete-btn" onClick={() => onDelete(note.id)} title="Delete">
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
                      <div className="ins-control" onClick={() => onUpdate(note.id, { hideCategory: !note.hideCategory })}>
                        <FaTag className={note.hideCategory ? 'active-icon' : ''} />
                        <span>{note.hideCategory ? 'CAT_OFF' : 'CAT_ON'}</span>
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
                        {presetCategories.map(cat => (
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
                    <button className="ins-footer-btn secondary" onClick={teachAI} style={{ width: '100%', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', background: 'rgba(var(--accent-rgb), 0.05)', marginBottom: '10px' }}>
                      <FaBrain /> TEACH_AI_THIS
                    </button>
                    <div className="ins-footer-grid">
                      <button className="ins-footer-btn secondary" onClick={() => onUpdate(note.id, { rotation: 0, opacity: 1, borderWidth: 1, borderRadius: 0, blur: 0, glow: false, customTextColor: null, customTextColorHex: null })}>
                        <FaSyncAlt /> RESET
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
          <div className="note-body" onPaste={handlePaste}>
            <input
              className="note-title-input"
              value={note.title || ''}
              onChange={(e) => onUpdate(note.id, { title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder=":: ENTRY_TITLE"
              style={{ textAlign: getTitleAlign(note.titleAlign) }}
            />

            {imageAttachments.length > 0 && (
              <div className="note-image-attachments">
                {imageAttachments.map(att => (
                  <div className="note-image-item" key={att.url}>
                    <a href={att.url} target="_blank" rel="noopener noreferrer">
                      <img src={att.url} alt={att.name} />
                    </a>
                    <button
                      className="att-remove"
                      onClick={(e) => { e.stopPropagation(); removeAttachment(att.url); }}
                      title="Remove"
                    >
                      <FaTimes />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className="content-container"
              onClick={showDrawing ? undefined : startEditing}
              onContextMenu={note.isFullscreen && !showDrawing ? openFormatMenu : undefined}
            >
              {showDrawing ? (
                <div className="note-drawing-container" onClick={(e) => e.stopPropagation()} style={{ height: '100%', minHeight: '180px', position: 'relative' }}>
                  <DrawingCanvas
                    data={note.drawingData}
                    onChange={(data) => onUpdate(note.id, { drawingData: data })}
                    color={accentColor}
                  />
                </div>
              ) : isEditing ? (
                <textarea
                  ref={textareaRef}
                  className="note-content-area"
                  value={draftContent}
                  onChange={handleDraftChange}
                  onKeyDown={handleEditorKeyDown}
                  placeholder="> waiting for input... (paste image/file to attach)"
                  autoFocus
                  onBlur={() => {
                    flushDraft();
                    setIsEditing(false);
                  }}
                />
              ) : (
                <div className="markdown-preview">
                  {note.drawingData && (
                    <div className="note-drawing-preview-wrapper" onClick={(e) => { e.stopPropagation(); setShowDrawing(true); }} title="Click to edit sketch">
                      <img src={note.drawingData} alt="Sketch" className="note-doodle-img" />
                    </div>
                  )}
                  {note.content ? (
                    <ReactMarkdown>{note.content}</ReactMarkdown>
                  ) : (
                    !note.drawingData && <span className="placeholder-text">{'> waiting for input...'}</span>
                  )}
                </div>
              )}
            </div>

            {/* Linked Notes Section */}
            {note.linkedNoteIds && note.linkedNoteIds.split(',').filter(Boolean).length > 0 && (
              <div className="note-linked-chips" onClick={(e) => e.stopPropagation()}>
                <span className="linked-title"><FaLink /> LINKS:</span>
                <div className="chips-container">
                  {note.linkedNoteIds.split(',').filter(Boolean).map(linkId => {
                    const target = window.allCurrentNotesGlobal?.find(n => n.id === linkId);
                    if (!target) return null;
                    const targetTheme = COLORS.find(c => c.id === target.color) || COLORS[0];
                    const targetColor = target.customColor || targetTheme.color;
                    return (
                      <button
                        key={linkId}
                        className="link-chip"
                        style={{ '--link-color': targetColor }}
                        onClick={() => locateNote && locateNote(linkId)}
                        title={`Go to ${target.title || 'Untitled'}`}
                      >
                        {target.title || 'Untitled'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {fileAttachments.length > 0 && (
              <div className="note-file-attachments">
                {fileAttachments.map(att => (
                  <div className="att-chip" key={att.url} onClick={(e) => e.stopPropagation()}>
                    <FaFileAlt className="att-icon" />
                    <span className="att-name" title={att.name}>{att.name}</span>
                    {att.size != null && <span className="att-size">{formatFileSize(att.size)}</span>}
                    <a href={att.url} target="_blank" rel="noopener noreferrer" download={att.name} className="att-action" title="Download">
                      <FaDownload />
                    </a>
                    <button className="att-remove" onClick={() => removeAttachment(att.url)} title="Remove">
                      <FaTimes />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploading && <div className="note-upload-indicator">Uploading...</div>}

            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { handleAttachmentUpload(e.target.files); e.target.value = ''; }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { handleAttachmentUpload(e.target.files); e.target.value = ''; }}
            />
          </div>
        )}
      </div>
    </Rnd>
    {formatMenu && (
      <div
        className="note-format-menu"
        style={{ top: formatMenu.y, left: formatMenu.x }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="fmt-section">
          <button className="fmt-btn" onClick={() => { runFormat('bold'); setFormatMenu(null); }}>
            <span className="fmt-icon" style={{ fontWeight: 700 }}>B</span>
            <span className="fmt-label">Bold</span>
            <span className="fmt-shortcut">Ctrl+B</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('italic'); setFormatMenu(null); }}>
            <span className="fmt-icon" style={{ fontStyle: 'italic' }}>I</span>
            <span className="fmt-label">Italic</span>
            <span className="fmt-shortcut">Ctrl+I</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('code'); setFormatMenu(null); }}>
            <span className="fmt-icon" style={{ fontFamily: 'monospace' }}>{'<>'}</span>
            <span className="fmt-label">Inline code</span>
            <span className="fmt-shortcut">Ctrl+E</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('strike'); setFormatMenu(null); }}>
            <span className="fmt-icon" style={{ textDecoration: 'line-through' }}>S</span>
            <span className="fmt-label">Strike</span>
            <span className="fmt-shortcut">Ctrl+Shift+X</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('highlight'); setFormatMenu(null); }}>
            <span className="fmt-icon" style={{ background: 'rgba(250,204,21,0.4)', padding: '0 4px' }}>H</span>
            <span className="fmt-label">Highlight</span>
            <span className="fmt-shortcut">Ctrl+Shift+H</span>
          </button>
        </div>
        <div className="fmt-divider" />
        <div className="fmt-section">
          <button className="fmt-btn" onClick={() => { runFormat('h1'); setFormatMenu(null); }}>
            <span className="fmt-icon">H1</span>
            <span className="fmt-label">Heading 1</span>
            <span className="fmt-shortcut">Ctrl+Alt+1</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('h2'); setFormatMenu(null); }}>
            <span className="fmt-icon">H2</span>
            <span className="fmt-label">Heading 2</span>
            <span className="fmt-shortcut">Ctrl+Alt+2</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('h3'); setFormatMenu(null); }}>
            <span className="fmt-icon">H3</span>
            <span className="fmt-label">Heading 3</span>
            <span className="fmt-shortcut">Ctrl+Alt+3</span>
          </button>
        </div>
        <div className="fmt-divider" />
        <div className="fmt-section">
          <button className="fmt-btn" onClick={() => { runFormat('bullet'); setFormatMenu(null); }}>
            <span className="fmt-icon">•</span>
            <span className="fmt-label">Bullet list</span>
            <span className="fmt-shortcut">Ctrl+Shift+L</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('numbered'); setFormatMenu(null); }}>
            <span className="fmt-icon">1.</span>
            <span className="fmt-label">Numbered list</span>
            <span className="fmt-shortcut">Ctrl+Shift+O</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('task'); setFormatMenu(null); }}>
            <span className="fmt-icon">☐</span>
            <span className="fmt-label">Task list</span>
            <span className="fmt-shortcut">Ctrl+Shift+T</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('quote'); setFormatMenu(null); }}>
            <span className="fmt-icon">❝</span>
            <span className="fmt-label">Quote</span>
            <span className="fmt-shortcut">Ctrl+Shift+Q</span>
          </button>
        </div>
        <div className="fmt-divider" />
        <div className="fmt-section">
          <button className="fmt-btn" onClick={() => { runFormat('link'); setFormatMenu(null); }}>
            <span className="fmt-icon">🔗</span>
            <span className="fmt-label">Link</span>
            <span className="fmt-shortcut">Ctrl+K</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('image'); setFormatMenu(null); }}>
            <span className="fmt-icon">🖼</span>
            <span className="fmt-label">Image</span>
            <span className="fmt-shortcut">Ctrl+Shift+I</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('codeblock'); setFormatMenu(null); }}>
            <span className="fmt-icon">{'{}'}</span>
            <span className="fmt-label">Code block</span>
            <span className="fmt-shortcut">Ctrl+/</span>
          </button>
          <button className="fmt-btn" onClick={() => { runFormat('hr'); setFormatMenu(null); }}>
            <span className="fmt-icon">―</span>
            <span className="fmt-label">Divider</span>
            <span className="fmt-shortcut">Ctrl+Shift+-</span>
          </button>
        </div>
        <div className="fmt-divider" />
        <div className="fmt-section">
          <button className="fmt-btn" onClick={() => { onUpdate(note.id, { isFullscreen: false }); setFormatMenu(null); }}>
            <span className="fmt-icon">⤢</span>
            <span className="fmt-label">Exit fullscreen</span>
            <span className="fmt-shortcut">Ctrl+Enter</span>
          </button>
        </div>
      </div>
    )}
    </>
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
  const [allNotesIndex, setAllNotesIndex] = useState([]);
  const [topZIndex, setTopZIndex] = useState(10);
  const [selectedColor, setSelectedColor] = useState(() => localStorage.getItem('daily-note-color') || 'cyan');
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('saved');
  const [theme, setTheme] = useState(() => localStorage.getItem('daily-note-theme') || 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState(() => localStorage.getItem('daily-note-search-scope') || 'day');
  const [showGlobalSearchResults, setShowGlobalSearchResults] = useState(false);
  const [showGrid, setShowGrid] = useState(() => localStorage.getItem('daily-note-grid') !== 'false');
  const [canvasBg, setCanvasBg] = useState(() => localStorage.getItem('daily-note-canvas-bg') || '');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [customBgUrl, setCustomBgUrl] = useState('');
  const [trashByDate, setTrashByDate] = useState({});
  const [showTrash, setShowTrash] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showHotkeyHelp, setShowHotkeyHelp] = useState(false);
  // Canvas right-click menu: { screenX, screenY, canvasX, canvasY } or null.
  const [ctxMenu, setCtxMenu] = useState(null);
  const hotkeyRef = useRef({});
  const [connection, setConnection] = useState(null);
  const [userId, setUserId] = useState(null);

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('daily-note-view-mode') || 'canvas'); // 'canvas' or 'kanban'
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionRect, setSelectionRect] = useState(null);
  const canvasRef = React.useRef(null);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const allCurrentNotes = notesByDate[dateKey] || [];
  const currentNotes = allCurrentNotes.filter(n => !n.isDeleted);
  const isAllTimeSearch = searchScope === 'all';

  // Sidebar States
  const [showSidebar, setShowSidebar] = useState(() => localStorage.getItem('daily-note-sidebar') === 'true');
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [sidebarFilterCat, setSidebarFilterCat] = useState('ALL');

  // Custom (user-created) categories, persisted. Effective list = built-in + custom.
  const [customCategories, setCustomCategories] = useState(loadCustomCategories);
  const allCategories = useMemo(
    () => [...CATEGORIES, ...customCategories.filter(c => !CATEGORIES.includes(c))],
    [customCategories]
  );
  const [newCatInput, setNewCatInput] = useState('');
  const [searchCatFilter, setSearchCatFilter] = useState('ALL'); // category filter for the search bar

  const addCustomCategory = (raw) => {
    const cat = String(raw || '').trim().toUpperCase().replace(/\s+/g, '_').slice(0, 16);
    if (!cat) return;
    if (allCategories.includes(cat)) { setNewCatInput(''); return; }
    setCustomCategories(prev => {
      const next = [...prev, cat];
      localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(next));
      return next;
    });
    setNewCatInput('');
  };

  const removeCustomCategory = (cat) => {
    setCustomCategories(prev => {
      const next = prev.filter(c => c !== cat);
      localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(next));
      return next;
    });
    if (sidebarFilterCat === cat) setSidebarFilterCat('ALL');
    if (searchCatFilter === cat) setSearchCatFilter('ALL');
  };

  // Persist view-preference options so they survive a reload.
  useEffect(() => { localStorage.setItem('daily-note-view-mode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('daily-note-grid', String(showGrid)); }, [showGrid]);
  useEffect(() => { localStorage.setItem('daily-note-color', selectedColor); }, [selectedColor]);

  const filteredSidebarNotes = allCurrentNotes.filter(n => {
    if (n.isDeleted) return false;
    const queryMatch = sidebarQuery.trim() === '' || 
      n.title?.toLowerCase().includes(sidebarQuery.toLowerCase()) ||
      n.content?.toLowerCase().includes(sidebarQuery.toLowerCase());
    const catMatch = sidebarFilterCat === 'ALL' || (n.customCategory || n.category) === sidebarFilterCat;
    return queryMatch && catMatch;
  });

  const toggleSidebar = () => {
    setShowSidebar(v => {
      const next = !v;
      localStorage.setItem('daily-note-sidebar', String(next));
      return next;
    });
  };

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

  // Persist the chosen interface theme. localStorage keeps the choice across reloads.
  const setThemeMode = (mode) => {
    setTheme(mode);
    localStorage.setItem('daily-note-theme', mode);
  };

  // Hotkey (D) cycles through all interface themes, incl. the TUI terminal look.
  const toggleTheme = () => {
    const order = ['dark', 'light', 'tui'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setThemeMode(next);
  };

  const applyCanvasBg = (val) => {
    if (!val) {
      setCanvasBg('');
      localStorage.removeItem('daily-note-canvas-bg');
    } else {
      setCanvasBg(val);
      localStorage.setItem('daily-note-canvas-bg', val);
    }
  };

  const canvasBgStyle = canvasBg
    ? {
      backgroundImage: canvasBg.startsWith('http') || canvasBg.startsWith('data:')
        ? `url("${canvasBg}")`
        : canvasBg,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
    : undefined;

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
                const current = prev[dateKey] || [];
                // Nếu note bị đánh dấu xóa (Soft delete), loại bỏ khỏi state ngay lập tức
                if (updatedNote.isDeleted) {
                  return { ...prev, [dateKey]: current.filter(n => n.id !== updatedNote.id) };
                }
                // Nếu không thì cập nhật nội dung
                const updated = current.map(n => n.id === updatedNote.id ? { ...n, ...updatedNote } : n);
                return { ...prev, [dateKey]: updated };
              });
            }
          });

          connection.on("NoteDeleted", (noteId) => {
            setNotesByDate(prev => {
              const current = prev[dateKey] || [];
              const removed = current.find(n => n.id === noteId);
              if (removed) {
                setTrashByDate(t => ({
                  ...t,
                  [dateKey]: [...(t[dateKey] || []).filter(n => n.id !== noteId), { ...removed, isDeleted: true, deletedAt: new Date().toISOString() }]
                }));
              }
              return { ...prev, [dateKey]: current.filter(n => n.id !== noteId) };
            });
          });

          connection.on("NoteRestored", (restored) => {
            if (restored.date !== dateKey) return;
            setTrashByDate(prev => ({
              ...prev,
              [dateKey]: (prev[dateKey] || []).filter(n => n.id !== restored.id)
            }));
            setNotesByDate(prev => {
              const current = prev[dateKey] || [];
              if (current.some(n => n.id === restored.id)) return prev;
              return { ...prev, [dateKey]: [...current, { ...restored, isFocused: false, isDeleting: false }] };
            });
          });

          connection.on("NotePurged", (noteId) => {
            setTrashByDate(prev => ({
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
      const response = await axiosInstance.get(`/api/DailyNote/${date}?includeDeleted=true`);
      const active = response.data.filter(n => !n.isDeleted);
      const deleted = response.data
        .filter(n => n.isDeleted)
        .map(n => ({ ...n, deletedAt: n.updatedAt || new Date().toISOString() }));

      setNotesByDate(prev => ({
        ...prev,
        [date]: active.map(n => ({ ...n, isFocused: false, isDeleting: false }))
      }));
      setTrashByDate(prev => ({ ...prev, [date]: deleted }));

      if (active.length > 0) {
        const maxZ = Math.max(...active.map(n => n.zIndex));
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

  const fetchAllNotes = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/api/DailyNote/all');
      setAllNotesIndex(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('[ERROR] Failed to fetch all notes:', error);
    }
  }, []);

  useEffect(() => {
    fetchAllNotes();
  }, [fetchAllNotes]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchPool = isAllTimeSearch ? allNotesIndex : currentNotes;
  const searchCatActive = searchCatFilter !== 'ALL';
  const searchActive = !!normalizedSearchQuery || searchCatActive;
  const searchResults = searchActive
    ? searchPool
        .filter(n => !n.isDeleted)
        .filter(n => !searchCatActive || (n.customCategory || n.category) === searchCatFilter)
        .filter(n => {
          if (!normalizedSearchQuery) return true;
          const haystack = [
            n.title,
            n.content,
            n.category,
            n.customCategory,
            n.timestamp,
            n.date,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(normalizedSearchQuery);
        })
        .slice(0, 50)
    : [];
  const visibleNotes = searchActive ? searchResults : currentNotes;

  const openSearchResult = async (note) => {
    if (!note?.date) return;
    const targetDate = new Date(note.date);
    if (isNaN(targetDate)) return;
    await fetchNotes(format(targetDate, 'yyyy-MM-dd'));
    setCurrentDate(targetDate);
    setShowGlobalSearchResults(false);
    setTimeout(() => {
      locateNote(note.id);
    }, 250);
  };

  const handleSearchScopeChange = (scope) => {
    setSearchScope(scope);
    localStorage.setItem('daily-note-search-scope', scope);
    setShowGlobalSearchResults(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const tag = t?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || t?.isContentEditable;

      if (e.key === 'Escape') {
        if (isTyping && typeof t.blur === 'function') { t.blur(); return; }
        const r = hotkeyRef.current;
        r.setShowToolsMenu(false);
        r.setShowHotkeyHelp(false);
        r.setShowNewMenu(false);
        r.setShowBgPicker(false);
        r.setShowTrash(false);
        r.setCtxMenu(null);
        return;
      }

      if (isTyping) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const r = hotkeyRef.current;
      const map = {
        n: () => r.addNote('blank'),
        t: () => r.addNote('todo'),
        m: () => r.addNote('meeting'),
        k: () => r.addNote('code'),
        v: () => r.setViewMode(v => v === 'canvas' ? 'kanban' : 'canvas'),
        d: () => r.toggleTheme(),
        b: () => r.setShowBgPicker(v => !v),
        g: () => r.setShowGrid(v => !v),
        r: () => r.setShowTrash(v => !v),
        c: () => r.setShowToolsMenu(v => !v),
        s: () => r.toggleSidebar(),
        '?': () => r.setShowHotkeyHelp(v => !v),
        '/': () => {
          const el = document.querySelector('.search-box-cyber input');
          if (el) el.focus();
        },
      };

      const handler = map[e.key.toLowerCase()] || (e.key === '?' ? map['?'] : null);
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      // Leave customTextColor unset so the note follows the current theme
      // dynamically; setting it here would freeze the color at creation time.
      customTextColor: null,
      updatedAt: new Date().toISOString(),
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
    const stamp = { updatedAt: new Date().toISOString() };
    setNotesByDate(prev => {
      const updated = (prev[dateKey] || []).map(n => n.id === id ? { ...n, ...updates, ...stamp } : n);
      saveNotesToBackend(updated.map(n => ({ ...n, date: dateKey })));
      return {
        ...prev,
        [dateKey]: updated
      };
    });
  };

  const deleteNote = async (id) => {
    if (!window.confirm("ARE YOU SURE YOU WANT TO HIDE THIS ENTRY?")) return;

    const noteToTrash = (notesByDate[dateKey] || []).find(n => n.id === id);

    // 1. Xóa ngay lập tức khỏi State để người dùng thấy nó biến mất và tránh bị Auto-save ghi đè
    setNotesByDate(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter(n => n.id !== id)
    }));

    // 1b. Đẩy vào trash session để có thể khôi phục trong cùng phiên làm việc
    if (noteToTrash) {
      setTrashByDate(prev => ({
        ...prev,
        [dateKey]: [...(prev[dateKey] || []), { ...noteToTrash, deletedAt: new Date().toISOString() }]
      }));
    }

    // 2. Gọi API DELETE chuyên biệt để Backend xử lý IsDeleted = true
    try {
      setSyncStatus('saving');
      await axiosInstance.delete(`/api/DailyNote/${id}`);
      setSyncStatus('saved');
    } catch (error) {
      console.error("[ERROR] Failed to hide note:", error);
      setSyncStatus('error');
      // Nếu lỗi, có thể cân nhắc fetch lại dữ liệu hoặc thông báo cho người dùng
    }
  };

  const restoreNote = async (trashedNote) => {
    const { isFocused, isDeleting, deletedAt, ...rest } = trashedNote;
    const restored = {
      ...rest,
      isDeleted: false,
      isMinimized: false,
      isFullscreen: false,
      updatedAt: new Date().toISOString(),
    };

    // Remove from trash
    setTrashByDate(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter(n => n.id !== trashedNote.id)
    }));

    // Add back to active notes
    setNotesByDate(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), restored]
    }));

    try {
      setSyncStatus('saving');
      await axiosInstance.post(`/api/DailyNote/${trashedNote.id}/restore`);
      setSyncStatus('saved');
    } catch (err) {
      console.error('[RESTORE-ERROR]', err);
      setSyncStatus('error');
    }
  };

  const purgeTrashedNote = async (trashId) => {
    setTrashByDate(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter(n => n.id !== trashId)
    }));
    try {
      await axiosInstance.delete(`/api/DailyNote/${trashId}/permanent`);
    } catch (err) {
      console.error('[PURGE-ERROR]', err);
    }
  };

  const clearTrash = async () => {
    if (!window.confirm('Empty today\'s trash? Notes here will no longer be restorable from this view.')) return;
    const ids = (trashByDate[dateKey] || []).map(n => n.id);
    setTrashByDate(prev => ({ ...prev, [dateKey]: [] }));
    try {
      await Promise.all(ids.map(id => axiosInstance.delete(`/api/DailyNote/${id}/permanent`)));
    } catch (err) {
      console.error('[CLEAR-TRASH-ERROR]', err);
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

  const locateNote = useCallback((id) => {
    focusNote(id);
    setTimeout(() => {
      const el = document.getElementById(`note-card-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        el.classList.add('locate-glow-active');
        setTimeout(() => {
          el.classList.remove('locate-glow-active');
        }, 2000);
      }
    }, 100);
  }, [focusNote]);

  const deleteSelectedNotes = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`ARE YOU SURE YOU WANT TO HIDE ${selectedIds.length} ENTRIES?`)) return;

    const idsToDelete = [...selectedIds];
    setSelectedIds([]); // Clear selection

    const notesToTrash = (notesByDate[dateKey] || []).filter(n => idsToDelete.includes(n.id));

    // 1. Cập nhật State ngay lập tức
    setNotesByDate(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map(n => idsToDelete.includes(n.id) ? { ...n, isDeleted: true } : n)
    }));

    // 1b. Đẩy vào trash session
    if (notesToTrash.length > 0) {
      const stamp = new Date().toISOString();
      setTrashByDate(prev => ({
        ...prev,
        [dateKey]: [...(prev[dateKey] || []), ...notesToTrash.map(n => ({ ...n, deletedAt: stamp }))]
      }));
    }

    // 2. Gọi API xóa hàng loạt
    try {
      setSyncStatus('saving');
      await Promise.all(idsToDelete.map(id => axiosInstance.delete(`/api/DailyNote/${id}`)));
      setSyncStatus('saved');
    } catch (error) {
      console.error("[ERROR] Failed to delete multiple notes:", error);
      setSyncStatus('error');
    }
  };

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left + canvas.scrollLeft,
      y: e.clientY - rect.top + canvas.scrollTop,
    };
  };

  const handleCanvasMouseDown = (e) => {
    if (viewMode !== 'canvas') return;
    // Only start marquee when clicking the empty canvas — not a note, button, input, or marquee itself
    if (e.target.closest('.daily-note-card-cyber') ||
        e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('textarea') ||
        e.target.closest('.selection-marquee')) {
      return;
    }

    const pt = getCanvasPoint(e);
    if (!pt) return;
    setSelectionRect({ startX: pt.x, startY: pt.y, endX: pt.x, endY: pt.y, active: true });
    setSelectedIds([]);
  };

  const handleCanvasMouseMove = (e) => {
    if (!selectionRect?.active) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;

    setSelectionRect(prev => ({ ...prev, endX: pt.x, endY: pt.y }));

    const x1 = Math.min(selectionRect.startX, pt.x);
    const x2 = Math.max(selectionRect.startX, pt.x);
    const y1 = Math.min(selectionRect.startY, pt.y);
    const y2 = Math.max(selectionRect.startY, pt.y);

    const ids = visibleNotes.filter(n => {
      const nx = n.x;
      const ny = n.y;
      const nw = n.width || 250;
      const nh = n.isMinimized ? 40 : (n.height || 200);
      // AABB intersection
      return nx < x2 && (nx + nw) > x1 && ny < y2 && (ny + nh) > y1;
    }).map(n => n.id);

    setSelectedIds(ids);
  };

  const handleCanvasMouseUp = () => {
    setSelectionRect(null);
  };

  const navigateDate = (days) => {
    setCurrentDate(prev => days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days)));
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    // Only show the canvas menu when right-clicking empty space, not a note.
    if (viewMode !== 'canvas' || e.target.closest('.daily-note-card-cyber')) {
      setCtxMenu(null);
      return;
    }
    const pt = getCanvasPoint(e);
    setCtxMenu({
      screenX: e.clientX,
      screenY: e.clientY,
      canvasX: pt ? pt.x : 0,
      canvasY: pt ? pt.y : 0,
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(visibleNotes.map(n => n.id));
  };

  const toggleGrid = () => setShowGrid(v => !v);

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

  // Refresh the hotkey handler ref on every render so the global keydown
  // listener (attached once on mount) always sees the latest closures
  // without re-attaching. Placed here, after all the action functions are
  // declared, to avoid temporal-dead-zone access on functions like addNote.
  hotkeyRef.current = {
    addNote,
    toggleTheme,
    setViewMode,
    setShowBgPicker,
    setShowTrash,
    setShowGrid,
    setShowToolsMenu,
    setShowNewMenu,
    setShowHotkeyHelp,
    setCtxMenu,
    toggleSidebar,
  };

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
    <div
      className={`daily-note-app-container-cyber theme-${theme} view-${viewMode} ${showGrid ? 'show-grid' : ''}`}
    >
      <header className="app-toolbar-cyber">
        <div className="date-navigator">
          <button className="nav-btn" onClick={() => navigateDate(-1)}><FaChevronLeft /></button>
          <div className="current-date-display">
            <h2>{format(currentDate, 'yyyy_MM_dd')}</h2>
            <div className="status-indicator-container">
              <span className="note-count">ACTIVE_ENTRIES: {searchActive ? searchResults.length : currentNotes.length}</span>
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
          <button
            className={`nav-btn sidebar-toggle-btn ${showSidebar ? 'active' : ''}`}
            onClick={toggleSidebar}
            title="Toggle Sidebar Index (S)"
          >
            <FaListUl />
          </button>

          {selectedIds.length > 0 && (
            <button className="nav-btn delete-selected-btn" onClick={deleteSelectedNotes} title="Delete Selected">
              <FaTrashAlt /> DELETE_SELECTED ({selectedIds.length})
            </button>
          )}

          <div className="toolbar-group toolbar-group-search">
            <div className={`search-box-cyber ${searchActive ? 'is-active' : ''}`}>
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder={isAllTimeSearch ? "SEARCH_ALL..." : "SEARCH..."}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowGlobalSearchResults(true);
                }}
                onFocus={() => setShowGlobalSearchResults(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowGlobalSearchResults(false), 150);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <FaTimes />
                </button>
              )}
              <select
                className={`search-cat-select ${searchCatActive ? 'active' : ''}`}
                value={searchCatFilter}
                onChange={(e) => {
                  setSearchCatFilter(e.target.value);
                  setShowGlobalSearchResults(true);
                }}
                title="Filter by category"
              >
                <option value="ALL">ALL_CATS</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="search-scope-toggle" role="tablist" aria-label="Search scope">
                <button
                  type="button"
                  className={`search-scope-btn ${!isAllTimeSearch ? 'active' : ''}`}
                  onClick={() => handleSearchScopeChange('day')}
                  title="Search only this day"
                >
                  DAY
                </button>
                <button
                  type="button"
                  className={`search-scope-btn ${isAllTimeSearch ? 'active' : ''}`}
                  onClick={() => handleSearchScopeChange('all')}
                  title="Search all notes"
                >
                  ALL
                </button>
              </div>
            </div>
            {showGlobalSearchResults && searchActive && (
              <div className="global-search-dropdown" onMouseDown={(e) => e.preventDefault()}>
                <div className="global-search-header">
                  <span>{isAllTimeSearch ? 'ALL_NOTES_RESULTS' : 'THIS_DAY_RESULTS'}</span>
                  <span>{searchResults.length}</span>
                </div>
                <div className="global-search-list">
                  {searchResults.length === 0 ? (
                    <div className="global-search-empty">No matches found</div>
                  ) : (
                    searchResults.map(note => (
                      <button
                        key={`${note.date}-${note.id}`}
                        className="global-search-item"
                        onClick={() => openSearchResult(note)}
                      >
                        <div className="global-search-item-top">
                          <span className="global-search-title">{note.title || 'Untitled'}</span>
                          <span className="global-search-date">{note.date}</span>
                        </div>
                        <div className="global-search-snippet">
                          {(note.content || '').toString().replace(/\s+/g, ' ').slice(0, 120) || '(empty)'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-picker-container">
            {showBgPicker && (
              <div className="bg-picker-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="bg-picker-header">CANVAS_BG</div>
                <div className="bg-picker-grid">
                  {CANVAS_BG_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      className={`bg-tpl ${(canvasBg || null) === tpl.value ? 'active' : ''}`}
                      style={tpl.value ? { background: tpl.value } : undefined}
                      onClick={() => applyCanvasBg(tpl.value)}
                      title={tpl.name}
                    >
                      <span>{tpl.name}</span>
                    </button>
                  ))}
                </div>
                <div className="bg-picker-custom">
                  <input
                    type="text"
                    placeholder="Paste anime image URL..."
                    value={customBgUrl}
                    onChange={(e) => setCustomBgUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customBgUrl.trim()) {
                        applyCanvasBg(customBgUrl.trim());
                        setShowBgPicker(false);
                      }
                    }}
                  />
                  <button
                    className="bg-apply-btn"
                    onClick={() => {
                      if (customBgUrl.trim()) {
                        applyCanvasBg(customBgUrl.trim());
                        setShowBgPicker(false);
                      }
                    }}
                  >APPLY</button>
                </div>
                <button className="bg-close" onClick={() => setShowBgPicker(false)}><FaTimes /> CLOSE</button>
              </div>
            )}
          </div>

          <div className="trash-picker-container">
            {showTrash && (
              <div className="trash-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="trash-header">
                  <span>TRASH · {(trashByDate[dateKey] || []).length}</span>
                  {(trashByDate[dateKey] || []).length > 0 && (
                    <button className="trash-clear-btn" onClick={clearTrash} title="Empty trash">
                      Empty
                    </button>
                  )}
                </div>
                <div className="trash-list">
                  {(trashByDate[dateKey] || []).length === 0 ? (
                    <div className="trash-empty">Nothing here yet.</div>
                  ) : (
                    [...(trashByDate[dateKey] || [])].reverse().map(t => (
                      <div className="trash-item" key={t.id}>
                        <div className="trash-item-info">
                          <span className="trash-item-title">{t.title || 'Untitled'}</span>
                          <span className="trash-item-meta">
                            {t.category || 'MEMO'} · {t.deletedAt ? new Date(t.deletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div className="trash-item-actions">
                          <button
                            className="trash-action restore"
                            onClick={() => restoreNote(t)}
                            title="Restore"
                          >
                            <FaUndo />
                          </button>
                          <button
                            className="trash-action purge"
                            onClick={() => purgeTrashedNote(t.id)}
                            title="Remove from trash"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button className="trash-close" onClick={() => setShowTrash(false)}>CLOSE</button>
              </div>
            )}
          </div>

          <div className="new-menu-container">
            <button className="create-note-btn" onClick={() => setShowNewMenu(v => !v)}>
              <FaPlus /> NEW_ENTRY <FaChevronDown className="caret" />
            </button>
            {showNewMenu && (
              <div className="new-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { addNote('blank'); setShowNewMenu(false); }}>
                  <FaFileAlt /> Blank <span className="hk-hint">N</span>
                </button>
                <button onClick={() => { addNote('todo'); setShowNewMenu(false); }}>
                  <FaListUl /> To-do List <span className="hk-hint">T</span>
                </button>
                <button onClick={() => { addNote('meeting'); setShowNewMenu(false); }}>
                  <FaFileAlt /> Meeting Notes <span className="hk-hint">M</span>
                </button>
                <button onClick={() => { addNote('code'); setShowNewMenu(false); }}>
                  <FaCode /> Code Snippet <span className="hk-hint">K</span>
                </button>
              </div>
            )}
          </div>

          <div className="tools-menu-container">
            <button
              className="nav-btn tools-menu-btn"
              onClick={() => setShowToolsMenu(v => !v)}
              title="More tools (theme, background, trash, view)"
            >
              <FaEllipsisH />
            </button>
            {showToolsMenu && (
              <div className="tools-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="tools-section">
                  <div className="tools-section-label">VIEW</div>
                  <div className="tools-segmented">
                    <button
                      className={viewMode === 'canvas' ? 'active' : ''}
                      onClick={() => { setViewMode('canvas'); }}
                    >
                      <FaTh /> Canvas
                    </button>
                    <button
                      className={viewMode === 'kanban' ? 'active' : ''}
                      onClick={() => { setViewMode('kanban'); }}
                    >
                      <FaLayerGroup /> Kanban
                    </button>
                  </div>
                  <span className="hk-hint inline">V</span>
                </div>

                <div className="tools-section">
                  <div className="tools-section-label">THEME</div>
                  <div className="tools-segmented">
                    <button
                      className={theme === 'light' ? 'active' : ''}
                      onClick={() => setThemeMode('light')}
                    >
                      <FaSun /> Light
                    </button>
                    <button
                      className={theme === 'dark' ? 'active' : ''}
                      onClick={() => setThemeMode('dark')}
                    >
                      <FaMoon /> Dark
                    </button>
                    <button
                      className={theme === 'tui' ? 'active' : ''}
                      onClick={() => setThemeMode('tui')}
                    >
                      <FaTerminal /> TUI
                    </button>
                  </div>
                  <span className="hk-hint inline">D</span>
                </div>

                <div className="tools-section">
                  <div className="tools-section-label">DEFAULT_COLOR</div>
                  <div className="tools-swatches">
                    {COLORS.map(c => (
                      <button
                        key={c.id}
                        className={`color-option ${selectedColor === c.id ? 'active' : ''}`}
                        style={{ backgroundColor: c.color }}
                        onClick={() => setSelectedColor(c.id)}
                        title={c.id}
                      />
                    ))}
                  </div>
                  <span className="hk-hint inline">C</span>
                </div>

                <div className="tools-divider" />

                <button
                  className={`tools-menu-item ${showGrid ? 'active' : ''}`}
                  onClick={() => setShowGrid(v => !v)}
                >
                  <FaBorderNone /> Grid Overlay <span className="hk-hint">G</span>
                </button>

                <button
                  className={`tools-menu-item ${canvasBg ? 'active' : ''}`}
                  onClick={() => { setShowToolsMenu(false); setShowBgPicker(true); }}
                >
                  <FaImage /> Canvas Background <span className="hk-hint">B</span>
                </button>

                <button
                  className={`tools-menu-item ${(trashByDate[dateKey] || []).length > 0 ? 'has-items' : ''}`}
                  onClick={() => { setShowToolsMenu(false); setShowTrash(true); }}
                >
                  <FaTrash /> Trash
                  {(trashByDate[dateKey] || []).length > 0 && (
                    <span className="tools-menu-badge">{(trashByDate[dateKey] || []).length}</span>
                  )}
                  <span className="hk-hint">R</span>
                </button>
              </div>
            )}
          </div>

          <button
            className="nav-btn hotkey-help-btn"
            onClick={() => setShowHotkeyHelp(true)}
            title="Keyboard shortcuts (?)"
          >
            <FaKeyboard />
          </button>
        </div>
      </header>

      {showHotkeyHelp && (
        <div className="hotkey-help-overlay" onClick={() => setShowHotkeyHelp(false)}>
          <div className="hotkey-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hotkey-help-header">
              <span><FaKeyboard /> KEYBOARD_SHORTCUTS</span>
              <button onClick={() => setShowHotkeyHelp(false)} aria-label="Close">
                <FaTimes />
              </button>
            </div>
            <div className="hotkey-help-body">
              <div className="hk-group">
                <div className="hk-group-title">Create</div>
                <div className="hk-row"><kbd>N</kbd><span>New blank note</span></div>
                <div className="hk-row"><kbd>T</kbd><span>New to-do list</span></div>
                <div className="hk-row"><kbd>M</kbd><span>New meeting notes</span></div>
                <div className="hk-row"><kbd>K</kbd><span>New code snippet</span></div>
              </div>
              <div className="hk-group">
                <div className="hk-group-title">View & Style</div>
                <div className="hk-row"><kbd>V</kbd><span>Toggle Canvas / Kanban</span></div>
                <div className="hk-row"><kbd>D</kbd><span>Toggle Light / Dark theme</span></div>
                <div className="hk-row"><kbd>C</kbd><span>Open Tools menu (color, view…)</span></div>
                <div className="hk-row"><kbd>G</kbd><span>Toggle grid overlay</span></div>
                <div className="hk-row"><kbd>B</kbd><span>Open canvas background picker</span></div>
              </div>
              <div className="hk-group">
                <div className="hk-group-title">Navigation</div>
                <div className="hk-row"><kbd>/</kbd><span>Focus search</span></div>
                <div className="hk-row"><kbd>S</kbd><span>Toggle Sidebar Index</span></div>
                <div className="hk-row"><kbd>R</kbd><span>Open trash</span></div>
                <div className="hk-row"><kbd>Right-click</kbd><span>Canvas quick menu</span></div>
                <div className="hk-row"><kbd>?</kbd><span>Open this help</span></div>
                <div className="hk-row"><kbd>Esc</kbd><span>Close any open menu / blur input</span></div>
              </div>
            </div>
            <div className="hotkey-help-footer">
              Hotkeys are disabled while typing in inputs or note bodies.
            </div>
          </div>
        </div>
      )}

      {ctxMenu && (
        <div className="canvas-ctx-backdrop" onMouseDown={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}>
          <div
            className="canvas-ctx-menu"
            style={{
              left: Math.min(ctxMenu.screenX, window.innerWidth - 220),
              top: Math.min(ctxMenu.screenY, window.innerHeight - 220),
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="ctx-item" onMouseDown={() => { addNote('blank', ctxMenu.canvasX, ctxMenu.canvasY); setCtxMenu(null); }}>
              <FaPlus /> <span>New entry here</span>
            </button>
            <button className="ctx-item" onMouseDown={() => { selectAllVisible(); setCtxMenu(null); }}>
              <FaTh /> <span>Select all</span>
              <span className="ctx-count">{visibleNotes.length}</span>
            </button>
            <button className="ctx-item" onMouseDown={() => { toggleGrid(); setCtxMenu(null); }}>
              <FaBorderNone /> <span>{showGrid ? 'Hide grid' : 'Show grid'}</span>
            </button>
            <div className="ctx-divider" />
            <button
              className="ctx-item danger"
              onMouseDown={() => { clearAllNotes(); setCtxMenu(null); }}
              disabled={allCurrentNotes.length === 0}
            >
              <FaTrashAlt /> <span>Clear all entries</span>
            </button>
          </div>
        </div>
      )}

      <div className="daily-note-main-content-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {showSidebar && (
          <aside className="note-sidebar-cyber">
            <div className="sidebar-header">
              <span>NOTE INDEX</span>
              <button className="close-sidebar-btn" onClick={() => setShowSidebar(false)}><FaTimes /></button>
            </div>
            
            <div className="sidebar-search">
              <input 
                type="text" 
                placeholder="Filter index..." 
                value={sidebarQuery} 
                onChange={(e) => setSidebarQuery(e.target.value)} 
              />
              {sidebarQuery && <FaTimes className="clear-search" onClick={() => setSidebarQuery('')} />}
            </div>

            <div className="sidebar-filters">
              <button className={`filter-cat-btn ${sidebarFilterCat === 'ALL' ? 'active' : ''}`} onClick={() => setSidebarFilterCat('ALL')}>ALL</button>
              {allCategories.map(cat => {
                const isCustom = !CATEGORIES.includes(cat);
                return (
                  <button
                    key={cat}
                    className={`filter-cat-btn ${sidebarFilterCat === cat ? 'active' : ''} ${isCustom ? 'is-custom' : ''}`}
                    style={isCustom ? { '--cat-accent': getCategoryAccent(cat).color } : undefined}
                    onClick={() => setSidebarFilterCat(cat)}
                    title={isCustom ? `Custom category — Alt+click to remove` : cat}
                    onMouseDown={(e) => {
                      if (isCustom && e.altKey) {
                        e.preventDefault();
                        removeCustomCategory(cat);
                      }
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <form
              className="sidebar-add-cat"
              onSubmit={(e) => { e.preventDefault(); addCustomCategory(newCatInput); }}
            >
              <input
                className="add-cat-input"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="NEW_CATEGORY..."
                maxLength={16}
              />
              <button type="submit" className="add-cat-btn" title="Create category">
                <FaPlus />
              </button>
            </form>

            <div className="sidebar-notes-list">
              {filteredSidebarNotes.length === 0 ? (
                <div className="sidebar-empty">No entries found</div>
              ) : (
                filteredSidebarNotes.map(n => {
                  const nTheme = COLORS.find(c => c.id === n.color) || COLORS[0];
                  const accent = n.customColor || nTheme.color;
                  return (
                    <div 
                      key={n.id} 
                      className={`sidebar-note-item ${n.isFocused ? 'active' : ''} ${n.isCompleted ? 'completed' : ''}`}
                      onClick={() => locateNote(n.id)}
                      style={{ '--accent-color': accent }}
                    >
                      <div className="note-item-meta">
                        <span className="note-item-cat">{n.customCategory || n.category || 'MEMO'}</span>
                        <span className="note-item-time">{n.timestamp}</span>
                      </div>
                      <div className="note-item-title">{n.title || 'Untitled Entry'}</div>
                      <div className="note-item-snippet">{n.content ? (n.content.length > 60 ? n.content.substring(0, 60) + '...' : n.content) : '(Empty content)'}</div>
                      
                      <div className="note-item-actions" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className={`item-action-btn ${n.pinned ? 'active' : ''}`}
                          onClick={() => updateNote(n.id, { pinned: !n.pinned, locked: !n.locked })}
                          title={n.pinned ? 'Unpin note' : 'Pin note'}
                        >
                          <FaDrawPolygon />
                        </button>
                        <button 
                          className={`item-action-btn ${n.isMinimized ? 'active' : ''}`}
                          onClick={() => updateNote(n.id, { isMinimized: !n.isMinimized })}
                          title={n.isMinimized ? 'Maximize note' : 'Minimize note'}
                        >
                          {n.isMinimized ? <FaWindowMaximize /> : <FaWindowMinimize />}
                        </button>
                        <button 
                          className={`item-action-btn ${n.isCompleted ? 'active' : ''}`}
                          onClick={() => updateNote(n.id, { isCompleted: !n.isCompleted })}
                          title={n.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                        >
                          <FaCheckCircle />
                        </button>
                        <button 
                          className="item-action-btn danger" 
                          onClick={() => deleteNote(n.id)}
                          title="Delete note"
                        >
                          <FaTrashAlt />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        <main
          className={`note-canvas-cyber ${canvasBg ? 'has-custom-bg' : ''}`}
          ref={canvasRef}
          style={canvasBgStyle}
          onContextMenu={handleContextMenu}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          {viewMode === 'canvas' ? (
            <div className="notes-canvas">
              {renderNoteLinks()}
              {visibleNotes.length === 0 && !loading ? (
                <div className="empty-state-cyber">
                  <div className="empty-icon"><FaTerminal /></div>
                  <h3>{searchActive ? 'NO_MATCHES_FOUND' : 'NO_DATA_FOUND'}</h3>
                  <p>{searchActive ? 'Try a different keyword/category or clear the search.' : 'Initialize a new entry to begin data logging.'}</p>
                </div>
              ) : (
                visibleNotes.map(note => (
                  <Note
                    key={note.id}
                    note={{ ...note, isSelected: selectedIds.includes(note.id) }}
                    onUpdate={updateNote}
                    onDelete={deleteNote}
                    onFocus={focusNote}
                    onDuplicate={duplicateNote}
                    onSendToBack={sendToBack}
                    appTheme={theme}
                    locateNote={locateNote}
                  />
                ))
              )}

              {/* Selection Box Rect */}
              {selectionRect && selectionRect.active && (
                <div
                  className="selection-marquee"
                  style={{
                    left: Math.min(selectionRect.startX, selectionRect.endX),
                    top: Math.min(selectionRect.startY, selectionRect.endY),
                    width: Math.abs(selectionRect.startX - selectionRect.endX),
                    height: Math.abs(selectionRect.startY - selectionRect.endY)
                  }}
                />
              )}

              <div style={{
                position: 'absolute',
                top: Math.max(...(allCurrentNotes.length > 0 ? allCurrentNotes.map(n => n.y + (n.height || 200)) : [0])) + 500,
                left: 0,
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: 'none'
              }} />
            </div>
          ) : (
            <KanbanBoard notes={visibleNotes} onUpdate={updateNote} onDelete={deleteNote} onFocus={focusNote} appTheme={theme} />
          )}
        </main>
      </div>
    </div>
  );
};

const CATEGORY_ACCENTS = {
  TASK: { color: '#c3e88d', rgb: '195, 232, 141' },
  IDEA: { color: '#c792ea', rgb: '199, 146, 234' },
  LOG: { color: '#89ddff', rgb: '137, 221, 255' },
  MEMO: { color: '#ffcb6b', rgb: '255, 203, 107' },
  SYSTEM: { color: '#ff5370', rgb: '255, 83, 112' },
};

// Deterministic accent for any category — built-in ones use the table above,
// custom ones get a stable HSL color derived from the label so they look
// distinct without needing a hand-picked palette.
const hexFromHsl = (h, s, l) => {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};
const getCategoryAccent = (cat) => {
  if (CATEGORY_ACCENTS[cat]) return CATEGORY_ACCENTS[cat];
  const label = String(cat || 'MEMO');
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const color = hexFromHsl(hue, 60, 70);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return { color, rgb: `${r}, ${g}, ${b}` };
};

const CUSTOM_CATS_KEY = 'daily-note-custom-cats';
const loadCustomCategories = () => {
  try {
    const raw = localStorage.getItem(CUSTOM_CATS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
};

const sortByKanbanOrder = (a, b) => {
  const ao = typeof a.kanbanOrder === 'number' ? a.kanbanOrder : Number.MAX_SAFE_INTEGER;
  const bo = typeof b.kanbanOrder === 'number' ? b.kanbanOrder : Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return (a.timestamp || '').localeCompare(b.timestamp || '');
};

const KanbanBoard = ({ notes, onUpdate, onDelete, onFocus, appTheme }) => {
  // Built-in columns plus any custom category that actually appears in notes.
  const categories = React.useMemo(() => {
    const base = ['TASK', 'IDEA', 'LOG', 'MEMO', 'SYSTEM'];
    const extra = [];
    notes.forEach(n => {
      const cat = n.customCategory || n.category;
      if (cat && !base.includes(cat) && !extra.includes(cat)) extra.push(cat);
    });
    return [...base, ...extra];
  }, [notes]);

  const grouped = React.useMemo(() => {
    const map = {};
    categories.forEach(c => { map[c] = []; });
    notes.forEach(n => {
      const cat = n.customCategory || n.category || 'MEMO';
      const bucket = map[cat] || (map[cat] = []);
      bucket.push(n);
    });
    Object.keys(map).forEach(k => map[k].sort(sortByKanbanOrder));
    return map;
  }, [notes]);

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceList = (grouped[source.droppableId] || []).slice();
    const destList = source.droppableId === destination.droppableId
      ? sourceList
      : (grouped[destination.droppableId] || []).slice();

    const moving = sourceList.find(n => n.id === draggableId);
    if (!moving) return;

    if (source.droppableId === destination.droppableId) {
      sourceList.splice(source.index, 1);
      sourceList.splice(destination.index, 0, moving);
      sourceList.forEach((n, idx) => {
        if (n.kanbanOrder !== idx) {
          onUpdate(n.id, { kanbanOrder: idx });
        }
      });
    } else {
      sourceList.splice(source.index, 1);
      destList.splice(destination.index, 0, moving);

      onUpdate(moving.id, {
        customCategory: destination.droppableId,
        category: destination.droppableId,
        kanbanOrder: destination.index
      });

      sourceList.forEach((n, idx) => {
        if (n.id !== moving.id && n.kanbanOrder !== idx) {
          onUpdate(n.id, { kanbanOrder: idx });
        }
      });
      destList.forEach((n, idx) => {
        if (n.id !== moving.id && n.kanbanOrder !== idx) {
          onUpdate(n.id, { kanbanOrder: idx });
        }
      });
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="kanban-container-cyber">
        {categories.map(cat => {
          const accent = getCategoryAccent(cat);
          const colNotes = grouped[cat] || [];
          return (
            <div
              key={cat}
              className="kanban-column"
              style={{ '--accent-color': accent.color, '--accent-rgb': accent.rgb }}
            >
              <div className="column-header">
                <div className="header-main">
                  <span className="cat-dot" />
                  <span className="cat-name">{cat}</span>
                </div>
                <span className="cat-count">{colNotes.length}</span>
              </div>
              <Droppable droppableId={cat}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`column-content ${snapshot.isDraggingOver ? 'is-drag-over' : ''}`}
                  >
                    {colNotes.length === 0 && !snapshot.isDraggingOver && (
                      <div className="column-empty">
                        <span className="empty-bracket">[</span>
                        <span className="empty-text">DROP HERE</span>
                        <span className="empty-bracket">]</span>
                      </div>
                    )}
                    {colNotes.map((note, index) => (
                      <Draggable key={note.id} draggableId={String(note.id)} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`kanban-draggable ${dragSnapshot.isDragging ? 'is-dragging' : ''}`}
                          >
                            <KanbanNote
                              note={note}
                              onUpdate={onUpdate}
                              onDelete={onDelete}
                              onFocus={onFocus}
                              appTheme={appTheme}
                              dragHandleProps={dragProvided.dragHandleProps}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};

const KanbanNote = ({ note, onUpdate, onDelete, onFocus, appTheme, dragHandleProps }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const theme = COLORS.find(c => c.id === note.color) || COLORS[0];
  const accentColor = note.customColor || theme.color;
  const accentRgb = note.customRgb || theme.rgb;
  const category = note.customCategory || note.category || 'MEMO';

  return (
    <div
      className={`kanban-note-card note-theme-${note.noteTheme === 1 ? 'light' : (note.noteTheme === 2 ? 'sticky' : 'dark')} ${showDrawing ? 'is-drawing' : ''} ${note.isSelected ? 'is-selected' : ''}`}
      style={{ '--accent-color': accentColor, '--accent-rgb': accentRgb }}
      onClick={() => onFocus(note.id)}
    >
      <div className="k-note-header" {...(dragHandleProps || {})}>
        <span className="k-drag-handle" title="Drag to reorder">⠿</span>
        <span className="k-time">[ {note.timestamp} ]</span>
        <span className="k-category-chip" title={category}>{category}</span>
        <div className="k-actions">
          <button
            className={showDrawing ? 'active' : ''}
            onClick={(e) => {
              e.stopPropagation();
              setShowDrawing(!showDrawing);
            }}
            title="Toggle Drawing"
          >
            <FaPalette />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} title="Hide Note">
            <FaTimes />
          </button>
        </div>
      </div>

      <div className="k-note-body">
        <input
          className="k-title-input"
          value={note.title || ''}
          onChange={(e) => onUpdate(note.id, { title: e.target.value })}
          placeholder="UNTITLED"
        />

        <div className="k-content-wrap">
          {showDrawing ? (
            <div className="k-drawing-container" onClick={(e) => e.stopPropagation()}>
              <DrawingCanvas
                data={note.drawingData}
                onChange={(data) => onUpdate(note.id, { drawingData: data })}
                color={accentColor}
              />
            </div>
          ) : (
            <>
              {note.drawingData && (
                <div className="k-drawing-preview" onClick={() => setShowDrawing(true)} title="Click to edit drawing">
                  <img src={note.drawingData} alt="Sketch" className="note-doodle-img" style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '4px', border: '1px solid rgba(var(--accent-rgb), 0.15)', display: 'block', margin: '4px auto' }} />
                </div>
              )}
              <div
                className="k-markdown"
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              >
                {isEditing ? (
                  <textarea
                    autoFocus
                    value={note.content || ''}
                    onChange={(e) => onUpdate(note.id, { content: e.target.value })}
                    onBlur={() => setIsEditing(false)}
                  />
                ) : (
                  <ReactMarkdown>{note.content || '> waiting for input...'}</ReactMarkdown>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyNoteApp;
