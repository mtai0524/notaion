import { Plugin, TextSelection, AllSelection } from "prosemirror-state";

const AddDraggableItemPlugin = new Plugin({
  appendTransaction(transactions, oldState, newState) {
    const tr = newState.tr;

    transactions.forEach((transaction) => {
      if (transaction.docChanged) {
        newState.doc.descendants((node, pos) => {
          if (node.isBlock && node.type.name !== "draggableItem") {
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

      if (event.ctrlKey && event.key === "a") {
        const node = state.doc.nodeAt(from);
        if (node && node.isBlock) {
          const start = from;
          const end = start + node.nodeSize - 2;
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
