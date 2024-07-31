import { useCallback, useEffect, useState } from "react";
import { BubbleMenu } from "@tiptap/react";
import { Dropdown, Menu } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faItalic,
  faStrikethrough,
  faCode,
} from "@fortawesome/free-solid-svg-icons";
import PropTypes from "prop-types";
import "./MenuBar.scss";
import FloatingMenu from "../../ui/menu/FloatingMenu";

const MenuBar = ({ editor }) => {
  const [floatingMenu, setFloatingMenu] = useState({
    top: 0,
    left: 0,
    visible: false,
  });

  const addImage = useCallback(() => {
    const url = window.prompt("URL");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { selection } = editor.state;
      const { $from, $to } = selection;
      if ($from.pos === $to.pos && $from.parent.content.size === 0) {
        const rect = editor.view.dom.getBoundingClientRect();
        setFloatingMenu({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          visible: true,
        });
      } else {
        setFloatingMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    editor.on("selectionUpdate", handleUpdate);

    return () => {
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor]);

  if (!editor) return null;

  const headingMenu = (
    <Menu>
      <Menu.Item
        key="h1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor.isActive("heading", { level: 1 }) ? "is-active" : ""}
      >
        Heading 1
      </Menu.Item>
      <Menu.Item
        key="h2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
      >
        Heading 2
      </Menu.Item>
      <Menu.Item
        key="h3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive("heading", { level: 3 }) ? "is-active" : ""}
      >
        Heading 3
      </Menu.Item>
      <Menu.Item
        key="paragraph"
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={editor.isActive("paragraph") ? "is-active" : ""}
      >
        Paragraph
      </Menu.Item>
    </Menu>
  );

  const isActive = (type, options) => editor.isActive(type, options);

  return (
    <div className="control-group">
      <BubbleMenu
        className="bubble-menu"
        editor={editor}
        tippyOptions={{ duration: 100 }}
      >
        <div className="bubble-menu-controls">
          <button onClick={addImage}>Set image</button>
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={isActive("bold") ? "is-active" : ""}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 12a4 4 0 0 0 0-8H6v8"></path>
              <path d="M15 20a4 4 0 0 0 0-8H6v8Z"></path>
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={isActive("italic") ? "is-active" : ""}
          >
            <FontAwesomeIcon icon={faItalic} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={isActive("strike") ? "is-active" : ""}
          >
            <FontAwesomeIcon icon={faStrikethrough} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={isActive("underline") ? "is-active" : ""}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path d="M6 4v6a6 6 0 0 0 12 0V4"></path>
              <line x1="4" x2="20" y1="20" y2="20"></line>
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            disabled={!editor.can().chain().focus().toggleCode().run()}
            className={isActive("code") ? "is-active" : ""}
          >
            <FontAwesomeIcon icon={faCode} />
          </button>
          <Dropdown overlay={headingMenu}>
            <button className="dropbtn">Font</button>
          </Dropdown>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={isActive("bulletList") ? "is-active" : ""}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="8" x2="21" y1="6" y2="6"></line>
              <line x1="8" x2="21" y1="12" y2="12"></line>
              <line x1="8" x2="21" y1="18" y2="18"></line>
              <line x1="3" x2="3.01" y1="6" y2="6"></line>
              <line x1="3" x2="3.01" y1="12" y2="12"></line>
              <line x1="3" x2="3.01" y1="18" y2="18"></line>
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={isActive("codeBlock") ? "is-active" : ""}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={isActive("blockquote") ? "is-active" : ""}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
            </svg>
          </button>
          <div className="input-icon-wrapper">
            <div className="custom-color-picker">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="13.5" cy="6.5" r=".5"></circle>
                <circle cx="17.5" cy="10.5" r=".5"></circle>
                <circle cx="8.5" cy="7.5" r=".5"></circle>
                <circle cx="6.5" cy="12.5" r=".5"></circle>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
              </svg>
            </div>
            <input
              type="color"
              onInput={(event) =>
                editor.chain().focus().setColor(event.target.value).run()
              }
              value={editor.getAttributes("textStyle").color}
              data-testid="setColor"
              onChange={(event) => {
                document.querySelector(
                  ".custom-color-picker"
                ).style.backgroundColor = event.target.value;
              }}
            />
          </div>
        </div>
      </BubbleMenu>
      <FloatingMenu editor={editor} menu={{ ...floatingMenu, isActive }} />
    </div>
  );
};

MenuBar.propTypes = {
  editor: PropTypes.object.isRequired,
};

export default MenuBar;
