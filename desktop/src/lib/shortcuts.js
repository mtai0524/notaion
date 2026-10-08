// Single source for keyboard help: the Help panel and the empty-editor hints.
export const SHORTCUT_GROUPS = [
  {
    title: "NORMAL (danh sách)",
    items: [
      ["j / k", "Xuống / lên ghi chú (hoặc ↓ / ↑)"],
      ["g / G", "Ghi chú đầu / cuối"],
      ["Enter / i", "Vào soạn thảo nội dung (INSERT)"],
      ["e", "Sửa tiêu đề"],
      ["n", "Ghi nhanh ghi chú mới"],
      ["x", "Đánh dấu xong / mở lại"],
      ["d", "Xoá (hỏi lại: y / n)"],
      ["[ / ]", "Ngày trước / ngày sau"],
      ["t / c", "Về hôm nay / mở lịch chọn ngày"],
      ["/", "Tìm kiếm mọi ngày"],
      ["1 / 2", "Chuyển khung NOTES / EDITOR"],
      ["T", "Đổi theme (default, dark, catppuccin, gruvbox, nord, dracula)"],
      ["E", "Export toàn bộ ghi chú (.md / .json / .zip kèm ảnh)"],
      ["V", "Bật / tắt chế độ nvim trong ghi chú"],
      ["r", "Tải lại ngày hiện tại"],
      ["q", "Ẩn app xuống khay"],
      ["?", "Trợ giúp"],
    ],
  },
  {
    title: "INSERT (soạn thảo)",
    items: [
      ["Esc", "Về NORMAL"],
      ["Enter", "Tách thành khối mới — danh sách / checklist tự nối tiếp"],
      ["Backspace", "Ở đầu dòng: bỏ định dạng, rồi gộp với dòng trên"],
      ["# / ## / ###", "Đầu dòng + dấu cách → tiêu đề"],
      ["- / [] / >", "Đầu dòng + dấu cách → danh sách / checklist / trích dẫn"],
      ["``` / ---", "Khối code / đường kẻ"],
      ["Ctrl+L", "Checklist cho dòng / đánh dấu xong"],
      ["Ctrl+;", "Chèn giờ [HH:MM]"],
    ],
  },
  {
    title: "nvim (bật bằng V)",
    items: [
      ["Enter / i", "Từ danh sách: mở ghi chú ở chế độ NORMAL (như mở file trong nvim)"],
      ["i a I A", "Vào INSERT: trước / sau con trỏ, đầu / cuối dòng"],
      ["o O", "Khối mới bên dưới / bên trên rồi INSERT (danh sách tự nối tiếp)"],
      ["h l 0 ^ $", "Di chuyển trong dòng"],
      ["w b e", "Theo từ (qua cuối khối thì sang khối kế)"],
      ["j k / gg G", "Khối dưới / trên · khối đầu / cuối (nhận số đếm: 5j)"],
      ["x X s r", "Xoá ký tự · xoá và INSERT · thay ký tự (3x, 2rx)"],
      ["dd yy p P", "Xoá / sao chép / dán cả khối (3dd)"],
      ["dw d$ cw C D", "Xoá hoặc đổi theo từ, tới cuối dòng"],
      ["u / Ctrl+r", "Hoàn tác / làm lại"],
      ["Ctrl+L", "Checklist cho khối hiện tại"],
      ["Esc", "INSERT → NORMAL; ở NORMAL → về danh sách"],
    ],
  },
  {
    title: "Ảnh, file & kéo thả",
    items: [
      ["Ctrl+V", "Dán ảnh ngay tại con trỏ (tự tách dòng nếu đang giữa câu)"],
      ["Kéo thả file", "Thả từ Explorer — vạch màu cho biết vị trí"],
      ["⠿", "Kéo ở lề trái khối để đổi thứ tự (cả ảnh)"],
      ["📎 attach", "Chèn file tại con trỏ; click ảnh/file để mở"],
    ],
  },
  {
    title: "Toàn cục",
    items: [
      ["Ctrl+Alt+N", "Mở app & ghi nhanh từ bất kỳ đâu (kể cả khi đang ẩn)"],
      ["Ctrl+K", "Tìm kiếm"],
      ["Ctrl+N", "Ô ghi nhanh"],
      ["Alt+← / Alt+→", "Đổi ngày khi đang gõ"],
      ["F1 / Ctrl+/", "Trợ giúp"],
    ],
  },
];

/** Short subset shown when no note is selected. */
export const QUICK_HINTS = [
  ["n", "ghi chú mới"],
  ["j/k", "chọn ghi chú"],
  ["Enter", "soạn thảo"],
  ["/", "tìm kiếm"],
  ["Ctrl+Alt+N", "ghi nhanh từ bất kỳ đâu"],
  ["?", "tất cả phím tắt"],
];
