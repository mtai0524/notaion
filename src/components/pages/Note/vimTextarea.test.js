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

describe('vimTextarea — yank / paste', () => {
  it('yy then p pastes the line below', () => {
    const r = seq({ text: 'aaa\nbbb', pos: 0, mode: 'normal' }, ['y', 'y', 'p']);
    expect(r.text).toBe('aaa\naaa\nbbb');
  });
  it('dd stores the line; p pastes it back below', () => {
    // dd removes "b" (yanking it), p pastes it below the current line "c".
    const r = seq({ text: 'a\nb\nc', pos: 2, mode: 'normal' }, ['d', 'd', 'p']);
    expect(r.text).toBe('a\nc\nb');
  });
  it('yw then P pastes before the caret (charwise)', () => {
    const r = seq({ text: 'foo bar', pos: 0, mode: 'normal' }, ['y', 'w', 'P']);
    expect(r.text).toBe('foo foo bar');
  });
});

describe('vimTextarea — undo / redo', () => {
  it('u undoes an x, Ctrl+r redoes it', () => {
    const afterX = seq({ text: 'abc', pos: 1, mode: 'normal' }, ['x']);
    expect(afterX.text).toBe('ac');
    const afterU = seq(afterX, ['u']);
    expect(afterU.text).toBe('abc');
    const afterRedo = seq(afterU, [['r', { ctrlKey: true }]]);
    expect(afterRedo.text).toBe('ac');
  });
});

describe('vimTextarea — visual mode', () => {
  it('v + l + d deletes the charwise selection', () => {
    const r = seq({ text: 'hello', pos: 0, mode: 'normal' }, ['v', 'l', 'd']);
    expect(r.text).toBe('llo');   // "he" removed (inclusive)
    expect(r.mode).toBe('normal');
  });
  it('V + d deletes the whole line', () => {
    const r = seq({ text: 'aaa\nbbb', pos: 1, mode: 'normal' }, ['V', 'd']);
    expect(r.text).toBe('bbb');
  });
  it('v + w + y yanks then p pastes', () => {
    const y = seq({ text: 'foo bar', pos: 0, mode: 'normal' }, ['v', 'w', 'y']);
    expect(y.mode).toBe('normal');
    const p = seq(y, ['p']);
    expect(p.text).toContain('foo ');
  });
});

describe('vimTextarea — r / ~', () => {
  it('r{char} replaces one character', () => {
    const r = seq({ text: 'cat', pos: 0, mode: 'normal' }, ['r', 'b']);
    expect(r.text).toBe('bat');
  });
  it('~ flips case and advances', () => {
    const r = seq({ text: 'abc', pos: 0, mode: 'normal' }, ['~']);
    expect(r.text).toBe('Abc');
    expect(r.pos).toBe(1);
  });
});

describe('vimTextarea — markdown note keys (gx, gs, o/O bullets)', () => {
  it('gx toggles a checkbox on the current line', () => {
    const s = seq({ text: '- [ ] mua sữa', pos: 8, mode: 'normal' }, ['g', 'x']);
    expect(s.text).toBe('- [x] mua sữa');
    const s2 = seq({ text: '- [x] mua sữa', pos: 8, mode: 'normal' }, ['g', 'x']);
    expect(s2.text).toBe('- [ ] mua sữa');
  });

  it('gx on a plain bullet inserts a checkbox', () => {
    const s = seq({ text: '- mua sữa', pos: 4, mode: 'normal' }, ['g', 'x']);
    expect(s.text).toBe('- [ ] mua sữa');
  });

  it('gx on a plain line converts it into a task', () => {
    const s = seq({ text: 'mua sữa', pos: 3, mode: 'normal' }, ['g', 'x']);
    expect(s.text).toBe('- [ ] mua sữa');
  });

  it('gx works on the right line in multi-line text and is undoable', () => {
    const text = 'tiêu đề\n- [ ] việc A\n- [ ] việc B';
    const pos = text.indexOf('việc B');
    const s = seq({ text, pos, mode: 'normal' }, ['g', 'x']);
    expect(s.text).toBe('tiêu đề\n- [ ] việc A\n- [x] việc B');
    const u = run(s, 'u');
    expect(u.text).toBe(text);
  });

  it('gsb bolds the word under the cursor and toggles back', () => {
    const s = seq({ text: 'xin chào bạn', pos: 5, mode: 'normal' }, ['g', 's', 'b']);
    expect(s.text).toBe('xin **chào** bạn');
    const s2 = seq({ text: 'xin **chào** bạn', pos: 6, mode: 'normal' }, ['g', 's', 'b']);
    expect(s2.text).toBe('xin chào bạn');
  });

  it('gsc wraps the word in inline code', () => {
    const s = seq({ text: 'chạy npm nhé', pos: 5, mode: 'normal' }, ['g', 's', 'c']);
    expect(s.text).toBe('chạy `npm` nhé');
  });

  it('o on a bullet line continues the bullet', () => {
    const s = run({ text: '- việc A', pos: 3, mode: 'normal' }, 'o');
    expect(s.text).toBe('- việc A\n- ');
    expect(s.mode).toBe('insert');
    expect(s.pos).toBe('- việc A\n- '.length);
  });

  it('o on a checkbox line continues with an unchecked box', () => {
    const s = run({ text: '- [x] xong', pos: 3, mode: 'normal' }, 'o');
    expect(s.text).toBe('- [x] xong\n- [ ] ');
  });

  it('O on a numbered line inherits the number prefix', () => {
    const s = run({ text: '1. một\n2. hai', pos: 8, mode: 'normal' }, 'O');
    expect(s.text).toBe('1. một\n2. \n2. hai');
  });

  it('o on a plain line stays plain', () => {
    const s = run({ text: 'ghi chú', pos: 2, mode: 'normal' }, 'o');
    expect(s.text).toBe('ghi chú\n');
  });
});

describe('continueListOnEnter — auto-continue bullets in INSERT/plain typing', () => {
  it('Enter on a bullet line adds the next bullet', async () => {
    const { continueListOnEnter } = await import('./vimTextarea');
    const text = '- việc A';
    const r = continueListOnEnter(text, text.length);
    expect(r.text).toBe('- việc A\n- ');
    expect(r.pos).toBe(r.text.length);
  });

  it('Enter on a checkbox line adds an unchecked box', async () => {
    const { continueListOnEnter } = await import('./vimTextarea');
    const text = '- [x] xong';
    const r = continueListOnEnter(text, text.length);
    expect(r.text).toBe('- [x] xong\n- [ ] ');
  });

  it('Enter on a numbered line increments the number', async () => {
    const { continueListOnEnter } = await import('./vimTextarea');
    const text = '3. ba';
    const r = continueListOnEnter(text, text.length);
    expect(r.text).toBe('3. ba\n4. ');
  });

  it('Enter on an EMPTY bullet removes it (end of list)', async () => {
    const { continueListOnEnter } = await import('./vimTextarea');
    const text = 'trên\n- ';
    const r = continueListOnEnter(text, text.length);
    expect(r.text).toBe('trên\n');
    expect(r.pos).toBe(r.text.length);
  });

  it('Enter mid-line splits and carries the prefix', async () => {
    const { continueListOnEnter } = await import('./vimTextarea');
    const text = '- một hai';
    const r = continueListOnEnter(text, 5); // caret after "một"
    expect(r.text).toBe('- một\n-  hai');
  });

  it('returns null on a plain line (native newline)', async () => {
    const { continueListOnEnter } = await import('./vimTextarea');
    expect(continueListOnEnter('ghi chú', 7)).toBe(null);
  });
});
