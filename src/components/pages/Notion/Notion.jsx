import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Space, Tooltip, message, Spin, Image } from "antd";
import {
  DownloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  PlusOutlined,
  FontSizeOutlined,
  CodeOutlined,
  FileImageOutlined,
  FileTextOutlined,
  DeleteOutlined,
  FileOutlined,
  HolderOutlined,
  SettingOutlined,
  BgColorsOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import "./Notion.scss";
import { v4 as uuidv4 } from "uuid";
import axiosInstance from "../../../axiosConfig";
import debounce from "lodash.debounce";

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
  accent: "#3b82f6",        // any hex
  focusMode: false,         // hides controls + ghost-add
  layout: "single",         // single | columns2 | columns3
  showOutline: false,       // outline (TOC) sidebar visibility
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

// ── Slash command catalog (Notion-style) ─────────────────────────────
const SLASH_COMMANDS = [
  {
    key: "heading-1",
    label: "Heading 1",
    desc: "Big section heading",
    hint: "Ctrl 1",
    icon: <span className="slash-icon-text">H1</span>,
    type: "heading",
  },
  {
    key: "heading-2",
    label: "Heading 2",
    desc: "Medium section heading",
    hint: "Ctrl 2",
    icon: <span className="slash-icon-text">H2</span>,
    type: "heading",
  },
  {
    key: "heading-3",
    label: "Heading 3",
    desc: "Small section heading",
    hint: "Ctrl 3",
    icon: <span className="slash-icon-text">H3</span>,
    type: "heading",
  },
  {
    key: "heading-4",
    label: "Code block",
    desc: "Capture a code snippet",
    hint: "Ctrl 4",
    icon: <CodeOutlined />,
    type: "heading",
  },
  {
    key: "text",
    label: "Plain text",
    desc: "Reset to a regular text block",
    icon: <FontSizeOutlined />,
    type: "heading",
  },
  {
    key: "choose-image",
    label: "Image",
    desc: "Upload or embed an image",
    icon: <FileImageOutlined />,
    type: "action",
  },
  {
    key: "choose-file",
    label: "File",
    desc: "Upload any file attachment",
    icon: <FileOutlined />,
    type: "action",
  },
  {
    key: "delete",
    label: "Delete block",
    desc: "Remove this block",
    hint: "Ctrl D",
    icon: <DeleteOutlined />,
    type: "action",
    danger: true,
  },
];

const SlashMenu = ({ query, selectedIndex, onSelect, onClose, anchorRef }) => {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q)
    );
  }, [query]);

  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return (
      <div className="slash-menu" role="listbox">
        <div className="slash-empty">No matches for &quot;{query}&quot;</div>
        <div className="slash-footer">esc to close</div>
      </div>
    );
  }

  return (
    <div className="slash-menu" role="listbox" ref={listRef}>
      <div className="slash-header">
        {query ? (
          <span>
            Filter: <strong>{query}</strong>
          </span>
        ) : (
          <span>Basic blocks</span>
        )}
      </div>
      <div className="slash-list">
        {filtered.map((cmd, idx) => (
          <button
            type="button"
            data-idx={idx}
            key={cmd.key}
            role="option"
            aria-selected={idx === selectedIndex}
            className={`slash-item ${idx === selectedIndex ? "is-selected" : ""} ${cmd.danger ? "is-danger" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(cmd);
            }}
          >
            <div className="slash-item-icon">{cmd.icon}</div>
            <div className="slash-item-body">
              <div className="slash-item-label">{cmd.label}</div>
              <div className="slash-item-desc">{cmd.desc}</div>
            </div>
            {cmd.hint && <kbd className="slash-item-hint">{cmd.hint}</kbd>}
          </button>
        ))}
      </div>
      <div className="slash-footer">
        <span>
          <kbd>↑↓</kbd> navigate
        </span>
        <span>
          <kbd>↵</kbd> select
        </span>
        <span>
          <kbd>esc</kbd> close
        </span>
      </div>
    </div>
  );
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
              className={`outline-item level-${h.level}`}
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
    <div className="notion-prefs-panel" onMouseDown={(e) => e.stopPropagation()}>
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
            { value: "single", label: "1 col" },
            { value: "columns2", label: "2 cols" },
            { value: "columns3", label: "3 cols" },
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
      if (newTextarea) newTextarea.focus();
    }
  }, [blockId]);

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

  useEffect(() => {
    Object.keys(editTextareaRefs.current).forEach((id) => {
      const textarea = editTextareaRefs.current[id];
      if (textarea) {
        textarea.style.height = "15px";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    });
  }, [items, newContent]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const scrollY = window.scrollY;
    const reorderedItems = reorder(
      items,
      result.source.index,
      result.destination.index
    );
    setItems(() => {
      const updatedItems = reorderedItems.map((item, index) => ({
        ...item,
        order: index,
      }));
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
      const response = await axiosInstance.post("/api/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fileData = response.data[0];
      const fileUrl = `${axiosInstance.defaults.baseURL}/api/files/download/${fileData.savedName}?name=${encodeURIComponent(fileData.originalName)}`;
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
          const response = await axiosInstance.post("/api/files/upload", formData);
          const fileData = response.data[0];
          const fileUrl = `${axiosInstance.defaults.baseURL}/api/files/download/${fileData.savedName}?name=${encodeURIComponent(fileData.originalName)}`;
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
      const response = await axiosInstance.post("/api/files/upload", formData);
      const fileData = response.data[0];
      const fileUrl = `${axiosInstance.defaults.baseURL}/api/files/download/${fileData.savedName}?name=${encodeURIComponent(fileData.originalName)}`;
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

  const onDownload = (imgUrl) => {
    fetch(imgUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const url = URL.createObjectURL(new Blob([blob]));
        const link = document.createElement("a");
        link.href = url;
        link.download = "image.png";
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(url);
        link.remove();
      });
  };

  const renderItemContent = (item) => {
    if (
      item.content &&
      item.content.match(/\.(jpeg|jpg|gif|png|webp|heic)$/i) != null
    ) {
      return (
        <div
          className="image-wrapper"
          onKeyDown={(e) => handleKeyDown(e, item.id)}
          tabIndex={0}
        >
          <Image
            width={220}
            src={item.content}
            preview={{
              toolbarRender: (
                _,
                {
                  image: { url },
                  transform: { scale },
                  actions: {
                    onFlipY,
                    onFlipX,
                    onRotateLeft,
                    onRotateRight,
                    onZoomOut,
                    onZoomIn,
                    onReset,
                  },
                }
              ) => (
                <Space size={12} className="toolbar-wrapper">
                  <DownloadOutlined onClick={() => onDownload(url)} />
                  <SwapOutlined rotate={90} onClick={onFlipY} />
                  <SwapOutlined onClick={onFlipX} />
                  <RotateLeftOutlined onClick={onRotateLeft} />
                  <RotateRightOutlined onClick={onRotateRight} />
                  <ZoomOutOutlined disabled={scale === 1} onClick={onZoomOut} />
                  <ZoomInOutlined disabled={scale === 50} onClick={onZoomIn} />
                  <UndoOutlined onClick={onReset} />
                </Space>
              ),
            }}
          />
        </div>
      );
    }
    if (typeof item.content === "string" && item.content.match(/\bhttps?:\/\/\S+/)) {
      if (item.content.includes("/api/files/download/")) {
        let fileName = "File";
        let fileExt = "file";
        try {
          const url = new URL(item.content);
          fileName = url.searchParams.get("name") || item.content.split("/").pop();
          fileExt = fileName.split(".").pop().toLowerCase();
        } catch (err) {
          fileName = item.content.split("/").pop();
          fileExt = fileName.split(".").pop().toLowerCase();
        }
        const getFileIcon = (ext) => {
          if (["zip", "rar", "7z"].includes(ext)) return "📦";
          if (["pdf", "doc", "docx", "txt"].includes(ext)) return "📑";
          if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
          if (["mp4", "mov", "avi"].includes(ext)) return "🎬";
          if (["mp3", "wav", "ogg"].includes(ext)) return "🎵";
          return "📄";
        };
        return (
          <div className="file-block">
            <div className="file-icon-box">{getFileIcon(fileExt)}</div>
            <div className="file-details">
              <span className="file-name">{fileName}</span>
              <span className="file-meta">{fileExt.toUpperCase()} · attachment</span>
            </div>
            <div className="file-actions">
              <a href={item.content} download className="download-btn">
                Download
              </a>
            </div>
          </div>
        );
      }
      return convertLinksToEmbedTags(item.content);
    }
  };

  const convertLinksToEmbedTags = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const embedRegex = /(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w\-]+)/g;
    const spotifyRegex = /(https?:\/\/open\.spotify\.com\/(?:track|album|playlist)\/[\w\-?=]+)/g;
    const imageRegex = /\.(jpg|jpeg|png|gif|bmp|webp)$/i;

    return (
      <div>
        {text.split(urlRegex).map((segment, index) => {
          if (embedRegex.test(segment)) {
            return (
              <div key={index} className="embed-container">
                <iframe
                  src={segment.replace("watch?v=", "embed/")}
                  frameBorder="0"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            );
          }
          if (spotifyRegex.test(segment)) {
            const spotifyEmbedUrl = segment.replace(
              /(https:\/\/open\.spotify\.com\/)/,
              "https://open.spotify.com/embed/"
            );
            return (
              <div key={index} className="spotify-container">
                <iframe
                  src={`${spotifyEmbedUrl}?utm_source=generator&theme=0`}
                  frameBorder="0"
                  allowFullScreen
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            );
          }
          if (imageRegex.test(segment)) {
            return (
              <div key={index} className="image-container">
                <img src={segment} alt="Embedded" />
              </div>
            );
          }
          if (urlRegex.test(segment)) {
            return (
              <div key={index} className="webpage-container">
                <iframe src={segment} frameBorder="0" title={`Webpage-${index}`} />
              </div>
            );
          }
          return <span key={index}>{segment}</span>;
        })}
      </div>
    );
  };

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
                          className="draggable-item"
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
                                onClick={() => {
                                  setSlashMenuFor(item.id);
                                  setSlashQuery("");
                                  setSlashSelectedIndex(0);
                                  editTextareaRefs.current[item.id]?.focus();
                                }}
                              >
                                <HolderOutlined />
                              </span>
                            </Tooltip>
                          </div>

                          <div className="container-block">
                            {renderItemContent(item) ? (
                              renderItemContent(item)
                            ) : (
                              <textarea
                                placeholder={
                                  item.placeholder ||
                                  "Press '/' for commands, or just type…"
                                }
                                value={newContent[item.id] || item.content || ""}
                                onChange={(e) =>
                                  handleChangeContent(item.id, e.target.value)
                                }
                                onKeyDown={(e) => handleKeyDown(e, item.id)}
                                onPaste={(e) => handlePaste(e, item.id)}
                                ref={(el) =>
                                  (editTextareaRefs.current[item.id] = el)
                                }
                                className={`edit-textarea ${
                                  item.heading ? `heading-${item.heading}` : ""
                                }`}
                              />
                            )}
                            {loadingImage === item.id && (
                              <div className="loading-overlay">
                                <Spin />
                              </div>
                            )}
                            {slashMenuFor === item.id && (
                              <div className="slash-menu-anchor">
                                <SlashMenu
                                  query={slashQuery}
                                  selectedIndex={slashSelectedIndex}
                                  onSelect={(cmd) => executeSlashCommand(cmd, item.id)}
                                  onClose={closeSlashMenu}
                                />
                              </div>
                            )}
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
