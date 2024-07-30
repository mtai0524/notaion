import { Plugin } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";

const AddDraggableItemPlugin = new Plugin({
  appendTransaction(transactions, oldState, newState) {
    const tr = newState.tr;

    transactions.forEach((transaction) => {
      if (transaction.docChanged) {
        // Lặp qua các phần tử trong tài liệu
        newState.doc.descendants((node, pos) => {
          if (node.isBlock && node.type.name !== "draggableItem") {
            // Thêm thuộc tính 'data-type' cho các phần tử mới
            tr.setNodeMarkup(pos, null, {
              ...node.attrs,
              "data-type": "draggableItem",
            });
          }
        });
      }
    });

    if (tr.docChanged) {
      return tr;
    }
  },

  props: {
    handleKeyDown(view, event) {
      if (event.key === "Enter") {
        const { state, dispatch } = view;
        const { selection } = state;
        const { from, to } = selection;

        // Check if the selection is within a block node
        if (
          selection instanceof TextSelection &&
          state.doc.nodeAt(from) &&
          state.doc.nodeAt(to)
        ) {
          const node = state.doc.nodeAt(from);
          if (node && node.isBlock && node.type.name !== "draggableItem") {
            // Wrap the node in a draggableItem
            const tr = state.tr;
            const { commands } = view;
            commands.wrapIn("draggableItem");
            dispatch(tr);
            return true;
          }
        }
      }
      return false;
    },
  },
});

export default AddDraggableItemPlugin;
