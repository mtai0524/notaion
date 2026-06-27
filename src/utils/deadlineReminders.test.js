import { describe, it, expect } from 'vitest';
import { computeDueReminders, markKey } from './deadlineReminders';

const base = {
  id: 'n1',
  deadline: '2026-06-27T10:00:00.000Z',
  reminderLeadMinutes: 10,
  reminderDone: false,
  isCompleted: false,
};
const noFired = new Set();

describe('computeDueReminders', () => {
  it('returns [] when no deadline', () => {
    expect(computeDueReminders({ ...base, deadline: null }, new Date('2026-06-27T10:00:00Z'), noFired)).toEqual([]);
  });

  it('returns [] for completed note', () => {
    expect(computeDueReminders({ ...base, isCompleted: true }, new Date('2026-06-27T10:00:00Z'), noFired)).toEqual([]);
  });

  it('returns [] when reminderDone', () => {
    expect(computeDueReminders({ ...base, reminderDone: true }, new Date('2026-06-27T10:00:00Z'), noFired)).toEqual([]);
  });

  it('returns [] before lead window', () => {
    expect(computeDueReminders(base, new Date('2026-06-27T09:49:00Z'), noFired)).toEqual([]);
  });

  it('fires lead inside lead window but before deadline', () => {
    expect(computeDueReminders(base, new Date('2026-06-27T09:55:00Z'), noFired)).toEqual(['lead']);
  });

  it('fires both lead and due at/after deadline when neither fired', () => {
    expect(computeDueReminders(base, new Date('2026-06-27T10:00:00Z'), noFired)).toEqual(['lead', 'due']);
  });

  it('excludes already-fired marks', () => {
    const fired = new Set([markKey('n1', 'lead')]);
    expect(computeDueReminders(base, new Date('2026-06-27T10:00:00Z'), fired)).toEqual(['due']);
  });

  it('fires due as overdue catch-up well past deadline', () => {
    expect(computeDueReminders(base, new Date('2026-06-27T12:00:00Z'), new Set([markKey('n1', 'lead')]))).toEqual(['due']);
  });

  it('with no lead time, fires only due at deadline', () => {
    expect(computeDueReminders({ ...base, reminderLeadMinutes: null }, new Date('2026-06-27T10:00:00Z'), noFired)).toEqual(['due']);
  });
});
