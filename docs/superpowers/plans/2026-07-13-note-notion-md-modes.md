# Notion/Markdown Note Format Modes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Daily Note editor two cleanly separated formats — a visual block-based **Notion mode** (default) and the existing raw **Markdown mode** (opt-in) — both operating on the same markdown `content` string.

**Architecture:** A pure `noteFormat.js` module parses a markdown string into `blocks[]` and serializes back (round-trip safe). `NotionBlock.jsx` renders + inline-edits one block via `contentEditable`. `NotionEditor.jsx` composes blocks with a slash menu and drag-drop. `TuiView.jsx` picks `NotionEditor` (notion) or the current textarea (md) based on a global `note format` toggle stored in localStorage.

**Tech Stack:** React 18, vitest (already configured), react-beautiful-dnd (already a dependency, used elsewhere), existing `renderInline` / `CALLOUT_KINDS` helpers in TuiView.

## Global Constraints

- Source of truth is always a markdown **string** on `note.content`. No backend/DB changes, no data migration.
- Old notes (plain markdown strings) must open in both modes without breaking.
- Notion mode must NEVER surface raw markdown syntax (`**`, `> [!note]`, `> [>]`, `#`) to the user.
- Round-trip must be stable: `serialize(parse(md))` produces markdown equivalent to `md` for all supported blocks.
- Format toggle default is `notion`, stored in localStorage key `daily-note-format`, applied globally to all notes.
- Follow existing TuiView conventions: `lsGet`/`lsSet` helpers, `doUpdate(id, { content })` to persist, `CALLOUT_KINDS` for callout icons.
- Supported blocks: paragraph, heading 1/2/3, todo, bullet, quote, callout (note/info/warning/success/danger), toggle, code, divider, image, file. Anything else → safe paragraph (verbatim).
- Out of scope: nested-deep blocks, WYSIWYG tables, cross-note drag-drop.

---

### Task 1: `noteFormat.js` — parse markdown → blocks[]

**Files:**
- Create: `src/components/pages/Note/noteFormat.js`
- Test: `src/components/pages/Note/noteFormat.test.js`

**Interfaces:**
- Produces: `parseMarkdown(md: string): Block[]` where
  `Block = { id: string, type: 'paragraph'|'h1'|'h2'|'h3'|'todo'|'bullet'|'quote'|'callout'|'toggle'|'code'|'divider'|'image'|'file', text: string, ... }`.
  - `todo` adds `checked: boolean`.
  - `callout` adds `kind: 'note'|'info'|'warning'|'success'|'danger'` and `text` may contain `\n` for multi-line body.
  - `toggle` adds `title: string` and `children: string` (child lines joined by `\n`, indentation stripped).
  - `code` adds `text` = code body (fences stripped), `lang: string`.
  - `image`/`file` add `url: string`, `alt`/`label: string`.
  - Each block gets a stable `id` via a module counter (`b0`, `b1`, …) so React keys and drag-drop are stable within one parse.

- [ ] **Step 1: Write the failing test**

```javascript
// src/components/pages/Note/noteFormat.test.js
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './noteFormat';

describe('parseMarkdown', () => {
  it('parses a plain paragraph', () => {
    const b = parseMarkdown('hello world');
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ type: 'paragraph', text: 'hello world' });
  });

  it('parses headings 1-3', () => {
    const b = parseMarkdown('# A\n## B\n### C');
    expect(b.map((x) => x.type)).toEqual(['h1', 'h2', 'h3']);
    expect(b.map((x) => x.text)).toEqual(['A', 'B', 'C']);
  });

  it('parses todo with checked state', () => {
    const b = parseMarkdown('- [ ] open\n- [x] done');
    expect(b[0]).toMatchObject({ type: 'todo', checked: false, text: 'open' });
    expect(b[1]).toMatchObject({ type: 'todo', checked: true, text: 'done' });
  });

  it('parses a callout with kind and multi-line body', () => {
    const b = parseMarkdown('> [!warning] be careful\n> second line');
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ type: 'callout', kind: 'warning', text: 'be careful\nsecond line' });
  });

  it('parses a toggle with children', () => {
    const b = parseMarkdown('> [>] Title\n    child one\n    child two');
    expect(b[0]).toMatchObject({ type: 'toggle', title: 'Title', children: 'child one\nchild two' });
  });

  it('falls back to paragraph for unknown syntax (table)', () => {
    const b = parseMarkdown('| a | b |');
    expect(b[0]).toMatchObject({ type: 'paragraph', text: '| a | b |' });
  });

  it('gives every block a stable unique id', () => {
    const b = parseMarkdown('one\ntwo');
    expect(b[0].id).not.toEqual(b[1].id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/pages/Note/noteFormat.test.js`
