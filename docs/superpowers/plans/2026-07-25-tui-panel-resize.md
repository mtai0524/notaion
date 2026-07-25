# TUI Panel Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép chỉnh chiều rộng ba panel của TUI Daily Note (FOLDERS · NOTES · PREVIEW) bằng bàn phím (Alt+h/l và RESIZE mode) và chuột (kéo splitter, Alt+drag), kích thước nhớ qua localStorage.

**Architecture:** Toàn bộ logic tính toán nằm trong module thuần mới `tuiResize.js` (hàm trên mảng số, không đụng DOM — test bằng vitest). `TuiView.jsx` chỉ giữ state `sizes`, các nhánh keydown, và handler pointer. Layout chuyển từ `width`/`flex` hỗn hợp sang inline `flex: 0 0 <n>%`, chỉ áp khi ở chế độ ba panel desktop.

**Tech Stack:** React 18 (hooks), SCSS, vitest, pointer events.

## Global Constraints

- Mảng kích thước luôn có đúng 3 phần tử `[folders, notes, preview]`, tổng = 100.
- Sàn tối thiểu mỗi panel: `MIN = 8` (phần trăm).
- Bước bàn phím: `STEP = 2`, `BIG_STEP = 8`.
- Mặc định: `DEFAULT_SIZES = [16, 35, 49]`.
- localStorage key: `tui:panelSizes`. Debounce ghi khi kéo: 300ms.
- Inline style **chỉ** được áp khi `!zen && !narrow` (xem Task 4) — nếu không sẽ phá layout mobile và zen.
- Không đổi API, không đổi data model, không thêm route.
- Giữ toàn bộ test hiện có xanh (`npm test`).
- Tiếng Việt cho tên test và comment giải thích, khớp `tuiMobile.test.js`.

---

### Task 1: Module thuần `tuiResize.js` — clamp và applyDelta

**Files:**
- Create: `src/components/pages/Note/tuiResize.js`
- Test: `src/components/pages/Note/tuiResize.test.js`

**Interfaces:**
- Consumes: (không có — task đầu tiên)
- Produces:
  - `DEFAULT_SIZES: number[]` = `[16, 35, 49]`
  - `MIN: number` = `8`, `STEP: number` = `2`, `BIG_STEP: number` = `8`
  - `clampSizes(sizes: number[]): number[]` — ép sàn `MIN`, chuẩn hoá tổng về 100; đầu vào không hợp lệ → `DEFAULT_SIZES`
  - `applyDelta(sizes: number[], focus: string, delta: number): number[]` — `focus` là `'folders' | 'notes' | 'preview'`, `delta` dương = nới panel focus

- [ ] **Step 1: Viết test thất bại**

Tạo `src/components/pages/Note/tuiResize.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { DEFAULT_SIZES, MIN, clampSizes, applyDelta } from './tuiResize';

const sum = (a) => a.reduce((x, y) => x + y, 0);

describe('clampSizes', () => {
  it('giữ nguyên mảng hợp lệ', () => {
    expect(clampSizes([16, 35, 49])).toEqual([16, 35, 49]);
  });
  it('tổng luôn về 100', () => {
    expect(sum(clampSizes([10, 10, 10]))).toBeCloseTo(100);
    expect(sum(clampSizes([50, 50, 50]))).toBeCloseTo(100);
  });
  it('ép sàn MIN', () => {
    const r = clampSizes([2, 49, 49]);
    expect(r[0]).toBeGreaterThanOrEqual(MIN);
    expect(sum(r)).toBeCloseTo(100);
  });
  it('đầu vào hỏng → mặc định', () => {
    expect(clampSizes(null)).toEqual(DEFAULT_SIZES);
    expect(clampSizes([1, 2])).toEqual(DEFAULT_SIZES);
    expect(clampSizes([NaN, 35, 49])).toEqual(DEFAULT_SIZES);
    expect(clampSizes([Infinity, 35, 49])).toEqual(DEFAULT_SIZES);
  });
});

describe('applyDelta', () => {
  it('FOLDERS mượn của NOTES, PREVIEW không đổi', () => {
    const r = applyDelta([16, 35, 49], 'folders', 2);
    expect(r[0]).toBeCloseTo(18);
    expect(r[1]).toBeCloseTo(33);
    expect(r[2]).toBeCloseTo(49);
  });
  it('NOTES thương lượng với PREVIEW', () => {
    const r = applyDelta([16, 35, 49], 'notes', 2);
    expect(r[0]).toBeCloseTo(16);
    expect(r[1]).toBeCloseTo(37);
    expect(r[2]).toBeCloseTo(47);
  });
  it('PREVIEW mượn của NOTES', () => {
    const r = applyDelta([16, 35, 49], 'preview', 2);
    expect(r[1]).toBeCloseTo(33);
    expect(r[2]).toBeCloseTo(51);
  });
  it('delta âm = thu lại', () => {
    const r = applyDelta([16, 35, 49], 'folders', -2);
    expect(r[0]).toBeCloseTo(14);
    expect(r[1]).toBeCloseTo(37);
  });
  it('dừng khi hàng xóm chạm sàn, không tràn sang panel thứ ba', () => {
    const r = applyDelta([16, 9, 75], 'folders', 10);
    expect(r[1]).toBeCloseTo(MIN);
    expect(r[0]).toBeCloseTo(17);
    expect(r[2]).toBeCloseTo(75);
    expect(sum(r)).toBeCloseTo(100);
  });
  it('không tự co dưới sàn', () => {
    const r = applyDelta([9, 42, 49], 'folders', -10);
    expect(r[0]).toBeCloseTo(MIN);
    expect(sum(r)).toBeCloseTo(100);
  });
  it('focus lạ → giữ nguyên', () => {
    expect(applyDelta([16, 35, 49], 'zzz', 2)).toEqual([16, 35, 49]);
  });
  it('tổng luôn bảo toàn', () => {
    let s = [16, 35, 49];
    for (const f of ['folders', 'notes', 'preview', 'folders']) s = applyDelta(s, f, 5);
    expect(sum(s)).toBeCloseTo(100);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `npx vitest run src/components/pages/Note/tuiResize.test.js`
Expected: FAIL — `Failed to resolve import "./tuiResize"`

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `src/components/pages/Note/tuiResize.js`:

```js
/* Pure helpers for TUI panel resizing (Omarchy/Hyprland style).
   Sizes are percentages of .tui-body width: [folders, notes, preview],
   always summing to 100. All functions here are DOM-free so they unit-test
   directly. */

