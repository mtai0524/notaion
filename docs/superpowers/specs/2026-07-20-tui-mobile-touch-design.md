# TUI Mobile — thao tác chạm đầy đủ (design)

**Ngày:** 2026-07-20 · **Trạng thái:** đã duyệt (user chọn: đầy đủ thao tác bằng chạm; bố cục = thanh action dưới đáy + long-press menu)

## Mục tiêu

Người dùng điện thoại làm được **mọi thao tác** của TUI Daily Note bằng chạm, không cần bàn phím vật lý. Desktop (>768px) giữ nguyên 100% hành vi hiện tại.

## Phạm vi

- Chỉ ảnh hưởng viewport ≤768px (media query + phát hiện `(pointer: coarse)` cho nvim).
- Toàn bộ thay đổi nằm trong `src/components/pages/Note/TuiView.jsx` + `TuiView.scss` (+ helper thuần tách riêng nếu cần test).
- Không thêm route, không đổi API, không đổi data model.

## Thành phần

### 1. Thanh action dưới đáy (`.tui-mobile-actions`)

Thanh nút cố định dưới đáy TUI, chỉ hiển thị ≤768px, **đổi nút theo ngữ cảnh**:

| Ngữ cảnh | Nút chính | Nút `⋯` mở sheet |
|---|---|---|
| List (focus = folders/notes, không soạn) | `+ New` · `🔍 Tìm` (Telescope) · `📅 Lịch` | Week view · Options · Zen · Pomodoro · Help |
| Xem note (focus = preview, không soạn) | `✎ Edit` · `✓ Done` · `📌 Pin` | Archive · Deadline · Category · Delete · Copy |
| Đang soạn (mode = body/title) | `✓ Save` · `✕ Cancel` · `📎 Attach` | — |

- Hộp "Save changes?" (unsavedPrompt) thành 3 nút chạm: `Save` / `Discard` / `Keep editing`.
- Các nút **gọi đúng các hàm sẵn có** (new note, toggle done, pin, archive, saveBody, editBody, openTelescope, calendar…) — chỉ thêm lối vào bằng chạm, không viết logic nghiệp vụ mới.
- Context của thanh được tính bằng **helper thuần** `mobileActionContext({ focus, mode, unsavedPrompt })` → `'list' | 'preview' | 'editor' | 'unsaved'` (unit-test được).

### 2. Long-press trên note row (`.tui-action-sheet`)

- Nhấn giữ ~500ms một note row → mở **action sheet** (overlay trượt từ đáy, chạm nền để đóng) với cùng bộ thao tác như `⋯` của PREVIEW: Done · Pin · Archive · Deadline · Category · Delete · Copy.
- Long-press dùng pointer events (pointerdown + timer 500ms, hủy khi pointermove quá ngưỡng ~10px hoặc pointerup sớm) — tách thành helper thuần nếu khả thi.
- Sheet dùng chung cho cả long-press và nút `⋯` (một component, nhận note đích).

### 3. Nvim tự tắt trên màn hình cảm ứng

- Phát hiện `window.matchMedia('(pointer: coarse)')` một lần khi mount.
- Khi coarse pointer: editor **luôn ở chế độ gõ thường** (bỏ modal NORMAL/INSERT, không LineGutter vim, không Ex `:`), bất kể setting nvim đang bật.
- Desktop giữ nvim nguyên vẹn. Lý do: bàn phím ảo không có Esc — NORMAL mode là bẫy kẹt.

### 4. Bàn phím ảo không che editor

- Dùng `window.visualViewport` (resize event) đo chiều cao thật còn nhìn thấy; đặt CSS var (vd `--tui-vvh`) để:
  - thanh Save/Cancel luôn nổi trên bàn phím ảo;
  - textarea co lại theo phần còn thấy được (thay `100dvh`/min-height tĩnh hiện tại ở mobile).
- Fallback: trình duyệt không có `visualViewport` → giữ hành vi hiện tại.

### 5. Vuốt chuyển panel

- Vuốt ngang (touch) trên vùng `.tui-body`: trái/phải → chuyển focus FOLDERS ↔ NOTES ↔ PREVIEW (cùng logic 3 nút switcher sẵn có).
- Ngưỡng: |Δx| > 60px và |Δx| > 2·|Δy| (tránh nuốt cuộn dọc). Không chặn scroll dọc.
- Không kích hoạt khi đang soạn (mode body/title) để không xung đột chọn text.

## Xử lý lỗi / biên

- Long-press không được nuốt tap thường (tap ngắn vẫn drill vào preview như hiện tại).
- Action sheet đóng bằng: chạm nền, nút ×, hoặc chọn xong 1 thao tác.
- Nút Done/Pin/… trên sheet thao tác đúng note được long-press (không phải note đang `sel` nếu khác nhau).
- Save/Cancel khi đang uploading: giữ hành vi hiện tại (spinner, không double-submit).

## Kiểm thử

- **Unit (vitest):** `mobileActionContext` helper; helper long-press (nếu tách thuần); giữ 93 test hiện có xanh.
- **Runtime (skill verify):** headless Chrome viewport 390×844, chụp màn hình: (a) list + action bar, (b) preview + action bar, (c) editor + Save/Cancel, (d) action sheet mở.
- Desktop regression: viewport 1280 — không thấy action bar/sheet, nvim vẫn hoạt động.
