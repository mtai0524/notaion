import { describe, expect, it } from 'vitest';
import { formatDue, gradeCard, isDue, newCardSchedule, nextInterval, sortByDue } from './schedule';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000;

describe('schedule', () => {
  it('makes new cards due right away', () => {
    expect(isDue(newCardSchedule(NOW), NOW)).toBe(true);
  });

  it('gives a new card 1 day on good', () => {
    expect(nextInterval(newCardSchedule(NOW), 3)).toBe(1);
  });

  it('gives a new card 4 days on easy', () => {
    expect(nextInterval(newCardSchedule(NOW), 4)).toBe(4);
  });

  it('grows the interval by ease on good', () => {
    expect(nextInterval({ interval: 4, ease: 2.5 }, 3)).toBe(10);
  });

  it('resets the interval and lowers ease on again', () => {
    const patch = gradeCard({ interval: 10, ease: 2.5, due: NOW }, 1, NOW);
    expect(patch).toEqual({ interval: 0, ease: 2.3, due: NOW });
  });

  it('never lets ease drop below 1.3', () => {
    expect(gradeCard({ interval: 1, ease: 1.3, due: NOW }, 1, NOW).ease).toBe(1.3);
  });

  it('sets the due date interval days ahead', () => {
    expect(gradeCard({ interval: 4, ease: 2.5, due: NOW }, 3, NOW).due).toBe(NOW + 10 * DAY_MS);
  });

  it('labels a due card as due', () => {
    expect(formatDue({ due: NOW }, NOW)).toBe('due');
  });

  it('labels a future card with days left', () => {
    expect(formatDue({ due: NOW + 2 * DAY_MS }, NOW)).toBe('2d');
  });

  it('sorts cards by due date', () => {
    expect(sortByDue([{ due: 3 }, { due: 1 }, { due: 2 }]).map((card) => card.due)).toEqual([1, 2, 3]);
  });
});
