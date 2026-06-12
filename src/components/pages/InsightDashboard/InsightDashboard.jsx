import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FaRocket, FaChartLine, FaHistory,
  FaPlus, FaChevronRight, FaRegCalendarAlt,
  FaFileAlt, FaBrain, FaSearch, FaEllipsisV, FaChevronLeft, FaGlobe, FaServer,
  FaDownload, FaCheckCircle,
  FaFolderOpen, FaCalendarDay
} from 'react-icons/fa';
import { NavLink, useNavigate } from 'react-router-dom';
import axiosInstance from '../../../axiosConfig';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  subDays
} from 'date-fns';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { Tooltip } from 'react-tooltip';
import './InsightDashboard.scss';

const InsightDashboard = () => {
  const navigate = useNavigate();
  const [allNotes, setAllNotes] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [heatmapData, setHeatmapData] = useState([]);
  const [heatmapFilter, setHeatmapFilter] = useState('all'); // 'all', 'localhost', 'production'
  const [sandboxMode, setSandboxMode] = useState(false);
  const [localEdits, setLocalEdits] = useState({}); // { '2026-05-11': count }
  const isMouseDownRef = useRef(false);

  useEffect(() => {
    const handleGlobalMouseUp = () => { isMouseDownRef.current = false; };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const notesRes = await axiosInstance.get('/api/DailyNote/all');
      const notes = notesRes.data;
      setAllNotes(notes);

      const filesRes = await axiosInstance.get('/api/files');
      setRecentFiles(filesRes.data.slice(0, 5));

      // Fetch Heatmap Data
      const heatmapRes = await axiosInstance.get('/api/Analytics/heatmap');
      setHeatmapData(heatmapRes.data);

    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredHeatmapData = useMemo(() => {
    // Generate all dates for the last year to ensure every square is clickable
    const end = new Date();
    const start = subDays(end, 365);
    const allDates = eachDayOfInterval({ start, end });
    
    const grouped = heatmapData.reduce((acc, curr) => {
      if (heatmapFilter === 'all' ||
        (heatmapFilter === 'localhost' && curr.isLocalhost) ||
        (heatmapFilter === 'production' && !curr.isLocalhost)) {
        acc[curr.date] = (acc[curr.date] || 0) + curr.count;
      }
      return acc;
    }, {});

    // Merge with local sandbox edits
    Object.keys(localEdits).forEach(date => {
      grouped[date] = (grouped[date] || 0) + localEdits[date];
    });

    return allDates.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return {
        date: dateStr,
        count: grouped[dateStr] || 0
      };
    });
  }, [heatmapData, heatmapFilter, localEdits]);

  const paintCell = useCallback((date) => {
    if (!date) return;
    setLocalEdits(prev => ({
      ...prev,
      [date]: (prev[date] || 0) + 5
    }));
  }, []);

  const handleHeatmapClick = (value) => {
    if (!sandboxMode || !value || !value.date) return;
    paintCell(value.date);
  };

  const transformDayElement = (element, value) => {
    if (!sandboxMode) return element;
    
    return React.cloneElement(element, {
      onMouseDown: (e) => {
        e.preventDefault();
        isMouseDownRef.current = true;
        if (value && value.date) paintCell(value.date);
      },
      onMouseEnter: () => {
        if (isMouseDownRef.current && value && value.date) {
          paintCell(value.date);
        }
      },
      style: { cursor: 'crosshair' }
    });
  };

  const recentNotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = [...allNotes];
    if (term) {
      list = list.filter(n =>
        (n.title || '').toLowerCase().includes(term) ||
        (n.content || '').toLowerCase().includes(term) ||
        (n.customCategory || n.category || '').toLowerCase().includes(term)
      );
    }
    return list
      .sort((a, b) => {
        const da = new Date(`${a.date || '1970-01-01'}T${a.timestamp || '00:00:00'}`);
        const db = new Date(`${b.date || '1970-01-01'}T${b.timestamp || '00:00:00'}`);
        return db - da;
      })
      .slice(0, term ? 8 : 4);
  }, [allNotes, searchTerm]);

  const todayFocus = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return allNotes
      .filter(n => n.date === today)
      .filter(n => !n.isCompleted)
      .filter(n => {
        const cat = (n.customCategory || n.category || '').toUpperCase();
        return cat === 'TASK' || cat === 'IDEA';
      })
      .slice(0, 5);
  }, [allNotes]);

  const toggleNoteCompleted = async (note) => {
    try {
      const updated = { ...note, isCompleted: !note.isCompleted };
      await axiosInstance.post('/api/DailyNote', updated);
      setAllNotes(prev => prev.map(n => n.id === note.id ? updated : n));
    } catch (err) {
      console.error('Toggle complete failed:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Calendar Logic
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    return eachDayOfInterval({
      start: startDate,
      end: endDate
    });
  }, [currentMonth]);

  const hasNotesOnDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return allNotes.some(note => note.date === dateStr);
  };

  const handleDayClick = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    navigate(`/daily-note?date=${dateStr}`);
  };

  return (
    <div className="insight-dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Work <span className="highlight">Dashboard</span></h1>
          <p>Welcome back. Here is an overview of your notes and tasks.</p>
        </div>
        <div className="header-actions">
          <div className="header-search">
            <FaSearch className="header-search-icon" />
            <input
              type="text"
              placeholder="Search notes, categories, content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="header-search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >×</button>
            )}
          </div>
          <NavLink to="/daily-note" className="action-btn-neo">
            <FaPlus /> New Note
          </NavLink>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="main-col">
          <section className="section-panel">
            <div className="panel-header">
              <h2><FaHistory /> Recent Activity {searchTerm && <span className="filter-pill">filter: "{searchTerm}"</span>}</h2>
              <NavLink to="/daily-note" className="view-all">View All <FaChevronRight /></NavLink>
            </div>
            <div className="activity-list">
              {recentNotes.length > 0 ? (
                recentNotes.map(note => (
                  <div key={note.id} className="activity-item">
                    <div className="item-date">{note.date}</div>
                    <div className="item-content">
                      <div className="item-title">{note.title || "Untitled Entry"}</div>
                      <div className="item-meta">
                        <span className="tag">{note.customCategory || note.category}</span>
                        <span className="time">{note.timestamp}</span>
                      </div>
                    </div>
                    <NavLink to={`/daily-note?date=${note.date}`} className="item-link"><FaChevronRight /></NavLink>
                  </div>
                ))
              ) : (
                <div className="empty-state">No recent entries found.</div>
              )}
            </div>
          </section>

          <section className="section-panel mt-4">
            <div className="panel-header">
              <h2><FaCalendarDay /> Today's Focus</h2>
              <span className="view-all" style={{ cursor: 'default' }}>{todayFocus.length} pending</span>
            </div>
            <div className="activity-list">
              {todayFocus.length > 0 ? (
                todayFocus.map(note => (
                  <div key={note.id} className={`activity-item focus-item ${note.isCompleted ? 'done' : ''}`}>
                    <button
                      className="focus-check"
                      onClick={() => toggleNoteCompleted(note)}
                      title={note.isCompleted ? 'Mark as pending' : 'Mark as done'}
                    >
                      <FaCheckCircle />
                    </button>
                    <div className="item-content">
                      <div className="item-title">{note.title || 'Untitled Task'}</div>
                      <div className="item-meta">
                        <span className="tag">{note.customCategory || note.category}</span>
                        <span className="time">{note.timestamp}</span>
                      </div>
                    </div>
                    <NavLink to={`/daily-note?date=${note.date}`} className="item-link"><FaChevronRight /></NavLink>
                  </div>
                ))
              ) : (
                <div className="empty-state">Nothing pending for today. Nice.</div>
              )}
            </div>
          </section>

          <section className="section-panel heatmap-section mt-4">
            <div className="panel-header">
              <div className="title-group">
                <h2><FaChartLine /> Visit Activity Heatmap</h2>
                <p className="subtitle">Engagement across environments</p>
              </div>
              <div className="heatmap-filters">
                <button 
                  className={`sandbox-btn ${sandboxMode ? 'active' : ''}`}
                  onClick={() => setSandboxMode(!sandboxMode)}
                  title="Click to paint on heatmap (Temporary)"
                >
                  <FaBrain /> {sandboxMode ? 'Paint Mode: ON' : 'Paint Mode: OFF'}
                </button>
                {sandboxMode && Object.keys(localEdits).length > 0 && (
                  <button className="clear-btn" onClick={() => setLocalEdits({})}>
                    Clear
                  </button>
                )}
                <div className="v-divider" />
                <button
                  className={`filter-btn ${heatmapFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setHeatmapFilter('all')}
                >
                  All
                </button>
                <button
                  className={`filter-btn ${heatmapFilter === 'localhost' ? 'active' : ''}`}
                  onClick={() => setHeatmapFilter('localhost')}
                >
                  <FaServer /> Local
                </button>
                <button
                  className={`filter-btn ${heatmapFilter === 'production' ? 'active' : ''}`}
                  onClick={() => setHeatmapFilter('production')}
                >
                  <FaGlobe /> Prod
                </button>
              </div>
            </div>

            <div className="visit-summary-bar">
              <div className="summary-item">
                <span className="s-label">Total Visits</span>
                <span className="s-value">{filteredHeatmapData.reduce((a, b) => a + b.count, 0)}</span>
              </div>
              <div className="summary-item">
                <span className="s-label">Peak</span>
                <span className="s-value">
                  {filteredHeatmapData.length > 0
                    ? Math.max(...filteredHeatmapData.map(d => d.count))
                    : 0}
                </span>
              </div>
              <div className="summary-item">
                <span className="s-label">Days</span>
                <span className="s-value">{filteredHeatmapData.filter(d => d.count > 0).length}</span>
              </div>
            </div>

            <div className="heatmap-wrapper">
              <div className={`heatmap-container ${sandboxMode ? 'sandbox-active' : ''}`}>
                <CalendarHeatmap
                  key={`heatmap-${sandboxMode}`}
                  startDate={subDays(new Date(), 365)}
                  endDate={new Date()}
                  values={filteredHeatmapData}
                  showWeekdayLabels={true}
                  onClick={handleHeatmapClick}
                  transformDayElement={transformDayElement}
                  classForValue={(value) => {
                    if (!value || value.count === 0) return 'color-empty';
                    
                    // Fixed thresholds for better "painting" feel
                    const count = value.count;
                    if (count >= 20) return 'color-scale-4';
                    if (count >= 10) return 'color-scale-3';
                    if (count >= 5) return 'color-scale-2';
                    return 'color-scale-1';
                  }}
                  tooltipDataAttrs={(value) => {
                    if (!value || !value.date) return { 'data-tooltip-id': 'heatmap-tooltip', 'data-tooltip-content': 'No activity' };
                    const dateObj = new Date(value.date);
                    const dayName = format(dateObj, 'EEEE');
                    return {
                      'data-tooltip-id': 'heatmap-tooltip',
                      'data-tooltip-content': `${dayName}, ${value.date}: ${value.count} visits`,
                    };
                  }}
                />
                <Tooltip id="heatmap-tooltip" />
              </div>

              <div className="heatmap-legend">
                <span>Less</span>
                <div className="legend-cells">
                  <div className="l-cell color-empty"></div>
                  <div className="l-cell color-scale-1"></div>
                  <div className="l-cell color-scale-2"></div>
                  <div className="l-cell color-scale-3"></div>
                  <div className="l-cell color-scale-4"></div>
                </div>
                <span>More</span>
              </div>
            </div>
          </section>
        </div>

        <div className="side-col">
          <section className="section-panel">
            <div className="panel-header">
              <h2><FaRocket /> Quick Access</h2>
            </div>
            <div className="quick-links">
              <NavLink to="/notion" className="quick-link">
                <div className="ql-icon"><FaFileAlt /></div>
                <span>Notion Workspace</span>
              </NavLink>
              <NavLink to="/files" className="quick-link">
                <div className="ql-icon"><FaHistory /></div>
                <span>File Archives</span>
              </NavLink>
              <NavLink to="/setting" className="quick-link">
                <div className="ql-icon"><FaEllipsisV /></div>
                <span>Settings</span>
              </NavLink>
            </div>
          </section>

          <section className="section-panel mt-4">
            <div className="panel-header">
              <h2><FaFolderOpen /> Recent Files</h2>
              <NavLink to="/files" className="view-all">View All <FaChevronRight /></NavLink>
            </div>
            <div className="recent-files-list">
              {recentFiles.length > 0 ? (
                recentFiles.map(f => (
                  <div className="recent-file-item" key={f.id || f.savedName}>
                    <div className="rf-icon"><FaFileAlt /></div>
                    <div className="rf-info">
                      <div className="rf-name" title={f.originalName}>{f.originalName}</div>
                      <div className="rf-meta">
                        {formatFileSize(f.sizeInBytes)}
                        {f.uploadedAt && <span> · {format(new Date(f.uploadedAt), 'MMM d')}</span>}
                      </div>
                    </div>
                    {f.cloudUrl ? (
                      <a className="rf-action" href={f.cloudUrl} target="_blank" rel="noopener noreferrer" title="Open">
                        <FaDownload />
                      </a>
                    ) : (
                      <NavLink to="/files" className="rf-action" title="Open">
                        <FaChevronRight />
                      </NavLink>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">No files uploaded yet.</div>
              )}
            </div>
          </section>

          <section className="section-panel mt-4">
            <div className="panel-header">
              <h2><FaRegCalendarAlt /> Calendar</h2>
              <div className="calendar-controls">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><FaChevronLeft /></button>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><FaChevronRight /></button>
              </div>
            </div>
            <div className="mini-calendar">
              <div className="cal-month">{format(currentMonth, 'MMMM yyyy')}</div>
              <div className="cal-grid">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                  <div key={day} className="cal-day-label">{day}</div>
                ))}
                {calendarDays.map((day, i) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());
                  const hasNotes = hasNotesOnDay(day);

                  return (
                    <div
                      key={i}
                      className={`cal-day ${!isCurrentMonth ? 'not-current' : ''} ${isToday ? 'today' : ''} ${hasNotes ? 'has-notes' : ''}`}
                      onClick={() => handleDayClick(day)}
                    >
                      {format(day, 'd')}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default InsightDashboard;
