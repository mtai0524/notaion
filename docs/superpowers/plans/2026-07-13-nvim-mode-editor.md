# Nvim Mode (Modal Editing) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. NOTE: the user commits their own code — do NOT run `git commit`/`git push`; leave changes staged for the user.

**Goal:** Add an optional Nvim modal-editing mode (NORMAL/INSERT) to the Notion block editor, toggled in Options / `:nvim`, with a dedicated shortcut help group.

**Architecture:** Pure caret math lives in `vimEditor.js` (offset計算 for w/b/0/$/x on a string, no DOM). `NotionEditor.jsx` owns `vimMode` state, handles NORMAL keydown, and applies caret changes via the Selection API. `Editable` gets a `vimNormal` prop to disable contentEditable + show a block cursor. `TuiView.jsx` owns the `nvim` on/off flag (localStorage), the Options row, the `:nvim` command, and the help group, passing `nvim` down.

**Tech Stack:** React 18, vitest + @testing-library/react (already set up), existing NotionEditor/Editable/TuiView.

## Global Constraints

- Nvim applies ONLY to the Notion block editor. Markdown mode (textarea) is untouched.
- Default OFF. When off, the editor behaves exactly as today (no regression, no modes, no block cursor, no badge).
- localStorage key: `daily-note-nvim`, values `'on'` / `'off'`, default `'off'`.
- On entering the editor with nvim on, start in NORMAL mode (like nvim opening a file).
- Supported keys (no more): INSERT `i a A o O`, back to NORMAL `Esc`/`Ctrl+[`; NORMAL move `h j k l w b 0 $ gg G`, edit `x dd o O`. NOT in scope: operator+motion, visual, `.`, counts, vim yank/paste.
- NORMAL: block cursor + highlighted current block + `-- NORMAL --` badge. INSERT: normal caret + `-- INSERT --` badge.
- Follow existing patterns: `lsGet`/`lsSet`, the data-driven `optionRows`, `execCommand` switch, `helpSections` array, `resetAppearance`.

---

### Task 1: `vimEditor.js` — pure caret-offset logic

**Files:**
- Create: `src/components/pages/Note/vimEditor.js`
- Test: `src/components/pages/Note/vimEditor.test.js`

**Interfaces:**
- Produces:
  - `wordForward(text, pos): number` — offset of the start of the next word (vim `w`). Clamps to text.length.
  - `wordBackward(text, pos): number` — offset of the start of the previous word (vim `b`). Clamps to 0.
  - `lineStart(text, pos): number` — offset of the start of the current line (vim `0`).
  - `lineEnd(text, pos): number` — offset of the end of the current line (vim `$`).
  - `deleteCharAt(text, pos): { text, pos }` — remove the char at pos (vim `x`); pos stays (clamped).

- [ ] **Step 1: Write the failing test**

