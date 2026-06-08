// Nguồn chân lý duy nhất cho backend URL.
// Đổi backend giữa local / host bằng 1 biến env VITE_API_TARGET (đặt trong .env.local).
//   VITE_API_TARGET=local   -> backend chạy ở máy (https://localhost:7059)
//   VITE_API_TARGET=hosted  -> backend trên host (https://notaion.runasp.net)
// Không set: dev dùng local, build production dùng hosted.

const TARGETS = {
  local: "https://localhost:7059",
  hosted: "https://notaion.runasp.net",
};

const target =
  import.meta.env.VITE_API_TARGET ||
  (import.meta.env.DEV ? "local" : "hosted");

const API_BASE_URL = TARGETS[target] ?? TARGETS.hosted;
const SIGNALR_URL = `${API_BASE_URL}/chathub`;

export default {
  target,
  API_BASE_URL,
  SIGNALR_URL,
  // Giữ tên cũ để tương thích các chỗ còn tham chiếu trực tiếp.
  API_LOCAL: TARGETS.local,
  API_HOSTING: TARGETS.hosted,
};
