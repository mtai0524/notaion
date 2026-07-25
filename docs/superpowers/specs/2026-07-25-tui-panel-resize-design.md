# TUI Panel Resize — kiểu Omarchy/Hyprland (design)

**Ngày:** 2026-07-25 · **Trạng thái:** đã duyệt (user chọn: cả phím tắt lẫn RESIZE mode; cả kéo splitter lẫn Alt+drag; lưu localStorage; modifier = Alt; mô hình "mượn từ hàng xóm")

## Mục tiêu

Người dùng chỉnh được chiều rộng ba panel của TUI Daily Note (FOLDERS · NOTES · PREVIEW) bằng **bàn phím** và **chuột**, theo quy ước quen thuộc của Omarchy (Hyprland). Kích thước được nhớ qua các phiên làm việc.

## Phạm vi

- Chỉ ảnh hưởng desktop ở chế độ ba panel. Zen mode và viewport ≤768px giữ nguyên 100% hành vi hiện tại.
- Thay đổi nằm trong `src/components/pages/Note/TuiView.jsx` + `TuiView.scss`, cộng helper thuần mới `tuiResize.js` (+ test).
- Không thêm route, không đổi API, không đổi data model.

## Bối cảnh: layout hiện tại

`TuiView.scss` đang dùng ba đơn vị lệch nhau:

```scss
.tui-folders { width: 200px; flex-shrink: 0; }
.tui-notes   { flex: 1; }
.tui-preview { flex: 1.4; }
```

Không thể resize nhất quán trên ba đơn vị khác loại, nên bước đầu là quy về **một hệ duy nhất**.

## Thành phần

### 1. Mô hình kích thước

State là mảng ba số phần trăm chiều rộng của `.tui-body`, luôn cộng lại bằng 100:

```
[folders, notes, preview]  →  DEFAULT_SIZES = [16, 35, 49]
```

Mặc định này tái tạo đúng tỉ lệ hiện tại (200px trên màn ~1250px ≈ 16%; phần còn lại chia 1 : 1.4).

- Áp bằng inline style `flex: 0 0 <n>%` trên từng `.tui-panel`.
- CSS tĩnh ở trên **giữ nguyên** làm fallback (khi chưa hydrate / JS lỗi).
- **Sàn tối thiểu `MIN = 8%`** mỗi panel.

**Quan trọng — không phá mobile/zen:** inline style chỉ được áp khi ở chế độ ba panel trên desktop. Zen (`.tui.tui-zen` ẩn folders/preview) và breakpoint `≤768px` (`.tui-panel { display: none }` + `.tui-panel.focused { flex: 1 1 100% }`) đang dựa vào CSS; một `flex: 0 0 16%` inline sẽ thắng specificity và làm hỏng cả hai. Điều kiện áp: `!zen && !isMobile` — dùng lại state `zen` và cờ mobile (`matchMedia('(max-width: 768px) and (pointer: coarse)')`) đã có sẵn trong `TuiView.jsx`.

### 2. Mô hình "mượn từ hàng xóm"

Resize luôn tác động lên **một đường biên**, không phải một panel: panel đang focus nới ra thì hàng xóm co lại đúng bằng đó, panel thứ ba không đổi. Tổng luôn là 100.

| Focus | `l` (nới) | `h` (thu) |
|---|---|---|
| FOLDERS | mượn của NOTES | trả cho NOTES |
| NOTES | mượn của PREVIEW | trả cho PREVIEW |
| PREVIEW | mượn của NOTES | trả cho NOTES |

NOTES nằm giữa nên quy ước là nó luôn thương lượng với PREVIEW — panel lớn nhất, chịu co giãn tốt nhất. Hệ quả đã chấp nhận: **không có cách dùng bàn phím để kéo riêng biên FOLDERS|NOTES khi đang focus NOTES** (chuột làm được).

Khi hàng xóm chạm sàn 8%, thao tác dừng — không tràn sang panel thứ ba.

**Bước nhảy:** `STEP = 2%` (~25px trên màn 1250px), `BIG_STEP = 8%`.

### 3. Bàn phím — phím tắt trực tiếp

Super **không dùng được**: trên Omarchy, Hyprland bắt Super ở tầng compositor nên trình duyệt không bao giờ nhận. Thay bằng **Alt**.

| Phím | Hành vi |
|---|---|
| `Alt` + `l` / `→` | panel đang focus nới ra 2% |
| `Alt` + `h` / `←` | panel đang focus thu lại 2% |
| `Alt+Shift` + `l` / `h` | bước lớn 8% |

- Cần `preventDefault()` để Alt+chữ không bật menu trình duyệt.
- Chỉ hoạt động ở `mode === 'normal'` — không nuốt phím khi đang soạn (`title`/`body`/`search`/`command`).
- Không đổi mode, không hiện overlay.

**Vị trí chèn trong `onKeyDown` — bắt buộc.** Nhánh Alt phải đặt **trước** `switch (k)`, cụ thể là ngay sau guard `if (e.ctrlKey || e.metaKey)` (`TuiView.jsx:1627`) và trước nhánh đếm số vim. Lý do: guard đó chỉ chặn Ctrl/Meta chứ không chặn Alt, nên `Alt+h`/`Alt+l` vẫn rơi xuống các `case 'h'`/`case 'l'` sẵn có (`TuiView.jsx:1708–1729` — nhảy focus theo ngữ cảnh panel) và sẽ chuyển focus thay vì resize. Nhánh Alt phải `return` sau khi xử lý.

### 4. Bàn phím — RESIZE mode

Bấm `R` ở NORMAL (phím này đang trống trong keymap) để vào mode chỉnh liên tiếp. Thêm `'resize'` vào state machine `mode` sẵn có (`TuiView.jsx:228`).

