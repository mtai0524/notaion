# TUI Mobile Touch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người dùng điện thoại làm được mọi thao tác TUI Daily Note bằng chạm (spec: `docs/superpowers/specs/2026-07-20-tui-mobile-touch-design.md`).

**Architecture:** Thêm thanh action đáy context-aware + action sheet (long-press / nút ⋯) vào `TuiView.jsx`, gọi lại đúng các handler sẵn có. Helper thuần tách vào `tuiMobile.js` để unit-test. Nvim tắt khi `(pointer: coarse)`. `visualViewport` → CSS var chống bàn phím ảo che editor. Vuốt ngang chuyển panel.

**Tech Stack:** React 18, SCSS, vitest (jsdom). Không thêm dependency mới.

## Global Constraints

- **TUYỆT ĐỐI KHÔNG chạy `git commit` / `git push`** — user tự commit. Kết thúc mỗi task chỉ chạy test/build; để nguyên working tree.
- Desktop (>768px) giữ nguyên 100% hành vi + giao diện hiện tại.
- Mobile style theo neo-brutalist sẵn có (nút vuông, border 1.5px, shadow offset — xem `.tui-mobile-nav button` trong `TuiView.scss:1911`); đỏ chỉ dùng cho hành động nguy hiểm.
- Mọi nút chạm `min-height: 44px`.
- Tests hiện có (93) phải xanh sau mỗi task: `npx vitest run`.

---

### Task 1: Helper thuần `tuiMobile.js` (TDD)

**Files:**
- Create: `src/components/pages/Note/tuiMobile.js`
- Test: `src/components/pages/Note/tuiMobile.test.js`

**Interfaces:**
- Produces: `mobileActionContext({ focus, mode, unsavedPrompt })` → `'unsaved' | 'editor' | 'preview' | 'list'`; `swipePanelTarget(focus, dx, dy, opts?)` → `'folders' | 'notes' | 'preview' | null`.

- [ ] **Step 1: Viết test fail**

```js
// src/components/pages/Note/tuiMobile.test.js
import { describe, it, expect } from 'vitest';
import { mobileActionContext, swipePanelTarget } from './tuiMobile';

describe('mobileActionContext', () => {
  it('unsavedPrompt thắng mọi thứ', () => {
    expect(mobileActionContext({ focus: 'preview', mode: 'body', unsavedPrompt: true })).toBe('unsaved');
  });
  it('mode body/title → editor', () => {
    expect(mobileActionContext({ focus: 'preview', mode: 'body', unsavedPrompt: false })).toBe('editor');
    expect(mobileActionContext({ focus: 'notes', mode: 'title', unsavedPrompt: false })).toBe('editor');
  });
  it('focus preview (không soạn) → preview', () => {
    expect(mobileActionContext({ focus: 'preview', mode: 'normal', unsavedPrompt: false })).toBe('preview');
  });
  it('mặc định → list', () => {
    expect(mobileActionContext({ focus: 'notes', mode: 'normal', unsavedPrompt: false })).toBe('list');
    expect(mobileActionContext({ focus: 'folders', mode: 'delete', unsavedPrompt: false })).toBe('list');
  });
});

describe('swipePanelTarget', () => {
  it('vuốt trái (dx âm) → panel kế tiếp', () => {
    expect(swipePanelTarget('folders', -80, 0)).toBe('notes');
    expect(swipePanelTarget('notes', -80, 10)).toBe('preview');
  });
  it('vuốt phải (dx dương) → panel trước', () => {
    expect(swipePanelTarget('preview', 80, 0)).toBe('notes');
    expect(swipePanelTarget('notes', 80, 0)).toBe('folders');
  });
  it('ở mép thì đứng yên (null)', () => {
    expect(swipePanelTarget('folders', 80, 0)).toBe(null);
    expect(swipePanelTarget('preview', -80, 0)).toBe(null);
  });
  it('dưới ngưỡng 60px hoặc chéo dọc quá → null', () => {
    expect(swipePanelTarget('notes', -40, 0)).toBe(null);
    expect(swipePanelTarget('notes', -80, 50)).toBe(null); // |dx| < 2|dy|
  });
  it('focus lạ → null', () => {
    expect(swipePanelTarget('editor', -80, 0)).toBe(null);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/components/pages/Note/tuiMobile.test.js`
