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
    title: "Soạn thảo (khối như Notion)",
    items: [
      ["Enter", "Tách dòng thành khối mới — danh sách / checklist tự nối tiếp"],
      ["Backspace", "Ở đầu dòng: bỏ định dạng, rồi gộp với dòng trên"],
      ["# / ## / ###", "Gõ ở đầu dòng + dấu cách → tiêu đề"],
      ["- / [] / >", "Gõ ở đầu dòng + dấu cách → danh sách / checklist / trích dẫn"],
      ["``` / ---", "Khối code / đường kẻ ngang"],
      ["Ctrl+L", "Bật checklist cho dòng / đánh dấu xong"],
      ["Ctrl+;", "Chèn giờ [HH:MM]"],
      ["↑ / ↓", "Sang dòng trên / dưới"],
    ],
  },
  {
    title: "Ảnh, file & kéo thả",
    items: [
      ["Ctrl+V", "Dán ảnh ngay tại vị trí con trỏ (tự tách dòng nếu đang giữa câu)"],
      ["Kéo thả file", "Thả từ Explorer — vạch xanh cho biết ảnh sẽ nằm ở đâu"],
      ["⠿", "Rê chuột vào lề trái của khối, kéo ⠿ để đổi thứ tự (cả ảnh)"],
      ["📎 Đính kèm", "Chèn file tại con trỏ; click ảnh/file để mở, × để xoá"],
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