```javascript
// src/components/pages/Note/vimEditor.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/pages/Note/vimEditor.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/components/pages/Note/vimEditor.js
// Pure vim caret-offset helpers over a plain string. No DOM. A "word" is a run
// of non-space chars (vim WORD-ish — good enough for note text).
const isSpace = (c) => c === ' ' || c === '\t' || c === '\n';

export const wordForward = (text, pos) => {
  const n = text.length;
  let i = Math.min(pos, n);
  while (i < n && !isSpace(text[i])) i++; // skip current word
  while (i < n && isSpace(text[i])) i++;  // skip spaces
  return i;
};

export const wordBackward = (text, pos) => {
  let i = Math.max(0, Math.min(pos, text.length)) - 1;
  while (i > 0 && isSpace(text[i])) i--;      // skip spaces left
  while (i > 0 && !isSpace(text[i - 1])) i--; // to start of word
  return Math.max(0, i);
};

export const lineStart = (text, pos) => {
  const nl = text.lastIndexOf('\n', Math.max(0, pos - 1));
  return nl === -1 ? 0 : nl + 1;
};

export const lineEnd = (text, pos) => {
  const nl = text.indexOf('\n', pos);
  return nl === -1 ? text.length : nl;
};

export const deleteCharAt = (text, pos) => {
  if (pos < 0 || pos >= text.length) return { text, pos: Math.min(pos, text.length) };
  return { text: text.slice(0, pos) + text.slice(pos + 1), pos };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/pages/Note/vimEditor.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Leave staged for the user (do NOT commit)**

Run: `git add src/components/pages/Note/vimEditor.js src/components/pages/Note/vimEditor.test.js`

---

### Task 2: `Editable` — vimNormal prop (disable editing + block cursor)

**Files:**
- Modify: `src/components/pages/Note/NotionBlock.jsx`
- Modify: `src/components/pages/Note/NotionBlock.scss`
- Test: `src/components/pages/Note/NotionBlock.test.jsx`

**Interfaces:**
- Consumes: existing `Editable`/`NotionBlock` props.
- Produces: `NotionBlock`/`Editable` accept `vimNormal: bool`. When true, the editable region renders `contentEditable={false}` and adds class `nb-vim-normal` (CSS draws a block-cursor look via a caret element or background). When false, behaves exactly as today.

- [ ] **Step 1: Write the failing test**

```jsx
// append to src/components/pages/Note/NotionBlock.test.jsx
it('disables contentEditable in vim NORMAL mode', () => {
  const { container } = render(
    <NotionBlock block={{ id: 'b0', type: 'paragraph', text: 'hi' }} vimNormal onChange={() => {}} />,
  );
  const el = container.querySelector('.nb-text');
  expect(el.getAttribute('contenteditable')).toBe('false');
  expect(el.classList.contains('nb-vim-normal')).toBe(true);
});