Expected: FAIL — "Cannot find module './tuiMobile'" (hoặc tương đương).

- [ ] **Step 3: Implement tối thiểu**

```js
// src/components/pages/Note/tuiMobile.js
/* Pure helpers for the TUI mobile (touch) experience. */

/* Which action set the mobile bottom bar shows. unsavedPrompt outranks
   everything: the user must answer it before doing anything else. */
export function mobileActionContext({ focus, mode, unsavedPrompt }) {
  if (unsavedPrompt) return 'unsaved';
  if (mode === 'body' || mode === 'title') return 'editor';
  if (focus === 'preview') return 'preview';
  return 'list';
}

const PANELS = ['folders', 'notes', 'preview'];

/* Horizontal swipe → adjacent panel. Requires a mostly-horizontal gesture
   (|dx| ≥ threshold and |dx| ≥ 2|dy|) so vertical scrolling never switches
   panels. Returns the new focus or null for "no switch". */
export function swipePanelTarget(focus, dx, dy, { threshold = 60 } = {}) {
  if (Math.abs(dx) < threshold || Math.abs(dx) < 2 * Math.abs(dy)) return null;
  const i = PANELS.indexOf(focus);
  if (i === -1) return null;
  const j = dx < 0 ? i + 1 : i - 1;
  if (j < 0 || j >= PANELS.length) return null;
  return PANELS[j];
}
```

- [ ] **Step 4: Chạy test pass**

Run: `npx vitest run src/components/pages/Note/tuiMobile.test.js`
Expected: PASS (9 tests). Sau đó `npx vitest run` — toàn bộ xanh.

---

### Task 2: Thanh action đáy + nút cho hộp "Save changes?"

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx` (import helper; state `sheetOpen`; JSX thanh action sau `</div>` đóng `.tui-body`, trước status bar; sửa span `tui-unsaved-prompt` ~dòng 2222)
- Modify: `src/components/pages/Note/TuiView.scss` (cuối file, trong media query mobile)

**Interfaces:**
- Consumes: `mobileActionContext` (Task 1); handler sẵn có trong TuiView: `commit()`, `saveBody()`, `bodyDirty()`, `createNote('blank')`, `editBody()`, `toggleDone()`, `togglePin()`, `setShowTele(true)`, `setShowCal(true)`, `setUnsavedPrompt`, `setMode`, `setDraft`, `setSlash`, `inputRef`, `fileInputRef`, `suppressBlurRef`, `current`.
- Produces: state `const [sheetOpen, setSheetOpen] = useState(null); // null | 'tools' | 'note'` — Task 3 dùng.

- [ ] **Step 1: Thêm import + state**

Đầu file TuiView.jsx (cạnh các import nội bộ khác):
```js
import { mobileActionContext, swipePanelTarget } from './tuiMobile';
```
Cạnh các useState khác (~dòng 264):
```js
const [sheetOpen, setSheetOpen] = useState(null); // mobile action sheet: null | 'tools' | 'note'
```

- [ ] **Step 2: Thêm JSX thanh action**

Chèn ngay sau thẻ đóng `</div>` của `.tui-body`, trước phần status bar:

