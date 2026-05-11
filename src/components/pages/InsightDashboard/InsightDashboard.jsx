import React, { useState, useEffect, useMemo } from 'react';
import {
  FaRocket, FaChartLine, FaTasks, FaHistory,
  FaPlus, FaChevronRight, FaRegCalendarAlt, FaFire,
  FaFileAlt, FaBrain, FaSearch, FaEllipsisV, FaChevronLeft, FaGlobe, FaServer
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

  const [stats, setStats] = useState({
    totalNotes: 0,
    activeTasks: 0,
    completedTasks: 0,
    ideas: 0
  });

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

      const tasks = notes.filter(n => n.category === 'TASK' || n.customCategory === 'TASK');
      setStats({
        totalNotes: notes.length,
        activeTasks: tasks.filter(t => !t.isCompleted).length,
        completedTasks: tasks.filter(t => t.isCompleted).length,
        ideas: notes.filter(n => n.category === 'IDEA' || n.customCategory === 'IDEA').length
      });

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
    let data = [];
    const grouped = heatmapData.reduce((acc, curr) => {
      if (heatmapFilter === 'all' ||
        (heatmapFilter === 'localhost' && curr.isLocalhost) ||
        (heatmapFilter === 'production' && !curr.isLocalhost)) {
        acc[curr.date] = (acc[curr.date] || 0) + curr.count;
      }
      return acc;
    }, {});

    return Object.keys(grouped).map(date => ({
      date,
      count: grouped[date]
    }));
  }, [heatmapData, heatmapFilter]);

  const recentNotes = useMemo(() => {
    return [...allNotes]
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 4);
  }, [allNotes]);

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
          <NavLink to="/daily-note" className="action-btn-neo">
            <FaPlus /> New Note
          </NavLink>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card neo-blue">
          <div className="stat-icon"><FaFileAlt /></div>
          <div className="stat-info">
            <span className="label">Total Notes</span>
            <span className="value">{stats.totalNotes}</span>
          </div>
          <div className="stat-progress"></div>
        </div>
        <div className="stat-card neo-purple">
          <div className="stat-icon"><FaTasks /></div>
          <div className="stat-info">
            <span className="label">Active Tasks</span>
            <span className="value">{stats.activeTasks}</span>
          </div>
          <div className="stat-progress"></div>
        </div>
        <div className="stat-card neo-green">
          <div className="stat-icon"><FaBrain /></div>
          <div className="stat-info">
            <span className="label">Ideas</span>
            <span className="value">{stats.ideas}</span>
          </div>
          <div className="stat-progress"></div>
        </div>
        <div className="stat-card neo-orange">
          <div className="stat-icon"><FaFire /></div>
          <div className="stat-info">
            <span className="label">Completed</span>
            <span className="value">{stats.completedTasks}</span>
          </div>
          <div className="stat-progress"></div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="main-col">
          <section className="section-panel">
            <div className="panel-header">
              <h2><FaHistory /> Recent Activity</h2>
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

          <section className="section-panel heatmap-section mt-4">
            <div className="panel-header">
              <div className="title-group">
                <h2><FaChartLine /> Visit Activity Heatmap</h2>
                <p className="subtitle">Engagement across environments</p>
              </div>
              <div className="heatmap-filters">
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
              <div className="heatmap-container">
                <CalendarHeatmap
                  startDate={subDays(new Date(), 365)}
                  endDate={new Date()}
                  values={filteredHeatmapData}
                  showWeekdayLabels={true}
                  classForValue={(value) => {
                    if (!value || value.count === 0) return 'color-empty';
                    const maxCount = filteredHeatmapData.length > 0 ? Math.max(...filteredHeatmapData.map(d => d.count)) : 1;
                    const count = value.count;
                    if (count >= maxCount * 0.8 && maxCount > 5) return 'color-scale-4';
                    if (count >= maxCount * 0.5) return 'color-scale-3';
                    if (count >= maxCount * 0.2) return 'color-scale-2';
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
              <NavLink to="/signal" className="quick-link">
                <div className="ql-icon"><FaChartLine /></div>
                <span>AI Analytics</span>
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
