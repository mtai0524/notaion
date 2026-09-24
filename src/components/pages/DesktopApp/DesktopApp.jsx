import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import NotaionMark from "../../pixel/NotaionMark";
import { setAfterLoginPath } from "../../../utils/afterLogin";
import "./DesktopApp.scss";

// Installer builds are published as GitHub Releases by .github/workflows/desktop-release.yml.
export const DESKTOP_DOWNLOAD_URL = "https://github.com/mtai0524/notaion/releases/latest";

const validToken = () => {
  const token = Cookies.get("token");
  if (!token) return null;
  try {
    const { exp } = jwt_decode(token);
    return exp && exp * 1000 > Date.now() + 60_000 ? token : null;
  } catch {
    return null;
  }
};

/**
 * /desktop       — download page for the Notaion Daily desktop app.
 * /desktop-auth  — opened by the desktop app ("Đăng nhập qua trình duyệt"):
 *                  hands the web session token to the app via notaion://auth.
 */
const DesktopApp = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const connect = location.pathname === "/desktop-auth";
  const token = validToken();
  const appLink = token ? `notaion://auth?token=${encodeURIComponent(token)}` : null;
  const opened = useRef(false);

  useEffect(() => {
    if (connect && appLink && !opened.current) {
      opened.current = true;
      window.location.href = appLink;
    }
  }, [connect, appLink]);

  const goLogin = () => {
    setAfterLoginPath("/desktop-auth");
    navigate("/login");
  };

  return (
    <div className="desktop-page">
      <div className="desktop-card">
        <div className="desktop-brand">
          <NotaionMark size={40} />
          <div>
            <h1>Notaion Daily cho Windows</h1>
            <p>Daily Notes gọn nhẹ — mở tức thì, ghi nhanh từ bất kỳ đâu.</p>
          </div>
        </div>

        {connect ? (
          token ? (
            <div className="desktop-connect">
              <p>Đang mở app Notaion Daily… Nếu trình duyệt hỏi, chọn <b>Mở</b>.</p>
              <a className="desktop-btn primary" href={appLink}>Mở Notaion Daily</a>
              <p className="desktop-muted">Chưa cài app? <a href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">Tải về</a></p>
            </div>
          ) : (
            <div className="desktop-connect">
              <p>Đăng nhập trên web trước, sau đó app sẽ tự nhận phiên đăng nhập.</p>
              <button className="desktop-btn primary" onClick={goLogin}>Đăng nhập</button>
            </div>
          )
        ) : (
          <>
            <ul className="desktop-features">
              <li><kbd>Ctrl+Alt+N</kbd> ghi nhanh từ bất kỳ đâu, <kbd>Esc</kbd> ẩn lại</li>
              <li>Mở tức thì từ cache, vẫn ghi được khi mất mạng — tự đồng bộ khi có mạng lại</li>
              <li>Tìm kiếm mọi ngày <kbd>Ctrl+K</kbd>, không phân biệt dấu</li>
              <li>Checklist <kbd>Ctrl+L</kbd>, chèn giờ <kbd>Ctrl+;</kbd>, tự nối danh sách khi Enter</li>
              <li>Chạy nền ở khay hệ thống, cài đặt ~5 MB</li>
            </ul>
            <a className="desktop-btn primary" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">
              Tải cho Windows
            </a>
            <p className="desktop-muted">
              Chọn file <code>Notaion.Daily_x.y.z_x64-setup.exe</code> trong mục Assets. Windows SmartScreen có thể
              cảnh báo vì app chưa ký số — chọn <i>More info → Run anyway</i>.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default DesktopApp;
