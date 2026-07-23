import { useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import MediaContextMenu from "./MediaContextMenu";

/**
 * NodeView for file attachments: re-renders the 📁 card, opens the file on
 * left-click, and shows a right-click menu (Download / Copy link / Open / Delete).
 */
const FileAttachmentNodeView = ({ node, deleteNode }) => {
  const { href, name, size } = node.attrs;
  const [menu, setMenu] = useState(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const handleClick = (e) => {
    e.preventDefault();
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <NodeViewWrapper
      as="div"
      className="file-attachment-card"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      contentEditable={false}
    >
      <div className="file-attachment-icon">📁</div>
      <div className="file-attachment-info">
        <div className="file-attachment-name">{name || "Attachment"}</div>
        <div className="file-attachment-meta">
          {size ? `Download (${size})` : "Click to download"}
        </div>
      </div>
      {menu && (
        <MediaContextMenu
          x={menu.x}
          y={menu.y}
          name={name || "Attachment"}
          url={href}
          onDelete={deleteNode}
          onClose={() => setMenu(null)}
        />
      )}
    </NodeViewWrapper>
  );
};

export default FileAttachmentNodeView;
