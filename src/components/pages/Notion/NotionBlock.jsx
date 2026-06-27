import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Space, Spin, Image } from "antd";
import {
  DownloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  CodeOutlined,
  FontSizeOutlined,
  FileImageOutlined,
  FileOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

// Blocks taller than this (px) get clamped with a "Show more" toggle while not
// being edited, so a long page stays scannable instead of forcing the reader to
// scroll past every oversized block.
const CLAMP_PX = 360;

const isHtmlFileUrl = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/\.html?($|[?#])/i.test(trimmed)) return true;
  if (/^data:text\/html[;,]/i.test(trimmed)) return true;
  return false;
};

const HtmlPreview = ({ url, title = "HTML preview" }) => {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setHtml("");
    setError("");

    if (!url) {
      setError("No HTML source");
      return () => {};
    }

    if (/^data:text\/html[;,]/i.test(url)) {
      const commaIndex = url.indexOf(",");
      const raw = commaIndex >= 0 ? url.slice(commaIndex + 1) : "";
      const decoded = url.includes(";base64,")
        ? atob(raw)
        : decodeURIComponent(raw);
      if (!cancelled) setHtml(decoded);
      return () => {
        cancelled = true;
      };
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setHtml(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load HTML");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="html-preview-container">
      {error ? (
        <div className="html-preview-error">{error}</div>
      ) : (
        <iframe
          title={title}
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
};

// ── Slash command catalog (Notion-style) ─────────────────────────────
export const SLASH_COMMANDS = [
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

const filterSlash = (query) => {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.key.toLowerCase().includes(q)
  );
};

const SlashMenu = ({ query, selectedIndex, onSelect }) => {
  const filtered = useMemo(() => filterSlash(query), [query]);
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

// Format an ISO/string date into a short relative-or-absolute label.
const fmtTime = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  const diff = now - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// File extensions that must NOT be dropped into an <iframe>. Cloudinary (and most
// backends) serve these raw files with `Content-Disposition: attachment`, so an
// iframe pointing at them triggers an automatic download on every render and shows
// nothing — exactly the "blank box + auto-download" bug. Render a download card
// for these instead.
const DOWNLOADABLE_EXTENSIONS = [
  "xls", "xlsx", "csv",
  "doc", "docx", "ppt", "pptx",
  "zip", "rar", "7z", "tar", "gz",
  "mp3", "wav", "ogg", "flac",
  "mp4", "mov", "avi", "mkv",
];

const getFileIcon = (ext) => {
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "📦";
  if (["pdf", "doc", "docx", "txt"].includes(ext)) return "📑";
  if (["ppt", "pptx"].includes(ext)) return "📽️";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "🎬";
  if (["mp3", "wav", "ogg", "flac"].includes(ext)) return "🎵";
  return "📄";
};

// Pull a display name + lowercase extension out of any file URL (Cloudinary,
// backend download endpoint, …). Falls back gracefully on unparseable strings.
const describeFileUrl = (content) => {
  let fileName = "File";
  try {
    const url = new URL(content);
    fileName =
      url.searchParams.get("name") ||
      decodeURIComponent(url.pathname.split("/").pop() || "") ||
      content.split("/").pop();
  } catch {
    fileName = content.split("/").pop();
  }
  fileName = (fileName || "File").split("?")[0].split("#")[0] || "File";
  const fileExt = fileName.includes(".")
    ? fileName.split(".").pop().toLowerCase()
    : "file";
  return { fileName, fileExt };
};

const renderFileBlock = (item, handlers, attachment) => {
  const { fileName, fileExt } = describeFileUrl(item.content);
  return (
    <div className="file-block">
      <div className="file-icon-box">{getFileIcon(fileExt)}</div>
      <div className="file-details">
        <span className="file-name">{fileName}</span>
        <span className="file-meta">{fileExt.toUpperCase()} · attachment</span>
      </div>
      <div className="file-actions">
        <button
          type="button"
          className="download-btn"
          onClick={() =>
            handlers.onDownload(
              item.content,
              fileName,
              attachment?.savedName,
              attachment?.cloudUrl
            )
          }
        >
          Download
        </button>
      </div>
    </div>
  );
};

const convertLinksToEmbedTags = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const embedRegex = /(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+)/g;
  const spotifyRegex =
    /(https?:\/\/open\.spotify\.com\/(?:track|album|playlist)\/[\w?=-]+)/g;
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
              <img src={segment} alt="Embedded" loading="lazy" />
            </div>
          );
        }
        if (urlRegex.test(segment)) {
          return (
            <div key={index} className="webpage-container">
              <iframe
                src={segment}
                frameBorder="0"
                title={`Webpage-${index}`}
                loading="lazy"
              />
            </div>
          );
        }
        return <span key={index}>{segment}</span>;
      })}
    </div>
  );
};