```jsx
{/* Mobile bottom action bar — context-aware; CSS hides it above 768px */}
<div className="tui-mobile-actions">
  {(() => {
    const ctx = mobileActionContext({ focus, mode, unsavedPrompt });
    if (ctx === 'unsaved') return (<>
      <button type="button" className="tma-btn primary"
              onClick={() => { saveBody(); setUnsavedPrompt(false); setMode('normal'); setDraft(''); setSlash(null); }}>✓ Save</button>
      <button type="button" className="tma-btn danger"
              onClick={() => { setUnsavedPrompt(false); setMode('normal'); setDraft(''); setSlash(null); }}>✕ Discard</button>
      <button type="button" className="tma-btn"
              onClick={() => { setUnsavedPrompt(false); requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); }}>Keep</button>
    </>);
    if (ctx === 'editor') return (<>
      <button type="button" className="tma-btn primary"
              onMouseDown={(e) => { e.preventDefault(); commit(); }}>✓ Save</button>
      <button type="button" className="tma-btn"
              onMouseDown={(e) => { e.preventDefault();
                if (mode === 'body' && bodyDirty()) setUnsavedPrompt(true);
                else { setMode('normal'); setDraft(''); setSlash(null); } }}>✕ Cancel</button>
      {mode === 'body' && (
        <button type="button" className="tma-btn"
                onMouseDown={(e) => { e.preventDefault(); suppressBlurRef.current = true; fileInputRef.current?.click(); }}>📎</button>
      )}
    </>);
    if (ctx === 'preview') return (<>
      <button type="button" className="tma-btn primary" onClick={editBody}>✎ Edit</button>
      <button type="button" className="tma-btn" onClick={toggleDone}>{current?.isCompleted ? '↺ Undone' : '✓ Done'}</button>
      <button type="button" className="tma-btn" onClick={togglePin}>{current?.pinned ? '📌 Unpin' : '📌 Pin'}</button>
      <button type="button" className="tma-btn" onClick={() => setSheetOpen('note')}>⋯</button>
    </>);
    return (<>
      <button type="button" className="tma-btn primary" onClick={() => createNote('blank')}>+ New</button>
      <button type="button" className="tma-btn" onClick={() => setShowTele(true)}>🔍</button>
      <button type="button" className="tma-btn" onClick={() => setShowCal(true)}>📅</button>
      <button type="button" className="tma-btn" onClick={() => setSheetOpen('tools')}>⋯</button>
    </>);
  })()}
</div>
```

Lưu ý: nút editor dùng `onMouseDown` + `preventDefault` (pattern sẵn có của nút Attach/format — giữ focus textarea, không kích hoạt onBlur).

- [ ] **Step 3: Thêm nút chạm vào hộp "Save changes?" trong editor bar**

Tại span `tui-unsaved-prompt` (~dòng 2222), thay:
```jsx
<span className="tui-unsaved-prompt">
  Save changes? <kbd>y</kbd> save · <kbd>n</kbd> discard · <kbd>Esc</kbd> keep editing
</span>
```
bằng:
```jsx
<span className="tui-unsaved-prompt">
  Save changes?
  <button type="button" className="tui-warn-btn yes"
          onClick={() => { saveBody(); setUnsavedPrompt(false); setMode('normal'); setDraft(''); setSlash(null); }}>
    Save (y)
  </button>
  <button type="button" className="tui-warn-btn no"
          onClick={() => { setUnsavedPrompt(false); setMode('normal'); setDraft(''); setSlash(null); }}>
    Discard (n)
  </button>
  <button type="button" className="tui-warn-btn"
          onClick={() => { setUnsavedPrompt(false); requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); }}>
    Keep (Esc)
  </button>
</span>
```
(class `tui-warn-btn` đã có style sẵn — dùng lại.)

- [ ] **Step 4: SCSS**

