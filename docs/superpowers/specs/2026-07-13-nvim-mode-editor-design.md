# Design — Nvim mode (modal editing) cho Daily Note editor

**Ngày:** 2026-07-13
**Phạm vi:** Daily Note Notion-mode editor (`src/components/pages/Note/`)

## Vấn đề

TUI danh sách note đã có sẵn hệ vim keys (j/k, count `5j`, marks `;a`/`'a`,
`:command`, `d→y` delete, `i` để soạn…). Phần **CHƯA có vim** là bên trong
editor: khi đang soạn nội dung block thì không có modal editing (Normal/Insert).

Yêu cầu: thêm **Nvim mode** — modal editing khi soạn note — bật/tắt được, có
bảng hướng dẫn shortcut riêng.

## Phạm vi

- Nvim mode = **modal editing trong Notion editor** (block-based). Danh sách note
  không đổi (đã có vim keys).
- **Markdown mode (textarea) KHÔNG áp Nvim** ở giai đoạn này — giữ nguyên.
- Mặc định **off** — không bật thì editor hoạt động y như hiện tại (không hồi quy).

## Bật/tắt

- Dòng Options (phím `T`): `nvim mode — modal editing trong editor`, giá trị
  `on/off`, lưu `localStorage` key `daily-note-nvim`, mặc định `off`.
- Lệnh: `:nvim` (toggle), `:nvim on`, `:nvim off`.
- Trạng thái `nvim` đọc ở TuiView, truyền xuống NotionEditor.

## Modal editing

Vào editor (nhấn `i` từ list) → khi `nvim=on`, editor mở ở **NORMAL** mode
(giống nvim: mở file là normal).

### INSERT mode (gõ chữ được)

| Phím | Hành vi |
|------|---------|
| `i` | chèn tại con trỏ |
| `a` | chèn sau con trỏ |
| `A` | về cuối dòng rồi chèn |
| `o` | mở block mới bên dưới, vào INSERT |
| `O` | mở block mới bên trên, vào INSERT |
| `Esc` | về NORMAL |

### NORMAL mode (phím là lệnh, không gõ chữ)

| Nhóm | Phím | Hành vi |
|------|------|---------|
| Move | `h`/`j`/`k`/`l` | trái / xuống / lên / phải (j/k ở biên nhảy block) |
| Move | `w` / `b` | nhảy đầu từ kế / từ trước |
| Move | `0` / `$` | đầu / cuối dòng (text block) |
| Move | `gg` / `G` | block đầu / block cuối |
| Edit | `x` | xóa 1 ký tự tại con trỏ |
| Edit | `dd` | xóa cả block |
| Edit | `o` / `O` | mở block mới (→ INSERT) |
| Mode | `Esc` / `Ctrl+[` | giữ ở NORMAL |

Ra khỏi editor về list theo luồng lưu hiện tại (Ctrl+Enter lưu, Esc khi đã
NORMAL nhấn tiếp thoát — chi tiết ở plan).

### Con trỏ & badge

- **NORMAL**: con trỏ khối (block cursor, CSS overlay tại vị trí caret) + viền
  block đang ở sáng lên.
- **INSERT**: con trỏ que thường.
- Status bar hiện badge `-- NORMAL --` / `-- INSERT --`.

## Giới hạn (YAGNI — "cơ bản thực dụng")

Không làm ở giai đoạn này: operator+motion (dw/de/d$, cw/ci), visual mode,
`.` lặp lại, count (3dd), yank/paste kiểu vim (list đã có Y/P).

## Bảng hướng dẫn

- Help panel (`?`): khi `nvim=on` thêm nhóm **"NVIM (editor)"** liệt kê modes /
  motion / edit ở trên. Khi off thì nhóm ẩn.
- Cheatsheet trong editor: khi Nvim on thêm dòng nhắc
  "NORMAL: hjkl di chuyển · i để gõ · Esc về normal".

## Kiến trúc & module (cô lập, test được)

| Module | Trách nhiệm | Phụ thuộc |
|--------|-------------|-----------|
| `vimEditor.js` | Thuần logic tính offset caret cho `w`/`b`/`0`/`$`/`x` trên một chuỗi text (không đụng DOM). Test độc lập. | không |
| `NotionEditor.jsx` | Giữ `vimMode` state; xử lý keydown NORMAL, gọi `vimEditor` để tính offset, dùng Selection API áp vào DOM; `j/k` biên gọi `moveFocus`, `dd` gọi `removeAt`, `o/O` gọi `addAfter/addBefore` + INSERT. | `vimEditor`, `NotionBlock` |
| `NotionBlock`/`Editable` | Nhận prop `vimNormal`: tắt `contentEditable` khi NORMAL, vẽ block cursor overlay. | — |
| `TuiView.jsx` | State `nvim` (localStorage), dòng Options, lệnh `:nvim`, nhóm help NVIM; truyền `nvim` xuống NotionEditor. | NotionEditor |

**Ranh giới:** `vimEditor` không biết React; `NotionEditor` sở hữu vimMode +
Selection; TuiView chỉ bật/tắt cờ và hiển thị help.

## Xử lý biên

- **Nvim off**: không mode, không block cursor, không badge — editor y hệt hiện
  tại. Không hồi quy.
- **Markdown mode**: không áp Nvim (giữ nguyên textarea).
- **Toggle off khi đang INSERT/NORMAL**: về contentEditable thường an toàn.
- **Block không có text** (divider/image/file): NORMAL `j/k` đi qua bình thường;
  `i/a` trên các block này không vào INSERT (không có text để sửa) — nhảy tới
  block text gần nhất hoặc no-op (chi tiết ở plan).

## Tiêu chí hoàn thành

- Options có `nvim mode` on/off (mặc định off) + lệnh `:nvim` / `:nvim on|off`;
  lưu localStorage.
- Bật → editor mở NORMAL; `h/j/k/l`, `w`/`b`, `0`/`$`, `gg`/`G` di chuyển;
  `i/a/A/o/O` vào INSERT; `x`/`dd` sửa; `Esc` về NORMAL; badge + block cursor +
  viền block hiển thị.
- Tắt → editor như cũ, không hồi quy.
- Help panel có nhóm NVIM khi bật.
- `vimEditor.js` có test cho w/b/0/$/x.
