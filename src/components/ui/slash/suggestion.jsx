import { useRef, useEffect, useState } from "react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import CommandsList from "./CommandsList";
import PropTypes from "prop-types";

const CommandMenu = ({ editor, clientRect, query }) => {
  const [items, setItems] = useState([]);
  const tippyRef = useRef(null);

  useEffect(() => {
    const commands = [
      {
        title: "Heading 1",
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode("heading", { level: 1 })
            .run();
        },
      },
      {
        title: "Heading 2",
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode("heading", { level: 2 })
            .run();
        },
      },
      {
        title: "Bold",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setMark("bold").run();
        },
      },
      {
        title: "Italic",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setMark("italic").run();
        },
      },
    ]
      .filter((item) =>
        item.title.toLowerCase().startsWith(query.toLowerCase())
      )
      .slice(0, 10);

    setItems(commands);
  }, [query]);

  const handleSelect = (item) => {
    if (editor && clientRect) {
      const range = editor.state.selection.$from;
      item.command({ editor, range });
    }
  };

  return (
    <Tippy
      reference={tippyRef.current}
      content={<CommandsList items={items} onSelect={handleSelect} />}
      interactive
      placement="bottom-start"
      trigger="manual"
      visible={!!clientRect}
    >
      <div
        ref={tippyRef}
        style={{
          position: "absolute",
          left: clientRect?.left,
          top: clientRect?.top,
        }}
      ></div>
    </Tippy>
  );
};

CommandMenu.propTypes = {
  editor: PropTypes.object.isRequired,
  clientRect: PropTypes.object,
  query: PropTypes.string.isRequired,
};

export default CommandMenu;
