import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { signIn } from "../lib/api.js";
import { WEB_URL } from "../lib/config.js";
import { openExternal } from "../lib/native.js";
import { Mark } from "./Mark.jsx";

export function Login({ onSignIn, notice }) {
  const [login, setLogin] = useState(() => localStorage.getItem("nd:lastLogin") || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loginRef = useRef();
  const passwordRef = useRef();
  // Preact has no autoFocus emulation — focus the first empty field ourselves.
  useLayoutEffect(() => (login ? passwordRef : loginRef).current?.focus(), []);

  const submit = async (e) => {
    e.preventDefault();
    if (!login || !password) return;
    setBusy(true);
    setError("");
    try {
      const token = await signIn(login.trim(), password);
      localStorage.setItem("nd:lastLogin", login.trim());
      onSignIn(token);
    } catch (err) {
      setError(err.message || "Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="login">
      <form class="login-card pane focused" onSubmit={submit}>
        <span class="pane-title"><kbd>⏻</kbd>LOGIN</span>
        <div class="login-brand">
          <Mark size={36} />
          <div>
            <h1>Notaion Daily</h1>
            <p>$ daily notes — nhanh, gọn_</p>
          </div>
        </div>
        {notice && <div class="login-notice">{notice}</div>}
        <label>
          Email hoặc username
          <input
            value={login}
            onInput={(e) => setLogin(e.currentTarget.value)}
            ref={loginRef}
            autoComplete="username"
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
            ref={passwordRef}
            autoComplete="current-password"
          />
        </label>
        {error && <div class="login-error">{error}</div>}
        <button class="btn primary" type="submit" disabled={busy || !login || !password}>
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
        <div class="login-sep">hoặc</div>
        <button type="button" class="btn" onClick={() => openExternal(`${WEB_URL}/desktop-auth`)}>
          Đăng nhập qua trình duyệt (GitHub / Discord)
        </button>
      </form>
    </div>
  );
}
