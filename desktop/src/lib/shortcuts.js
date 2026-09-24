// Single source for keyboard help: the Help panel and the empty-editor hints.
export const SHORTCUT_GROUPS = [
  {
    title: "Chung",
    items: [
      ["Ctrl+Alt+N", "Mở app & ghi nhanh từ bất kỳ đâu (kể cả khi app đang ẩn)"],
      ["Ctrl+N", "Focus ô Ghi nhanh"],
      ["Ctrl+K", "Tìm kiếm mọi ngày (không phân biệt dấu)"],
      ["Ctrl+R / F5", "Tải lại ngày hiện tại"],
      ["F1 / Ctrl+/", "Mở / đóng trợ giúp"],
    ],
  },
  {
    title: "Ngày & ghi chú",
    items: [
      ["Alt+← / Alt+→", "Ngày trước / ngày sau"],
      ["Alt+Home", "Về hôm nay"],
      ["Alt+↑ / Alt+↓", "Chuyển ghi chú trước / sau"],
    ],
  },
  {
    title: "Ô Ghi nhanh",
    items: [
      ["Enter", "Tạo ghi chú với tiêu đề vừa gõ"],
      ["Shift+Enter", "Tạo rồi chuyển sang viết nội dung"],
      ["Esc", "Xoá ô; khi ô trống thì ẩn app xuống khay"],
      ["↓", "Đi xuống danh sách ghi chú"],
    ],
  },
  {
    title: "Soạn thảo",
    items: [
      ["Ctrl+L", "Checkbox: dòng thường → - [ ] → - [x]"],
      ["Ctrl+;", "Chèn giờ [HH:MM]"],
      ["Enter", "Tự nối danh sách (-, - [ ], 1.) — Enter ở mục trống để thoát"],
      ["Tab", "Thụt 2 dấu cách"],
      ["Ctrl+Z", "Hoàn tác (kể cả các thao tác trên)"],
    ],
  },
  {
    title: "Ảnh & file",
    items: [
      ["Ctrl+V", "Dán ảnh (ảnh chụp màn hình, ảnh đã copy) → đính kèm vào ghi chú"],
      ["Kéo thả", "Thả file từ Explorer vào khung soạn thảo"],
      ["📎 Đính kèm", "Chọn file từ máy; click ảnh/file để mở, × để gỡ"],
    ],
  },
];

/** Short subset shown when no note is selected. */
export const QUICK_HINTS = [
  ["Ctrl+Alt+N", "mở app & ghi nhanh từ bất kỳ đâu"],
  ["Ctrl+K", "tìm kiếm mọi ngày"],
  ["Alt+←/→", "đổi ngày"],
  ["Ctrl+L", "checkbox"],
  ["F1", "xem tất cả phím tắt"],
];
