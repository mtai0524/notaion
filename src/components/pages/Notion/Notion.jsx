import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Tooltip, message } from "antd";
import {
  PlusOutlined,
  HolderOutlined,
  SettingOutlined,
  BgColorsOutlined,
  CloseOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import "./Notion.scss";
import { v4 as uuidv4 } from "uuid";
import axiosInstance from "../../../axiosConfig";
import { downloadFile } from "../../../services/fileService";
import debounce from "lodash.debounce";
import { Rnd } from "react-rnd";
import NotionBlock, { LazyBlock, SLASH_COMMANDS } from "./NotionBlock";

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result.map((item, index) => ({ ...item, order: index }));
};

const generateRandomId = () => uuidv4();

// ── View preference catalog ──────────────────────────────────────────
const DEFAULT_PREFS = {
  density: "comfortable",   // compact | comfortable | spacious
  width: "normal",          // narrow | normal | wide | full
  theme: "auto",            // auto | light | dark | sepia
  font: "sans",             // sans | serif | mono
  fontSize: "md",           // sm | md | lg
  background: "plain",      // plain | dots | grid | lines
  accent: "#111827",        // any hex — defaults to Notaion ink (not blue)
  focusMode: false,         // hides controls + ghost-add
  layout: "single",         // single | columns2 | columns3 | canvas | slideshow
  showOutline: true,        // outline (TOC) sidebar visibility
  showTimestamps: false,    // show created/updated time under each block
};

const ACCENT_SWATCHES = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#111827", // ink
];

