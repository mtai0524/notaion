# Notaion Daily — desktop app

App desktop gọn nhẹ cho **Daily Notes** của Notaion. Dùng Tauri 2 (WebView2 có sẵn trên Windows) và Preact, không kéo theo antd/tiptap của web. Bộ cài khoảng vài MB, mở gần như tức thì.

Người dùng tải bộ cài từ trang web `/desktop` (menu **Desktop App**). Trang này trỏ tới GitHub Releases.

## Tính năng
- **Nhanh:** hiện ngay dữ liệu cache trong localStorage, rồi mới đồng bộ ở nền. Mọi thay đổi vào hàng đợi ghi (outbox) trước, nên mất mạng vẫn ghi được và sẽ tự gửi khi có mạng lại.
- **Ghi nhanh toàn hệ thống:** `Ctrl+Alt+N` gọi app lên và focus ô *Ghi nhanh*. `Enter` lưu, `Shift+Enter` lưu rồi viết tiếp nội dung, `Esc` (khi ô trống) ẩn app xuống khay.
- Chạy nền ở khay hệ thống, nút X chỉ ẩn cửa sổ. Chỉ chạy một bản (mở lần hai sẽ focus bản đang chạy).
- Tìm mọi ngày bằng `Ctrl+K`, không phân biệt dấu (gõ `hop du an` vẫn ra "Họp dự án").
- Soạn thảo: `Ctrl+L` bật/tắt checkbox, `Ctrl+;` chèn `[HH:MM]`, `Enter` tự nối danh sách.
- Điều hướng: `Alt+←/→` đổi ngày, `Alt+Home` về hôm nay, `Alt+↑/↓` chuyển ghi chú, `Ctrl+R` tải lại.
- Đăng nhập bằng email/mật khẩu, hoặc **qua trình duyệt** (GitHub/Discord). Cách thứ hai dùng deep-link `notaion://auth?token=…` từ trang web `/desktop-auth`.

Ghi chú tạo từ app có đủ các trường layout (x/y/width…), nên vẫn hiển thị bình thường trên canvas của web.

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
2. `git tag desktop-v0.1.0 && git push origin desktop-v0.1.0`
3. Workflow `.github/workflows/desktop-release.yml` build trên `windows-latest` và đăng file `*_x64-setup.exe` lên GitHub Release.

Giữ minor version của các crate `tauri-plugin-*` khớp với package npm `@tauri-apps/plugin-*` tương ứng, nếu lệch thì `tauri build` sẽ báo lỗi.

## Cấu trúc
| Đường dẫn | Vai trò |
|---|---|
| `src/lib/store.js` | Cache theo ngày, outbox, đồng bộ |
| `src/lib/api.js` | Client HTTP (đi qua `plugin-http` phía Rust, nên không bị CORS), kiểm tra hạn JWT |
| `src/lib/notes.js`, `editing.js` | Logic thuần: merge, search, phím tắt soạn thảo |
| `src/components/` | UI Preact |
| `src-tauri/src/lib.rs` | Tray, hotkey toàn cục, single-instance, deep-link |

**Lưu ý bảo mật:** `DailyNoteController` phía backend không có `[Authorize]`. Nếu gửi token hết hạn, request sẽ âm thầm ghi vào user `anonymous`. Vì vậy app tự chặn token hết hạn và bắt đăng nhập lại.
