# Nvim Ex Commands + Telescope — Implementation Plan

> Execute inline (TDD). The USER commits — do NOT git commit/push; leave staged.

**Goal:** Add vim Ex commands (:w/:wq/:q/:q!/:x/:wa/:wqa/:e!/:noh) in the editor, and a Telescope-style fuzzy finder (notes / commands / dates) opened via Space→f / Ctrl+p.

**Architecture:** Pure `fuzzy.js` (score+filter, tested). `Telescope.jsx` popup takes abstract `sources`. TuiView wires an editor command-line for Ex commands (nvim NORMAL `:`), builds the 3 Telescope sources from existing data, and binds the open keys.

## Global Constraints

- Ex commands only when nvim on + mode==='body' + editor NORMAL. `:q` with unsaved changes is blocked with an error (like vim). Reuse `commit()`/exit flow; add a save-only path for `:w`.
- Telescope opens from list (not editing). `fuzzy.js` is DOM-free and tested. `Telescope.jsx` never imports note data — only abstract sources.
- No regression when nvim off.
- Follow patterns: `lsGet/lsSet`, `execCommand`, `helpSections`, vitest + @testing-library.

---

### Task 1: `fuzzy.js` — scoring + filter

**Files:** Create `src/components/pages/Note/fuzzy.js`, Test `src/components/pages/Note/fuzzy.test.js`

**Interfaces:** `fuzzyScore(text, query): number` (higher = better, -1 = no match, empty query = 0). `fuzzyFilter(items, query, keyFn): item[]` (matches only, sorted best-first, stable for empty query).

- [ ] **Step 1: failing test**

```javascript
// fuzzy.test.js
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
```

- [ ] **Step 2:** run → fail (module missing).
- [ ] **Step 3: implement**

```javascript
// fuzzy.js
// Lightweight subsequence fuzzy matcher. score: higher is better, -1 = no match.
export const fuzzyScore = (text, query) => {
  if (!query) return 0;
  const t = String(text).toLowerCase();
  const q = query.toLowerCase();
  let ti = 0, score = 0, streak = 0, matched = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    let found = -1;
    for (let j = ti; j < t.length; j++) { if (t[j] === c) { found = j; break; } }
    if (found === -1) return -1;
    matched++;
    if (found === ti) { streak++; score += 5 + streak; } else { streak = 0; score += 1; }
    if (found === 0 || t[found - 1] === ' ') score += 3; // word-boundary bonus
    ti = found + 1;
  }
  score -= (t.length - matched) * 0.1; // prefer shorter targets
  return score;
};

export const fuzzyFilter = (items, query, keyFn) => {
  if (!query) return items;
  return items
    .map((it) => ({ it, s: fuzzyScore(keyFn(it), query) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it);
};
```

- [ ] **Step 4:** run → pass. **Step 5:** `git add` fuzzy.js fuzzy.test.js (no commit).

---

### Task 2: `Telescope.jsx` — popup component

**Files:** Create `src/components/pages/Note/Telescope.jsx`, `Telescope.scss`, Test `Telescope.test.jsx`

**Interfaces:** `<Telescope sources onClose />` where `sources = [{ key, label, items, getKey, getLabel, getPreview, onPick }]`.
- Renders prompt + result list + preview + source tabs + hint line.
- State: `srcIdx` (active source), `query`, `sel` (selected result index).
- Results = `fuzzyFilter(source.items, query, source.getLabel)`.
- Keys: Ctrl+j/ArrowDown next, Ctrl+k/ArrowUp prev, Tab/Shift+Tab cycle source, Enter → `source.onPick(result)` + onClose, Esc → onClose.
- Prompt auto-focused.

- [ ] **Step 1: failing test**

```jsx
// Telescope.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Telescope from './Telescope';

const sources = [
  { key: 'notes', label: 'Notes', items: [{ id: 1, t: 'alpha' }, { id: 2, t: 'beta' }],
    getKey: (x) => x.id, getLabel: (x) => x.t, getPreview: (x) => `preview ${x.t}`, onPick: vi.fn() },
  { key: 'cmd', label: 'Commands', items: [{ id: 'c1', t: 'export' }],
    getKey: (x) => x.id, getLabel: (x) => x.t, getPreview: (x) => x.t, onPick: vi.fn() },
];

describe('Telescope', () => {
  it('filters results by the prompt query', () => {
    render(<Telescope sources={sources} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'alp' } });
    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.queryByText('beta')).toBeNull();
  });
  it('picks the selected item on Enter', () => {
    render(<Telescope sources={sources} onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'beta' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(sources[0].onPick).toHaveBeenCalledWith(sources[0].items[1]);
  });
  it('cycles sources on Tab', () => {
    render(<Telescope sources={sources} onClose={() => {}} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/search/i), { key: 'Tab' });
    expect(screen.getByText('export')).toBeTruthy();
  });
});
```

