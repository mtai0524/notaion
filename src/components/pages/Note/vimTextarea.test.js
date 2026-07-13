import { describe, it, expect } from 'vitest';
import { vimTextareaKey } from './vimTextarea';

// Helper: run one key against a state and return the next state.
const run = (state, key, mods = {}) => vimTextareaKey(state, { key, ...mods });

describe('vimTextarea — mode transitions', () => {
  it('i / a / A / o / O enter insert', () => {
    const base = { text: 'hello', pos: 2, mode: 'normal' };
    expect(run(base, 'i').mode).toBe('insert');
    expect(run(base, 'a').mode).toBe('insert');
    expect(run(base, 'a').pos).toBe(3);              // after caret
    expect(run(base, 'A').pos).toBe(5);              // line end
    const o = run({ text: 'a\nb', pos: 0, mode: 'normal' }, 'o');
    expect(o.mode).toBe('insert');
    expect(o.text).toBe('a\n\nb');                   // new line below "a"
    const O = run({ text: 'a\nb', pos: 2, mode: 'normal' }, 'O');
    expect(O.text).toBe('a\n\nb');                   // new line above "b"
  });

  it('Escape leaves insert to normal', () => {
    expect(run({ text: 'x', pos: 1, mode: 'insert' }, 'Escape').mode).toBe('normal');
  });

  it('typing in insert mode is not intercepted (returns null → let the textarea handle it)', () => {
    expect(vimTextareaKey({ text: 'x', pos: 1, mode: 'insert' }, { key: 'a' })).toBeNull();
  });
});

describe('vimTextarea — normal motions', () => {
  const st = (pos) => ({ text: 'ab cd\nef', pos, mode: 'normal' });
  it('h / l move by one, clamped', () => {
    expect(run(st(2), 'h').pos).toBe(1);
    expect(run(st(2), 'l').pos).toBe(3);
    expect(run(st(0), 'h').pos).toBe(0);
  });
  it('w / b jump words', () => {
    expect(run(st(0), 'w').pos).toBe(3);   // "cd"
    expect(run(st(3), 'b').pos).toBe(0);   // "ab"
  });
  it('0 / $ go to line bounds', () => {
    expect(run(st(4), '0').pos).toBe(0);
    expect(run(st(0), '$').pos).toBe(5);   // end of "ab cd"
  });
  it('arrow keys move like h/j/k/l in NORMAL', () => {
    expect(run(st(2), 'ArrowLeft').pos).toBe(1);
    expect(run(st(2), 'ArrowRight').pos).toBe(3);
    expect(run(st(0), 'ArrowDown').pos).toBe(6);   // to line 2 "ef"
    expect(run(st(6), 'ArrowUp').pos).toBe(0);     // back up to line 1
  });
  it('arrow keys fall through in INSERT (null → textarea handles them)', () => {
    expect(vimTextareaKey({ text: 'ab', pos: 1, mode: 'insert' }, { key: 'ArrowLeft' })).toBeNull();
  });
  it('gg / G go to text bounds', () => {
    const G = run(st(0), 'G');
    expect(G.pos).toBe(8);                 // end of text
    const g1 = run(st(5), 'g');
    expect(g1.pending).toBe('g');
    const g2 = run(g1, 'g');
    expect(g2.pos).toBe(0);
  });
});

describe('vimTextarea — normal edits', () => {
  it('x deletes the char at pos', () => {
    const r = run({ text: 'abc', pos: 1, mode: 'normal' }, 'x');
    expect(r.text).toBe('ac');
    expect(r.pos).toBe(1);
  });
  it('dd deletes the current line', () => {
    const d1 = run({ text: 'a\nb\nc', pos: 2, mode: 'normal' }, 'd');
    expect(d1.pending).toBe('d');
    const d2 = run(d1, 'd');
    expect(d2.text).toBe('a\nc');
  });
});