Cuối `TuiView.scss`:
```scss
/* ── Mobile bottom action bar (context-aware) — phones only ── */
.tui .tui-mobile-actions { display: none; }

@media (max-width: 768px) {
  .tui .tui-mobile-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    position: sticky;
    bottom: 0;
    z-index: 30;
    padding: 8px 2px calc(8px + env(safe-area-inset-bottom, 0px));
    background: var(--container-bg, #fff);
    border-top: 1.5px solid var(--border-color, #111827);

    .tma-btn {
      flex: 1 1 0;
      min-width: 0;
      min-height: 44px;
      padding: 8px 6px;
      background: var(--container-bg, #fff);
      border: 1.5px solid var(--border-color, #111827);
      border-radius: var(--radius-sm, 4px);
      color: var(--text-color, #111827);
      font: inherit;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      box-shadow: -1.5px 1.5px 0 0 var(--shadow-color, #111827);

      &:active { box-shadow: none; transform: translate(-1px, 1px); }
      &.primary { background: var(--text-color, #111827); color: var(--container-bg, #fff); }
      &.danger { border-color: #dc2626; color: #dc2626; }
    }
  }
}
```

- [ ] **Step 5: Verify**

Run: `npx vitest run` → toàn bộ xanh. `npm run build` → 0 errors.

---

### Task 3: Action sheet + long-press trên note row

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx` (ref long-press; handlers `lpStart/lpMove/lpEnd`; JSX sheet trước thẻ đóng root; gắn touch handlers + suppress click vào note row ~dòng 1962)
- Modify: `src/components/pages/Note/TuiView.scss`

**Interfaces:**
- Consumes: `sheetOpen`/`setSheetOpen` (Task 2); handler sẵn có: `toggleDone()`, `togglePin()`, `editBody()`, `askArchive()`, `yankNote()`, `setDue(hhmm)` (nhận `'HH:mm'` hoặc `'off'`), `setMode('category')`, `setMode('delete')`, `setShowWeek(true)`, `setShowTheme(true)`, `setZen`+`lsSet(TUI_ZEN_KEY, v)`, `startPomodoro()`/`stopPomodoro()`, `pomodoro`, `setNoteIndex`, `current`, `zen`.

- [ ] **Step 1: Long-press handlers**

Cạnh các ref khác (~dòng 277):
```js
const lpRef = useRef(null); // long-press trên note row: { timer, x, y, fired }
```
Cạnh các handler (~sau `cycleSort`):
```js
/* Long-press (~500ms, không rê quá 10px) trên một note row mở action sheet
   cho đúng note đó. Tap thường vẫn drill vào preview như cũ. */
