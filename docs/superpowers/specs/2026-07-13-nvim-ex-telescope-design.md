# Design — Nvim Ex commands (:wq…) + Telescope search

**Ngày:** 2026-07-13
**Phạm vi:** Daily Note TUI (`src/components/pages/Note/`)

## Vấn đề

Nvim mode đã có modal editing. Cần thêm 2 thứ để giống nvim hơn:
1. **Lệnh Ex** (`:w :wq :q :q! :x :wa :wqa :e! :noh`) gõ trong editor ở NORMAL.
2. **Telescope search** — fuzzy finder (note / command / date) mở bằng leader + Ctrl+p.

Cả hai phải có hướng dẫn phím trong help.

## Phần 1 — Lệnh Ex trong editor

**Kích hoạt:** khi đang soạn note (mode='body') + nvim NORMAL, gõ `:` mở command
line ngay trong editor. Áp dụng cả Notion editor lẫn Markdown editor.

| Lệnh | Hành vi |
|------|---------|
| `:w` | lưu `draft` vào note (commit), **ở lại** editor |
| `:wq` / `:x` | lưu + thoát về list |
| `:q` | thoát nếu `draft === current.content`; nếu đã đổi → báo lỗi "no write since last change (add ! to override)" |
| `:q!` | thoát, bỏ thay đổi chưa lưu |
| `:wa` / `:wqa` | như `:w` / `:wq` (chỉ soạn 1 note một lúc) |
| `:e!` | nạp lại note từ bản đã lưu (`setDraft(current.content)`), bỏ sửa |
| `:noh` | tắt highlight search (xóa query hiện tại) |

**Kỹ thuật:** tái dùng `commit()` (lưu content) và luồng thoát body mode. Lưu
"đã đổi chưa" = `draft !== current.content`. Command line: khi nvim NORMAL gõ
`:`, mở một input `:` ở status bar editor; Enter chạy lệnh, Esc hủy.

## Phần 2 — Telescope search

**Mở:** ở danh sách note (không đang soạn), `Space` rồi `f` (leader `<leader>ff`)
hoặc `Ctrl+p` → popup Telescope.

**Giao diện:** prompt (ô gõ fuzzy) trên · danh sách kết quả giữa · preview bên
phải · tab hiển thị nguồn đang chọn · dòng hint phím dưới cùng.

**3 nguồn (Tab / Shift+Tab xoay vòng):**
- **Notes** — fuzzy trên `title + content` của `allNotes` (toàn bộ). Enter →
  nhảy tới note (đổi ngày nếu cần + select).
- **Commands** — fuzzy trên danh sách lệnh (export, calendar, theme, nvim, set
  number, week, zen…). Enter → chạy lệnh.
- **Dates** — fuzzy trên các ngày có note (`markedDates`: yyyy-mm-dd + số note).
  Enter → nhảy tới ngày.

**Phím trong popup:** `Ctrl+j`/`Ctrl+k` hoặc `↑`/`↓` di chuyển · `Tab`/`Shift+Tab`
đổi nguồn · `Enter` chọn · `Esc` đóng. Prompt tự focus.

**Fuzzy:** subsequence match + cho điểm (khít/liền mạch/đầu từ), sắp theo điểm.

## Kiến trúc & module (cô lập, test được)

| Module | Trách nhiệm | Phụ thuộc |
|--------|-------------|-----------|
| `fuzzy.js` | `fuzzyScore(text, query): number` (−1 nếu không khớp) + `fuzzyFilter(items, query, keyFn): item[]` (đã sắp xếp). Thuần, test độc lập. | không |
| `Telescope.jsx` | Popup: prompt + list + preview + phím. Nhận `sources` [{key,label,items,getKey,getPreview,onPick}], `onClose`. | `fuzzy` |
| `TuiView.jsx` | State mở/đóng Telescope; dựng 3 nguồn từ `allNotes`/lệnh/`markedDates`; phím `Space→f`/`Ctrl+p` ở list NORMAL; lệnh Ex trong editor; help + hint. | `Telescope` |

**Ranh giới:** `fuzzy` không biết React; `Telescope` không biết dữ liệu note
(nhận sources trừu tượng); TuiView chỉ dựng nguồn + gắn phím.

## Hướng dẫn (help)

- Help panel (`?`) nhóm **NVIM (editor)** bổ sung: `: → :w :wq :q :q!` (Ex),
  và dòng Telescope: `Space f / Ctrl+p` mở finder.
- Popup Telescope có dòng hint phím ngay trong popup.

## Xử lý biên

- Ex `:q` khi đã sửa → **chặn + báo lỗi** (không thoát), như vim.
- Lệnh Ex chỉ nhận khi nvim on + đang body + NORMAL; nvim off thì `:` không làm gì
  đặc biệt trong editor (giữ hành vi cũ).
- Telescope mở từ list NORMAL (hoặc bất kỳ khi không đang soạn); Ctrl+p luôn mở.
- Nguồn rỗng (không note/không ngày) → list rỗng + thông báo "no results".
- Esc trong popup đóng, trả focus về list root.

## Tiêu chí hoàn thành

- Trong editor nvim NORMAL, gõ `:` mở cmdline; `:w :wq :q :q! :x :wa :wqa :e! :noh`
  hoạt động đúng bảng trên; `:q` khi đã sửa bị chặn.
- `Space f` / `Ctrl+p` mở Telescope; Tab xoay 3 nguồn; Ctrl+j/k + ↑↓ di chuyển;
  Enter mở note/chạy lệnh/nhảy ngày; Esc đóng; preview hiển thị.
- `fuzzy.js` có test (score + filter + sort).
- Help panel có hướng dẫn Ex + Telescope; popup có hint phím.
- Nvim off: không hồi quy.