// Render non-text content (image / html / file / embed) for a block.
const renderItemContent = (item, handlers) => {
  const attachment = (item.attachments || []).find(
    (att) => att.url === item.content
  );
  if (
    item.content &&
    item.content.match(/\.(jpeg|jpg|gif|png|webp|heic)$/i) != null
  ) {
    return (
      <div
        className="image-wrapper"
        onKeyDown={(e) => handlers.onKeyDown(e, item.id)}
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
                <DownloadOutlined onClick={() => handlers.onDownload(url)} />
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
  if (
    isHtmlFileUrl(item.content) ||
    attachment?.contentType?.includes("text/html") ||
    /\.html?($|[?#])/i.test(attachment?.originalName || "")
  ) {
    return (
      <div className="html-preview-shell">
        <HtmlPreview
          url={item.content}
          title={attachment?.originalName || "HTML preview"}
        />
        <div className="html-preview-actions">
          <button
            type="button"
            className="download-btn"
            onClick={() =>
              handlers.onDownload(
                item.content,
                attachment?.originalName || "preview.html",
                attachment?.savedName,
                attachment?.cloudUrl
              )
            }
          >
            Download
          </button>
        </div>
      </div>
    );
  }
  if (typeof item.content === "string" && item.content.match(/\bhttps?:\/\/\S+/)) {
    // Backend download endpoint, or any uploaded file whose type can't be safely
    // embedded (Excel, Word, archives, …). Render a download card instead of an
    // iframe — embedding these auto-downloads them on every render and shows blank.
    const { fileExt } = describeFileUrl(item.content);
    if (
      item.content.includes("/api/files/download/") ||
      DOWNLOADABLE_EXTENSIONS.includes(fileExt)
    ) {
      return renderFileBlock(item, handlers, attachment);
    }
    return convertLinksToEmbedTags(item.content);
  }
  return null;
};

const EXPANDED_KEY = "notion.expandedBlocks";

const isExpandedPersisted = (id) => {
  try {
    const arr = JSON.parse(localStorage.getItem(EXPANDED_KEY) || "[]");
    return Array.isArray(arr) && arr.includes(id);
  } catch {
    return false;
  }
};

const setExpandedPersisted = (id, value) => {
  try {
    const arr = JSON.parse(localStorage.getItem(EXPANDED_KEY) || "[]");
    const set = new Set(Array.isArray(arr) ? arr : []);
    if (value) set.add(id);
    else set.delete(id);
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
};

/**
 * A single editable Notion block. Memoised so typing inside one block never
 * re-renders its siblings — the parent passes stable handlers (via a ref) and
 * primitive props, so React.memo can bail out for every block except the one
 * actually changing.
 */
const NotionBlock = memo(function NotionBlock({
  item,
  value,
  isLoading,
  showTimestamps,
  collapsible,
  slashOpen,
  slashQuery,
  slashSelectedIndex,
  handlers,
}) {
  const textareaRef = useRef(null);
  const bodyRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(() => isExpandedPersisted(item.id));

  const setTextareaEl = useCallback(
    (el) => {
      textareaRef.current = el;
      handlers.registerRef(item.id, el);
    },
    [handlers, item.id]
  );

  // Auto-grow this textarea to fit its content — scoped to the block so a
  // keystroke no longer reflows every textarea on the page.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "15px";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);

  // Measure whether the rendered body is tall enough to warrant clamping.
  useLayoutEffect(() => {
    if (!collapsible) {
      setOverflowing(false);
      return;
    }
    const el = bodyRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > CLAMP_PX + 24);
  }, [value, collapsible, expanded, focused, item.content, item.heading]);

  const toggleExpand = useCallback(
    (next) => {
      setExpanded(next);
      setExpandedPersisted(item.id, next);
    },
    [item.id]
  );

  const content = renderItemContent(item, handlers);
  const clamped = collapsible && overflowing && !expanded && !focused;
  const showCollapse = collapsible && overflowing && expanded && !focused;

  const ts =
    showTimestamps && (item.createdAt || item.updatedAt) ? (
      <div className="block-timestamps">
        {item.createdAt && (
          <span title={new Date(item.createdAt).toLocaleString()}>
            Created {fmtTime(item.createdAt)}
          </span>
        )}
        {item.updatedAt && item.updatedAt !== item.createdAt && (
          <span title={new Date(item.updatedAt).toLocaleString()}>
            · Updated {fmtTime(item.updatedAt)}
          </span>
        )}
      </div>
    ) : null;

  return (
    <>
      <div
        ref={bodyRef}
        className={`block-collapsible${clamped ? " is-clamped" : ""}`}
      >
        {content ? (
          content
        ) : (
          <textarea
            placeholder={
              item.placeholder || "Press '/' for commands, or just type…"
            }
            value={value}
            onChange={(e) => handlers.onChange(item.id, e.target.value)}
            onKeyDown={(e) => handlers.onKeyDown(e, item.id)}
            onPaste={(e) => handlers.onPaste(e, item.id)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            ref={setTextareaEl}
            className={`edit-textarea ${item.heading ? `heading-${item.heading}` : ""}`}
          />
        )}
      </div>
      {clamped && (
        <button
          type="button"
          className="block-expand-btn"
          onClick={() => toggleExpand(true)}
        >
          Xem thêm ↓
        </button>
      )}
      {showCollapse && (
        <button
          type="button"
          className="block-expand-btn"
          onClick={() => toggleExpand(false)}
        >
          Thu gọn ↑
        </button>
      )}
      {ts}
      {isLoading && (
        <div className="loading-overlay">
          <Spin />
        </div>
      )}
      {slashOpen && (
        <div className="slash-menu-anchor">
          <SlashMenu
            query={slashQuery}
            selectedIndex={slashSelectedIndex}
            onSelect={(cmd) => handlers.onSelectSlash(cmd, item.id)}
          />
        </div>
      )}
    </>
  );
});

export default NotionBlock;

/**
 * Lazily mounts a NotionBlock only once it scrolls near the viewport. Until then
 * a same-height placeholder reserves space so the scrollbar doesn't jump. Once a
 * block has rendered it stays mounted (so cursor/textarea state is never lost on
 * scroll), and blocks that are being interacted with skip lazying entirely.
 *
 * "Trượt xuống đâu thì load đến đó": heavy content (images, embeds, file cards)
 * is only built for blocks the reader has actually scrolled to.
 */
export const LazyBlock = memo(function LazyBlock(props) {
  const { item, slashOpen } = props;
  const wrapRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  // Remember the last real height so the placeholder reserves the same space.
  const heightRef = useRef(0);

  // Always render blocks the user is interacting with, regardless of position.
  const forceRender = slashOpen;

  useEffect(() => {
    if (rendered || forceRender) return;
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setRendered(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRendered(true);
          observer.disconnect();
        }
      },
      // Start loading a screenful early so content is ready before it's seen.
      { root: null, rootMargin: "600px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rendered, forceRender]);

  // Measure height while mounted so a future unmount could reserve space.
  useLayoutEffect(() => {
    if ((rendered || forceRender) && wrapRef.current) {
      const h = wrapRef.current.offsetHeight;
      if (h) heightRef.current = h;
    }
  });

  if (rendered || forceRender) {
    return (
      <div ref={wrapRef} data-lazy-block={item.id}>
        <NotionBlock {...props} />
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      data-lazy-block={item.id}
      className="lazy-block-placeholder"
      style={{ minHeight: heightRef.current || 48 }}
      aria-hidden="true"
    />
  );
});