export const DEFAULT_SIZES = [16, 35, 49];
export const MIN = 8;
export const STEP = 2;
export const BIG_STEP = 8;

const PANELS = ['folders', 'notes', 'preview'];

const valid = (s) =>
  Array.isArray(s) && s.length === 3 && s.every((n) => typeof n === 'number' && Number.isFinite(n));

/* Floor every panel at MIN, then rescale so the total is exactly 100.
   Rescaling can push a panel back under MIN, so we settle it by handing the
   deficit to the largest panel — with 3 panels and MIN=8 there is always
   room (3*8 = 24 < 100). */
export function clampSizes(sizes) {
  if (!valid(sizes)) return [...DEFAULT_SIZES];
  const out = sizes.map((n) => Math.max(MIN, n));
  const total = out.reduce((a, b) => a + b, 0);
  if (total <= 0) return [...DEFAULT_SIZES];
  let excess = total - 100;
  // Take the excess from whoever has slack above MIN, largest first.
  while (excess > 1e-9) {
    const slack = out.map((n) => n - MIN);
    const pool = slack.reduce((a, b) => a + b, 0);
    if (pool <= 1e-9) return [...DEFAULT_SIZES]; // cannot fit — shouldn't happen
    const take = Math.min(excess, pool);
    for (let i = 0; i < out.length; i += 1) out[i] -= (slack[i] / pool) * take;
    excess -= take;
  }
  if (excess < -1e-9) out[out.indexOf(Math.max(...out))] -= excess; // deficit → biggest
  return out.map((n) => Math.round(n * 1e6) / 1e6);
}

/* Which neighbour a panel borrows from. NOTES sits in the middle, so by
   convention it always negotiates with PREVIEW (the widest panel). */
const NEIGHBOUR = { folders: 1, notes: 2, preview: 1 };

/* Grow (delta > 0) or shrink (delta < 0) the focused panel, taking the space
   from exactly one neighbour so the third panel never moves. */
