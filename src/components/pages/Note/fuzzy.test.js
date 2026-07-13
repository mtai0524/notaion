import { describe, it, expect } from 'vitest';
import { fuzzyScore, fuzzyFilter } from './fuzzy';

describe('fuzzyScore', () => {
  it('returns -1 when chars are missing', () => {
    expect(fuzzyScore('hello', 'xyz')).toBe(-1);
  });
  it('matches a subsequence', () => {
    expect(fuzzyScore('hello world', 'hlo')).toBeGreaterThan(0);
  });
  it('scores a contiguous / prefix match higher than a scattered one', () => {
    expect(fuzzyScore('hello', 'hel')).toBeGreaterThan(fuzzyScore('haelalo', 'hel'));
  });
  it('is case-insensitive and empty query scores 0', () => {
    expect(fuzzyScore('Hello', 'hello')).toBeGreaterThan(0);
    expect(fuzzyScore('x', '')).toBe(0);
  });
});

describe('fuzzyFilter', () => {
  it('keeps only matches, best first', () => {
    const items = ['apple', 'grape', 'application'];
    const out = fuzzyFilter(items, 'app', (x) => x);
    expect(out).toContain('apple');
    expect(out).toContain('application');
    expect(out).not.toContain('grape');
    expect(out[0]).toBe('apple'); // shorter/tighter ranks first
  });
  it('returns all items unchanged for empty query', () => {
    const items = ['a', 'b'];
    expect(fuzzyFilter(items, '', (x) => x)).toEqual(items);
  });
});
