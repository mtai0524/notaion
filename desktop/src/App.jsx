import { useEffect, useMemo, useState } from "preact/hooks";
import { createApi } from "./lib/api.js";
import { createStore } from "./lib/store.js";
import { isTokenExpired } from "./lib/jwt.js";
import { onAuthLink } from "./lib/native.js";
import { Login } from "./components/Login.jsx";
import { DailyView } from "./components/DailyView.jsx";

const TOKEN_KEY = "nd:token";

export function App() {
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && !isTokenExpired(t) ? t : null;
  });
  const [notice, setNotice] = useState("");

  const signIn = (t) => {
    localStorage.setItem(TOKEN_KEY, t);
    setNotice("");
    setToken(t);
  };

  // One store per session; getToken reads the live value so a re-login does
  // not need a new store (pending outbox writes are kept across re-logins).
  const store = useMemo(() => {
    const api = createApi(() => localStorage.getItem(TOKEN_KEY));
    return createStore({
      api,
      onAuthError: () => {
        localStorage.removeItem(TOKEN_KEY);
        setNotice("Phiên đăng nhập đã hết hạn — đăng nhập lại để tiếp tục đồng bộ.");
        setToken(null);
      },
    });
  }, []);

  useEffect(() => {
    let off = () => {};
    onAuthLink((t) => {
      if (!isTokenExpired(t)) signIn(t);
    }).then((fn) => (off = fn));
    return () => off();
  }, []);

  const signOut = () => {
    const { pending } = store.getStatus();
    if (pending && !confirm(`Còn ${pending} thay đổi chưa đồng bộ sẽ bị mất. Vẫn đăng xuất?`)) return;
    localStorage.removeItem(TOKEN_KEY);
    store.clear();
    setToken(null);
  };

  if (!token) return <Login onSignIn={signIn} notice={notice} />;
  return <DailyView store={store} token={token} onSignOut={signOut} />;
}