const lpStart = (i, e) => {
  const t = e.touches?.[0];
  if (!t) return;
  lpRef.current = {
    x: t.clientX, y: t.clientY, fired: false,
    timer: setTimeout(() => {
      if (!lpRef.current) return;
      lpRef.current.fired = true;
      setNoteIndex(i);
      setSheetOpen('note');
    }, 500),
  };
};
const lpMove = (e) => {
  const s = lpRef.current;
  const t = e.touches?.[0];
  if (!s || !t) return;
  if (Math.abs(t.clientX - s.x) > 10 || Math.abs(t.clientY - s.y) > 10) {
    clearTimeout(s.timer);
    lpRef.current = null;
  }
};
const lpEnd = () => { if (lpRef.current) clearTimeout(lpRef.current.timer); };
```

- [ ] **Step 2: Gắn vào note row**

Tại div `.tui-row` (~dòng 1962), thêm props:
```jsx
onTouchStart={(e) => lpStart(i, e)}
onTouchMove={lpMove}
onTouchEnd={lpEnd}
onContextMenu={(e) => { if (lpRef.current?.fired) e.preventDefault(); }}
```
và ĐẦU handler `onClick` sẵn có của row, thêm guard:
```js
if (lpRef.current?.fired) { lpRef.current = null; return; } // long-press đã xử lý
```

- [ ] **Step 3: JSX action sheet**

Trước thẻ đóng root của TUI (cạnh các overlay khác như week/options):
```jsx
{sheetOpen && (
  <div className="tui-sheet-backdrop" onClick={() => setSheetOpen(null)}>
    <div className="tui-action-sheet" onClick={(e) => e.stopPropagation()}>
      {sheetOpen === 'note' && current ? (<>
        <div className="tui-sheet-title">{current.title || '(untitled)'}</div>
        <button type="button" onClick={() => { toggleDone(); setSheetOpen(null); }}>
          ✓ {current.isCompleted ? 'Mark undone' : 'Mark done'}</button>
        <button type="button" onClick={() => { togglePin(); setSheetOpen(null); }}>
          📌 {current.pinned ? 'Unpin' : 'Pin'}</button>
        <button type="button" onClick={() => { setSheetOpen(null); editBody(); }}>✎ Edit content</button>
        <button type="button" onClick={() => { setSheetOpen(null); askArchive(); }}>📦 Archive</button>
        <button type="button" onClick={() => { setSheetOpen(null); setMode('category'); }}>🏷 Category</button>
        <button type="button" onClick={() => { yankNote(); setSheetOpen(null); }}>⧉ Copy</button>
        <div className="tui-sheet-due">
          <span>⏰ Due</span>
          <input type="time"
                 defaultValue={current.deadline
                   ? `${String(new Date(current.deadline).getHours()).padStart(2, '0')}:${String(new Date(current.deadline).getMinutes()).padStart(2, '0')}`
                   : ''}
                 onChange={(e) => { if (e.target.value) setDue(e.target.value); }} />
          {current.deadline && (
            <button type="button" onClick={() => { setDue('off'); setSheetOpen(null); }}>clear</button>
          )}
        </div>
        <button type="button" className="danger"
                onClick={() => { setSheetOpen(null); setMode('delete'); }}>🗑 Delete</button>
      </>) : (<>
        <button type="button" onClick={() => { setSheetOpen(null); setShowWeek(true); }}>📊 Week review</button>
        <button type="button" onClick={() => { setSheetOpen(null); setShowTheme(true); }}>⚙ Options</button>
        <button type="button" onClick={() => { const v = !zen; setZen(v); lsSet(TUI_ZEN_KEY, v); setSheetOpen(null); }}>
          ◱ Zen {zen ? 'off' : 'on'}</button>
        <button type="button" onClick={() => { setSheetOpen(null); if (pomodoro) stopPomodoro(); else startPomodoro(); }}>
          🍅 {pomodoro ? 'Stop pomodoro' : 'Pomodoro'}</button>
        <button type="button" onClick={() => { setSheetOpen(null); setMode('help'); }}>? Help</button>
      </>)}
    </div>
  </div>
)}
```
(Nếu tên biến zen-persist khác `lsSet(TUI_ZEN_KEY, v)`, dùng đúng pattern tại `TuiView.jsx:724`.)

- [ ] **Step 4: SCSS**

Cuối `TuiView.scss`:
```scss
/* ── Mobile action sheet (long-press / ⋯) ── */
.tui-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 240;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.4);
}

