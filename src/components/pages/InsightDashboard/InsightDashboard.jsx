import React, { useState, useEffect } from 'react';
import { 
  FaRocket, FaChartLine, FaTasks, FaHistory, 
  FaPlus, FaChevronRight, FaRegCalendarAlt, FaFire,
  FaFileAlt, FaBrain, FaSearch, FaEllipsisV
} from 'react-icons/fa';
import { NavLink } from 'react-router-dom';
import axiosInstance from '../../../axiosConfig';
import { format } from 'date-fns';
import './InsightDashboard.scss';

const InsightDashboard = () => {
  const [allNotes, setAllNotes] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(true);
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
      // Fetch all notes
      const notesRes = await axiosInstance.get('/api/DailyNote/all');
      const notes = notesRes.data;
      setAllNotes(notes);

      // Fetch recent files
      const filesRes = await axiosInstance.get('/api/files');
      setRecentFiles(filesRes.data.slice(0, 5));

      // Calculate stats
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

  const recentNotes = [...allNotes]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 4);

  return (
    <div className="insight-dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Command <span className="highlight">Center</span></h1>
          <p>System operational. Visualizing your digital workspace.</p>
        </div>
        <div className="header-actions">
          <NavLink to="/daily-note" className="action-btn-neon">
            <FaPlus /> NEW_ENTRY
          </NavLink>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card neon-blue">
          <div className="stat-icon"><FaFileAlt /></div>
          <div className="stat-info">
            <span className="label">TOTAL_NOTES</span>
            <span className="value">{stats.totalNotes}</span>
          </div>
          <div className="stat-progress" style={{ width: '70%' }}></div>
        </div>
        <div className="stat-card neon-purple">
          <div className="stat-icon"><FaTasks /></div>
          <div className="stat-info">
            <span className="label">ACTIVE_TASKS</span>
            <span className="value">{stats.activeTasks}</span>
          </div>
          <div className="stat-progress" style={{ width: '45%' }}></div>
        </div>
        <div className="stat-card neon-green">
          <div className="stat-icon"><FaBrain /></div>
          <div className="stat-info">
            <span className="label">IDEAS_LOGGED</span>
            <span className="value">{stats.ideas}</span>
          </div>
          <div className="stat-progress" style={{ width: '30%' }}></div>
        </div>
        <div className="stat-card neon-orange">
          <div className="stat-icon"><FaFire /></div>
          <div className="stat-info">
            <span className="label">COMPLETED</span>
            <span className="value">{stats.completedTasks}</span>
          </div>
          <div className="stat-progress" style={{ width: '85%' }}></div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="main-col">
          <section className="section-panel">
            <div className="panel-header">
              <h2><FaHistory /> RECENT_ACTIVITY</h2>
              <NavLink to="/daily-note" className="view-all">VIEW_ALL <FaChevronRight /></NavLink>
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
                    <NavLink to="/daily-note" className="item-link"><FaChevronRight /></NavLink>
                  </div>
                ))
              ) : (
                <div className="empty-state">No recent entries found.</div>
              )}
            </div>
          </section>

          <section className="section-panel mt-4">
            <div className="panel-header">
              <h2><FaTasks /> PENDING_TASKS</h2>
            </div>
            <div className="task-preview-grid">
               {allNotes.filter(n => (n.category === 'TASK' || n.customCategory === 'TASK') && !n.isCompleted).slice(0, 6).map(task => (
                 <div key={task.id} className="task-mini-card">
                    <div className="task-status"></div>
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
              <h2><FaRocket /> QUICK_ACCESS</h2>
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
                <span>System Config</span>
              </NavLink>
            </div>
          </section>

          <section className="section-panel mt-4">
             <div className="panel-header">
              <h2><FaRegCalendarAlt /> CALENDAR_SNAPSHOT</h2>
            </div>
            <div className="mini-calendar">
              {/* Simplified visual calendar */}
              <div className="cal-month">{format(new Date(), 'MMMM yyyy')}</div>
              <div className="cal-grid">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="cal-day-label">{['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}</div>
                ))}
                {Array.from({ length: 31 }).map((_, i) => (
                  <div key={i} className={`cal-day ${i + 1 === new Date().getDate() ? 'today' : ''} ${[5, 12, 18, 25].includes(i) ? 'has-notes' : ''}`}>
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default InsightDashboard;
