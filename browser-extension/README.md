# Notaion — Daily Notes (Browser Extension)

Extension mở nhanh trang ghi chú hằng ngày Notaion từ thanh công cụ trình duyệt.

## Tính năng
- Click icon → mở **Daily Notes**; nếu đã có tab Notaion đang mở thì tái sử dụng tab đó thay vì mở thêm.
- Nút **Mở trong tab mới** khi cần.
- Phím tắt **Alt+N**.

## Cài đặt (chế độ developer)

### Chrome / Edge / Brave
1. Mở `chrome://extensions` (Edge: `edge://extensions`).
2. Bật **Developer mode** (góc trên bên phải).
3. Chọn **Load unpacked** → trỏ tới thư mục `browser-extension/`.

### Firefox
1. Mở `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on** → chọn file `manifest.json` trong `browser-extension/`.

## Cấu hình
Đổi URL ứng dụng trong [`popup.js`](popup.js) (hằng số `APP_URL`) nếu bạn deploy Notaion ở domain khác. Mặc định trỏ tới `https://notaion.onrender.com`.

## Cấu trúc
| File | Vai trò |
|------|---------|
| `manifest.json` | Khai báo extension (MV3), quyền, phím tắt |
| `popup.html` / `popup.css` / `popup.js` | Giao diện popup + logic mở tab |
| `icons/` | Icon 16/48/128px |