Expected: FAIL with "parseMarkdown is not a function" / import error.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/components/pages/Note/noteFormat.js
// Pure markdown <-> block model for the Daily Note editor. No React here.
// The source of truth stays a markdown string; blocks are a transient view.

export const CALLOUT_KIND_KEYS = ['note', 'info', 'warning', 'success', 'danger'];

let _idc = 0;
const nid = () => `b${_idc++}`;

const CHECK = /^\s*[-*]\s*\[( |x|X)\]\s?(.*)$/;

// md string -> Block[]
export const parseMarkdown = (md) => {
  const lines = String(md ?? '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // code fence
    if (/^```/.test(ln)) {
      const lang = ln.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i++; }
      out.push({ id: nid(), type: 'code', lang, text: body.join('\n') });
      continue;
    }

    // toggle: "> [>] title" + indented (>=2 space) children
    const tog = ln.match(/^>\s?\[>\]\s?(.*)$/);
    if (tog) {
      const children = [];
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1])) {
        i++; children.push(lines[i].replace(/^\s{2,}/, ''));
      }
      out.push({ id: nid(), type: 'toggle', title: tog[1] || '', children: children.join('\n') });
      continue;
    }

    // callout: "> [!kind] text" + following "> " continuation
    const call = ln.match(/^>\s?\[!(\w+)\]\s?(.*)$/);
    if (call) {
      const kind = CALLOUT_KIND_KEYS.includes(call[1].toLowerCase()) ? call[1].toLowerCase() : 'note';
      const body = [call[2]];
      while (i + 1 < lines.length && /^>\s?(?!\[)/.test(lines[i + 1])) {
        i++; body.push(lines[i].replace(/^>\s?/, ''));
      }
      out.push({ id: nid(), type: 'callout', kind, text: body.join('\n') });
      continue;
    }

    const chk = ln.match(CHECK);
    if (chk) { out.push({ id: nid(), type: 'todo', checked: chk[1].toLowerCase() === 'x', text: chk[2] }); continue; }

    const img = ln.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) { out.push({ id: nid(), type: 'image', alt: img[1], url: img[2] }); continue; }

    const file = ln.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/);
    if (file) { out.push({ id: nid(), type: 'file', label: file[1], url: file[2] }); continue; }

    const h = ln.match(/^(#{1,3})\s+(.*)$/);
    if (h) { out.push({ id: nid(), type: `h${h[1].length}`, text: h[2] }); continue; }

    if (/^>\s?/.test(ln)) { out.push({ id: nid(), type: 'quote', text: ln.replace(/^>\s?/, '') }); continue; }
    if (/^[-*]\s+/.test(ln)) { out.push({ id: nid(), type: 'bullet', text: ln.replace(/^[-*]\s+/, '') }); continue; }
    if (/^---+$/.test(ln.trim())) { out.push({ id: nid(), type: 'divider', text: '' }); continue; }

    out.push({ id: nid(), type: 'paragraph', text: ln });
  }
  return out;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/pages/Note/noteFormat.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/Note/noteFormat.js src/components/pages/Note/noteFormat.test.js
git commit -m "feat(note): parseMarkdown — markdown string to block model"
```

---

### Task 2: `noteFormat.js` — serialize blocks[] → markdown + round-trip

**Files:**
- Modify: `src/components/pages/Note/noteFormat.js`
- Test: `src/components/pages/Note/noteFormat.test.js`

**Interfaces:**
- Consumes: `Block[]` from Task 1.
- Produces: `serializeBlocks(blocks: Block[]): string`. Inverse of `parseMarkdown` for all supported block types.

- [ ] **Step 1: Write the failing test (append to existing file)**

```javascript
// append to src/components/pages/Note/noteFormat.test.js
import { serializeBlocks } from './noteFormat';

describe('serializeBlocks', () => {
  it('serializes each block type back to markdown', () => {
    expect(serializeBlocks([{ type: 'h2', text: 'Hi' }])).toBe('## Hi');
    expect(serializeBlocks([{ type: 'todo', checked: true, text: 'x' }])).toBe('- [x] x');
    expect(serializeBlocks([{ type: 'divider' }])).toBe('---');
    expect(serializeBlocks([{ type: 'callout', kind: 'info', text: 'a\nb' }]))
      .toBe('> [!info] a\n> b');
    expect(serializeBlocks([{ type: 'toggle', title: 'T', children: 'c1\nc2' }]))
      .toBe('> [>] T\n    c1\n    c2');
  });
});

describe('round-trip', () => {
  const samples = [
    'hello world',
    '# H1\n## H2\n### H3',
    '- [ ] a\n- [x] b',
    '- bullet\n> quote',
    '> [!danger] watch out\n> line two',
    '> [>] Toggle\n    child one\n    child two',
    '```js\nconst x = 1;\n```',
    '---',
    '![alt](http://img)\n[📎 file](http://f)',
  ];
  it.each(samples)('serialize(parse(md)) === md for: %s', (md) => {
    expect(serializeBlocks(parseMarkdown(md))).toBe(md);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/pages/Note/noteFormat.test.js`
Expected: FAIL with "serializeBlocks is not a function".

- [ ] **Step 3: Write minimal implementation (append to noteFormat.js)**

```javascript
// append to src/components/pages/Note/noteFormat.js
const one = (b) => {
  switch (b.type) {
    case 'h1': return `# ${b.text}`;
    case 'h2': return `## ${b.text}`;
    case 'h3': return `### ${b.text}`;
    case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.text}`;
    case 'bullet': return `- ${b.text}`;
    case 'quote': return `> ${b.text}`;
    case 'divider': return '---';
    case 'image': return `![${b.alt || ''}](${b.url})`;
    case 'file': return `[${b.label}](${b.url})`;
    case 'code': return '```' + (b.lang || '') + '\n' + (b.text || '') + '\n```';
    case 'callout': {
      const [first, ...rest] = String(b.text ?? '').split('\n');
      return [`> [!${b.kind || 'note'}] ${first}`, ...rest.map((l) => `> ${l}`)].join('\n');
    }
    case 'toggle': {
      const kids = String(b.children ?? '').length
        ? String(b.children).split('\n').map((l) => `    ${l}`)
        : [];
      return [`> [>] ${b.title || ''}`, ...kids].join('\n');
    }
    default: return b.text ?? '';
  }
};

export const serializeBlocks = (blocks) => (blocks || []).map(one).join('\n');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/pages/Note/noteFormat.test.js`
Expected: PASS (all round-trip + serialize tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/Note/noteFormat.js src/components/pages/Note/noteFormat.test.js
git commit -m "feat(note): serializeBlocks + round-trip stability"
```

---

### Task 3: `NotionBlock.jsx` — render + inline-edit one block

**Files:**
- Create: `src/components/pages/Note/NotionBlock.jsx`
- Test: `src/components/pages/Note/NotionBlock.test.jsx`

**Interfaces:**
- Consumes: a `Block` (Task 1), `CALLOUT_KINDS` (import from a shared spot — see note below).
- Produces: `<NotionBlock block onChange onEnter onBackspaceEmpty onToggleCheck onToggleCollapse collapsed />`
  - `onChange(text)` fires on inline edit (the block's editable text; for callout = full body, toggle = title).
  - `onEnter()` — Enter pressed at end (parent creates a new paragraph after).
  - `onBackspaceEmpty()` — Backspace in an empty block (parent merges/removes).
  - `onToggleCheck()` — todo checkbox clicked.
  - `onToggleCollapse()` — toggle caret clicked.

**Note on CALLOUT_KINDS:** it currently lives inside `TuiView.jsx` as a module const. Move it into `noteFormat.js` as an exported `CALLOUT_KINDS` map (`{ note:{icon,label}, ... }`) and re-import it in TuiView, so both the editor and TuiView share one source. Do this move as the first step of this task.

- [ ] **Step 1: Move CALLOUT_KINDS into noteFormat.js**

In `src/components/pages/Note/noteFormat.js`, add:

```javascript
export const CALLOUT_KINDS = {
  note:    { icon: '💡', label: 'Note' },
  info:    { icon: 'ℹ️', label: 'Info' },
  warning: { icon: '⚠️', label: 'Warning' },
  success: { icon: '✅', label: 'Success' },
  danger:  { icon: '🔥', label: 'Danger' },
};
```

In `src/components/pages/Note/TuiView.jsx`, delete the local `const CALLOUT_KINDS = {...}` and add to the top imports:

```javascript
import { CALLOUT_KINDS } from './noteFormat';
```

Run `npx vitest run` and `npm run build` to confirm nothing broke.

- [ ] **Step 2: Write the failing test**

```javascript
// src/components/pages/Note/NotionBlock.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotionBlock from './NotionBlock';

describe('NotionBlock', () => {
  it('renders a heading with its text and level class', () => {
    render(<NotionBlock block={{ id: 'b0', type: 'h1', text: 'Title' }} onChange={() => {}} />);
    const el = screen.getByText('Title');
    expect(el.closest('.nb-h1')).toBeTruthy();
  });

  it('renders a callout with its icon', () => {
    render(<NotionBlock block={{ id: 'b0', type: 'callout', kind: 'danger', text: 'boom' }} onChange={() => {}} />);
    expect(screen.getByText('🔥')).toBeTruthy();
  });

  it('fires onToggleCheck when a todo checkbox is clicked', () => {
    const onToggleCheck = vi.fn();
    render(<NotionBlock block={{ id: 'b0', type: 'todo', checked: false, text: 'do' }}
                        onChange={() => {}} onToggleCheck={onToggleCheck} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggleCheck).toHaveBeenCalled();
  });
});
```

Check `@testing-library/react` is installed first: run `npx vitest run src/components/pages/Note/NotionBlock.test.jsx`; if it errors on the import, run `npm i -D @testing-library/react @testing-library/jest-dom jsdom` and add `environment: 'jsdom'` under `test:` in `vite.config.js`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/pages/Note/NotionBlock.test.jsx`
Expected: FAIL (NotionBlock not found).

- [ ] **Step 4: Write minimal implementation**

```jsx
// src/components/pages/Note/NotionBlock.jsx
import { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { CALLOUT_KINDS } from './noteFormat';
import './NotionBlock.scss';

// One block, rendered visually (never showing raw markdown syntax) and
// inline-editable via contentEditable. Bold/italic show live; icons/carets stay.
const Editable = ({ value, className, onChange, onEnter, onBackspaceEmpty }) => {
  const ref = useRef(null);
  // keep DOM text in sync without clobbering the caret while typing
  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) ref.current.textContent = value ?? '';
  }, [value]);
  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onChange?.(e.currentTarget.textContent)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter?.(); }
        else if (e.key === 'Backspace' && !e.currentTarget.textContent) { e.preventDefault(); onBackspaceEmpty?.(); }
      }}
    />
  );
};
Editable.propTypes = {
  value: PropTypes.string, className: PropTypes.string,
  onChange: PropTypes.func, onEnter: PropTypes.func, onBackspaceEmpty: PropTypes.func,
};

const NotionBlock = ({ block, onChange, onEnter, onBackspaceEmpty, onToggleCheck, onToggleCollapse, collapsed }) => {
  const b = block;
  const common = { onChange, onEnter, onBackspaceEmpty };

  if (b.type === 'divider') return <hr className="nb-hr" />;

  if (b.type === 'todo') {
    return (
      <div className={`nb-todo ${b.checked ? 'checked' : ''}`}>
        <input type="checkbox" checked={!!b.checked} onChange={() => onToggleCheck?.()} />
        <Editable value={b.text} className="nb-text" {...common} />
      </div>
    );
  }

  if (b.type === 'callout') {
    const k = CALLOUT_KINDS[b.kind] || CALLOUT_KINDS.note;
    return (
      <div className={`nb-callout kind-${b.kind || 'note'}`}>
        <span className="nb-callout-icon">{k.icon}</span>
        <Editable value={b.text} className="nb-callout-body" {...common} />
      </div>
    );
  }

  if (b.type === 'toggle') {
    return (
      <div className={`nb-toggle ${collapsed ? 'collapsed' : ''}`}>
        <div className="nb-toggle-head">
          <span className="nb-toggle-caret" onClick={() => onToggleCollapse?.()}>▸</span>
          <Editable value={b.title} className="nb-toggle-title" {...common} />
        </div>
        {!collapsed && b.children ? <div className="nb-toggle-body">{b.children}</div> : null}
      </div>
    );
  }

  if (b.type === 'image') {
    return <img className="nb-img" src={b.url} alt={b.alt || ''} loading="lazy" />;
  }
  if (b.type === 'file') {
    return <a className="nb-file" href={b.url} target="_blank" rel="noopener noreferrer">{b.label}</a>;
  }
  if (b.type === 'code') {
    return <pre className="nb-code"><code>{b.text}</code></pre>;
  }

  const cls = b.type === 'h1' ? 'nb-h1' : b.type === 'h2' ? 'nb-h2' : b.type === 'h3' ? 'nb-h3'
    : b.type === 'quote' ? 'nb-quote' : b.type === 'bullet' ? 'nb-bullet' : 'nb-p';
  return <Editable value={b.text} className={`nb-text ${cls}`} {...common} />;
};

NotionBlock.propTypes = {
  block: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  onEnter: PropTypes.func,
  onBackspaceEmpty: PropTypes.func,
  onToggleCheck: PropTypes.func,
  onToggleCollapse: PropTypes.func,
  collapsed: PropTypes.bool,
};

export default NotionBlock;
```

Create `src/components/pages/Note/NotionBlock.scss` with minimal styling matching the existing `.tui-pv-*` look (headings sized h1>h2>h3, callout tinted box with `--callout-accent` per kind copied from TuiView.scss, toggle caret rotates when open, todo strikes through when checked). Reuse the color values already in `TuiView.scss` under `.tui-pv-callout`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/pages/Note/NotionBlock.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/pages/Note/NotionBlock.jsx src/components/pages/Note/NotionBlock.scss src/components/pages/Note/NotionBlock.test.jsx src/components/pages/Note/noteFormat.js src/components/pages/Note/TuiView.jsx
git commit -m "feat(note): NotionBlock — visual render + inline edit of one block; share CALLOUT_KINDS"
```

---

### Task 4: `NotionEditor.jsx` — block list, edit-to-content, checkbox/collapse

**Files:**
- Create: `src/components/pages/Note/NotionEditor.jsx`
- Test: `src/components/pages/Note/NotionEditor.test.jsx`

**Interfaces:**
- Consumes: `parseMarkdown`, `serializeBlocks` (Tasks 1-2), `NotionBlock` (Task 3).
- Produces: `<NotionEditor content onChange />`
  - `content: string` — the note markdown.
  - `onChange(md: string)` — called whenever the user edits, with the re-serialized markdown.
  - Internally: `blocks = parseMarkdown(content)` held in state; edits mutate the block, then `onChange(serializeBlocks(blocks))`.

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/pages/Note/NotionEditor.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotionEditor from './NotionEditor';

describe('NotionEditor', () => {
  it('renders one block per markdown line', () => {
    render(<NotionEditor content={'# A\nbody'} onChange={() => {}} />);
    expect(screen.getByText('A').closest('.nb-h1')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('re-serializes to markdown on a checkbox toggle', () => {
    const onChange = vi.fn();
    render(<NotionEditor content={'- [ ] task'} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('- [x] task');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/pages/Note/NotionEditor.test.jsx`
Expected: FAIL (NotionEditor not found).

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/pages/Note/NotionEditor.jsx
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { parseMarkdown, serializeBlocks } from './noteFormat';
import NotionBlock from './NotionBlock';
import './NotionEditor.scss';

const NotionEditor = ({ content, onChange }) => {
  const [blocks, setBlocks] = useState(() => parseMarkdown(content));
  const [collapsed, setCollapsed] = useState({});

  // re-parse when the note switches (content prop changes from outside)
  useEffect(() => { setBlocks(parseMarkdown(content)); }, [content]);

  const commit = (next) => { setBlocks(next); onChange?.(serializeBlocks(next)); };

  const patch = (i, upd) => commit(blocks.map((b, j) => (j === i ? { ...b, ...upd } : b)));

  const setText = (i, text) => {
    const b = blocks[i];
    if (b.type === 'toggle') patch(i, { title: text });
    else patch(i, { text });
  };

  const addAfter = (i) => {
    const next = [...blocks];
    next.splice(i + 1, 0, { id: `n${Date.now()}`, type: 'paragraph', text: '' });
    commit(next);
  };

  const removeAt = (i) => { if (blocks.length > 1) commit(blocks.filter((_, j) => j !== i)); };

  return (
    <div className="notion-editor">
      {blocks.map((b, i) => (
        <NotionBlock
          key={b.id}
          block={b}
          collapsed={!!collapsed[b.id]}
          onChange={(t) => setText(i, t)}
          onEnter={() => addAfter(i)}
          onBackspaceEmpty={() => removeAt(i)}
          onToggleCheck={() => patch(i, { checked: !b.checked })}
          onToggleCollapse={() => setCollapsed((m) => ({ ...m, [b.id]: !m[b.id] }))}
        />
      ))}
    </div>
  );
};

NotionEditor.propTypes = { content: PropTypes.string, onChange: PropTypes.func };

export default NotionEditor;
```

Create `src/components/pages/Note/NotionEditor.scss` with block spacing + a per-block hover row (space reserved on the left for the future drag handle).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/pages/Note/NotionEditor.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/Note/NotionEditor.jsx src/components/pages/Note/NotionEditor.scss src/components/pages/Note/NotionEditor.test.jsx
git commit -m "feat(note): NotionEditor — block list bound to markdown content"
```

---

### Task 5: Slash menu in NotionEditor

**Files:**
- Modify: `src/components/pages/Note/NotionEditor.jsx`
- Modify: `src/components/pages/Note/NotionEditor.test.jsx`

**Interfaces:**
- Consumes: the block list state from Task 4.
- Produces: typing `/` at the start of an empty paragraph opens a block-type menu; picking an item changes that block's `type` (and resets fields). Menu items: paragraph, h1, h2, h3, todo, bullet, quote, callout note/info/warning/success/danger, toggle, code, divider.

- [ ] **Step 1: Write the failing test (append)**

```jsx
// append to NotionEditor.test.jsx
it('turns a block into a heading via the slash menu', () => {
  const onChange = vi.fn();
  render(<NotionEditor content={''} onChange={onChange} />);
  // open the slash menu on the (single, empty) block
  fireEvent.click(screen.getByText('/ block'));   // the "insert block" affordance
  fireEvent.click(screen.getByText('Heading 1'));
  expect(onChange).toHaveBeenCalledWith('# ');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/pages/Note/NotionEditor.test.jsx`
Expected: FAIL (no "/ block" affordance / "Heading 1" item).

- [ ] **Step 3: Implement the slash menu**

Add to `NotionEditor.jsx`: a `SLASH_MENU` array `[{ key, label, type, kind? }]`, an `openSlashFor` state (block index or null), a small popup rendered next to that block, and a `setType(i, type, kind)` that patches the block resetting shape (`{ type, kind, text: type.startsWith('callout')? '' : b.text, checked: false, children: '' }`). Trigger: an always-present ghost "+ / block" affordance on an empty block, plus detecting a leading `/` in `onChange`. Picking an item calls `setType` then closes the menu and calls `commit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/pages/Note/NotionEditor.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/Note/NotionEditor.jsx src/components/pages/Note/NotionEditor.test.jsx
git commit -m "feat(note): slash menu to insert/convert blocks in Notion mode"
```

---

### Task 6: Drag-drop block reordering

**Files:**
- Modify: `src/components/pages/Note/NotionEditor.jsx`
- Modify: `src/components/pages/Note/NotionEditor.test.jsx`

**Interfaces:**
- Consumes: block list from Task 4; `react-beautiful-dnd` (`DragDropContext`, `Droppable`, `Draggable`) — already a project dependency.
- Produces: each block wrapped in a `Draggable` with a hover handle `⠿`; dropping reorders `blocks` and calls `onChange(serializeBlocks(reordered))`.

- [ ] **Step 1: Write the failing test (append)**

```jsx
// append to NotionEditor.test.jsx — verify a reorder helper serializes correctly
import { reorder } from './NotionEditor';   // export the pure helper

it('reorder() moves a block and preserves the rest', () => {
  const md = 'one\ntwo\nthree';
  // pure reorder on parsed blocks is exercised via reorder(blocks, from, to)
  // moving index 0 -> 2 yields "two\nthree\none"
  const { parseMarkdown, serializeBlocks } = require('./noteFormat');
  const blocks = parseMarkdown(md);
  expect(serializeBlocks(reorder(blocks, 0, 2))).toBe('two\nthree\none');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/pages/Note/NotionEditor.test.jsx`
Expected: FAIL (`reorder` not exported).

- [ ] **Step 3: Implement**

Add and export a pure `reorder(list, from, to)` in `NotionEditor.jsx`:

```javascript
export const reorder = (list, from, to) => {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};
```

Wrap the block list in `<DragDropContext onDragEnd={...}>` → `<Droppable>` → each block in `<Draggable draggableId={b.id} index={i}>`, putting the drag handle props on a `⠿` span (hover-revealed). `onDragEnd` calls `commit(reorder(blocks, source.index, destination.index))` when `destination` exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/pages/Note/NotionEditor.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/Note/NotionEditor.jsx src/components/pages/Note/NotionEditor.test.jsx
git commit -m "feat(note): drag-drop block reordering in Notion mode"
```

---

### Task 7: Format toggle in Options + wire NotionEditor into TuiView

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx`

**Interfaces:**
- Consumes: `NotionEditor` (Tasks 4-6), existing `optionRows` array, `lsGet`/`lsSet`, `doUpdate`, the `mode === 'body'` render branch.
- Produces: global `noteFormat` state (`'notion' | 'md'`, default `'notion'`, localStorage key `daily-note-format`); an Options row toggling it; the body editor renders `NotionEditor` when `notion`, the existing textarea when `md`.

- [ ] **Step 1: Add the state + key**

Near the other `_KEY` consts: `const NOTE_FORMAT_KEY = 'daily-note-format';`
Near the other `useState`s: `const [noteFormat, setNoteFormat] = useState(() => lsGet(NOTE_FORMAT_KEY, 'notion'));`
Add a setter: `const toggleNoteFormat = () => setNoteFormat((f) => { const n = f === 'notion' ? 'md' : 'notion'; lsSet(NOTE_FORMAT_KEY, n); return n; });`

- [ ] **Step 2: Add the Options row**

In the `optionRows` array (Task from a previous change), add as the first entry:

```javascript
{ kbd: 'F', label: 'note format — notion / markdown', value: noteFormat, on: noteFormat === 'notion',
  run: toggleNoteFormat },
```

Add `noteFormat` to any dependency the array is rebuilt from (it is rebuilt every render, so no change needed) and include `noteFormat` in `resetAppearance` (reset to `'notion'`, `lsSet(NOTE_FORMAT_KEY, 'notion')`).

- [ ] **Step 3: Branch the body editor render**

In the `mode === 'body'` block (`<div className="tui-editor-wrap">…`), wrap the existing markdown editor so it only renders when `noteFormat === 'md'`, and render `<NotionEditor content={draft} onChange={setDraft} />` when `noteFormat === 'notion'`. Import at top: `import NotionEditor from './NotionEditor';`. Keep `commit()` unchanged — it persists `draft` either way. Example:

```jsx
{mode === 'body' ? (
  noteFormat === 'notion' ? (
    <div className="tui-editor-wrap notion">
      <NotionEditor content={draft} onChange={setDraft} />
      <div className="tui-editor-bar">{/* keep the attach button + Ctrl+Enter/Esc hint as-is */}</div>
    </div>
  ) : (
    <div className="tui-editor-wrap">{/* the entire existing markdown editor, unchanged */}</div>
  )
) : ( /* preview */ )}
```

- [ ] **Step 4: Also branch the read-only preview**

In the preview render (`renderMarkdown(current.content, true)` path used when NOT editing), leave it as-is — `renderMarkdown` already renders blocks visually. No change needed; verify by reading the preview branch.

- [ ] **Step 5: Build + manual smoke**

Run: `npm run build`
Expected: build succeeds.
Manual: open Daily Note, press `i` — default shows the Notion block editor (no raw `**`/`> [!note]`). Open Options (`T`), toggle `note format` to `md` — editing shows the raw textarea. Type a callout in one mode, switch, confirm the same content appears in the other form.

- [ ] **Step 6: Commit**

```bash
git add src/components/pages/Note/TuiView.jsx
git commit -m "feat(note): global notion/md format toggle wired into the TUI editor"
```

---

### Task 8: Empty-state + edge polish + full test run

**Files:**
- Modify: `src/components/pages/Note/NotionEditor.jsx`
- Modify: `src/components/pages/Note/NotionEditor.test.jsx`

**Interfaces:**
- Consumes: everything above.
- Produces: empty note shows one editable paragraph with placeholder "gõ / để chèn khối"; switching modes while editing commits first (already handled by `setDraft` being the single buffer); unknown markdown stays verbatim (already covered by Task 1's paragraph fallback).

- [ ] **Step 1: Write the failing test (append)**

```jsx
// append to NotionEditor.test.jsx
it('shows a single empty paragraph for empty content', () => {
  const { container } = render(<NotionEditor content={''} onChange={() => {}} />);
  expect(container.querySelectorAll('.nb-text').length).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run src/components/pages/Note/NotionEditor.test.jsx`
If `parseMarkdown('')` returns `[{type:'paragraph',text:''}]`, this already passes — confirm. If it returns `[]`, make `NotionEditor` fall back to one empty paragraph block when `blocks.length === 0`.

- [ ] **Step 3: Implement fallback if needed**

In `NotionEditor`, after parsing: `const view = blocks.length ? blocks : [{ id: 'empty', type: 'paragraph', text: '' }];` and render `view`. Add the placeholder via CSS `.nb-text:empty::before { content: 'gõ / để chèn khối'; color: var(--text-muted); }`.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (noteFormat, NotionBlock, NotionEditor, existing deadlineReminders).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/pages/Note/NotionEditor.jsx src/components/pages/Note/NotionEditor.test.jsx
git commit -m "feat(note): empty-state placeholder + full test pass for Notion editor"
```

---

## Self-Review Notes

- **Spec coverage:** single-string source of truth (Tasks 1-2), block model & all block types (Task 1), inline edit no-raw-syntax (Task 3), slash menu (Task 5), drag-drop within note (Task 6), global toggle in Options default notion (Task 7), markdown mode untouched (Task 7 branch keeps existing editor), round-trip safety (Task 2), unknown-md fallback (Task 1), empty state (Task 8). All covered.
- **Out of scope** (nested-deep, tables, cross-note drag) intentionally absent.
- **Type consistency:** `parseMarkdown`/`serializeBlocks`/`reorder`/`CALLOUT_KINDS` names used identically across tasks. Block field names (`text`, `checked`, `kind`, `title`, `children`, `url`, `alt`, `label`, `lang`) consistent between parse (Task 1), serialize (Task 2), and render (Task 3).
- **Test infra risk:** Tasks 3+ need `@testing-library/react` + jsdom; Step 2 of Task 3 installs them if missing and sets `environment: 'jsdom'` in `vite.config.js`.
