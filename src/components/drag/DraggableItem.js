import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import DraggableComponent from "./DraggableComponent";

const DraggableItem = Node.create({
  name: "draggableItem",
  group: "block",
  draggable: true,
  content: "block+",

  parseHTML() {
    return [
      {
        tag: 'div[data-type="draggableItem"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { ...HTMLAttributes, "data-type": "draggableItem" }, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DraggableComponent);
  },
});

export default DraggableItem;