- [ ] **Step 2:** run → fail. **Step 3:** implement `Telescope.jsx` (prompt input with `placeholder="Search…"`, list mapping filtered results with a `.sel` class on `sel`, preview panel `source.getPreview(results[sel])`, source tabs, hint line `Ctrl+j/k · Tab source · Enter · Esc`) + `Telescope.scss` (neo-brutalist popup, backdrop, 2-col body). Reset `sel=0` when query/source changes; clamp `sel`. **Step 4:** run → pass. **Step 5:** `git add` (no commit).

---

### Task 3: Ex commands in the editor (nvim NORMAL `:`)

**Files:** Modify `src/components/pages/Note/TuiView.jsx`

**Interfaces:** New editor command-line state `edCmd` (string|null). In editor NORMAL, `:` opens it; Enter runs `execEditorEx(edCmd)`; Esc cancels. `execEditorEx` handles the Ex table.

- [ ] **Step 1:** Add state `const [edCmd, setEdCmd] = useState(null);` (null = closed).
- [ ] **Step 2:** Add a save-only helper (commit content but stay):

```javascript
const saveBody = () => { if (current) doUpdate(current.id, { content: draft }); };
const exitBody = (discard) => { if (discard) setDraft(''); setMode('normal'); setDraft(''); setSlash(null); };
```

(Reuse `commit()` where it already saves+exits; `exitBody(true)` discards.)

- [ ] **Step 3:** `execEditorEx(raw)`:

```javascript
const dirty = () => current && draft !== (current.content || '');
const execEditorEx = (raw) => {
  const c = raw.trim();
  setEdCmd(null);
  switch (c) {
    case 'w': case 'wa': saveBody(); flashMsg('written'); break;
    case 'wq': case 'x': case 'wqa': saveBody(); setMode('normal'); setDraft(''); setSlash(null); break;
    case 'q': case 'qa': if (dirty()) flashMsg('E37: no write since last change (add ! to override)'); else { setMode('normal'); setDraft(''); setSlash(null); } break;
    case 'q!': case 'qa!': setMode('normal'); setDraft(''); setSlash(null); break;
    case 'e!': if (current) setDraft(current.content || ''); flashMsg('reloaded'); break;
    case 'noh': case 'nohlsearch': setQuery(''); break;
    case '': break;
    default: flashMsg(`not an editor command: :${c}`);
  }
};
```

- [ ] **Step 4:** Open `:` in editor NORMAL. In `handleMdVim` (md) and `onVimKeyDown` (Notion), when NORMAL and key===':' → `e.preventDefault(); setEdCmd('');` (and for md, return true). Guard: only when nvim.
- [ ] **Step 5:** Render the editor command-line. In BOTH editor branches (notion + md), when `edCmd !== null`, render an input at the bottom:

```jsx
{edCmd !== null && (
  // eslint-disable-next-line jsx-a11y/no-autofocus
  <div className="ed-cmdline">:<input autoFocus value={edCmd}
    onChange={(e) => setEdCmd(e.target.value)}
    onKeyDown={(e) => { e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); execEditorEx(edCmd); }
      else if (e.key === 'Escape') { e.preventDefault(); setEdCmd(null); } }}
    onBlur={() => setEdCmd(null)} />
</div>
)}
```

Add `.ed-cmdline` style (monospace bar, ink border) in TuiView.scss.

- [ ] **Step 6:** Build + manual: nvim on, edit note, NORMAL `:wq` saves+exits, `:w` saves stays, `:q` on dirty warns, `:q!` discards.
- [ ] **Step 7:** `git add` (no commit).

---

### Task 4: Wire Telescope into TuiView (sources + open keys)

**Files:** Modify `src/components/pages/Note/TuiView.jsx`

**Interfaces:** State `showTele` (bool) + `teleLeader` (ref for Space→f). Build 3 sources; bind open keys in list NORMAL; render `<Telescope>`.

- [ ] **Step 1:** Import `Telescope`. Add `const [showTele, setShowTele] = useState(false);` and `const leaderRef = useRef(false);`
- [ ] **Step 2:** Build sources (memoized):