const FONT_STACKS = {
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  serif: "'Lora', 'Georgia', serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

const loadPrefs = () => {
  try {
    const raw = localStorage.getItem("notion.prefs");
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

// ── Outline / Table of contents sidebar ──────────────────────────────
const OutlineSidebar = ({ items, newContent, onJump, onClose }) => {
  const headings = useMemo(() => {
    return items
      .map((it) => {
        if (!it.heading || !String(it.heading).startsWith("heading-")) return null;
        const level = parseInt(it.heading.replace("heading-", ""), 10);
        if (!level || level < 1 || level > 3) return null;
        const raw = newContent[it.id] ?? it.content ?? "";
        const text = String(raw).trim().replace(/\s+/g, " ").slice(0, 80);
        return text ? { id: it.id, level, text } : null;
      })
      .filter(Boolean);
  }, [items, newContent]);

  // Highlight the heading currently in view so the reader always knows where
  // they are without scrolling to check. Keyed by the heading id list so the
  // observer is only rebuilt when headings are added/removed, not on keystrokes.
  const [activeId, setActiveId] = useState(null);
  const headingKey = headings.map((h) => h.id).join("|");

  useEffect(() => {
    const ids = headingKey ? headingKey.split("|") : [];
    if (ids.length === 0) {
      setActiveId(null);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
        if (visible[0]) {
          setActiveId(visible[0].target.getAttribute("data-block-id"));
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.querySelector(`[data-block-id="${id}"]`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headingKey]);

  return (
    <aside className="notion-outline">
      <div className="outline-header">
        <span className="outline-title">On this page</span>
        <button type="button" className="outline-close" onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>
      {headings.length === 0 ? (
        <div className="outline-empty">
          Add a heading with <kbd>/</kbd> to build an outline.
        </div>
      ) : (
        <nav className="outline-list">
          {headings.map((h) => (
            <button
              key={h.id}
              type="button"
              className={`outline-item level-${h.level} ${h.id === activeId ? "is-active" : ""}`}
              onClick={() => onJump(h.id)}
              title={h.text}
            >
              <span className="outline-bar" />
              <span className="outline-text">{h.text}</span>
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
};

// ── Minimap ──────────────────────────────────────────────────────────
// A compact vertical strip in the corner: one cell per block sized by its real
// height, plus a viewport marker that follows the scroll. Click or drag to jump
// anywhere on the page quickly.
const Minimap = ({ items, selectedIds, onJump }) => {
  const [metrics, setMetrics] = useState({ docHeight: 1, blocks: [] });
  const [view, setView] = useState({ top: 0, height: 0 });
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  // Re-measure block geometry on scroll/resize/content change (throttled to a
  // frame). getBoundingClientRect + scrollY gives stable document coordinates.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        window.innerHeight,
        1
      );
      const blocks = items
        .map((it) => {
          const el = document.querySelector(`[data-block-id="${it.id}"]`);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const top = r.top + window.scrollY;
          return { id: it.id, top, height: Math.max(r.height, 1) };
        })
        .filter(Boolean);
      setMetrics({ docHeight, blocks });
      setView({ top: window.scrollY, height: window.innerHeight });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const interval = setInterval(measure, 800); // catch async height changes (images, lazy blocks)
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  const { docHeight } = metrics;

  const scrollToRatio = useCallback(
    (clientY) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      const target = ratio * docHeight - window.innerHeight / 2;
      window.scrollTo({ top: Math.max(0, target), behavior: "auto" });
    },
    [docHeight]
  );

  const onPointerDown = (e) => {
    draggingRef.current = true;
    scrollToRatio(e.clientY);
    const move = (ev) => draggingRef.current && scrollToRatio(ev.clientY);
    const up = () => {
      draggingRef.current = false;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const pct = (v) => `${(v / docHeight) * 100}%`;

  return (
    <div className="notion-minimap" aria-hidden="false">
      <div
        ref={trackRef}
        className="minimap-track"
        onMouseDown={onPointerDown}
        role="presentation"
      >
        {metrics.blocks.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`minimap-cell ${selectedIds?.has(b.id) ? "is-selected" : ""}`}
            style={{ top: pct(b.top), height: pct(b.height) }}
            title="Jump to block"
            onClick={(e) => {
              e.stopPropagation();
              onJump(b.id);
            }}
          />
        ))}
        <div
          className="minimap-viewport"
          style={{ top: pct(view.top), height: pct(view.height) }}
        />
      </div>
    </div>
  );
};

// ── Settings panel ───────────────────────────────────────────────────
const SegGroup = ({ label, value, options, onChange }) => (
  <div className="prefs-row">
    <div className="prefs-label">{label}</div>
    <div className="prefs-seg">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`prefs-seg-item ${value === opt.value ? "is-active" : ""}`}
          onClick={() => onChange(opt.value)}
          title={opt.title || opt.label}
        >
          {opt.icon && <span className="prefs-seg-icon">{opt.icon}</span>}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  </div>
);

const NotionPrefsPanel = ({ prefs, onChange, onReset, onClose }) => {
  return (
    <div
      className="notion-prefs-panel"
      style={{ "--notion-accent": prefs.accent }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="prefs-header">
        <div className="prefs-title">
          <BgColorsOutlined />
          <span>Appearance</span>
        </div>
        <button type="button" className="prefs-close" onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>

      <div className="prefs-body">
        <SegGroup
          label="Theme"
          value={prefs.theme}
          onChange={(v) => onChange({ theme: v })}
          options={[
            { value: "auto", label: "Auto" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "sepia", label: "Sepia" },
          ]}
        />

        <SegGroup
          label="Density"
          value={prefs.density}
          onChange={(v) => onChange({ density: v })}
          options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfy" },
            { value: "spacious", label: "Spacious" },
          ]}
        />

        <SegGroup
          label="Page width"
          value={prefs.width}
          onChange={(v) => onChange({ width: v })}
          options={[
            { value: "narrow", label: "Narrow" },
            { value: "normal", label: "Normal" },
            { value: "wide", label: "Wide" },
            { value: "full", label: "Full" },
          ]}
        />

        <SegGroup
          label="Font"
          value={prefs.font}
          onChange={(v) => onChange({ font: v })}
          options={[
            { value: "sans", label: "Sans" },
            { value: "serif", label: "Serif" },
            { value: "mono", label: "Mono" },
          ]}
        />

        <SegGroup
          label="Text size"
          value={prefs.fontSize}
          onChange={(v) => onChange({ fontSize: v })}
          options={[
            { value: "sm", label: "S" },
            { value: "md", label: "M" },
            { value: "lg", label: "L" },
          ]}
        />

        <SegGroup
          label="Background"
          value={prefs.background}
          onChange={(v) => onChange({ background: v })}
          options={[
            { value: "plain", label: "Plain" },
            { value: "dots", label: "Dots" },
            { value: "grid", label: "Grid" },
            { value: "lines", label: "Lines" },
          ]}
        />

        <SegGroup
          label="Layout"
          value={prefs.layout}
          onChange={(v) => onChange({ layout: v })}
          options={[
            { value: "single", label: "List" },
            { value: "columns2", label: "2 cols" },
            { value: "columns3", label: "3 cols" },
            { value: "canvas", label: "Canvas" },
            { value: "slideshow", label: "Slides" },
          ]}
        />

        <div className="prefs-row">
          <div className="prefs-label">Outline (Table of contents)</div>
          <button
            type="button"
            className={`prefs-toggle ${prefs.showOutline ? "is-on" : ""}`}
            onClick={() => onChange({ showOutline: !prefs.showOutline })}
          >
            <span className="prefs-toggle-thumb" />
          </button>
        </div>

        <div className="prefs-row">
          <div className="prefs-label">Show timestamps</div>
          <button
            type="button"
            className={`prefs-toggle ${prefs.showTimestamps ? "is-on" : ""}`}
            onClick={() => onChange({ showTimestamps: !prefs.showTimestamps })}
          >
            <span className="prefs-toggle-thumb" />
          </button>
        </div>

        <div className="prefs-row">
          <div className="prefs-label">Accent</div>
          <div className="prefs-swatches">
            {ACCENT_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`prefs-swatch ${prefs.accent === c ? "is-active" : ""}`}
                style={{ background: c }}
                onClick={() => onChange({ accent: c })}
                title={c}
              />
            ))}
            <input
              type="color"
              className="prefs-swatch prefs-swatch-custom"
              value={prefs.accent}
              onChange={(e) => onChange({ accent: e.target.value })}
              title="Custom color"
            />
          </div>
        </div>

        <div className="prefs-row">
          <div className="prefs-label">Focus mode</div>
          <button
            type="button"
            className={`prefs-toggle ${prefs.focusMode ? "is-on" : ""}`}
            onClick={() => onChange({ focusMode: !prefs.focusMode })}
          >
            <span className="prefs-toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="prefs-footer">
        <button type="button" className="prefs-reset" onClick={onReset}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
};

const Notion = () => {
  const [blockId, setBlockId] = useState();
  const [items, setItems] = useState([]);
  const [newContent, setNewContent] = useState({});
  const editTextareaRefs = useRef({});
  const [apiAvailable, setApiAvailable] = useState(true);
  const [loadingImage, setLoadingImage] = useState(null);
  const [loadingItems, setLoadingItems] = useState(true);

  // View preferences (theme, density, font, etc.) — persisted locally
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showPrefs, setShowPrefs] = useState(false);
  const updatePref = (patch) => setPrefs((p) => ({ ...p, ...patch }));
  useEffect(() => {
    try {
      localStorage.setItem("notion.prefs", JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  // Canvas mode positions (free-floating blocks) — persisted in localStorage
  const [canvasPositions, setCanvasPositions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("notion.canvasPositions") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("notion.canvasPositions", JSON.stringify(canvasPositions));
    } catch {
      /* ignore */
    }
  }, [canvasPositions]);
  const updateCanvasPos = useCallback((id, patch) => {
    setCanvasPositions((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }, []);
  const getCanvasPos = useCallback(
    (id, fallbackIndex = 0) => {
      const p = canvasPositions[id];
      if (p) return p;
      // Spiral default layout for new blocks
      const col = fallbackIndex % 3;
      const row = Math.floor(fallbackIndex / 3);
      return {
        x: 40 + col * 320,
        y: 40 + row * 240,
        w: 280,
        h: 180,
      };
    },
    [canvasPositions]
  );

  // Slideshow mode — current slide index
  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => {
    if (prefs.layout !== "slideshow") return;
    const handler = (e) => {
      // Avoid intercepting typing in textareas
      if (e.target?.tagName === "TEXTAREA" || e.target?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setSlideIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setSlideIndex((i) => Math.max(i - 1, 0));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [prefs.layout, items.length]);

  // Clamp slide index when items change
  useEffect(() => {
    if (slideIndex >= items.length) setSlideIndex(Math.max(0, items.length - 1));
  }, [items.length, slideIndex]);

  const pageStyleVars = useMemo(
    () => ({
      "--notion-accent": prefs.accent,
      "--notion-font": FONT_STACKS[prefs.font] || FONT_STACKS.sans,
    }),
    [prefs.accent, prefs.font]
  );

  const pageClass = [
    "notion-page",
    `density-${prefs.density}`,
    `width-${prefs.width}`,
    `theme-${prefs.theme}`,
    `font-${prefs.font}`,
    `size-${prefs.fontSize}`,
    `bg-${prefs.background}`,
    `layout-${prefs.layout}`,
    prefs.focusMode ? "is-focus-mode" : "",
    prefs.showOutline ? "has-outline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const jumpToBlock = useCallback((id) => {
    const el = document.querySelector(`[data-block-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const textarea = editTextareaRefs.current[id];
      if (textarea) setTimeout(() => textarea.focus(), 350);
    }
  }, []);

  // Slash menu state
  const [slashMenuFor, setSlashMenuFor] = useState(null);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const filteredSlashLength = useMemo(() => {
    const q = slashQuery.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS.length;
    return SLASH_COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q)
    ).length;
  }, [slashQuery]);

  const checkApiConnection = async () => {
    try {
      await axiosInstance.get("/api/HealthCheck/health-check");
      return true;
    } catch (error) {
      message.error("Failed connect server");
      return false;
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      const available = await checkApiConnection();
      setApiAvailable(available);
    };
    checkConnection();
  }, []);

  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const response = await axiosInstance.get("/api/Items");
      setItems(response.data);
    } catch (error) {
      console.error("Error fetching items:", error);
      message.error("Error fetching items", 1);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (!loadingItems && items.length === 0) {
      const newBlockId = generateRandomId();
      setItems([
        {
          id: newBlockId,
          placeholder: "Press '/' for commands, or just type…",
          heading: "",
          order: 0,
        },
      ]);
      setBlockId(newBlockId);
    }
  }, [items, loadingItems]);

  useEffect(() => {
    if (blockId) {
      const newTextarea = editTextareaRefs.current[blockId];
      // preventScroll keeps focusing a freshly-created block from yanking the
      // page down — the block is brought into view explicitly when needed.
      if (newTextarea) newTextarea.focus({ preventScroll: true });
    }
  }, [blockId]);

  // Items are fetched async after mount, so the page height grows over time.
  // The browser's automatic scroll restoration then lands at the wrong spot
  // (usually the bottom) once content fills in. Disable it for this page and
  // pin the window to the top right after the first batch of items renders.
  useEffect(() => {
    const prevRestoration = window.history.scrollRestoration;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    return () => {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = prevRestoration || "auto";
      }
    };
  }, []);

  const didInitialScrollReset = useRef(false);
  useEffect(() => {
    if (loadingItems || didInitialScrollReset.current) return;
    didInitialScrollReset.current = true;
    // Wait a frame so layout settles, then start at the top.
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, [loadingItems]);

  useEffect(() => {
    fetchItems();
  }, []);

  const addItem = (id) => {
    const newBlockId = generateRandomId();
    let index;
    if (id) {
      index = items.findIndex((item) => item.id === id) + 1;
    } else {
      index = 0;
    }
    const newItem = {
      id: newBlockId,
      heading: "",
      code: "",
      order: index,
    };
    const newItems = [...items];
    newItems.splice(index, 0, newItem);
    setItems(newItems.map((item, idx) => ({ ...item, order: idx })));
    setBlockId(newBlockId);
    setTimeout(() => {
      editTextareaRefs.current[newBlockId]?.focus();
    }, 0);
  };


  const onDragEnd = (result) => {
    if (!result.destination) return;
    const scrollY = window.scrollY;
    const sel = selectedIdsRef.current;
    const draggedId = result.draggableId;

    let updatedItems;
    // If the dragged block is part of a multi-selection, move the whole group
    // (preserving their relative order) to the drop position.
    if (sel.size > 1 && sel.has(draggedId)) {
      const moving = items.filter((it) => sel.has(it.id));
      const rest = items.filter((it) => !sel.has(it.id));
      // Where the drop lands among the non-selected blocks.
      const destItem = items[result.destination.index];
      let insertAt = rest.findIndex((it) => it.id === destItem?.id);
      if (insertAt === -1) insertAt = rest.length;
      // Dropping below its original spot should land after the target block.
      if (result.destination.index > result.source.index) insertAt += 1;
      const merged = [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)];
      updatedItems = merged.map((item, index) => ({ ...item, order: index }));
    } else {
      const reorderedItems = reorder(
        items,
        result.source.index,
        result.destination.index
      );
      updatedItems = reorderedItems.map((item, index) => ({ ...item, order: index }));
    }

    setItems(() => {
      saveItems(updatedItems, true);
      return updatedItems;
    });
    window.scrollTo(0, scrollY);
  };

  // Close slash menu when clicking outside
  useEffect(() => {
    const handler = (event) => {
      if (!slashMenuFor) return;
      const isInsideMenu = event.target.closest(".slash-menu");
      const isInsideTextarea = event.target.closest("textarea");
      if (!isInsideMenu && !isInsideTextarea) {
        closeSlashMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [slashMenuFor]);

  const closeSlashMenu = () => {
    setSlashMenuFor(null);
    setSlashQuery("");
    setSlashSelectedIndex(0);
  };

  // Open the slash command menu for a block — reused by the drag handle and by
  // right-click (so a context menu shows the same "/" suggestions).
  const openSlashMenuFor = useCallback((id) => {
    setSlashMenuFor(id);
    setSlashQuery("");
    setSlashSelectedIndex(0);
    editTextareaRefs.current[id]?.focus({ preventScroll: true });
  }, []);

  // ── Multi-select (marquee) ──────────────────────────────────────────
  // Set of block ids the user has lassoed. Empty = nothing selected.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Live marquee rectangle in viewport coords while dragging on empty space.
  const [marquee, setMarquee] = useState(null);
  const marqueeStateRef = useRef(null);

  // Delete every currently-selected block in one go.
  const deleteSelected = useCallback(async () => {
    const ids = selectedIdsRef.current;
    if (!ids.size) return;
    const toDelete = [...ids];
    setItems((prev) =>
      prev.filter((it) => !ids.has(it.id)).map((it, idx) => ({ ...it, order: idx }))
    );
    clearSelection();
    await Promise.all(toDelete.map((id) => deleteItem(id, false)));
    message.success(`Deleted ${toDelete.length} block(s)`, 0.6);
  }, [clearSelection]);

  // Marquee select: drag on blank canvas to lasso blocks. Ignores drags that
  // start on an interactive element (text, button, drag handle, etc.).
  useEffect(() => {
    const isBlankTarget = (target) =>
      !target.closest(
        "textarea, input, button, a, .block-controls, .slash-menu, " +
          ".notion-minimap, .notion-prefs-fab, .notion-prefs-panel, " +
          ".notion-block-context, .ant-image, .file-block, .draggable-item"
      );

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      const page = e.target.closest(".notion-page");
      if (!page) return;
      if (!isBlankTarget(e.target)) return;

      marqueeStateRef.current = {
        x0: e.clientX,
        y0: e.clientY,
        additive: e.shiftKey || e.metaKey || e.ctrlKey,
        base: e.shiftKey || e.metaKey || e.ctrlKey ? new Set(selectedIdsRef.current) : new Set(),
        moved: false,
      };
    };

    const onMouseMove = (e) => {
      const st = marqueeStateRef.current;
      if (!st) return;
      const dx = Math.abs(e.clientX - st.x0);
      const dy = Math.abs(e.clientY - st.y0);
      if (!st.moved && dx < 4 && dy < 4) return; // ignore tiny jitters / plain clicks
      st.moved = true;

      const rect = {
        left: Math.min(st.x0, e.clientX),
        top: Math.min(st.y0, e.clientY),
        right: Math.max(st.x0, e.clientX),
        bottom: Math.max(st.y0, e.clientY),
      };
      setMarquee(rect);

      const hit = new Set(st.base);
      document.querySelectorAll("[data-block-id]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const intersects =
          r.left < rect.right &&
          r.right > rect.left &&
          r.top < rect.bottom &&
          r.bottom > rect.top;
        if (intersects) hit.add(el.getAttribute("data-block-id"));
      });
      setSelectedIds(hit);
    };

    const onMouseUp = () => {
      const st = marqueeStateRef.current;
      marqueeStateRef.current = null;
      setMarquee(null);
      // A plain click on blank space (no drag) clears the selection.
      if (st && !st.moved && !st.additive) clearSelection();
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [clearSelection]);

  // Delete / Backspace removes the marquee selection (when not typing).
  useEffect(() => {
    const onKey = (e) => {
      if (!selectedIdsRef.current.size) return;
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        clearSelection();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteSelected, clearSelection]);

  const saveNewItems = async (heading, id) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, heading: heading === "text" ? "" : heading } : item
    );
    setItems(updatedItems);
    await saveItems(updatedItems, false);
  };

  const editingItemIdRef = useRef(null);

  const handleFileChange = async (e) => {
    const id = editingItemIdRef.current;
    setLoadingImage(id);
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("files", file);

    try {
      const response = await axiosInstance.post("/api/files/upload/cloudinary", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fileData = response.data[0];
      const fileUrl = fileData.cloudUrl;
      if (id) {
        if (file.type.startsWith("image/")) {
          responseDataImage({ data: { url: fileUrl } }, e, id);
        } else {
          handleChangeContent(id, fileUrl);
        }
      } else {
        const newBlockId = generateRandomId();
        const newItem = {
          id: newBlockId,
          heading: "",
          code: "",
          order: items.length,
          content: fileUrl,
        };
        const updatedItems = [...items, newItem];
        setItems(updatedItems);
        saveItems(updatedItems, false);
      }
      setLoadingImage(null);
    } catch (error) {
      console.error("Error uploading file:", error);
      setLoadingImage(null);
      message.error("Failed to upload file");
    }
  };

  const responseDataImage = (response, e, id) => {
    const data = response.data;
    const currentContent =
      newContent[id] || items.find((item) => item.id === id)?.content || "";
    const cursorPosition = e.target?.selectionStart ?? currentContent.length;
    const beforeCursor = currentContent.substring(0, cursorPosition);
    const newContentWithImage = `${beforeCursor}${data.url}`;
    handleChangeContent(id, newContentWithImage);
  };

  const isFileDrag = (e) => {
    const types = e?.dataTransfer?.types;
    if (!types) return false;
    if (typeof types.includes === "function") return types.includes("Files");
    for (let i = 0; i < types.length; i++) if (types[i] === "Files") return true;
    return false;
  };

  const handleGlobalDrop = async (e) => {
    if (!isFileDrag(e)) return; // let react-beautiful-dnd own non-file drags
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("files", file);
        const newBlockId = generateRandomId();
        setItems((prev) => [
          ...prev,
          { id: newBlockId, heading: "", code: "", order: prev.length, content: "" },
        ]);
        setLoadingImage(newBlockId);
        try {
          const response = await axiosInstance.post("/api/files/upload/cloudinary", formData);
          const fileData = response.data[0];
          const fileUrl = fileData.cloudUrl;
          setItems((prevItems) => {
            const updated = prevItems.map((item) =>
              item.id === newBlockId ? { ...item, content: fileUrl } : item
            );
            saveItems(updated, false);
            return updated;
          });
        } catch (error) {
          console.error("Error uploading dropped file:", error);
          setItems((prev) => prev.filter((item) => item.id !== newBlockId));
          message.error("Failed to upload dropped file");
        } finally {
          setLoadingImage(null);
        }
      }
    }
  };

  const handleGlobalDragOver = (e) => {
    if (isFileDrag(e)) e.preventDefault();
  };

  const fileInputRef = useRef(null);

  const executeSlashCommand = async (cmd, id) => {
    editingItemIdRef.current = id;
    const scrollY = window.scrollY;
    closeSlashMenu();

    if (cmd.key === "choose-image") {
      fileInputRef.current.accept = "image/*";
      fileInputRef.current.click();
    } else if (cmd.key === "choose-file") {
      fileInputRef.current.accept = "*/*";
      fileInputRef.current.click();
    } else if (cmd.key === "delete") {
      setItems((prev) => prev.filter((item) => item.id !== id));
      await deleteItem(id, true);
    } else {
      saveNewItems(cmd.key, id);
    }
    window.scrollTo(0, scrollY);
  };

  const applyHeadingFormat = async (id, heading) => {
    saveNewItems(heading, id);
  };

  const handleKeyDown = async (e, id) => {
    // Slash menu navigation has priority when it's open for this block
    if (slashMenuFor === id) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashSelectedIndex((i) => Math.min(i + 1, filteredSlashLength - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const q = slashQuery.trim().toLowerCase();
        const list = q
          ? SLASH_COMMANDS.filter(
              (c) =>
                c.label.toLowerCase().includes(q) ||
                c.desc.toLowerCase().includes(q) ||
                c.key.toLowerCase().includes(q)
            )
          : SLASH_COMMANDS;
        const target = list[slashSelectedIndex];
        if (target) executeSlashCommand(target, id);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeSlashMenu();
        return;
      }
      if (e.key === "Backspace") {
        if (slashQuery.length === 0) {
          closeSlashMenu();
          return;
        }
        setSlashQuery((q) => q.slice(0, -1));
        setSlashSelectedIndex(0);
        e.preventDefault();
        return;
      }
      if (e.key.length === 1) {
        setSlashQuery((q) => q + e.key);
        setSlashSelectedIndex(0);
        e.preventDefault();
        return;
      }
    }

    if (e.key === "/") {
      e.preventDefault();
      setSlashMenuFor(id);
      setSlashQuery("");
      setSlashSelectedIndex(0);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addItem(id);
      if (apiAvailable) {
        await saveItems(items, false);
      }
    } else if (e.key === "Backspace") {
      const currentItemIndex = items.findIndex((item) => item.id === id);
      const currentItem = items[currentItemIndex];
      if (
        currentItem &&
        (!newContent[id] || !newContent[id].trim()) &&
        (!currentItem.content || !currentItem.content.trim())
      ) {
        e.preventDefault();
        const updatedItems = items.filter((item) => item.id !== id);
        setItems(updatedItems);
        if (apiAvailable) {
          deleteItemDebounced(id);
        }
        if (updatedItems.length === 0) {
          const newBlockId = generateRandomId();
          setItems([
            {
              id: newBlockId,
              placeholder: "Press '/' for commands, or just type…",
              heading: "",
              code: "",
              order: 0,
            },
          ]);
          setBlockId(newBlockId);
          setTimeout(() => {
            editTextareaRefs.current[newBlockId]?.focus();
          }, 0);
        } else if (currentItemIndex > 0) {
          const previousItemId = updatedItems[currentItemIndex - 1].id;
          setTimeout(() => {
            const previousTextarea = editTextareaRefs.current[previousItemId];
            if (previousTextarea) {
              previousTextarea.focus();
              previousTextarea.setSelectionRange(
                previousTextarea.value.length,
                previousTextarea.value.length
              );
            }
          }, 0);
        }
      }
    }
  };

  const handleKeyDownGlobal = async (e) => {
    if (!e.ctrlKey) return;
    const id = slashMenuFor;
    if (!id) return;
    if (e.key === "1") {
      e.preventDefault();
      await applyHeadingFormat(id, "heading-1");
      closeSlashMenu();
    } else if (e.key === "2") {
      e.preventDefault();
      await applyHeadingFormat(id, "heading-2");
      closeSlashMenu();
    } else if (e.key === "3") {
      e.preventDefault();
      await applyHeadingFormat(id, "heading-3");
      closeSlashMenu();
    } else if (e.key === "4") {
      e.preventDefault();
      await applyHeadingFormat(id, "heading-4");
      closeSlashMenu();
    } else if (e.key === "d") {
      e.preventDefault();
      setItems((prev) => prev.filter((item) => item.id !== id));
      await deleteItem(id, true);
      closeSlashMenu();
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDownGlobal);
    return () => document.removeEventListener("keydown", handleKeyDownGlobal);
  }, [slashMenuFor]);

  const deleteItem = async (id, noti) => {
    try {
      await axiosInstance.delete(`/api/Items/delete-item/${id}`);
      if (noti) message.success("Deleted", 0.5);
      return true;
    } catch (error) {
      if (noti) message.error("Error deleting item", 0.5);
      return false;
    }
  };

  const deleteItemDebounced = useCallback(
    debounce(async (id) => {
      if (apiAvailable) await deleteItem(id, false);
    }, 500),
    [apiAvailable]
  );

  const saveItems = async (updatedItems, showNoti) => {
    if (!apiAvailable) return;
    try {
      await axiosInstance.post("/api/Items/bulk", updatedItems);
    } catch (error) {
      console.error("Error saving items:", error);
      if (showNoti) message.error("Error saving items", 1);
    }
  };

  const saveItemsDebounced = useCallback(
    debounce(async (updatedItems) => {
      await saveItems(updatedItems, false);
    }, 1000),
    []
  );

  const handleChangeContent = useCallback(
    (id, value) => {
      setNewContent((prev) => ({ ...prev, [id]: value }));
      const updatedItems = items.map((item) =>
        item.id === id ? { ...item, content: value } : item
      );
      setItems(updatedItems);
      saveItemsDebounced(updatedItems);
    },
    [items, setNewContent, setItems, saveItemsDebounced]
  );

  const uploadFileAndInsert = async (file, targetId, isNewBlock) => {
    setLoadingImage(targetId);
    const formData = new FormData();
    formData.append("files", file);
    try {
      const response = await axiosInstance.post("/api/files/upload/cloudinary", formData);
      const fileData = response.data[0];
      const fileUrl = fileData.cloudUrl;
      setItems((prevItems) => {
        const updated = prevItems.map((it) =>
          it.id === targetId ? { ...it, content: fileUrl } : it
        );
        saveItems(updated, false);
        return updated;
      });
    } catch (error) {
      console.error("Error uploading pasted file:", error);
      if (isNewBlock) setItems((prev) => prev.filter((it) => it.id !== targetId));
      message.error("Failed to upload pasted file");
    } finally {
      setLoadingImage(null);
    }
  };

  const handlePaste = async (e, id) => {
    const clipboardItems = e.clipboardData.items;
    for (let i = 0; i < clipboardItems.length; i++) {
      const clipItem = clipboardItems[i];
      if (clipItem.kind !== "file") continue;
      const file = clipItem.getAsFile();
      if (!file) continue;

      e.preventDefault();

      const currentContent =
        newContent[id] || items.find((it) => it.id === id)?.content || "";
      const hasContent = currentContent.trim().length > 0;

      if (hasContent) {
        const insertIndex = items.findIndex((it) => it.id === id) + 1;
        const newBlockId = generateRandomId();
        setItems((prev) => {
          const arr = [...prev];
          arr.splice(insertIndex, 0, {
            id: newBlockId,
            heading: "",
            code: "",
            order: insertIndex,
            content: "",
          });
          return arr.map((it, idx) => ({ ...it, order: idx }));
        });
        await uploadFileAndInsert(file, newBlockId, true);
      } else {
        await uploadFileAndInsert(file, id, false);
      }
      return;
    }
  };

  const handleGlobalPaste = async (e) => {
    if (document.activeElement?.tagName === "TEXTAREA") return;
    const clipboardItems = e.clipboardData.items;
    for (let i = 0; i < clipboardItems.length; i++) {
      const clipItem = clipboardItems[i];
      if (clipItem.kind !== "file") continue;
      const file = clipItem.getAsFile();
      if (!file) continue;

      e.preventDefault();
      const newBlockId = generateRandomId();
      setItems((prev) => [
        ...prev,
        { id: newBlockId, heading: "", code: "", order: prev.length, content: "" },
      ]);
      await uploadFileAndInsert(file, newBlockId, true);
      return;
    }
  };

  const onDownload = async (url, fileName = "file", savedName = "", cloudUrl = "") => {
    try {
      await downloadFile(savedName || fileName, fileName, cloudUrl || url);
    } catch (error) {
      console.error("Error downloading file:", error);
      message.error("Failed to download file");
    }
  };

  // Keep the latest handler closures in a ref so the object handed to every
  // NotionBlock stays referentially stable. That lets React.memo skip blocks
  // that didn't change — typing in one block no longer re-renders the rest.
  const cbRef = useRef({});
  cbRef.current = {
    handleChangeContent,
    handleKeyDown,
    handlePaste,
    executeSlashCommand,
    closeSlashMenu,
    onDownload,
  };
  const blockHandlers = useMemo(
    () => ({
      onChange: (id, v) => cbRef.current.handleChangeContent(id, v),
      onKeyDown: (e, id) => cbRef.current.handleKeyDown(e, id),
      onPaste: (e, id) => cbRef.current.handlePaste(e, id),
      onSelectSlash: (cmd, id) => cbRef.current.executeSlashCommand(cmd, id),
      onCloseSlash: () => cbRef.current.closeSlashMenu(),
      onDownload: (...a) => cbRef.current.onDownload(...a),
      registerRef: (id, el) => {
        if (el) editTextareaRefs.current[id] = el;
        else delete editTextareaRefs.current[id];
      },
    }),
    []
  );

  // Build the props NotionBlock needs for a given item, keeping slash-menu
  // state scoped to the active block so siblings receive stable primitives.
  const blockProps = (item, collapsible) => ({
    item,
    value: newContent[item.id] || item.content || "",
    isLoading: loadingImage === item.id,
    showTimestamps: prefs.showTimestamps,
    collapsible,
    slashOpen: slashMenuFor === item.id,
    slashQuery: slashMenuFor === item.id ? slashQuery : "",
    slashSelectedIndex: slashMenuFor === item.id ? slashSelectedIndex : 0,
    handlers: blockHandlers,
  });

  return (
    <>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className={`notion-prefs-fab ${showPrefs ? "is-open" : ""}`}
        onClick={() => setShowPrefs((v) => !v)}
        title="View settings"
      >
        {showPrefs ? <CloseOutlined /> : <SettingOutlined />}
      </button>
      {showPrefs && (
        <NotionPrefsPanel
          prefs={prefs}
          onChange={updatePref}
          onReset={() => setPrefs(DEFAULT_PREFS)}
          onClose={() => setShowPrefs(false)}
        />
      )}
      {prefs.showOutline && !loadingItems && (
        <OutlineSidebar
          items={items}
          newContent={newContent}
          onJump={jumpToBlock}
          onClose={() => updatePref({ showOutline: false })}
        />
      )}
      {!loadingItems &&
        items.length > 0 &&
        (!prefs.layout ||
          prefs.layout === "document" ||
          prefs.layout === "columns2" ||
          prefs.layout === "columns3") && (
          <Minimap items={items} selectedIds={selectedIds} onJump={jumpToBlock} />
        )}
      {marquee && (
        <div
          className="notion-marquee"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.right - marquee.left,
            height: marquee.bottom - marquee.top,
          }}
        />
      )}
      {selectedIds.size > 0 && (
        <div className="notion-selection-bar">
          <span className="selection-count">{selectedIds.size} selected</span>
          <button
            type="button"
            className="selection-btn danger"
            onClick={deleteSelected}
          >
            <DeleteOutlined /> Delete
          </button>
          <button type="button" className="selection-btn" onClick={clearSelection}>
            Clear
          </button>
        </div>
      )}
      <div
        className={pageClass}
        style={pageStyleVars}
        onDrop={handleGlobalDrop}
        onDragOver={handleGlobalDragOver}
        onPaste={handleGlobalPaste}
      >
        {loadingItems ? (
          <ul className="droppable-list">
            {[0, 1, 2].map((i) => (
              <li className="draggable-item" key={`sk-${i}`}>
                <div className="container-block">
                  <div className="skeleton-block" />
                </div>
              </li>
            ))}
          </ul>
        ) : prefs.layout === "canvas" ? (
          <div className="notion-canvas">
            {items.map((item, idx) => {
              const pos = getCanvasPos(item.id, idx);
              return (
                <Rnd
                  key={item.id}
                  size={{ width: pos.w, height: pos.h }}
                  position={{ x: pos.x, y: pos.y }}
                  bounds="parent"
                  minWidth={180}
                  minHeight={80}
                  dragHandleClassName="canvas-block-handle"
                  onDragStop={(e, d) =>
                    updateCanvasPos(item.id, { x: Math.max(0, d.x), y: Math.max(0, d.y) })
                  }
                  onResizeStop={(e, dir, ref, delta, p) =>
                    updateCanvasPos(item.id, {
                      w: parseInt(ref.style.width, 10),
                      h: parseInt(ref.style.height, 10),
                      x: Math.max(0, p.x),
                      y: Math.max(0, p.y),
                    })
                  }
                  className="canvas-block"
                >
                  <div className="canvas-block-handle" title="Drag to move">
                    <HolderOutlined />
                    <div className="canvas-block-tools">
                      <button
                        type="button"
                        className="canvas-tool-btn"
                        onClick={() => {
                          setSlashMenuFor(item.id);
                          setSlashQuery("");
                          setSlashSelectedIndex(0);
                          editTextareaRefs.current[item.id]?.focus();
                        }}
                        title="Block actions"
                      >
                        ⋯
                      </button>
                      <button
                        type="button"
                        className="canvas-tool-btn danger"
                        onClick={async () => {
                          setItems((prev) => prev.filter((it) => it.id !== item.id));
                          await deleteItem(item.id, true);
                        }}
                        title="Delete block"
                      >
                        <CloseOutlined />
                      </button>
                    </div>
                  </div>
                  <div className="container-block canvas-content">
                    <NotionBlock {...blockProps(item, false)} />
                  </div>
                </Rnd>
              );
            })}
            <button
              type="button"
              className="canvas-add-fab"
              onClick={() => addItem()}
              title="Add block"
            >
              <PlusOutlined />
            </button>
          </div>
        ) : prefs.layout === "slideshow" ? (
          <div className="notion-slideshow">
            {items.length > 0 && items[slideIndex] && (
              <div className="slide-stage">
                <div className="slide-frame">
                  <div className="container-block">
                    <NotionBlock {...blockProps(items[slideIndex], false)} />
                  </div>
                </div>
                <div className="slide-controls">
                  <button
                    type="button"
                    className="slide-nav"
                    onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                    disabled={slideIndex === 0}
                  >
                    ← Prev
                  </button>
                  <span className="slide-counter">
                    {slideIndex + 1} / {items.length}
                  </span>
                  <button
                    type="button"
                    className="slide-nav"
                    onClick={() => setSlideIndex((i) => Math.min(items.length - 1, i + 1))}
                    disabled={slideIndex >= items.length - 1}
                  >
                    Next →
                  </button>
                </div>
                <div className="slide-hint">
                  <kbd>←</kbd> <kbd>→</kbd> or <kbd>Space</kbd> to navigate
                </div>
              </div>
            )}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="droppable">
              {(provided) => (
                <ul
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="droppable-list"
                >
                  <li className="draggable-item ghost-add-item">
                    <div className="container-block">
                      <button
                        type="button"
                        className="ghost-add-btn"
                        onClick={() => addItem()}
                      >
                        <PlusOutlined />
                        <span>Add a block — or just press Enter inside one</span>
                      </button>
                    </div>
                  </li>
                  {items.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          data-block-id={item.id}
                          className={`draggable-item ${
                            selectedIds.has(item.id) ? "is-selected" : ""
                          }`}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            openSlashMenuFor(item.id);
                          }}
                        >
                          <div className="block-controls">
                            <Tooltip title="Click to add block below" placement="left">
                              <button
                                type="button"
                                className="block-control-btn"
                                onClick={() => addItem(item.id)}
                              >
                                <PlusOutlined />
                              </button>
                            </Tooltip>
                            <Tooltip
                              title="Drag to reorder · Click for actions"
                              placement="left"
                            >
                              <span
                                {...provided.dragHandleProps}
                                className="block-control-btn drag-handle"
                                onClick={() => openSlashMenuFor(item.id)}
                              >
                                <HolderOutlined />
                              </span>
                            </Tooltip>
                          </div>

                          <div className="container-block">
                            <LazyBlock {...blockProps(item, true)} />
                          </div>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </>
  );
};

export default Notion;
