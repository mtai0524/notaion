import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaRocket, FaChartLine, FaTasks, FaHistory, 
  FaPlus, FaChevronRight, FaRegCalendarAlt, FaFire,
  FaFileAlt, FaBrain, FaSearch, FaEllipsisV, FaChevronLeft
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
  subMonths 
} from 'date-fns';
import './InsightDashboard.scss';

const InsightDashboard = () => {
  const navigate = useNavigate();
  const [allNotes, setAllNotes] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
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

    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

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
    // We need to pass the date to DailyNoteApp. 
    // Usually via URL or state. Let's check how DailyNoteApp handles date.
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

          <section className="section-panel mt-4">
            <div className="panel-header">
              <h2><FaTasks /> Pending Tasks</h2>
            </div>
            <div className="task-preview-grid">
               {allNotes.filter(n => (n.category === 'TASK' || n.customCategory === 'TASK') && !n.isCompleted).slice(0, 6).map(task => (
                 <div key={task.id} className="task-mini-card" onClick={() => navigate(`/daily-note?date=${task.date}`)}>
                    <div className="task-text">{task.title || task.content?.substring(0, 30) || "Task..."}</div>
                    <div className="task-date">{task.date}</div>
                 </div>
               ))}
               {allNotes.filter(n => (n.category === 'TASK' || n.customCategory === 'TASK') && !n.isCompleted).length === 0 && (
                 <div className="empty-state">All systems clear. No pending tasks.</div>
               )}
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
