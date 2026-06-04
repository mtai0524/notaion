import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { parseLevel } from "./engine/level";
import { createGame, VIEW_W, VIEW_H } from "./engine/game";
import { createGameConnection } from "./net/gameConnection";
import "./PixelGame.scss";

const CLAIM_ID =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
const CLAIM_NAME = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";
const CLAIM_AVATAR =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/country";

export default function PixelGame() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const netRef = useRef(null);

  const [score, setScore] = useState(0);
  const [players, setPlayers] = useState(1);
  const [finished, setFinished] = useState(false);
  const [connected, setConnected] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const level = parseLevel();

    // Identity from the JWT cookie (same claim keys as the rest of the app).
    const token = Cookies.get("token");
    let userId = "";
    let name = "Player";
    let avatar = "";
    if (token) {
      try {
        const d = jwt_decode(token);
        userId = d[CLAIM_ID] || "";
        name = d[CLAIM_NAME] || "Player";
        avatar = d[CLAIM_AVATAR] || "";
      } catch {
        /* malformed token — fall through to guest */
      }
    } else {
      setNeedLogin(true);
    }

    const game = createGame(canvas, level, {
      localName: name,
      sendState: (s) => netRef.current?.sendState(s),
      onScore: setScore,
      onFinish: () => setFinished(true),
      onPlayers: setPlayers,
    });
    gameRef.current = game;
    game.start();

    // Only go online when authenticated; otherwise play solo locally.
    let net = null;
    if (token) {
      net = createGameConnection({
        onExisting: (list) => game.setRemotes(list),
        onJoined: (p) => game.addRemote(p),
        onLeft: (id) => game.removeRemote(id),
        onState: (id, x, y, vx, f, a) => game.setRemoteState(id, x, y, vx, f, a),
      });
      netRef.current = net;
      net
        .join("world-1", userId, name, avatar)
        .then(() => setConnected(true))
        .catch(() => setConnected(false));
    }

    return () => {
      game.destroy();
      net?.stop();
      gameRef.current = null;
      netRef.current = null;
    };
  }, []);

  return (
    <div className="pixel-game">
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="pixel-game__canvas"
      />

      <div className="pixel-game__hud">
        <div className="pg-badge">🪙 {score}</div>
        <div className="pg-badge">👥 {players}</div>
        <div className={`pg-badge ${connected ? "on" : needLogin ? "warn" : "off"}`}>
          {connected ? "Online" : needLogin ? "Khách" : "Offline"}
        </div>
      </div>

      <div className="pixel-game__hint">
        ◀ ▶ / A D: di chuyển · Space / W / ▲: nhảy · gom 🪙 và tới 🏁
      </div>

      {needLogin && (
        <div className="pixel-game__note">
          Đăng nhập để chơi cùng người khác (đang chơi một mình).
        </div>
      )}

      {finished && (
        <div className="pixel-game__overlay">
          <div className="pg-finish">
            <h2>🏁 Về đích!</h2>
            <p>Bạn thu thập được {score} 🪙</p>
            <button onClick={() => window.location.reload()}>Chơi lại</button>
          </div>
        </div>
      )}
    </div>
  );
}
