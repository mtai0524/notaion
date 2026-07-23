import { useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import MediaContextMenu from "./MediaContextMenu";

/**
 * NodeView for editor images: renders the <img> and opens a right-click menu
 * (Download / Copy link / Open in new tab / Delete).
 */
const ImageNodeView = ({ node, deleteNode }) => {
  const { src, name, alt, title } = node.attrs;
  const [menu, setMenu] = useState(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <NodeViewWrapper as="span" className="editor-image-wrapper">
      <img
        src={src}
        alt={alt || name || ""}
        title={title || name || ""}
        onContextMenu={handleContextMenu}
        draggable="false"
      />
      {menu && (
        <MediaContextMenu
          x={menu.x}
          y={menu.y}
          name={name || "Image"}
          url={src}
          onDelete={deleteNode}
          onClose={() => setMenu(null)}
        />
      )}
    </NodeViewWrapper>
  );
};

export default ImageNodeView;