export function applyDelta(sizes, focus, delta) {
  const base = clampSizes(sizes);
  const i = PANELS.indexOf(focus);
  if (i === -1 || !delta) return base;
  const j = NEIGHBOUR[focus];
  if (i === j) return base;
  // Both sides are bounded by MIN: we can move at most this much.
  const room = delta > 0 ? base[j] - MIN : base[i] - MIN;
  const move = Math.min(Math.abs(delta), Math.max(0, room)) * Math.sign(delta);
  const out = [...base];
  out[i] += move;
  out[j] -= move;
  return out.map((n) => Math.round(n * 1e6) / 1e6);
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/components/pages/Note/tuiResize.test.js`
Expected: PASS — toàn bộ test của `clampSizes` và `applyDelta` xanh

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/Note/tuiResize.js src/components/pages/Note/tuiResize.test.js
git commit -m "feat(tui): add pure resize helpers for panel sizing"
```

---

### Task 2: `sizesFromDrag` — kéo chuột theo tỉ lệ con trỏ

**Files:**
- Modify: `src/components/pages/Note/tuiResize.js`
- Test: `src/components/pages/Note/tuiResize.test.js`

**Interfaces:**
- Consumes: `clampSizes`, `MIN`, `DEFAULT_SIZES` từ Task 1
- Produces: `sizesFromDrag(sizes: number[], boundary: 0 | 1, ratio: number): number[]` — `boundary` 0 = khe FOLDERS|NOTES, 1 = khe NOTES|PREVIEW; `ratio` là vị trí con trỏ trong `.tui-body` (0–1)

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `src/components/pages/Note/tuiResize.test.js`:

```js
import { sizesFromDrag } from './tuiResize';

describe('sizesFromDrag', () => {
  it('biên 0: đặt mép phải của FOLDERS tại con trỏ, PREVIEW không đổi', () => {
    const r = sizesFromDrag([16, 35, 49], 0, 0.25);
    expect(r[0]).toBeCloseTo(25);
    expect(r[1]).toBeCloseTo(26);
    expect(r[2]).toBeCloseTo(49);
  });
  it('biên 1: đặt mép phải của NOTES tại con trỏ, FOLDERS không đổi', () => {
    const r = sizesFromDrag([16, 35, 49], 1, 0.7);
    expect(r[0]).toBeCloseTo(16);
    expect(r[1]).toBeCloseTo(54);
    expect(r[2]).toBeCloseTo(30);
  });
  it('kéo quá xa vẫn tôn trọng sàn MIN', () => {
    const a = sizesFromDrag([16, 35, 49], 0, 0.98);
    expect(a[1]).toBeGreaterThanOrEqual(MIN - 1e-6);
    expect(sum(a)).toBeCloseTo(100);
    const b = sizesFromDrag([16, 35, 49], 0, 0.0);
    expect(b[0]).toBeGreaterThanOrEqual(MIN - 1e-6);
    expect(sum(b)).toBeCloseTo(100);
  });
  it('biên lạ hoặc ratio hỏng → giữ nguyên', () => {
    expect(sizesFromDrag([16, 35, 49], 9, 0.5)).toEqual([16, 35, 49]);
    expect(sizesFromDrag([16, 35, 49], 0, NaN)).toEqual([16, 35, 49]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `npx vitest run src/components/pages/Note/tuiResize.test.js -t sizesFromDrag`
Expected: FAIL — `sizesFromDrag is not a function`

- [ ] **Step 3: Viết implementation tối thiểu**

Thêm vào cuối `src/components/pages/Note/tuiResize.js`:

```js
/* Drag a boundary to wherever the cursor is. boundary 0 = FOLDERS|NOTES,
   1 = NOTES|PREVIEW. `ratio` is the pointer's x position inside .tui-body
   (0–1). Only the two panels touching that boundary move; the third is
   untouched, which matches the keyboard "borrow from neighbour" model.
   Unlike the keyboard path this is continuous — snapping a drag to a 2%
   grid feels notchy. */
export function sizesFromDrag(sizes, boundary, ratio) {
  const base = clampSizes(sizes);
  if ((boundary !== 0 && boundary !== 1) || !Number.isFinite(ratio)) return base;
  const out = [...base];
  const pct = ratio * 100;
  if (boundary === 0) {
    const pair = base[0] + base[1];
    const a = Math.min(Math.max(pct, MIN), pair - MIN);
    out[0] = a;
    out[1] = pair - a;
  } else {
    const pair = base[1] + base[2];
    const edge = Math.min(Math.max(pct, base[0] + MIN), base[0] + pair - MIN);
    out[1] = edge - base[0];
    out[2] = pair - out[1];
  }
  return out.map((n) => Math.round(n * 1e6) / 1e6);
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/components/pages/Note/tuiResize.test.js`
Expected: PASS — cả ba describe block xanh

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/Note/tuiResize.js src/components/pages/Note/tuiResize.test.js
git commit -m "feat(tui): add sizesFromDrag for pointer-driven panel resize"
```

---

### Task 3: `loadSizes` / `saveSizes` — lưu localStorage

**Files:**
- Modify: `src/components/pages/Note/tuiResize.js`
- Test: `src/components/pages/Note/tuiResize.test.js`

**Interfaces:**
- Consumes: `clampSizes`, `DEFAULT_SIZES`, `MIN` từ Task 1
- Produces:
  - `SIZES_KEY: string` = `'tui:panelSizes'`
  - `loadSizes(): number[]` — đọc + validate, hỏng thì trả `DEFAULT_SIZES`
  - `saveSizes(sizes: number[]): void` — nuốt lỗi quota

Ghi chú: `TuiView.jsx` có sẵn `lsGet`/`lsSet` (dòng 106–114) nhưng chúng là hàm nội bộ **không export**. Không refactor chúng ở task này — `tuiResize.js` tự đọc/ghi để module đứng độc lập và test được, dùng cùng convention `JSON.parse`/`JSON.stringify` + nuốt lỗi.

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `src/components/pages/Note/tuiResize.test.js`:

```js
import { beforeEach } from 'vitest';
import { SIZES_KEY, loadSizes, saveSizes } from './tuiResize';

describe('loadSizes / saveSizes', () => {
  beforeEach(() => { localStorage.clear(); });

  it('chưa có gì → mặc định', () => {
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('lưu rồi đọc lại đúng', () => {
    saveSizes([20, 30, 50]);
    expect(loadSizes()).toEqual([20, 30, 50]);
  });
  it('JSON hỏng → mặc định', () => {
    localStorage.setItem(SIZES_KEY, '{nope');
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('sai độ dài → mặc định', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([50, 50]));
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('có NaN / không phải số → mặc định', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([null, 35, 49]));
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('tổng lệch quá → mặc định', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([10, 10, 10]));
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('dưới sàn → mặc định', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([2, 49, 49]));
    expect(loadSizes()).toEqual(DEFAULT_SIZES);
  });
  it('lệch trong sai số ±0.5 vẫn nhận (và được chuẩn hoá)', () => {
    localStorage.setItem(SIZES_KEY, JSON.stringify([16.2, 35, 49]));
    expect(sum(loadSizes())).toBeCloseTo(100);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `npx vitest run src/components/pages/Note/tuiResize.test.js -t loadSizes`
Expected: FAIL — `loadSizes is not a function`

- [ ] **Step 3: Viết implementation tối thiểu**

Thêm vào cuối `src/components/pages/Note/tuiResize.js`:

```js
export const SIZES_KEY = 'tui:panelSizes';

/* Read persisted sizes. Anything we can't fully trust — wrong shape, NaN,
   below the floor, total far off 100 — falls back to the default rather
   than being silently "fixed" into a layout the user never chose. */
export function loadSizes() {
  try {
    const raw = localStorage.getItem(SIZES_KEY);
    if (raw === null) return [...DEFAULT_SIZES];
    const parsed = JSON.parse(raw);
    if (!valid(parsed)) return [...DEFAULT_SIZES];
    if (parsed.some((n) => n < MIN)) return [...DEFAULT_SIZES];
    const total = parsed.reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.5) return [...DEFAULT_SIZES];
    return clampSizes(parsed);
  } catch {
    return [...DEFAULT_SIZES];
  }
}

export function saveSizes(sizes) {
  try { localStorage.setItem(SIZES_KEY, JSON.stringify(sizes)); } catch { /* quota — ignore */ }
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/components/pages/Note/tuiResize.test.js`
Expected: PASS — toàn bộ file xanh

(`vitest.config.js` đã đặt `environment: 'jsdom'` toàn cục nên `localStorage` có sẵn trong test, không cần khai báo gì thêm.)

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/Note/tuiResize.js src/components/pages/Note/tuiResize.test.js
git commit -m "feat(tui): persist panel sizes to localStorage with validation"
```

---

### Task 4: Nối state vào layout — inline flex, gated theo zen/mobile

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx` (import; state; 3 chỗ panel div ~2090, ~2174, ~2258)
- Modify: `src/components/pages/Note/TuiView.scss:104-106`

**Interfaces:**
- Consumes: `DEFAULT_SIZES`, `loadSizes`, `saveSizes`, `clampSizes` từ Task 1 & 3
- Produces:
  - state `sizes` / `setSizes` trong `TuiView`
  - `narrow: boolean` — true khi viewport ≤768px (chỉ theo bề rộng)
  - `panelStyle(i: number): object | undefined` — trả `{ flex: '0 0 X%' }` hoặc `undefined` khi không được áp

Ghi chú quan trọng: **không dùng `touchUi`** để gate. `touchUi` yêu cầu cả `max-width: 768px` **và** `pointer: coarse` (dòng 241–242), nên cửa sổ desktop hẹp dưới 768px sẽ cho `touchUi === false` trong khi CSS mobile **đã** áp dụng — inline style khi đó sẽ phá layout. Cần một media query chỉ theo bề rộng, khớp đúng breakpoint của SCSS.

- [ ] **Step 1: Thêm import và state**

Trong `src/components/pages/Note/TuiView.jsx`, thêm vào khối import đầu file (cạnh dòng 7 `import { mobileActionContext, swipePanelTarget } from './tuiMobile';`):

```js
import { DEFAULT_SIZES, loadSizes, saveSizes, clampSizes, applyDelta, sizesFromDrag, STEP, BIG_STEP } from './tuiResize';
```

Ngay sau state `zen` (dòng 278 `const [zen, setZen] = ...`), thêm:

```js
  const [sizes, setSizes] = useState(loadSizes); // [folders, notes, preview] — % of .tui-body

  // Bề rộng thôi, KHÔNG dùng touchUi: touchUi cần cả pointer:coarse, nên cửa
  // sổ desktop hẹp <768px sẽ lọt qua trong khi CSS mobile đã áp — inline
  // flex khi đó sẽ đè lên layout mobile và phá nó.
  const [narrow, setNarrow] = useState(() =>
    window.matchMedia?.('(max-width: 768px)')?.matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px)');
    if (!mq?.addEventListener) return undefined;
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Chỉ ba-panel-desktop mới nhận inline flex; zen và mobile để CSS lo.
  const sizingOn = !zen && !narrow;
  const panelStyle = (i) => (sizingOn ? { flex: `0 0 ${sizes[i]}%` } : undefined);
```

- [ ] **Step 2: Áp style vào ba panel**

Sửa 3 dòng mở panel. FOLDERS (~2090):

```jsx
        <div className={`tui-panel tui-folders ${focus === 'folders' ? 'focused' : ''}`} style={panelStyle(0)}>
```

NOTES (~2174) — giữ nguyên phần `className` sẵn có, chỉ thêm `style`:

```jsx
        <div className={`tui-panel tui-notes ${focus === 'notes' ? 'focused' : ''}`} style={panelStyle(1)}>
```

PREVIEW (~2258):

```jsx
        <div className={`tui-panel tui-preview ${focus === 'preview' ? 'focused' : ''}`} style={panelStyle(2)}>
```

- [ ] **Step 3: Ghi localStorage khi sizes đổi (debounce 300ms)**

Thêm ngay dưới `panelStyle`:

```js
  // Debounce: kéo chuột bắn setSizes mỗi frame, không đập vào storage từng lần.
  useEffect(() => {
    const t = setTimeout(() => saveSizes(sizes), 300);
    return () => clearTimeout(t);
  }, [sizes]);
```

- [ ] **Step 4: Nới lỏng CSS tĩnh để inline style thắng**

Trong `src/components/pages/Note/TuiView.scss`, đổi dòng 104–106 từ:

```scss
  .tui-folders { width: 200px; flex-shrink: 0; }
  .tui-notes { flex: 1; }
  .tui-preview { flex: 1.4; }
```

thành:

```scss
  /* Fallback khi JS chưa hydrate hoặc khi sizing tắt (zen/mobile). Inline
     `flex: 0 0 X%` từ TuiView sẽ thắng các dòng này khi sizing bật.
     `width` phải bỏ: nó không bị `flex` ghi đè nên FOLDERS sẽ kẹt ở 200px. */
  .tui-folders { flex: 0 0 200px; min-width: 0; }
  .tui-notes { flex: 1; }
  .tui-preview { flex: 1.4; }
```

- [ ] **Step 5: Kiểm tra chạy thật**

Run: `npm run dev` rồi mở TUI Daily Note ở viewport 1280.
Expected: ba panel trông **y hệt trước khi sửa** (16 / 35 / 49 tái tạo tỉ lệ cũ). Chưa resize được — đó là Task 5–7.

Kiểm tra thêm: thu cửa sổ xuống <768px → layout mobile một panel vẫn đúng; bật zen (`z`) → chỉ còn NOTES.

- [ ] **Step 6: Chạy toàn bộ test cho chắc không vỡ gì**

Run: `npm test`
Expected: PASS — toàn bộ test hiện có vẫn xanh

- [ ] **Step 7: Commit**

```bash
git add src/components/pages/Note/TuiView.jsx src/components/pages/Note/TuiView.scss
git commit -m "feat(tui): drive panel widths from percentage state"
```

---

### Task 5: Phím tắt Alt+h/l

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx` (chèn ngay sau guard Ctrl/Meta ở dòng ~1627–1631)

**Interfaces:**
- Consumes: `applyDelta`, `STEP`, `BIG_STEP` (Task 1); state `sizes`, `setSizes`, `sizingOn`, `focus` (Task 4)
- Produces: (không có export mới)

- [ ] **Step 1: Chèn nhánh Alt trước `switch (k)`**

Trong `onKeyDown`, ngay **sau** khối guard Ctrl/Meta này (dòng ~1627):

```js
    if (e.ctrlKey || e.metaKey) {
      const ownChord = focus === 'preview' && (k === 'd' || k === 'u');
      if (!ownChord) return;
    }
```

chèn:

```js
    // Alt+h/l resize panel đang focus (kiểu Hyprland; Super bị compositor
    // nuốt nên không dùng được trong trình duyệt). PHẢI đứng trước switch(k):
    // guard trên chỉ chặn Ctrl/Meta, nên Alt+h/l sẽ rơi xuống case 'h'/'l'
    // (nhảy focus, dòng ~1708/1729) và chuyển panel thay vì resize.
    if (e.altKey && sizingOn) {
      const dir = (k === 'l' || k === 'ArrowRight') ? 1 : (k === 'h' || k === 'ArrowLeft') ? -1 : 0;
      if (dir) {
        setSizes((s) => applyDelta(s, focus, dir * (e.shiftKey ? BIG_STEP : STEP)));
        e.preventDefault();
        return;
      }
    }
```

- [ ] **Step 2: Kiểm tra chạy thật**

Run: `npm run dev`, mở TUI ở viewport 1280, focus NOTES (phím `2`).
Expected:
- `Alt+l` → NOTES rộng ra, PREVIEW hẹp lại đúng bằng đó, FOLDERS không nhúc nhích.
- `Alt+h` → ngược lại.
- `Alt+Shift+l` → nhảy bước lớn hơn rõ rệt.
- Bấm `1` rồi `Alt+l` → FOLDERS rộng ra, NOTES hẹp lại, PREVIEW đứng yên.
- Giữ `Alt+l` liên tục → dừng lại khi hàng xóm chạm sàn, không có panel nào biến mất.
- Menu trình duyệt **không** bật ra khi bấm Alt+chữ.
- `h`/`l` **không kèm Alt** vẫn chuyển focus như cũ.

- [ ] **Step 3: Kiểm tra không rò sang mode soạn và overlay**

Bấm `i` để vào body, gõ `Alt+l` trong editor.
Expected: không resize (guard `mode === 'normal'` nằm ở nhánh trên trong `onKeyDown` — xác nhận nhánh Alt nằm **sau** guard mode đó; nếu chưa, di chuyển nó xuống dưới).

Mở calendar (`c`) rồi gõ `Alt+l`; mở Telescope (`Ctrl+p`) rồi gõ `Alt+l`.
Expected: không resize. Các overlay này đã `return` sớm ở dòng ~1555 và các khối lân cận — **nằm trên** vị trí chèn (~1627), nên tự an toàn. Chỉ cần đảm bảo không vô tình chèn nhánh Alt lên phía trên các guard đó.

- [ ] **Step 4: Chạy test**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/pages/Note/TuiView.jsx
git commit -m "feat(tui): resize panels with Alt+h/l"
```

---

### Task 6: RESIZE mode (`R`)

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx` (nhánh mode mới trong `onKeyDown`; `case 'R'`; `hints` dòng ~1977; bảng help dòng ~1884)

**Interfaces:**
- Consumes: `applyDelta`, `DEFAULT_SIZES`, `STEP`, `BIG_STEP` (Task 1); `sizes`/`setSizes`/`sizingOn` (Task 4)
- Produces: giá trị mode mới `'resize'` cho state machine `mode`

Ghi chú: badge status bar tự viết hoa (`mode.toUpperCase()`, dòng ~2608) nên `'resize'` hiện thành `RESIZE` mà không cần sửa JSX.

- [ ] **Step 1: Thêm nhánh xử lý RESIZE mode**

Trong `onKeyDown`, chèn **trước** nhánh Alt của Task 5 (RESIZE phải nuốt phím trước mọi thứ khác):

```js
    // RESIZE mode nuốt hẳn phím NORMAL: h/l/L/1/2/3 ở đây mang nghĩa resize
    // dù chúng đã có nghĩa khác ở NORMAL (vd L = focus preview, dòng ~1709).
    if (mode === 'resize') {
      e.preventDefault();
      if (k === 'Escape' || k === 'Enter') { setMode('normal'); return; }
      if (k === '=') { setSizes([...DEFAULT_SIZES]); return; }
      if (k === '1') { setFocus('folders'); return; }
      if (k === '2') { setFocus('notes'); return; }
      if (k === '3') { setFocus('preview'); return; }
      const dir = (k === 'l' || k === 'L' || k === 'ArrowRight') ? 1
        : (k === 'h' || k === 'H' || k === 'ArrowLeft') ? -1 : 0;
      if (dir) setSizes((s) => applyDelta(s, focus, dir * (k === 'H' || k === 'L' ? BIG_STEP : STEP)));
      return;
    }
```

- [ ] **Step 2: Thêm phím `R` vào NORMAL**

Tìm khối `switch (k)` dùng chung cho mọi focus — nơi có `case '1': setFocus('folders')` (dòng ~1647). Thêm ngay sau `case '3'`:

```js
      case 'R': if (sizingOn) { setMode('resize'); e.preventDefault(); } return;
```

- [ ] **Step 3: Thêm dòng hints**

Trong object `hints` (dòng ~1977), thêm entry:

```js
    resize: '── RESIZE ──  h/l:±2%  H/L:±8%  1/2/3:panel  =:reset  Esc:done',
```

và thêm `R:resize` vào chuỗi `normal` — sửa `... z:zen  A:arch ...` thành `... z:zen  R:resize  A:arch ...`.

- [ ] **Step 4: Thêm dòng vào bảng help `?`**

Trong bảng help (quanh dòng ~1884, cạnh `['Tab · h / l', 'cycle · panel left / right']`), thêm:

```js
        ['Alt+h/l · R', 'resize panel · RESIZE mode'],
```

- [ ] **Step 5: Thêm CSS cho badge RESIZE**

Trong `src/components/pages/Note/TuiView.scss`, cạnh rule `&.mode-title, &.mode-body` (dòng ~792), thêm `mode-resize` vào danh sách để badge có cùng kiểu nhấn:

```scss
      &.mode-title, &.mode-body, &.mode-resize {
```

- [ ] **Step 6: Kiểm tra chạy thật**

Run: `npm run dev`, viewport 1280.
Expected:
- Bấm `R` → badge status bar đổi thành `RESIZE`, dòng hints đổi theo.
- `h`/`l` chỉnh 2%, `H`/`L` chỉnh 8%.
- `1`/`2`/`3` đổi panel đang chỉnh, chỉnh tiếp thấy đúng panel đó đổi.
- `=` đưa về đúng bố cục mặc định ban đầu.
- `Esc` (và `Enter`) về `NORMAL`.
- Bấm `?` → thấy dòng resize trong bảng help.

- [ ] **Step 7: Kiểm tra biên**

- Bấm `R` hai lần liên tiếp → vẫn ở RESIZE, không kẹt.
- Vào RESIZE rồi bấm `z` → `z` bị nuốt (không bật zen). Thoát `Esc` rồi `z` mới bật — đúng như thiết kế "RESIZE nuốt hẳn phím NORMAL".
- Bật zen trước rồi bấm `R` → không vào RESIZE (vì `sizingOn` false).

- [ ] **Step 8: Chạy test**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/pages/Note/TuiView.jsx src/components/pages/Note/TuiView.scss
git commit -m "feat(tui): add RESIZE mode for panel sizing"
```

---

### Task 7: Kéo chuột — splitter và Alt+drag

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx` (ref + handler; 2 splitter div trong `.tui-body`; handler trên `.tui-body`)
- Modify: `src/components/pages/Note/TuiView.scss` (rule `.tui-resizer`, `.tui-dragging`)

**Interfaces:**
- Consumes: `sizesFromDrag` (Task 2); `sizes`/`setSizes`/`sizingOn` (Task 4)
- Produces: (không có export mới)

- [ ] **Step 1: Thêm ref và handler kéo**

Cạnh các ref khác trong `TuiView`, thêm:

```js
  const bodyRef = useRef(null);
  const dragRef = useRef(null); // boundary đang kéo: 0 | 1 | null
```

Thêm handler (đặt cạnh `panelStyle`):

```js
  /* Kéo một đường biên. Cập nhật liên tục theo con trỏ (không snap về bước 2%
     như bàn phím) — kéo chuột mà snap vào lưới thì thấy rít. */
  const dragMove = (clientX) => {
    const el = bodyRef.current;
    if (!el || dragRef.current === null) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    setSizes((s) => sizesFromDrag(s, dragRef.current, (clientX - r.left) / r.width));
  };

  const startDrag = (boundary, e) => {
    if (!sizingOn) return;
    dragRef.current = boundary;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const endDrag = (e) => {
    if (dragRef.current === null) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
```

- [ ] **Step 2: Gắn ref và handler lên `.tui-body`**

Sửa dòng mở `.tui-body` (dòng ~2087) từ:

```jsx
      <div className="tui-body" onTouchStart={bodySwipeStart} onTouchEnd={bodySwipeEnd}>
```

thành:

```jsx
      <div className={`tui-body ${dragRef.current !== null ? 'tui-dragging' : ''}`} ref={bodyRef}
           onTouchStart={bodySwipeStart} onTouchEnd={bodySwipeEnd}
           onPointerDown={(e) => {
             // Alt+kéo ở bất kỳ đâu (kiểu Hyprland): điểm bắt đầu quyết định
             // biên nào bị kéo — trong FOLDERS thì biên trái, còn lại biên phải.
             if (!e.altKey || !sizingOn || e.button !== 0) return;
             const inFolders = e.target.closest?.('.tui-folders');
             startDrag(inFolders ? 0 : 1, e);
           }}
           onPointerMove={(e) => dragMove(e.clientX)}
           onPointerUp={endDrag}
           onPointerCancel={endDrag}>
```

- [ ] **Step 3: Chèn hai splitter**

Trong `.tui-body`, chèn **giữa** panel FOLDERS và panel NOTES (tức ngay trước dòng `{/* NOTES */}`):

```jsx
        {sizingOn && (
          <div className="tui-resizer" role="separator" aria-orientation="vertical"
               aria-label="Resize folders panel"
               onPointerDown={(e) => startDrag(0, e)}
               onPointerMove={(e) => dragMove(e.clientX)}
               onPointerUp={endDrag} onPointerCancel={endDrag} />
        )}
```

và chèn **giữa** panel NOTES và panel PREVIEW (ngay trước dòng `{/* PREVIEW */}`) bản giống hệt nhưng biên 1:

```jsx
        {sizingOn && (
          <div className="tui-resizer" role="separator" aria-orientation="vertical"
               aria-label="Resize notes panel"
               onPointerDown={(e) => startDrag(1, e)}
               onPointerMove={(e) => dragMove(e.clientX)}
               onPointerUp={endDrag} onPointerCancel={endDrag} />
        )}
```

- [ ] **Step 4: Thêm CSS**

Trong `src/components/pages/Note/TuiView.scss`, thêm vào trong khối `.tui` (cạnh rule `.tui-folders` ở dòng ~104):

```scss
  /* Vùng bắt cho splitter. `gap: 12px` của .tui-body đã tạo sẵn khe; resizer
     rộng 12px và có margin âm hai bên để phủ đúng khe đó mà không chiếm thêm
     chỗ (nếu không, tổng % + chiều rộng resizer sẽ tràn quá 100%). */
  .tui-resizer {
    flex: 0 0 12px;
    margin: 0 -12px;
    z-index: 2;
    cursor: col-resize;
    background: transparent;
    touch-action: none;
  }

  /* Đang kéo: chặn bôi đen text và ép con trỏ giữ nguyên hình dạng dù chuột
     đi lạc ra khỏi khe. */
  .tui-body.tui-dragging {
    user-select: none;
    cursor: col-resize;
  }
```

- [ ] **Step 5: Kiểm tra chạy thật**

Run: `npm run dev`, viewport 1280.
Expected:
- Rê chuột vào khe giữa FOLDERS và NOTES → con trỏ đổi thành `col-resize`.
- Kéo khe đó → FOLDERS và NOTES đổi kích thước mượt theo chuột, PREVIEW đứng yên.
- Kéo khe NOTES|PREVIEW → hai panel đó đổi, FOLDERS đứng yên.
- Kéo mạnh sang một bên → dừng ở sàn, không panel nào biến mất hay tràn.
- Trong lúc kéo không bị bôi đen chữ.
- Kéo nhanh ra ngoài cửa sổ rồi thả → không kẹt trạng thái kéo (thả chuột là hết).
- Giữ `Alt` rồi kéo giữa panel NOTES → resize được, không cần nhắm trúng khe.

- [ ] **Step 6: Kiểm tra lưu lại**

Kéo cho bố cục khác hẳn mặc định, đợi ~1 giây, F5 tải lại trang.
Expected: ba panel giữ đúng kích thước vừa đặt.

Kiểm tra `localStorage.getItem('tui:panelSizes')` trong devtools console → thấy mảng 3 số cộng lại ~100.

- [ ] **Step 7: Regression mobile và zen**

- Thu cửa sổ <768px → không thấy splitter, layout một panel như cũ, vuốt ngang vẫn chuyển panel.
- Bật zen (`z`) → chỉ còn NOTES, không splitter.
- Tắt zen → quay lại đúng kích thước đã lưu.

- [ ] **Step 8: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS — toàn bộ test cũ và mới đều xanh

- [ ] **Step 9: Commit**

```bash
git add src/components/pages/Note/TuiView.jsx src/components/pages/Note/TuiView.scss
git commit -m "feat(tui): resize panels by dragging splitters or Alt+drag"
```

---

### Task 8: Biên còn lại — zen thoát RESIZE, kiểm tra cuối

**Files:**
- Modify: `src/components/pages/Note/TuiView.jsx`

**Interfaces:**
- Consumes: state `mode`, `sizingOn` (Task 4, 6)
- Produces: (không có export mới)

- [ ] **Step 1: Thoát RESIZE khi sizing tắt giữa chừng**

Spec yêu cầu: bật zen khi đang ở RESIZE mode → thoát về NORMAL (không còn biên để chỉnh). Tương tự khi cửa sổ co xuống mobile. Thêm effect cạnh effect debounce của Task 4:

```js
  // Zen bật hay cửa sổ co xuống mobile giữa lúc đang RESIZE → không còn biên
  // nào để chỉnh, thoát về NORMAL kẻo kẹt trong mode vô nghĩa.
  useEffect(() => {
    if (!sizingOn && mode === 'resize') setMode('normal');
  }, [sizingOn, mode]);
```

- [ ] **Step 2: Kiểm tra chạy thật**

Run: `npm run dev`
Expected:
- Bấm `R` vào RESIZE, rồi thu cửa sổ xuống <768px → badge tự về `NORMAL`.
- Bấm `R`, rồi mở rộng lại và bật zen bằng nút/lệnh → badge về `NORMAL`.

- [ ] **Step 3: Chạy lint**

Run: `npm run lint`
Expected: PASS — không lỗi mới. Nếu báo `react-hooks/exhaustive-deps` ở effect nào vừa thêm, bổ sung dependency còn thiếu thay vì tắt rule.

- [ ] **Step 4: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Xác minh runtime đầy đủ bằng skill `verify`**

Dùng skill `verify` (headless Chrome trên vite dev server), chụp màn hình:
1. viewport 1280 — bố cục mặc định 3 panel
2. sau vài lần `Alt+l` — thấy panel focus rộng ra
3. RESIZE mode — status bar hiện `RESIZE` + hints
4. sau khi kéo splitter — bố cục lệch hẳn
5. reload — vẫn giữ đúng bố cục
6. viewport 390×844 — layout mobile không đổi

- [ ] **Step 6: Commit**

```bash
git add src/components/pages/Note/TuiView.jsx
git commit -m "fix(tui): leave RESIZE mode when sizing turns off"
```

---

## Ghi chú cho người thực hiện

- **Thứ tự nhánh trong `onKeyDown` rất quan trọng.** Từ trên xuống: guard mode soạn → guard Ctrl/Meta (dòng ~1627) → **nhánh RESIZE (Task 6)** → **nhánh Alt (Task 5)** → nhánh đếm số vim → `switch (k)`. Sai thứ tự thì `h`/`l` sẽ chuyển focus thay vì resize.
- **Đừng dùng `touchUi` để gate inline style** — nó cần `pointer: coarse`, nên cửa sổ desktop hẹp sẽ lọt. Dùng `narrow` (chỉ bề rộng) như Task 4.
- **`width` phải bỏ khỏi `.tui-folders`** — thuộc tính `width` không bị `flex` ghi đè, để lại thì FOLDERS kẹt ở 200px.
- Mọi phép tính trên mảng size đều đi qua `tuiResize.js`; không tính toán % rải rác trong component.
