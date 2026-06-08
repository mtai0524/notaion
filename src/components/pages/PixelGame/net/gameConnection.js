import * as signalR from "@microsoft/signalr";
import Cookies from "js-cookie";
import config from "../../../../config";

// Thin wrapper around the SignalR /gameHub connection. Mirrors how the rest of
// the app builds hub connections (accessTokenFactory + automatic reconnect).
export function createGameConnection(handlers = {}) {
  const baseUrl = config.API_BASE_URL;

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${baseUrl}/gameHub`, {
      accessTokenFactory: () => Cookies.get("token"),
      withCredentials: true,
    })
    .withAutomaticReconnect()
    .build();

  connection.on("ExistingPlayers", (players) => handlers.onExisting?.(players || []));
  connection.on("PlayerJoined", (player) => handlers.onJoined?.(player));
  connection.on("PlayerLeft", (connectionId) => handlers.onLeft?.(connectionId));
  connection.on("PlayerState", (connectionId, x, y, vx, facing, anim) =>
    handlers.onState?.(connectionId, x, y, vx, facing, anim)
  );

  return {
    async join(room, userId, name, avatar) {
      await connection.start();
      await connection.invoke("JoinGame", room, userId || "", name || "Player", avatar || "");
    },
    sendState(s) {
      if (connection.state === signalR.HubConnectionState.Connected) {
        // Fire-and-forget; dropped frames are fine for position updates.
        connection
          .invoke("UpdateState", s.x, s.y, s.vx, s.facing, s.anim)
          .catch(() => {});
      }
    },
    async stop() {
      try {
        await connection.stop();
      } catch {
        /* ignore */
      }
    },
    raw: connection,
  };
}
