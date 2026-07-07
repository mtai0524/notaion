import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { format, addMonths, subMonths, startOfMonth, startOfWeek, addDays, isSameDay, isSameMonth } from 'date-fns';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import './CalendarPopup.scss';

/**
 * Month-grid date jumper for Daily Notes, Notaion neo-brutalist styling.
 * Days that already have notes carry an ink dot (count in the tooltip),
 * so the calendar doubles as a "which days did I write" history view.
 */
const CalendarPopup = ({ current, marked, onSelect, onClose }) => {
  const [viewMonth, setViewMonth] = useState(startOfMonth(current));
  const today = new Date();

  // Esc closes the popup without touching the page-level hotkeys.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // 6 fixed weeks so the popup height never jumps between months.
  const weeks = useMemo(() => {
    const first = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)));
  }, [viewMonth]);

  return (
    <>
      <div className="note-cal-backdrop" onMouseDown={onClose} />
      <div className="note-cal-popup" onMouseDown={(e) => e.stopPropagation()}>
        <div className="note-cal-head">
          <button type="button" className="note-cal-nav" onClick={() => setViewMonth((m) => subMonths(m, 1))} title="Previous month">
            <FaChevronLeft />
          </button>
          <span className="note-cal-title">{format(viewMonth, 'MM / yyyy')}</span>
          <button type="button" className="note-cal-nav" onClick={() => setViewMonth((m) => addMonths(m, 1))} title="Next month">
            <FaChevronRight />
          </button>
        </div>

        <div className="note-cal-grid">
          {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((d) => (
            <span key={d} className="note-cal-dow">{d}</span>
          ))}
          {weeks.flat().map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const count = marked[key] || 0;
            return (
              <button
                key={key}
                type="button"
                className={[
                  'note-cal-day',
                  isSameMonth(day, viewMonth) ? '' : 'other-month',
                  isSameDay(day, current) ? 'selected' : '',
                  isSameDay(day, today) ? 'today' : '',
                  count > 0 ? 'has-notes' : '',
                ].filter(Boolean).join(' ')}
                title={count > 0 ? `${key} · ${count} note${count > 1 ? 's' : ''}` : key}
                onClick={() => { onSelect(day); onClose(); }}
              >
                {format(day, 'd')}
                {count > 0 && <span className="note-cal-dot" />}
              </button>
            );
          })}
        </div>

        <div className="note-cal-foot">
          <button type="button" className="note-cal-today-btn"
                  onClick={() => { onSelect(today); onClose(); }}>
            TODAY
          </button>
          <span className="note-cal-hint">● = has notes · Esc to close</span>
        </div>
      </div>
    </>
  );
};

CalendarPopup.propTypes = {
  current: PropTypes.instanceOf(Date).isRequired,
  marked: PropTypes.object.isRequired, // { 'yyyy-MM-dd': noteCount }
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default CalendarPopup;
