import { Plugin, TextSelection, AllSelection } from "prosemirror-state";

const AddDraggableItemPlugin = new Plugin({
  appendTransaction(transactions, oldState, newState) {
    const tr = newState.tr;

    transactions.forEach((transaction) => {
      if (transaction.docChanged) {
        // Iterate through the document nodes
        newState.doc.descendants((node, pos) => {
          if (node.isBlock && node.type.name !== "draggableItem") {
            // Add 'data-type' attribute to new block nodes
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
      const { state, dispatch } = view;
      const { selection } = state;
      const { from, to } = selection;

      // Handle Enter key to wrap block nodes in draggableItem
      if (event.key === "Enter") {
        if (
          selection instanceof TextSelection &&
          state.doc.nodeAt(from) &&
          state.doc.nodeAt(to)
        ) {
          const node = state.doc.nodeAt(from);
          if (node && node.isBlock && node.type.name !== "draggableItem") {
            const tr = state.tr;
            const { commands } = view;
            commands.wrapIn("draggableItem");
            dispatch(tr);
            return true;
          }
        }
      }

      // Handle Ctrl+A key to select all content within a block node or entire document
      if (event.ctrlKey && event.key === "a") {
        const node = state.doc.nodeAt(from);
        if (node && node.isBlock) {
          const start = from;
          const end = start + node.nodeSize - 2; // Subtract 2 to account for the start and end positions of the block node
          const newSelection = TextSelection.create(state.doc, start, end);
          const tr = state.tr.setSelection(newSelection);
          dispatch(tr);
          return true;
        } else {
          const tr = state.tr.setSelection(new AllSelection(state.doc));
          dispatch(tr);
          return true;
        }
      }

      return false;
    },
  },
});

export default AddDraggableItemPlugin;
