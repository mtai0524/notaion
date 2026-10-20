# Notaion Daily — desktop app

App desktop gọn nhẹ cho **Daily Notes** của Notaion, dùng Tauri 2 (WebView2 có sẵn trên Windows) và Preact. Phần giao diện ngày chính là **TUI của bản web** (`../src/components/pages/Note/TuiView.jsx`), chạy qua `preact/compat`. Nhờ vậy desktop và web luôn giống nhau, sửa một chỗ là cả hai cùng có. App không kéo theo antd/tiptap, bộ cài vẫn chỉ vài MB.

Người dùng tải bộ cài từ trang web `/desktop` (menu **Desktop App**). Trang này trỏ tới GitHub Releases.

## Tính năng
- **Giống bản web:** layout TUI 3 cột FOLDERS · NOTES · PREVIEW, soạn thảo kiểu **Notion (block)** hoặc **Markdown**, tuỳ chọn chế độ nvim. Có focus expand, phóng to panel bằng `z`, lịch `c`, Telescope `Ctrl+P`, lệnh `:`, trợ giúp `?`.
- **Options** (`T`) gồm các tab:
  - EDITOR, VIEW.
  - APPEARANCE: màu active, viền, bo góc, độ trong suốt, ảnh nền.
  - TEXT: font, độ đậm, cỡ chữ, giãn dòng, màu chữ, riêng cho từng panel.
  - Mọi tuỳ chọn lưu trong localStorage, có nút khôi phục mặc định.
- **Nhanh:** hiện ngay dữ liệu cache trong localStorage, rồi mới đồng bộ ở nền. Mọi thay đổi vào hàng đợi ghi (outbox) trước, nên mất mạng vẫn ghi được (thanh trên hiện `offline — will sync`) và sẽ tự gửi khi có mạng lại.
- **Ghi nhanh toàn hệ thống:** `Ctrl+Alt+N` gọi app lên, chuyển về hôm nay và mở một ghi chú mới để gõ tiêu đề ngay.
- Chạy nền ở khay hệ thống, nút X chỉ ẩn cửa sổ. Chỉ chạy một bản (mở lần hai sẽ focus bản đang chạy).
- Theme sáng/tối tự theo cài đặt của Windows.
- Hộp xác nhận `y`/`n` hoạt động cả khi đang bật bộ gõ tiếng Việt (Unikey/Telex).
- **Export:** nút ⬇ trên thanh trên cùng hoặc lệnh `:export | all | json | zip`, lưu thẳng vào thư mục Downloads.
  - Markdown (`.md`): một ngày, hoặc mọi ngày trong một file.
  - Backup (`.json`): đầy đủ mọi trường để lưu trữ và nhập lại.
  - Zip (`.zip`): `notes/<ngày>.md` + `notes.json` + thư mục `attachments/` chứa ảnh và file đã tải về. Link trong Markdown được đổi sang bản local; file nào không tải được thì giữ link gốc và được ghi vào `download-errors.txt`.
- Đăng nhập bằng email/mật khẩu, hoặc **qua trình duyệt** (GitHub/Discord). Cách thứ hai dùng deep-link `notaion://auth?token=…` từ trang web `/desktop-auth`. Nút `@tên ⏻` trên thanh trên cùng để đăng xuất.

## Phát triển
Cần Node 18+, Rust và **Visual Studio Build Tools (C++)** để có MSVC linker.

```bash
cd desktop
npm install
npm run dev        # tauri dev (vite :2406 + app)
npm test           # unit tests (vitest)
npm run build      # bộ cài NSIS -> src-tauri/target/release/bundle/nsis/
```

Chưa có MSVC thì dùng toolchain GNU (cần MSYS2 mingw64). Nhớ dùng PowerShell, không dùng Git Bash, vì lệnh `link` của Git Bash che mất linker:

```powershell
$env:RUSTUP_TOOLCHAIN='stable-x86_64-pc-windows-gnu'; $env:CARGO_TARGET_DIR="$PWD\src-tauri\target-gnu"; npx tauri dev
```

API mặc định là `https://notaion.runasp.net`. Có thể đổi bằng `VITE_API_URL=https://localhost:7059`. Nếu đổi sang host khác thì phải thêm host đó vào `src-tauri/capabilities/default.json` (scope của `http:default`).

## Phát hành
1. Tăng `version` trong `src-tauri/tauri.conf.json` (và `package.json`).
2. `git tag desktop-v0.3.0 && git push origin desktop-v0.3.0`
3. Workflow `.github/workflows/desktop-release.yml` build trên `windows-latest` và đăng file `*_x64-setup.exe` lên GitHub Release.

Giữ minor version của các crate `tauri-plugin-*` khớp với package npm `@tauri-apps/plugin-*` tương ứng, nếu lệch thì `tauri build` sẽ báo lỗi.

## Cấu trúc
| Đường dẫn | Vai trò |
|---|---|
| `src/components/TuiApp.jsx` | Nối TUI của web với store của desktop: cache, outbox, upload, export qua Tauri, quick capture |
| `../src/components/pages/Note/` | TUI dùng chung với web (`TuiView`, `DayToolbar`, Options…). React code, chạy qua `preact/compat` |
| `src/lib/store.js` | Cache theo ngày, outbox, đồng bộ |
| `src/lib/api.js` | Client HTTP (đi qua `plugin-http` phía Rust, nên không bị CORS), kiểm tra hạn JWT |
| `src/lib/notes.js` | Logic thuần: tạo note, merge, sắp xếp |
| `../shared/exportNotes.js` | Logic export (md / json / zip) dùng chung với web, không phụ thuộc thư viện nào. Test ở `src/lib/exportNotes.test.js` |
| `src-tauri/src/lib.rs` | Tray, hotkey toàn cục, single-instance, deep-link |

Code dùng chung nằm ngoài `desktop/`, mà CI chỉ cài `desktop/node_modules`. Vì vậy mọi gói mà các file đó import (`prop-types`, `date-fns`, `react-icons`, `react-beautiful-dnd`, `sass`) phải có trong `desktop/package.json` và trong `resolve.dedupe` của `vite.config.js`.

**Lưu ý bảo mật:** `DailyNoteController` phía backend không có `[Authorize]`. Nếu gửi token hết hạn, request sẽ âm thầm ghi vào user `anonymous`. Vì vậy app tự chặn token hết hạn và bắt đăng nhập lại.
