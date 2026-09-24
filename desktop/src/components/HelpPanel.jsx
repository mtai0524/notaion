import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import { SHORTCUT_GROUPS } from "../lib/shortcuts.js";
import { IS_TAURI, WEB_URL } from "../lib/config.js";
import { openExternal } from "../lib/native.js";

export function HelpPanel({ onClose }) {
  const [version, setVersion] = useState("");

  useEffect(() => {
    if (IS_TAURI) import("@tauri-apps/api/app").then((m) => m.getVersion()).then(setVersion).catch(() => {});
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div class="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="help pane focused" role="dialog" aria-label="Trợ giúp">
        <span class="pane-title"><kbd>?</kbd>HELP · NOTAION DAILY{version && ` v${version}`}</span>
        <button class="help-close chip" onClick={onClose} title="Đóng (Esc)">esc ✕</button>

        <div class="help-body">
          {SHORTCUT_GROUPS.map((g) => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              <dl>
                {g.items.map(([keys, desc]) => (
                  <Fragment key={keys + desc}>
                    <dt>
                      {keys.split(" / ").map((k, i) => (
                        <Fragment key={k}>{i > 0 && " / "}<kbd>{k}</kbd></Fragment>
                      ))}
                    </dt>
                    <dd>{desc}</dd>
                  </Fragment>
                ))}
              </dl>
            </section>
          ))}

          <section>
            <h3>Đồng bộ</h3>
            <ul class="help-notes">
              <li>Mọi thay đổi tự lưu, không cần bấm Lưu. Chấm ở góc dưới: <span class="dot ok" /> đã đồng bộ, <span class="dot warn" /> đang lưu, <span class="dot bad" /> offline.</li>
              <li>Mất mạng vẫn ghi được — thay đổi được giữ trên máy và tự gửi khi có mạng lại.</li>
              <li>Ghi chú sửa trên web sẽ hiện khi bạn quay lại cửa sổ app (hoặc <kbd>Ctrl+R</kbd>).</li>
              <li>Nút <b>X</b> chỉ ẩn app xuống khay hệ thống; thoát hẳn bằng chuột phải icon khay → <b>Thoát</b>.</li>
            </ul>
          </section>
        </div>

        <div class="help-foot">
          <button class="link" onClick={() => openExternal(`${WEB_URL}/daily-note`)}>Mở Daily Notes trên web</button>
          <button class="link" onClick={() => openExternal(`${WEB_URL}/desktop`)}>Tải bản mới</button>
        </div>
      </div>
    </div>
  );
}
