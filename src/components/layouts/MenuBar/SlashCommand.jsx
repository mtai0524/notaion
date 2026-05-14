import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  CodeOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  MinusOutlined,
  FileImageOutlined,
  FileOutlined,
  CheckSquareOutlined,
} from "@ant-design/icons";
import "./SlashCommand.scss";

const SLASH_ITEMS = [
  {
    title: "Heading 1",
    desc: "Big section heading",
    icon: <span className="sc-icon-text">H1</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    desc: "Medium section heading",
    icon: <span className="sc-icon-text">H2</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    desc: "Small section heading",
    icon: <span className="sc-icon-text">H3</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    desc: "Unordered list of items",
    icon: <UnorderedListOutlined />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    desc: "Ordered numbered list",
    icon: <OrderedListOutlined />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    desc: "To-do list with checkboxes",
    icon: <CheckSquareOutlined />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Code Block",
    desc: "Syntax-highlighted code snippet",
    icon: <CodeOutlined />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Divider",
    desc: "Horizontal separator line",
    icon: <MinusOutlined />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Image",
    desc: "Upload an image file",
    icon: <FileImageOutlined />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent("notaion:slash-upload", { detail: { type: "image" } }));
    },
  },
  {
    title: "File",
    desc: "Attach any file",
    icon: <FileOutlined />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent("notaion:slash-upload", { detail: { type: "file" } }));
    },
  },
];

// ── Popup list component ────────────────────────────────────────
const SlashMenuList = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { items } = props;
  const rowRefs = useRef([]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    rowRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selectedIndex];
        if (item) props.command(item);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) {
    return (
      <div className="sc-popup">
        <p className="sc-empty">No results</p>
      </div>
    );
  }

  return (
    <div className="sc-popup">
      <p className="sc-header">Basic blocks</p>
      <div className="sc-list">
        {items.map((item, idx) => (
          <button
            key={idx}
            ref={(el) => (rowRefs.current[idx] = el)}
            className={`sc-item ${idx === selectedIndex ? "is-selected" : ""}`}
            onMouseEnter={() => setSelectedIndex(idx)}
            onMouseDown={(e) => {
              e.preventDefault();
              props.command(item);
            }}
          >
            <div className="sc-icon">{item.icon}</div>
            <div className="sc-body">
              <div className="sc-title">{item.title}</div>
              <div className="sc-desc">{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="sc-footer">
        <kbd>↑↓</kbd> navigate &nbsp;<kbd>↵</kbd> select &nbsp;<kbd>esc</kbd> close
      </div>
    </div>
  );
});

SlashMenuList.displayName = "SlashMenuList";

// ── TipTap Extension ────────────────────────────────────────────
const SlashCommand = Extension.create({
  name: "slash-command",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        items: ({ query }) => {
          const q = query.toLowerCase().trim();
          if (!q) return SLASH_ITEMS;
          return SLASH_ITEMS.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              item.desc.toLowerCase().includes(q)
          );
        },
        render: () => {
          let component;
          let popup;

          return {
            onStart(props) {
              component = new ReactRenderer(SlashMenuList, {
                props,
                editor: props.editor,
              });
              if (!props.clientRect) return;
              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                zIndex: 9999,
              });
            },
            onUpdate(props) {
              component.updateProps(props);
              if (!props.clientRect) return;
              popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect });
            },
            onKeyDown(props) {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }
              return component.ref?.onKeyDown(props) ?? false;
            },
            onExit() {
              popup?.[0]?.destroy();
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});

export default SlashCommand;
