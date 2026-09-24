// Thin wrappers over Tauri APIs. Each is a no-op (or browser fallback) outside
// Tauri so the UI can still be developed with plain `vite`.
import { IS_TAURI } from "./config.js";

/** Global hotkey (Ctrl+Alt+N) → Rust shows the window and emits this event. */
export async function onQuickCapture(cb) {
  if (!IS_TAURI) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen("quick-capture", () => cb());
}

/** notaion://auth?token=… — sent by the web /desktop-auth page. */
export async function onAuthLink(cb) {
  if (!IS_TAURI) return () => {};
  const { onOpenUrl, getCurrent } = await import("@tauri-apps/plugin-deep-link");
  const handle = (urls) => {
    for (const raw of urls || []) {
      try {
        const u = new URL(raw);
        const token = u.searchParams.get("token");
        if (u.protocol === "notaion:" && token) cb(token);
      } catch {
        /* ignore malformed links */
      }
    }
  };
  handle(await getCurrent().catch(() => null)); // cold start via link
  return onOpenUrl(handle);
}

export async function openExternal(url) {
  if (!IS_TAURI) return void window.open(url, "_blank", "noopener");
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

export async function hideWindow() {
  if (!IS_TAURI) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().hide();
}