it('keeps contentEditable when vimNormal is false', () => {
  const { container } = render(
    <NotionBlock block={{ id: 'b0', type: 'paragraph', text: 'hi' }} onChange={() => {}} />,
  );
  expect(container.querySelector('.nb-text').getAttribute('contenteditable')).toBe('true');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/pages/Note/NotionBlock.test.jsx`
Expected: FAIL (contenteditable still "true", no `nb-vim-normal`).

- [ ] **Step 3: Implement**

In `NotionBlock.jsx`:
- Add `vimNormal` to `Editable`'s props and to `NotionBlock`'s props + propTypes.
- Thread `vimNormal` through the `common` object so every `Editable` gets it.
- In `Editable`'s returned `<div>`, change `contentEditable` to `contentEditable={!vimNormal}` and append `${vimNormal ? 'nb-vim-normal' : ''}` to `className`.
- Keep all existing behavior when `vimNormal` is false/undefined.

In `NotionBlock.scss` add:

```scss
.nb-vim-normal {
  caret-color: transparent;           // hide the thin caret; block cursor drawn below
  background: rgba(127, 127, 127, 0.06);
  border-radius: var(--radius-sm, 4px);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/pages/Note/NotionBlock.test.jsx`
Expected: PASS.

- [ ] **Step 5: Stage (no commit)**

Run: `git add src/components/pages/Note/NotionBlock.jsx src/components/pages/Note/NotionBlock.scss src/components/pages/Note/NotionBlock.test.jsx`

---

### Task 3: `NotionEditor` — vimMode state, NORMAL keymap, INSERT transitions

**Files:**
- Modify: `src/components/pages/Note/NotionEditor.jsx`
- Modify: `src/components/pages/Note/NotionEditor.scss`
- Test: `src/components/pages/Note/NotionEditor.test.jsx`

**Interfaces:**
- Consumes: `vimEditor` (Task 1), `NotionBlock` `vimNormal` (Task 2), existing `moveFocus`/`removeAt`/`addAfter`/`patch`.
- Produces: `<NotionEditor content onChange nvim />`. New prop `nvim: bool`.
  - When `nvim` true: internal `vimMode` state (`'normal' | 'insert'`), starts `'normal'`.
  - NORMAL keydown handled at the editor container: `i/a/A` → insert (at pos/after/end), `o/O` → new block + insert, `h/j/k/l/w/b/0/$/gg/G` → caret moves (via Selection API + `vimEditor`), `x` → delete char, `dd` → `removeAt`, `Esc` → stay normal.
  - INSERT: `Esc` → normal. Typing works (contentEditable enabled).
  - Passes `vimNormal={nvim && vimMode === 'normal'}` to each `NotionBlock`.
  - Renders a status badge `-- NORMAL --` / `-- INSERT --` when `nvim`.
  - When `nvim` false: no vimMode, no badge, blocks always editable (today's behavior).

- [ ] **Step 1: Write the failing test**

```jsx
// append to src/components/pages/Note/NotionEditor.test.jsx
describe('NotionEditor nvim mode', () => {
  it('shows a NORMAL badge and non-editable blocks when nvim is on', () => {
    const { container } = render(<NotionEditor content={'hi'} nvim onChange={() => {}} />);
    expect(container.querySelector('.ne-vim-badge')?.textContent).toMatch(/NORMAL/);
    expect(container.querySelector('.nb-text').getAttribute('contenteditable')).toBe('false');
  });

  it('enters INSERT on "i" and shows the INSERT badge (blocks editable)', () => {
    const { container } = render(<NotionEditor content={'hi'} nvim onChange={() => {}} />);
    fireEvent.keyDown(container.querySelector('.notion-editor'), { key: 'i' });
    expect(container.querySelector('.ne-vim-badge')?.textContent).toMatch(/INSERT/);
    expect(container.querySelector('.nb-text').getAttribute('contenteditable')).toBe('true');
  });

  it('deletes the current block on "dd" in NORMAL', () => {
    const onChange = vi.fn();
    const { container } = render(<NotionEditor content={'one\ntwo'} nvim onChange={onChange} />);
    const root = container.querySelector('.notion-editor');
    fireEvent.keyDown(root, { key: 'd' });
    fireEvent.keyDown(root, { key: 'd' });
    expect(onChange).toHaveBeenCalledWith('two');
  });

  it('has no badge and editable blocks when nvim is off', () => {
    const { container } = render(<NotionEditor content={'hi'} onChange={() => {}} />);
    expect(container.querySelector('.ne-vim-badge')).toBeNull();
    expect(container.querySelector('.nb-text').getAttribute('contenteditable')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/pages/Note/NotionEditor.test.jsx`
Expected: FAIL (no badge, blocks editable, `dd` does nothing).

- [ ] **Step 3: Implement**

In `NotionEditor.jsx`:
- Add prop `nvim` (default false), propTypes `nvim: PropTypes.bool`.
- Add state: `const [vimMode, setVimMode] = useState('normal');`
- Track the active block index for NORMAL commands: reuse `focusIndex` where possible; keep a `vimIndex` state (default 0) for the block the cursor is on in NORMAL.
- Add a container-level `onKeyDown` (on `.notion-editor`) that runs ONLY when `nvim && vimMode === 'normal'`:
  - `i` → setVimMode('insert') + focus current block caret (setFocusIndex(vimIndex)).
  - `a` → insert after caret: same as `i` for our purposes (INSERT), setVimMode('insert').
  - `A` → move caret to line end then INSERT.
  - `o` → `addAfter(vimIndex)` then setVimMode('insert').
  - `O` → insert a blank paragraph before vimIndex (add `addBefore(i)` helper mirroring `addAfter`), setVimMode('insert').
  - `j`/`k` → `setVimIndex` clamp ±1 (block move).
  - `g` (twice → `gg`) → vimIndex 0; `G` → last. Track a `pendingG` ref for the `gg` sequence.
  - `h`/`l`/`w`/`b`/`0`/`$` → move the caret inside the current block using the Selection API: read the focused editable's text + caret offset, compute the new offset via `vimEditor`, set the Selection range. Put this DOM glue in a helper `applyCaret(newOffset)` that finds the current block's `.nb-text`/editable node.
  - `x` → `deleteCharAt` on the current block's text at caret; commit via `patch(vimIndex, {text})`, keep caret.
  - `dd` → `removeAt(vimIndex)` (track `pendingD` ref for the double-`d`).
  - Any handled key: `e.preventDefault()`.
- INSERT mode: the container keydown listens for `Escape` (and `Ctrl+[`) → setVimMode('normal') + blur the editable so the block cursor shows. Typing is handled by the editable as today.
- Pass `vimNormal={nvim && vimMode === 'normal'}` to each `<NotionBlock>`.
- Render, when `nvim`, a badge: `<div className={`ne-vim-badge ${vimMode}`}>-- {vimMode.toUpperCase()} --</div>` at the top of `.notion-editor`.
- When `nvim` is false, none of the above engages (guard every handler on `nvim`).

Add `addBefore(i)`:

```javascript
const addBefore = (i) => {
  const next = [...blocks];
  next.splice(i, 0, { id: `n${next.length}-${Date.now()}`, type: 'paragraph', text: '' });
  setFocusIndex(i);
  commit(next);
};
```

`applyCaret` helper (DOM glue; keep it small):

```javascript
// Move the caret within the current block's editable to `offset`.
const applyCaret = (offset) => {
  const rows = document.querySelectorAll('.notion-editor .nb-text, .notion-editor .nb-callout-body, .notion-editor .nb-toggle-title, .notion-editor .nb-code-text');
  const el = rows[/* index of vimIndex among text blocks */];
  // Simpler: query the focused row by data attribute set on render (see below).
};
```

To make `applyCaret` reliable, add `data-vi={i}` to each `.ne-block` wrapper on render, then in `applyCaret` select `[data-vi="${vimIndex}"] [contenteditable]`, read its firstChild text node, and set a collapsed range at `offset`.

In `NotionEditor.scss` add:

```scss
.ne-vim-badge {
  align-self: flex-start;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 1px 8px;
  border-radius: var(--radius-sm, 4px);
  margin-bottom: 4px;
  background: var(--text-color, #111827);
  color: var(--container-bg, #fdfcf8);
  &.insert { background: #16a34a; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/pages/Note/NotionEditor.test.jsx`
Expected: PASS. (Caret-motion keys h/w/b/0/$ are exercised manually in the browser — jsdom lacks a real Selection; the tests cover badge, mode transitions, dd, and the off path.)

- [ ] **Step 5: Stage (no commit)**

Run: `git add src/components/pages/Note/NotionEditor.jsx src/components/pages/Note/NotionEditor.scss src/components/pages/Note/NotionEditor.test.jsx`

---

### Task 4: TuiView — nvim flag, Options row, `:nvim` command, help group

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx`

**Interfaces:**
- Consumes: `NotionEditor` `nvim` prop (Task 3), existing `lsGet/lsSet`, `optionRows`, `execCommand`, `helpSections`, `resetAppearance`.
- Produces: global `nvim` state, an Options toggle, `:nvim` command, and a conditional help group; passes `nvim` into `<NotionEditor>`.

- [ ] **Step 1: Add state + key**

Near `NOTE_FORMAT_KEY`: `const NVIM_KEY = 'daily-note-nvim';`
Near the `noteFormat` state: `const [nvim, setNvim] = useState(() => lsGet(NVIM_KEY, 'off') === 'on');`
Add a setter:

```javascript
const setNvimMode = (on) => { setNvim(on); lsSet(NVIM_KEY, on ? 'on' : 'off'); flashMsg(`nvim mode: ${on ? 'on' : 'off'}`); };
const toggleNvim = () => setNvimMode(!nvim);
```

- [ ] **Step 2: Options row**

In `optionRows`, right after the `note format` (`F`) row, add:

```javascript
{ kbd: 'V', label: 'nvim mode — modal editing trong editor', value: nvim ? 'on' : 'off', on: nvim,
  run: toggleNvim },
```

In `resetAppearance`, add: `setNvim(false); lsSet(NVIM_KEY, 'off');`

- [ ] **Step 3: `:nvim` command**

In `execCommand`, near `case 'zen':`, add:

```javascript
case 'nvim':
  if (arg === 'off') setNvimMode(false);
  else if (arg === 'on') setNvimMode(true);
  else toggleNvim();
  break;
```

- [ ] **Step 4: Pass the flag to NotionEditor**

Change the render at the `<NotionEditor content={draft} onChange={setDraft} />` line to:

```jsx
<NotionEditor content={draft} onChange={setDraft} nvim={nvim} />
```

- [ ] **Step 5: Help group (conditional)**

In `helpSections`, after building the base array, append the NVIM group only when `nvim` is on. Change `const helpSections = [ ... ];` so it's followed by:

```javascript
if (nvim) {
  helpSections.push({
    title: 'NVIM (editor)',
    rows: [
      ['i / a / A', 'insert · after · line-end'],
      ['o / O', 'open line below / above'],
      ['Esc', 'back to NORMAL'],
      ['h j k l', 'move left/down/up/right'],
      ['w / b', 'word forward / back'],
      ['0 / $', 'line start / end'],
      ['gg / G', 'first / last block'],
      ['x · dd', 'delete char · delete block'],
    ],
  });
}
```

(If `helpSections` is a `const` array literal, convert to `let`/build then push, or compute via a spread with a conditional — keep it a single array the render maps over.)

- [ ] **Step 6: Cheatsheet hint (editor)**

In the editor cheatsheet block (where `? Markdown` shows syntax), add a line rendered only when `nvim`:

```jsx
{nvim && <div className="tui-cheatsheet-tip">NVIM: NORMAL hjkl di chuyển · i để gõ · Esc về normal.</div>}
```

- [ ] **Step 7: Build + manual smoke**

Run: `npm run build`
Expected: build succeeds.
Manual: open Daily Note, Options (`T`) → toggle `nvim mode` on. Press `i` to edit a note — starts in NORMAL (badge shows, block cursor). `j/k` move blocks, `i` → INSERT (type), `Esc` → NORMAL, `dd` deletes a block, `w/b/0/$` move the caret. `:nvim off` disables it. Turn off → editor behaves as before.

- [ ] **Step 8: Stage (no commit)**

Run: `git add src/components/pages/Note/TuiView.jsx`

---

### Task 5: Full test run + regression check

**Files:** none (verification only).

- [ ] **Step 1: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass (vimEditor, NotionBlock, NotionEditor, noteFormat, deadlineReminders).

- [ ] **Step 2: Lint the touched files**

Run: `npx eslint src/components/pages/Note/vimEditor.js src/components/pages/Note/NotionEditor.jsx src/components/pages/Note/NotionBlock.jsx src/components/pages/Note/TuiView.jsx --ext js,jsx`
Expected: no new errors beyond the pre-existing `jsx-a11y/no-autofocus` / `prop-types` ones already in the codebase.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual regression — nvim OFF path**

With nvim off, confirm the editor still types, slash menu, drag-drop, per-block delete, and multi-select delete all work exactly as before.

---

## Self-Review Notes

- **Spec coverage:** toggle in Options + `:nvim` (Task 4), default off / localStorage (Task 4), NORMAL/INSERT + keymap (Task 3), pure motion logic + tests (Task 1), block cursor + non-editable in NORMAL (Task 2), badge (Task 3), help group when on (Task 4), cheatsheet hint (Task 4), no-regression when off (guards in Tasks 2/3 + Task 5 manual). Markdown mode untouched (Nvim wired only into the Notion branch, Task 4 step 4).
- **Out of scope** (operator+motion, visual, `.`, counts, vim yank/paste) intentionally absent.
- **Type consistency:** `vimNormal` (bool) used identically in Editable/NotionBlock (Task 2) and passed from NotionEditor (Task 3). `nvim` (bool) consistent NotionEditor↔TuiView (Tasks 3–4). `vimEditor` fn names (`wordForward/wordBackward/lineStart/lineEnd/deleteCharAt`) match between Task 1 impl and Task 3 usage.
- **jsdom limitation:** caret-motion keys (h/w/b/0/$) can't be asserted in jsdom (no real Selection); Task 3 tests cover badge/mode/dd/off, and the pure offset math is fully tested in Task 1. Manual browser check in Task 4/5.
- **Commit policy:** every task stages files; the USER commits. No `git commit` anywhere.
