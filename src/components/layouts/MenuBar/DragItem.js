// src/extensions/DragItem.js
import { Node, mergeAttributes } from "@tiptap/core";

const DragItem = Node.create({
  name: "dragItem",

  group: "block",

  content: "block*",

  defining: true,

  addAttributes() {
    return {
      "data-type": {
        default: "DragItem",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="draggableItem"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setDragItem:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name, { "data-type": "draggableItem" });
        },
    };
  },
});

export default DragItem;
