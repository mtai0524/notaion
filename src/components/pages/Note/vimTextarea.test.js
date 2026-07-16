import { describe, it, expect } from 'vitest';
import { vimTextareaKey } from './vimTextarea';

// Helper: run one key against a state and return the next state.
const run = (state, key, mods = {}) => vimTextareaKey(state, { key, ...mods });

// Run a sequence of keys (each an item: 'x' or ['x', {ctrlKey:true}]).
const seq = (state, keys) => keys.reduce((s, k) => {
  const [key, mods] = Array.isArray(k) ? k : [k, {}];
  const next = vimTextareaKey(s, { key, ...mods });
  return next === null ? s : next; // null = fall through (insert typing); keep state
}, state);

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

describe('vimTextarea — operator + motion', () => {
  const st = (pos) => ({ text: 'hello world foo', pos, mode: 'normal' });
  it('dw deletes to the next word', () => {
    const r = seq(st(0), ['d', 'w']);
    expect(r.text).toBe('world foo');
    expect(r.pos).toBe(0);
  });
  it('de deletes to end of word', () => {
    const r = seq(st(0), ['d', 'e']);
    expect(r.text).toBe(' world foo');
  });
  it('d$ and D delete to end of line', () => {
    expect(seq({ text: 'ab cd\nef', pos: 3, mode: 'normal' }, ['d', '$']).text).toBe('ab \nef');
    expect(seq({ text: 'ab cd\nef', pos: 3, mode: 'normal' }, ['D']).text).toBe('ab \nef');
  });
  it('cw deletes a word and enters insert', () => {
    const r = seq(st(0), ['c', 'w']);
    expect(r.mode).toBe('insert');
    expect(r.text).toBe('world foo');
  });
  it('cc changes the whole line (keeps it empty, insert)', () => {
    const r = seq({ text: 'aaa\nbbb', pos: 1, mode: 'normal' }, ['c', 'c']);
    expect(r.mode).toBe('insert');
    expect(r.text).toBe('\nbbb');
    expect(r.pos).toBe(0);
  });
  it('C changes to end of line and enters insert', () => {
    const r = seq({ text: 'ab cd\nef', pos: 3, mode: 'normal' }, ['C']);
    expect(r.mode).toBe('insert');
    expect(r.text).toBe('ab \nef');
  });
});

describe('vimTextarea — count prefix', () => {
  it('3dd deletes three lines', () => {
    const r = seq({ text: 'a\nb\nc\nd', pos: 0, mode: 'normal' }, ['3', 'd', 'd']);
    expect(r.text).toBe('d');
  });
  it('2w moves two words', () => {
    const r = seq({ text: 'aa bb cc', pos: 0, mode: 'normal' }, ['2', 'w']);
    expect(r.pos).toBe(6); // "cc"
  });
  it('count resets after the command', () => {
    const r = seq({ text: 'aa bb cc', pos: 0, mode: 'normal' }, ['2', 'w']);
    expect(r.count).toBeFalsy();
  });
});
