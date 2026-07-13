import { describe, it, expect } from 'vitest';
import { wordForward, wordBackward, lineStart, lineEnd, deleteCharAt } from './vimEditor';

describe('vimEditor motions', () => {
  it('wordForward jumps to the next word start', () => {
    expect(wordForward('hello world', 0)).toBe(6);   // -> "world"
    expect(wordForward('hello world', 6)).toBe(11);  // -> end
    expect(wordForward('a  b', 0)).toBe(3);           // skip spaces -> "b"
  });

  it('wordBackward jumps to the previous word start', () => {
    expect(wordBackward('hello world', 11)).toBe(6);  // from end -> "world"
    expect(wordBackward('hello world', 6)).toBe(0);   // -> "hello"
    expect(wordBackward('hello', 0)).toBe(0);         // clamp
  });

  it('lineStart / lineEnd within a multi-line string', () => {
    const t = 'ab\ncde\nf';
    expect(lineStart(t, 5)).toBe(3);  // pos in "cde" -> start of line 2
    expect(lineEnd(t, 4)).toBe(6);    // -> just after "cde"
    expect(lineStart(t, 1)).toBe(0);
    expect(lineEnd(t, 0)).toBe(2);
  });

  it('deleteCharAt removes the char at pos', () => {
    expect(deleteCharAt('abc', 1)).toEqual({ text: 'ac', pos: 1 });
    expect(deleteCharAt('abc', 2)).toEqual({ text: 'ab', pos: 2 });
    expect(deleteCharAt('', 0)).toEqual({ text: '', pos: 0 });
  });
});