| Phím | Hành vi |
|---|---|
| `h` / `l` | thu / nới 2% |
| `H` / `L` | thu / nới 8% |
| `1` / `2` / `3` | đổi panel đang chỉnh (FOLDERS/NOTES/PREVIEW) |
| `=` | reset về `DEFAULT_SIZES` |
| `Esc` / `Enter` | thoát về NORMAL |

- RESIZE mode **chặn hẳn** các phím NORMAL: khi `mode === 'resize'`, handler xử lý bảng trên rồi `return`, không rơi xuống `switch (k)`. Nhờ vậy `h`/`l`/`L`/`1`/`2`/`3` mang nghĩa resize dù chúng đã có nghĩa khác ở NORMAL (vd `L` đang là "focus preview" tại `TuiView.jsx:1709`).
- Status bar đổi chỉ báo `NORMAL` → `RESIZE`, dòng hints đổi theo — khớp cách các mode hiện có đang làm.
- Thêm một dòng vào bảng `?` help (`['Alt+h/l · R', 'resize panel · resize mode']`).

### 5. Chuột

**Kéo splitter (chính).** `gap: 12px` sẵn có giữa các panel là vùng bắt — không cần chèn thêm không gian, layout không đổi.

- Hai vùng bắt vô hình `.tui-resizer` phủ khe FOLDERS|NOTES và NOTES|PREVIEW, `cursor: col-resize`.
- `pointerdown` → bắt đầu kéo; `pointermove` → cập nhật; `pointerup` → kết thúc. Dùng `setPointerCapture` để không mất chuột khi kéo nhanh ra ngoài.
- Trong lúc kéo: `user-select: none` trên `.tui` để không quét trúng chữ.

**Alt + kéo (phụ, kiểu Hyprland).** Giữ Alt rồi kéo ở bất kỳ đâu trong `.tui-body` — điểm bắt đầu quyết định biên nào bị kéo: con trỏ nằm trong FOLDERS → biên trái; trong NOTES hoặc PREVIEW → biên phải của NOTES.

Kéo chuột cập nhật **liên tục theo con trỏ**, không ép vào bước 2% — chuột là thao tác liên tục, snap vào lưới sẽ thấy rít. Vẫn tôn trọng sàn 8%.

### 6. Lưu trạng thái

- Key `tui:panelSizes`, dùng `lsGet`/`lsSet` sẵn có (`TuiView.jsx:106–114`) — khớp cách `zen`/`grid`/`pomodoro` đang lưu.
- Ghi có **debounce ~300ms** khi kéo, để không đập vào storage mỗi frame.
- Đọc lúc khởi tạo có kiểm tra hợp lệ: đúng 3 số, hữu hạn, mỗi số ≥ 8, tổng ≈ 100 (sai số ±0.5). Không đạt → rơi về `DEFAULT_SIZES`.

### 7. Cấu trúc mã

`TuiView.jsx` đã 3037 dòng, nên tách phần logic thuần ra `src/components/pages/Note/tuiResize.js`:

| Hàm | Vai trò |
|---|---|
| `DEFAULT_SIZES` | `[16, 35, 49]` |
| `clampSizes(sizes)` | ép sàn 8% + chuẩn hoá tổng về 100 |
| `applyDelta(sizes, focus, delta)` | bảng hàng xóm ở mục 2; trả mảng mới |
| `sizesFromDrag(sizes, boundary, ratio)` | vị trí con trỏ (0–1) → mảng mới |
| `loadSizes()` / `saveSizes(sizes)` | localStorage + validate |

Toàn bộ là hàm thuần trên mảng số — test trực tiếp bằng vitest như `tuiMobile.test.js` đang làm, không cần dựng DOM. `TuiView.jsx` chỉ giữ state, nhánh keydown và handler kéo.

## Xử lý lỗi / biên

- Phím Alt+h/l và `R` **không được nuốt** khi đang soạn (`mode` là `title`/`body`/`search`/`command`) hay khi Telescope/help/calendar overlay đang mở.
- `R` ở RESIZE mode không tự lặp lại vào mode (idempotent).
- Kéo ra ngoài cửa sổ rồi thả: `pointercapture` + xử lý `pointercancel` để không kẹt trạng thái đang kéo.
- Resize cửa sổ trình duyệt: dùng % nên tự co giãn, không cần xử lý thêm.
- Zen mode bật khi đang ở RESIZE mode → thoát về NORMAL (không còn biên để chỉnh).
- Chuyển sang mobile giữa chừng: inline style bị gỡ, CSS mobile tiếp quản.
- localStorage hỏng/đầy: `lsGet`/`lsSet` đã nuốt lỗi sẵn — rơi về mặc định, không crash.

## Kiểm thử

- **Unit (vitest)** — `tuiResize.test.js`: bảo toàn tổng 100; tôn trọng sàn 8%; đúng bảng hàng xóm mục 2; dừng khi hàng xóm chạm sàn; `sizesFromDrag` theo tỉ lệ con trỏ; reset; `loadSizes` lọc được dữ liệu hỏng (không phải mảng, sai độ dài, có `NaN`, tổng lệch, dưới sàn).
- Giữ toàn bộ test hiện có xanh.
- **Runtime (skill `verify`)** — headless Chrome, viewport 1280: (a) mặc định 3 panel, (b) sau Alt+l vài lần, (c) RESIZE mode + status bar, (d) sau khi kéo splitter, (e) reload giữ đúng kích thước.
- **Regression:** viewport 390×844 → layout mobile không đổi; zen mode → vẫn chỉ hiện NOTES.
