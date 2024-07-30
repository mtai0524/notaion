import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import PropTypes from "prop-types";

const DraggableComponent = (props) => {
  return (
    <NodeViewWrapper className="draggable-item" {...props}>
      <div
        className="drag-handle"
        contentEditable={false}
        draggable="true"
        data-drag-handle
      >
        <svg
          style={{ width: "10px", marginLeft: "5px", marginRight: "5px" }}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 10 16"
        >
          <path d="M4 14c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM2 6C.9 6 0 6.9 0 8s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6C.9 0 0 .9 0 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </div>
      <NodeViewContent className="content" />
    </NodeViewWrapper>
  );
};

DraggableComponent.propTypes = {
  node: PropTypes.object.isRequired,
  updateAttributes: PropTypes.func.isRequired,
  extension: PropTypes.object.isRequired,
};

export default DraggableComponent;