```javascript
const teleSources = useMemo(() => {
  const notes = (allNotes || []).filter((n) => !n.isDeleted);
  const cmds = [
    { id: 'export', label: 'export markdown', run: () => exportDay(false) },
    { id: 'week', label: 'weekly review', run: () => setShowWeek(true) },
    { id: 'calendar', label: 'calendar', run: () => setShowCal(true) },
    { id: 'theme', label: 'cycle theme', run: () => setTheme('next') },
    { id: 'nvim', label: 'toggle nvim mode', run: toggleNvim },
    { id: 'number', label: 'toggle line numbers', run: toggleLineNo },
    { id: 'zen', label: 'toggle zen', run: toggleZen },
    { id: 'today', label: 'go to today', run: goToday },
  ];
  const dates = Object.entries(markedDates || {}).map(([d, n]) => ({ id: d, label: `${d} · ${n} note${n > 1 ? 's' : ''}`, date: d }));
  return [
    { key: 'notes', label: 'Notes', items: notes, getKey: (n) => n.id,
      getLabel: (n) => `${n.title || 'untitled'} ${n.content || ''}`,
      getPreview: (n) => `${n.title || 'untitled'}\n${n.date || ''}\n\n${(n.content || '').slice(0, 600)}`,
      onPick: (n) => { if (n.date) gotoDate(n.date); setPendingJump(n.id); setFocus('notes'); } },
    { key: 'commands', label: 'Commands', items: cmds, getKey: (c) => c.id,
      getLabel: (c) => c.label, getPreview: (c) => c.label, onPick: (c) => c.run() },
    { key: 'dates', label: 'Dates', items: dates, getKey: (d) => d.id,
      getLabel: (d) => d.label, getPreview: (d) => d.label, onPick: (d) => gotoDate(d.date) },
  ];
}, [allNotes, markedDates]); // eslint-disable-line react-hooks/exhaustive-deps
```

(Note `getLabel` for notes concatenates title+content so fuzzy searches both, but the list shows title — adjust Telescope to show `getKey`-independent `getName`. Simpler: add `getName` to sources for the visible label, `getLabel` for the searchable text. Update Telescope Task 2 to use `getName || getLabel` for display.)

- [ ] **Step 2b:** In Telescope, display uses `source.getName ? source.getName(item) : source.getLabel(item)`; filtering uses `getLabel`. Add `getName` to the notes source: `getName: (n) => n.title || 'untitled'`.

- [ ] **Step 3:** Open keys — in list NORMAL `handleKeyDown` switch, add:

```javascript
case 'p': if (e.ctrlKey) { setShowTele(true); e.preventDefault(); return; } break; // Ctrl+p
case ' ': leaderRef.current = true; e.preventDefault(); return; // leader
case 'f': if (leaderRef.current) { leaderRef.current = false; setShowTele(true); e.preventDefault(); return; } break;
```

Clear `leaderRef` on any other key (add `leaderRef.current = false;` at the top of the switch's default handling, or reset after a short timeout). Simplest: reset at the start of `handleKeyDown` unless key is ' ' or 'f'.

- [ ] **Step 4:** Render `{showTele && <Telescope sources={teleSources} onClose={() => { setShowTele(false); rootRef.current?.focus(); }} />}` near the other overlays.
- [ ] **Step 5:** Build + manual: Space then f (or Ctrl+p) opens Telescope; Tab cycles Notes/Commands/Dates; type to filter; Enter opens note / runs command / jumps date; Esc closes.
- [ ] **Step 6:** `git add` (no commit).

---

### Task 5: Help + hints + full verification

**Files:** Modify `src/components/pages/Note/TuiView.jsx`

- [ ] **Step 1:** In the NVIM help group, add rows:

```javascript
[': → :w :wq', 'save · save+quit'],
[':q · :q!', 'quit (blocked if dirty) · force'],
['Space f · Ctrl+p', 'Telescope finder'],
```

- [ ] **Step 2:** Full suite: `npx vitest run` → all pass (fuzzy, Telescope, existing).
- [ ] **Step 3:** Lint touched files (no new errors beyond pre-existing).
- [ ] **Step 4:** `npm run build` → succeeds.
- [ ] **Step 5:** Manual regression: nvim off → editor + list behave as before; Telescope still openable via Ctrl+p (or gate it behind nvim? — decide: Telescope is generally useful, keep Ctrl+p always on; Space-leader only meaningful in list NORMAL). Confirm no double-handling of Space.
- [ ] **Step 6:** `git add` (no commit).

## Self-Review Notes
- Coverage: Ex table (Task 3), Telescope 3 sources + keys + preview (Tasks 2,4), fuzzy tested (Task 1), help/hints (Task 5), no-regression (Task 5). All spec items covered.
- Type consistency: `fuzzyScore/fuzzyFilter` names match Task1↔Task2. Telescope `sources` shape (`key,label,items,getKey,getLabel,getName,getPreview,onPick`) consistent Task2↔Task4. `edCmd`/`execEditorEx` consistent within Task3.
- Decision: Space is only a leader in list NORMAL (not while editing); reset leaderRef each keydown unless ' '/'f'. Ctrl+p always opens Telescope.