.tui-action-sheet {
  width: 100%;
  max-height: 70vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--container-bg, #fff);
  border-top: 2px solid var(--border-color, #111827);
  font-family: inherit;

  .tui-sheet-title {
    font-weight: 800;
    font-size: 0.78rem;
    letter-spacing: 0.5px;
    padding: 2px 2px 6px;
    border-bottom: 1.5px dashed var(--border-color, #d1d5db);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button {
    min-height: 44px;
    text-align: left;
    padding: 8px 10px;
    background: var(--container-bg, #fff);
    border: 1.5px solid var(--border-color, #111827);
    border-radius: var(--radius-sm, 4px);
    color: var(--text-color, #111827);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: -1.5px 1.5px 0 0 var(--shadow-color, #111827);

    &:active { box-shadow: none; transform: translate(-1px, 1px); }
    &.danger { border-color: #dc2626; color: #dc2626; }
  }

  .tui-sheet-due {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 2px;
    font-size: 0.78rem;
    font-weight: 700;

    input[type='time'] {
      flex: 1;
      min-height: 40px;
      padding: 4px 8px;
      border: 1.5px solid var(--border-color, #111827);
      border-radius: var(--radius-sm, 4px);
      background: var(--container-bg, #fff);
      color: var(--text-color, #111827);
      font: inherit;
    }

    button { flex: 0 0 auto; min-height: 40px; }
  }
}

/* row long-press: chặn callout chọn chữ trên iOS */
@media (max-width: 768px) {
  .tui .tui-row {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
}
```

- [ ] **Step 5: Verify**

Run: `npx vitest run` → xanh. `npm run build` → 0 errors.

---

### Task 4: Nvim tự tắt trên màn hình cảm ứng

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx`

**Interfaces:**
- Consumes: state `nvim` sẵn có (`TuiView.jsx:230`).
- Produces: `nvimOn` — boolean dùng cho MỌI hành vi/render của nvim trong editor.

- [ ] **Step 1: Thêm phát hiện coarse pointer**

Cạnh các state (~dòng 230, sau `const [nvim, setNvim] = ...`):
```js
// Màn hình cảm ứng không có Esc — NORMAL mode là bẫy kẹt. Tắt hành vi nvim
// trên coarse pointer; setting nvim của user vẫn được giữ cho desktop.
const coarsePointer = useMemo(() => window.matchMedia?.('(pointer: coarse)')?.matches ?? false, []);
const nvimOn = nvim && !coarsePointer;
```
(Thêm `useMemo` vào import React nếu chưa có — đã có sẵn trong file.)

- [ ] **Step 2: Thay các chỗ đọc hành vi `nvim` → `nvimOn`**

Grep `nvim` trong TuiView.jsx, thay ĐÚNG các chỗ hành vi/render sau (KHÔNG đụng setNvim, localStorage, options popup — đó là setting):
- Guard đầu `handleMdVim` (dạng `if (!nvim ...) return false`) → `nvimOn`
- `className={`tui-textarea ${nvim && mdVim !== 'insert' ? 'vim-normal' : ''}`}` → `nvimOn`
- `onBeforeInput`: `if (nvim && mdVim !== 'insert')` → `nvimOn`
- `{nvim && vimLineNo && <LineGutter .../>}` → `nvimOn`
- Badge: `{nvim && (<span className={`ne-vim-badge inline ${mdVim}`}>...` → `nvimOn`
- Wrapper class: `` `tui-textarea-wrap ${nvim && vimLineNo ? 'with-lineno' : ''}` `` → `nvimOn`
- Prop NotionEditor: `nvim={nvim}` → `nvim={nvimOn}`
- Mọi chỗ khác đọc `nvim` để quyết định phím/hiển thị editor (grep từng usage, phân loại setting vs hành vi).

- [ ] **Step 3: Verify**

Run: `npx vitest run` → xanh. `npm run build` → 0 errors.
Kiểm nhanh logic: mở dev server, DevTools device mode (touch) → vào editor gõ bình thường được ngay, không có badge NORMAL; tắt device mode reload → nvim hoạt động như cũ.

---

### Task 5: Bàn phím ảo không che editor (visualViewport)

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx` (thêm useEffect)
- Modify: `src/components/pages/Note/TuiView.scss` (media query mobile)

**Interfaces:**
- Produces: CSS var `--tui-vvh` trên root `.tui` = chiều cao viewport thật còn thấy được.

- [ ] **Step 1: useEffect đo visualViewport**

Cạnh các useEffect khác:
```js
// Bàn phím ảo mobile: visualViewport.height = phần màn hình còn thấy được.
// Đặt vào --tui-vvh để CSS co editor + giữ thanh action nổi trên bàn phím.
useEffect(() => {
  const vv = window.visualViewport;
  if (!vv) return undefined;
  const apply = () => rootRef.current?.style.setProperty('--tui-vvh', `${vv.height}px`);
  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  return () => {
    vv.removeEventListener('resize', apply);
    vv.removeEventListener('scroll', apply);
  };
}, []);
```

- [ ] **Step 2: SCSS dùng var**

Trong media query mobile cuối `TuiView.scss`:
```scss
@media (max-width: 768px) {
  /* Khi bàn phím ảo mở, co TUI theo phần còn nhìn thấy để thanh action
     (sticky bottom) không bị đẩy xuống dưới bàn phím. */
  .tui {
    max-height: var(--tui-vvh, 100dvh);
  }
}
```

- [ ] **Step 3: Verify**

Run: `npx vitest run` + `npm run build` → xanh/0 errors. Runtime check ở Task 7.

---

### Task 6: Vuốt ngang chuyển panel

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx` (touch handlers trên `.tui-body`)

**Interfaces:**
- Consumes: `swipePanelTarget` (Task 1), `focus`/`setFocus`, `mode`.

- [ ] **Step 1: Handlers**

Cạnh `lpRef`:
```js
const swipeRef = useRef(null); // { x, y } — điểm touchstart trên .tui-body
```
Cạnh các handler:
```js
/* Vuốt ngang trên vùng panel → chuyển FOLDERS ↔ NOTES ↔ PREVIEW.
   Không kích hoạt khi đang soạn (xung đột chọn text / cuộn textarea). */
const bodySwipeStart = (e) => {
  const t = e.touches?.[0];
  swipeRef.current = t ? { x: t.clientX, y: t.clientY } : null;
};
const bodySwipeEnd = (e) => {
  const s = swipeRef.current;
  swipeRef.current = null;
  if (!s || mode === 'body' || mode === 'title') return;
  const t = e.changedTouches?.[0];
  if (!t) return;
  const target = swipePanelTarget(focus, t.clientX - s.x, t.clientY - s.y);
  if (target) setFocus(target);
};
```

- [ ] **Step 2: Gắn vào `.tui-body`**

Tại `<div className="tui-body">` (~dòng 1894):
```jsx
<div className="tui-body" onTouchStart={bodySwipeStart} onTouchEnd={bodySwipeEnd}>
```

- [ ] **Step 3: Verify**

Run: `npx vitest run` + `npm run build` → xanh/0 errors.

---

### Task 7: Runtime verify (mobile + desktop regression)

**Files:** không sửa code (chỉ verify; sửa lỗi phát hiện được nếu có).

- [ ] **Step 1: Toàn bộ test + build**

Run: `npx vitest run` → 102 tests xanh (93 cũ + 9 mới). `npm run build` → 0 errors.

- [ ] **Step 2: Runtime mobile 390×844 (skill `verify` — headless Chrome, dev server port 2405)**

Chụp và kiểm:
1. List view: thấy switcher panel + thanh action `[+ New][🔍][📅][⋯]`; bấm `⋯` → sheet tools mở.
2. Tap note → preview: thanh action đổi thành `[✎ Edit][✓ Done][📌 Pin][⋯]`; `⋯` → sheet note (Done/Pin/Archive/Category/Copy/Due/Delete).
3. Bấm `✎ Edit` → editor: thanh action `[✓ Save][✕ Cancel][📎]`; KHÔNG có badge NORMAL (nvim off vì touch — emulate coarse pointer).
4. Sửa nội dung rồi bấm `✕ Cancel` → thanh action thành `[Save][Discard][Keep]`.
5. Long-press (dispatch touchstart, đợi 600ms, touchend) trên một note row → sheet note mở đúng note đó.
6. Vuốt (touchstart/touchend giả lập dx=-100) trên `.tui-body` → focus chuyển panel kế tiếp.

- [ ] **Step 3: Desktop regression 1280×800**

1. Không thấy `.tui-mobile-actions`, không sheet.
2. Nvim vẫn hoạt động: vào editor, badge NORMAL hiện, `i` → INSERT.
3. Hộp "Save changes?" hiện 3 nút (mới) — bấm được bằng chuột, phím y/n/Esc vẫn hoạt động.

- [ ] **Step 4: Báo kết quả + git message gợi ý cho user (KHÔNG tự commit)**

```
feat(tui): full touch support on mobile — bottom action bar, long-press action sheet, auto-disable nvim on touch, visualViewport keyboard fix, swipe panel switching
```
