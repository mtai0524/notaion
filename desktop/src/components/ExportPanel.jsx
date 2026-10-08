import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { buildExport } from "../../../shared/exportNotes.js";
import { getFetch } from "../lib/api.js";
import { revealInFolder, saveDownload } from "../lib/native.js";

const FORMATS = [
  { key: "md", label: "Markdown", ext: ".md", desc: "mọi ngày trong một file, dễ đọc, dùng được với Obsidian / Notion" },
  { key: "json", label: "Backup", ext: ".json", desc: "đầy đủ mọi trường — để lưu trữ và nhập lại sau" },
  { key: "zip", label: "Zip + ảnh/file", ext: ".zip", desc: "ghi chú theo ngày + tải luôn ảnh và file đính kèm (nặng hơn)" },
];

export function ExportPanel({ store, onClose }) {
  const [active, setActive] = useState(0);
  const [state, setState] = useState({ phase: "idle" }); // idle | busy | done | error
  const rootRef = useRef();
  useLayoutEffect(() => rootRef.current?.focus(), []);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  const run = async (format) => {
    if (state.phase === "busy") return;
    setState({ phase: "busy", label: "đang lấy ghi chú…" });
    try {
      const notes = await store.fetchAllFull();
      if (!notes.length) throw new Error("chưa có ghi chú nào để export");
      const result = await buildExport(notes, {
        format,
        fetchImpl: await getFetch(), // Rust HTTP client: no CORS for Cloudinary / server files
        onProgress: (p) => {
          if (!mounted.current) return;
          if (p.phase === "files") setState({ phase: "busy", label: `đang tải ảnh/file ${p.done}/${p.total}…` });
          else if (p.phase === "zip") setState({ phase: "busy", label: "đang đóng gói…" });
        },
      });
      const saved = await saveDownload(result.filename, result.data, result.mime);
      if (mounted.current) setState({ phase: "done", saved, stats: result.stats });
    } catch (err) {
      if (mounted.current) setState({ phase: "error", message: err?.message || String(err) });
    }
  };

  // Window-level, not on the panel element: Esc / 1-3 must work wherever focus
  // happens to be (a click elsewhere, a script, the tray…). `live` always holds
  // the latest state/handlers without re-subscribing on every render.
  const live = useRef();
  live.current = { state, active, run, onClose };
  useEffect(() => {
    const handler = (e) => live.current.onKeyDown(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onKeyDown = (e) => {
    const { state, active, run, onClose } = live.current;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      return onClose();
    }
    if (state.phase === "busy") return;
    if (state.phase === "done" && (e.key === "o" || e.key === "O")) return void revealInFolder(state.saved.path);
    if (/^[1-3]$/.test(e.key)) {
      e.preventDefault();
      return run(FORMATS[Number(e.key) - 1].key);
    }
    if (e.key === "j" || e.key === "ArrowDown") setActive((i) => Math.min(i + 1, FORMATS.length - 1));
    else if (e.key === "k" || e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
    else if (e.key === "Enter") run(FORMATS[active].key);
    else return;
    e.preventDefault();
  };
  live.current.onKeyDown = onKeyDown;

  const { stats, saved } = state;
  return (
    <div class="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && state.phase !== "busy" && onClose()}>
      <div class="export pane focused" role="dialog" aria-label="Export" tabIndex={-1} ref={rootRef}>
        <span class="pane-title"><kbd>E</kbd>EXPORT · TẤT CẢ GHI CHÚ</span>
        <button class="help-close chip" onClick={onClose} disabled={state.phase === "busy"}>esc ✕</button>

        <ul class="export-list">
          {FORMATS.map((f, i) => (
            <li
              key={f.key}
              class={`export-item${i === active ? " sel" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(f.key)}
            >
              <kbd>{i + 1}</kbd>
              <span class="export-name">{f.label} <span class="dim">{f.ext}</span></span>
              <span class="export-desc dim">{f.desc}</span>
            </li>
          ))}
        </ul>

        <div class="export-status" role="status">
          {state.phase === "idle" && <span class="dim">chọn 1-3 hoặc j/k + Enter · file lưu vào thư mục Downloads</span>}
          {state.phase === "busy" && <span class="flash"><span class="spin">◌</span> {state.label}</span>}
          {state.phase === "error" && <span class="danger-text">! {state.message}</span>}
          {state.phase === "done" && (
            <span class="ok">
              ✓ đã lưu <b>{saved.name}</b> · {stats.notes} ghi chú · {stats.days} ngày{stats.files ? ` · ${stats.files} file` : ""}
              {stats.failed.length > 0 && (
                <span class="danger-text"> · {stats.failed.length} file không tải được (giữ link gốc, xem download-errors.txt)</span>
              )}
              {saved.path && (
                <> <button class="chip" onClick={() => revealInFolder(saved.path)}>o · mở thư mục</button></>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
