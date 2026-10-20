import { useState } from 'react';
import PropTypes from 'prop-types';
import { format, addDays } from 'date-fns';
import { FaChevronLeft, FaChevronRight, FaChevronDown, FaDownload } from 'react-icons/fa';
import CalendarPopup from './CalendarPopup';

const SYNC_LABELS = { saving: 'saving…', saved: 'saved', error: 'sync error', offline: 'offline — will sync' };

// `children` lands at the right edge, after the export button (desktop: sign out).
const DayToolbar = ({ date, markedDates, syncStatus, exporting, canExportDay, onDateChange, onExportDay, onExportAll, children }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const runExport = (run) => {
    setShowExportMenu(false);
    run();
  };

  return (
    <header className="dn-toolbar">
      <div className="dn-date-nav">
        <button className="dn-btn" onClick={() => onDateChange(addDays(date, -1))} title="Previous day">
          <FaChevronLeft />
        </button>
        <div className="dn-date">
          <h2 className="dn-date-title" onClick={() => setShowCalendar((v) => !v)} title="Open calendar">
            {format(date, 'yyyy_MM_dd')}
            <FaChevronDown className="dn-date-caret" />
          </h2>
          {showCalendar && (
            <CalendarPopup
              current={date}
              marked={markedDates}
              onSelect={onDateChange}
              onClose={() => setShowCalendar(false)}
            />
          )}
          <span className={`dn-sync ${syncStatus}`}>{SYNC_LABELS[syncStatus]}</span>
        </div>
        <button className="dn-btn" onClick={() => onDateChange(addDays(date, 1))} title="Next day">
          <FaChevronRight />
        </button>
      </div>

      <div className="dn-export">
        <button className="dn-btn" onClick={() => setShowExportMenu((v) => !v)} title="Export" disabled={exporting}>
          <FaDownload />
        </button>
        {showExportMenu && (
          <div className="dn-export-menu">
            <button onClick={() => runExport(onExportDay)} disabled={!canExportDay}>This day (.md)</button>
            <button onClick={() => runExport(() => onExportAll('md'))}>All days (.md)</button>
            <button onClick={() => runExport(() => onExportAll('json'))}>Backup (.json)</button>
            <button onClick={() => runExport(() => onExportAll('zip'))}>All + files (.zip)</button>
          </div>
        )}
      </div>
      {children}
    </header>
  );
};

DayToolbar.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  markedDates: PropTypes.object.isRequired,
  syncStatus: PropTypes.oneOf(['saving', 'saved', 'error', 'offline']).isRequired,
  exporting: PropTypes.bool.isRequired,
  canExportDay: PropTypes.bool.isRequired,
  onDateChange: PropTypes.func.isRequired,
  onExportDay: PropTypes.func.isRequired,
  onExportAll: PropTypes.func.isRequired,
  children: PropTypes.node,
};

export default DayToolbar;
