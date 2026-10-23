import { useCallback, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { message } from "antd";
import axiosInstance from "../../axiosConfig";
import "./LinkedAccounts.scss";

// Providers that are actually wired on the backend (Discord OAuth). Add more
// here as the backend grows ({ key, label, color }). `key` must match the
// route segment: /api/account/<key.toLowerCase()>-link.
const PROVIDERS = [
  { key: "Discord", label: "Discord", color: "#5865F2" },
  { key: "GitHub", label: "GitHub", color: "#24292e" },
];

const MIN_PASSWORD = 6;

export default function LinkedAccounts() {
  const [loading, setLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(true);
  const [linked, setLinked] = useState([]); // linked provider names
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const token = Cookies.get("token");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await axiosInstance.get("/api/account/linked-providers");
      setHasPassword(!!res.data.hasPassword);
      setLinked((res.data.providers || []).map((p) => p.provider));
    } catch {
      // unauthenticated or server error — leave defaults
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Show the result of an OAuth link redirect (?link=success|already|conflict|error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const link = params.get("link");
    if (!link) return;
    const provider = params.get("provider") || "Tài khoản";
    const handlers = {
      success: () => message.success(`Đã liên kết ${provider}!`),
      already: () => message.info("Tài khoản này đã được liên kết với bạn."),
      conflict: () => message.error("Tài khoản ngoài này đã liên kết với người dùng khác."),
      error: () => message.error("Liên kết thất bại, vui lòng thử lại."),
    };
    (handlers[link] || (() => {}))();
    // strip the query params so a refresh doesn't re-toast
    params.delete("link");
    params.delete("provider");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  const linkProvider = (key) => {
    if (!token) {
      message.warning("Bạn cần đăng nhập trước.");
      return;
    }
    // Return to wherever the user is now (Setting or their Profile) so the
    // OAuth redirect lands them back on the same page.
    const returnUrl = `${window.location.origin}${window.location.pathname}`;
    window.location.href =
      `${axiosInstance.defaults.baseURL}/api/account/${key.toLowerCase()}-link` +
      `?token=${encodeURIComponent(token)}&returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  const unlinkProvider = async (key) => {
    try {
      await axiosInstance.delete(`/api/account/unlink-provider/${key}`);
      message.success(`Đã gỡ liên kết ${key}`);
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || "Gỡ liên kết thất bại");
    }
  };

  const closePasswordForm = () => {
    setPwOpen(false);
    setPwCurrent("");
    setPwNext("");
    setPwConfirm("");
    setPwError("");
  };

  // An account created through Discord/GitHub has no password, so the backend
  // takes an empty currentPassword for the first one.
  const savePasswordAsync = async (e) => {
    e.preventDefault();
    if (pwNext.length < MIN_PASSWORD) {
      setPwError(`Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự.`);
      return;
    }
    if (pwNext !== pwConfirm) {
      setPwError("Hai mật khẩu không khớp.");
      return;
    }

    setPwError("");
    setPwSaving(true);
    try {
      await axiosInstance.post("/api/account/set-password", {
        currentPassword: hasPassword ? pwCurrent : null,
        newPassword: pwNext,
      });
      message.success(hasPassword ? "Đã đổi mật khẩu." : "Đã đặt mật khẩu.");
      closePasswordForm();
      load();
    } catch (err) {
      setPwError(err?.response?.data?.message || "Đặt mật khẩu thất bại.");
    } finally {
      setPwSaving(false);
    }
  };

  if (!token) {
    return <div className="linked-accounts-empty">Đăng nhập để quản lý liên kết tài khoản.</div>;
  }

  return (
    <div className="linked-accounts">
      {PROVIDERS.map((p) => {
        const isLinked = linked.includes(p.key);
        return (
          <div className="linked-account-row" key={p.key}>
            <span className="linked-account-badge" style={{ background: p.color }}>
              {p.label}
            </span>
            <span className={`linked-account-status ${isLinked ? "on" : "off"}`}>
              {loading ? "..." : isLinked ? "Đã liên kết" : "Chưa liên kết"}
            </span>
            {isLinked ? (
              <button className="linked-account-btn unlink" onClick={() => unlinkProvider(p.key)}>
                Gỡ liên kết
              </button>
            ) : (
              <button className="linked-account-btn link" onClick={() => linkProvider(p.key)}>
                Liên kết
              </button>
            )}
          </div>
        );
      })}

      <div className="linked-account-row">
        <span className="linked-account-badge password">Mật khẩu</span>
        <span className={`linked-account-status ${hasPassword ? "on" : "off"}`}>
          {loading ? "..." : hasPassword ? "Đã đặt" : "Chưa đặt"}
        </span>
        <button
          className={`linked-account-btn ${pwOpen ? "" : "password"}`}
          onClick={() => (pwOpen ? closePasswordForm() : setPwOpen(true))}
        >
          {pwOpen ? "Đóng" : hasPassword ? "Đổi mật khẩu" : "Đặt mật khẩu"}
        </button>
      </div>

      {pwOpen && (
        <form className="password-form" onSubmit={savePasswordAsync}>
          {hasPassword && (
            <div className="password-field">
              <label htmlFor="pw-current">Mật khẩu hiện tại</label>
              <input id="pw-current" type="password" autoComplete="current-password"
                     value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
            </div>
          )}
          <div className="password-field">
            <label htmlFor="pw-next">Mật khẩu mới</label>
            <input id="pw-next" type="password" autoComplete="new-password"
                   value={pwNext} onChange={(e) => setPwNext(e.target.value)} />
          </div>
          <div className="password-field">
            <label htmlFor="pw-confirm">Nhập lại mật khẩu mới</label>
            <input id="pw-confirm" type="password" autoComplete="new-password"
                   value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
          </div>
          {pwError
            ? <div className="password-error">{pwError}</div>
            : <div className="password-hint">Tối thiểu {MIN_PASSWORD} ký tự.</div>}
          <div className="password-actions">
            <button type="button" className="linked-account-btn" onClick={closePasswordForm} disabled={pwSaving}>
              Hủy
            </button>
            <button type="submit" className="linked-account-btn save" disabled={pwSaving}>
              {pwSaving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      )}

      {!hasPassword && (
        <div className="linked-account-warn">
          {linked.length <= 1
            ? "Chưa có mật khẩu nên đây là phương thức đăng nhập duy nhất, không thể gỡ. Đặt mật khẩu để đăng nhập trực tiếp và dùng được MCP server."
            : "Đặt mật khẩu để đăng nhập trực tiếp và dùng được MCP server."}
        </div>
      )}
    </div>
  );
}
