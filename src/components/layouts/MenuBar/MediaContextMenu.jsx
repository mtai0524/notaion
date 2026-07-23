import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { message } from "antd";
import { downloadFile } from "../../../services/fileService";
import "./MediaContextMenu.css";

/**
 * Right-click context menu shared by images and file attachments in the editor.
 * Renders into a body portal, clamps itself inside the viewport, and closes on
 * outside click / Esc / scroll.
 */
const MediaContextMenu = ({ x, y, name, url, savedName, onDelete, onClose }) => {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Clamp to viewport once the menu has measured itself.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(x, window.innerWidth - width - pad);
    const top = Math.min(y, window.innerHeight - height - pad);
    setPos({ left: Math.max(pad, left), top: Math.max(pad, top) });
  }, [x, y]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    const onDocDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  const handleDownload = async () => {
    onClose();
    try {
      await downloadFile(savedName, name, url);
    } catch (err) {
      console.error("Download failed", err);
      message.error("Tải xuống thất bại");
    }
  };

  const handleCopyLink = async () => {
    onClose();
    try {
      await navigator.clipboard.writeText(url);
      message.success("Đã copy link");
    } catch {
      message.error("Không copy được link");
    }
  };

  const handleOpen = () => {
    onClose();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = () => {
    onClose();
    onDelete();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="media-ctx-menu"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="media-ctx-header" title={name}>
        {name || "File"}
      </div>
      <button type="button" className="media-ctx-item" onClick={handleDownload}>
        Download
      </button>
      <button type="button" className="media-ctx-item" onClick={handleCopyLink}>
        Copy link
      </button>
      <button type="button" className="media-ctx-item" onClick={handleOpen}>
        Open in new tab
      </button>
      <div className="media-ctx-divider" />
      <button
        type="button"
        className="media-ctx-item media-ctx-danger"
        onClick={handleDelete}
      >
        Delete
      </button>
    </div>,
    document.body
  );
};

MediaContextMenu.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  name: PropTypes.string,
  url: PropTypes.string,
  savedName: PropTypes.string,
  onDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MediaContextMenu;
