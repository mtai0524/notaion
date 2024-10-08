import { useCallback, useState, useRef, useEffect } from "react";
import { BubbleMenu } from "@tiptap/react";
import { Dropdown, Menu, Tooltip, Skeleton } from "antd";
import {
  faBold,
  faItalic,
  faStrikethrough,
  faCode,
  faImage,
  faPenToSquare,
  faUnderline,
  faListCheck,
  faBroom,
  faRotateLeft,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import PropTypes from "prop-types";
import "./MenuBar.scss";
import axiosInstance from "../../../axiosConfig";

const MenuBar = ({ editor }) => {
  const [highlightColor, setHighlightColor] = useState("#ffc078");
  const [isLoading, setIsLoading] = useState(false);
  const skeletonRef = useRef(null);
  const [isBubbleMenuVisible, setIsBubbleMenuVisible] = useState(() => {
    const saved = localStorage.getItem("isBubbleMenuVisible");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isControlsMenuVisible, setIsControlsMenuVisible] = useState(() => {
    const saved = localStorage.getItem("isControlsMenuVisible");
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem(
      "isBubbleMenuVisible",
      JSON.stringify(isBubbleMenuVisible)
    );
    localStorage.setItem(
      "isControlsMenuVisible",
      JSON.stringify(isControlsMenuVisible)
    );
  }, [isBubbleMenuVisible, isControlsMenuVisible]);

  useEffect(() => {
    const savedBubbleMenuVisibility = localStorage.getItem(
      "isBubbleMenuVisible"
    );
    const savedControlsMenuVisibility = localStorage.getItem(
      "isControlsMenuVisible"
    );

    if (savedBubbleMenuVisibility !== null) {
      setIsBubbleMenuVisible(JSON.parse(savedBubbleMenuVisibility));
    }
    if (savedControlsMenuVisibility !== null) {
      setIsControlsMenuVisible(JSON.parse(savedControlsMenuVisibility));
    }
  }, []);

  const addImage = useCallback(() => {
    document.getElementById("fileInput").click();
  }, [editor]);

  const handleFileChange = useCallback(
    async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      setIsLoading(true);

      try {
        const response = await axiosInstance.post(
          "/api/items/upload",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        const imageUrl = response.data.url;
        console.log(imageUrl);
        editor.chain().focus().setImage({ src: imageUrl }).run();
      } catch (error) {
        console.error("Failed to upload image", error);
      } finally {
        setIsLoading(false);
      }
    },
    [editor]
  );

  const handleMouseMove = (event) => {
    if (skeletonRef.current) {
      skeletonRef.current.style.left = `${event.clientX}px`;
      skeletonRef.current.style.top = `${event.clientY}px`;
    }
  };

  if (!editor) return null;

  const headingMenu = (
    <Menu>
      <Menu.Item
        key="h1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor.isActive("heading", { level: 1 }) ? "is-active" : ""}
      >
        <span className="font-bold">Heading 1</span>
      </Menu.Item>
      <Menu.Item
        key="h2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
      >
        <span className="font-bold">Heading 2</span>
      </Menu.Item>
      <Menu.Item
        key="h3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive("heading", { level: 3 }) ? "is-active" : ""}
      >
        <span className="font-bold">Heading 3</span>
      </Menu.Item>
      <Menu.Item
        key="paragraph"
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={editor.isActive("paragraph") ? "is-active" : ""}
      >
        <span className="font-bold">Paragraph</span>
      </Menu.Item>
    </Menu>
  );

  const isActive = (type, options) => editor.isActive(type, options);

  return (
    <div className="control-group">
      {/* <button
        className="toggle-bubble-menu-btn w-6"
        onClick={() => setIsBubbleMenuVisible(!isBubbleMenuVisible)}
      >
        Toggle Bubble Menu
      </button>
      <button
        className="toggle-controls-menu-btn w-6"
        onClick={() => setIsControlsMenuVisible(!isControlsMenuVisible)}
      >
        Toggle Controls Menu
      </button> */}
      <BubbleMenu
        className={`bubble-menu ${!isBubbleMenuVisible ? "hidden" : ""}`}
        editor={editor}
        tippyOptions={{ duration: 100 }}
      >
        <div className="bubble-menu-controls ">
          <Tooltip title="Image">
            <button onClick={addImage}>
              <FontAwesomeIcon icon={faImage} />
            </button>
          </Tooltip>
          <input
            type="file"
            id="fileInput"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <Tooltip title="Bold : ctrl + b">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={isActive("bold") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faBold} />
            </button>
          </Tooltip>
          <Tooltip title="Italic: ctrl + i">
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={isActive("italic") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faItalic} />
            </button>
          </Tooltip>
          <Tooltip title="Strike: ctrl + shift + s">
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={isActive("strike") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faStrikethrough} />
            </button>
          </Tooltip>
          <Tooltip title="Underline:  ctrl + u">
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={editor.isActive("underline") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faUnderline} />
            </button>
          </Tooltip>
          <Tooltip title="Code: ctrl + e">
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              disabled={!editor.can().chain().focus().toggleCode().run()}
              className={isActive("code") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faCode} />
            </button>
          </Tooltip>
          <Tooltip title="Clear format">
            <button
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
            >
              <FontAwesomeIcon icon={faBroom} />
            </button>
          </Tooltip>
          <Tooltip title="Font: ctrl + alt + number">
            <Dropdown overlay={headingMenu}>
              <button className="dropbtn">
                <span className="font-bold">Font</span>
              </button>
            </Dropdown>
          </Tooltip>
          <Tooltip placement="bottom" title="Bullet list: ctrl + shift + 8">
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive("bulletList") ? "is-active" : ""}
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
          </Tooltip>
          <Tooltip placement="bottom" title="Task list: ctrl + shift + 9">
            <button
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={editor.isActive("taskList") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faListCheck} />
            </button>
          </Tooltip>
          <Tooltip placement="bottom" title="Code block: control + alt + c">
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
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" title="Block quote: control + shift + b">
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
                <path d="M6 21c3 0 4-2.692 4-5V5c0-1.25-.757-2.017-2-2H4C2.75 3 2 3.75 2 4.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
              </svg>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" title="Text color">
            <div className="input-icon-wrapper">
              <div className="custom-color-picker">
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
          </Tooltip>
          <Tooltip placement="bottom" title="Background color">
            <div className="input-icon-wrapper">
              <div className="custom-color-picker">
                <FontAwesomeIcon icon={faPenToSquare} />
              </div>
              <input
                className="custom-color-picker"
                type="color"
                value={highlightColor}
                onChange={(e) => {
                  const color = e.target.value;
                  setHighlightColor(color);
                  editor.chain().focus().toggleHighlight({ color }).run();
                }}
              />
            </div>
          </Tooltip>
          <Tooltip placement="bottom" title="undo">
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
              <FontAwesomeIcon style={{ margin: '0 0 1px -1px' }} icon={faRotateLeft}></FontAwesomeIcon>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" title="redo">
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
              <FontAwesomeIcon style={{ margin: '0 0px 1px -6px' }} icon={faRotateRight}></FontAwesomeIcon>
            </button>
          </Tooltip>
        </div>
      </BubbleMenu>
      <div
        className={`button-group ${!isControlsMenuVisible ? "hidden" : ""
          } w-full flex justify-center align-middle absolute z-5011111111`}
      >
        <div className="menubar-controls">
          <Tooltip title="Image">
            <button onClick={addImage}>
              <FontAwesomeIcon icon={faImage} />
            </button>
          </Tooltip>
          <input
            type="file"
            id="fileInput"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <Tooltip title="Bold : ctrl + b">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={isActive("bold") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faBold} />
            </button>
          </Tooltip>
          <Tooltip title="Italic: ctrl + i">
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={isActive("italic") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faItalic} />
            </button>
          </Tooltip>
          <Tooltip title="Strike: ctrl + shift + s">
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={isActive("strike") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faStrikethrough} />
            </button>
          </Tooltip>
          <Tooltip title="Underline:  ctrl + u">
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={editor.isActive("underline") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faUnderline} />
            </button>
          </Tooltip>
          <Tooltip title="Code: ctrl + e">
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              disabled={!editor.can().chain().focus().toggleCode().run()}
              className={isActive("code") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faCode} />
            </button>
          </Tooltip>
          <Tooltip title="Clear format">
            <button
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
            >
              <FontAwesomeIcon icon={faBroom} />
            </button>
          </Tooltip>
          <Tooltip title="Font: ctrl + alt + number">
            <Dropdown overlay={headingMenu}>
              <button className="dropbtn">
                <span className="font-bold">Font</span>
              </button>
            </Dropdown>
          </Tooltip>
          <Tooltip placement="bottom" title="Bullet list: ctrl + shift + 8">
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive("bulletList") ? "is-active" : ""}
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
          </Tooltip>
          <Tooltip placement="bottom" title="Task list: ctrl + shift + 9">
            <button
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={editor.isActive("taskList") ? "is-active" : ""}
            >
              <FontAwesomeIcon icon={faListCheck} />
            </button>
          </Tooltip>
          <Tooltip placement="bottom" title="Code block: control + alt + c">
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
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" title="Block quote: control + shift + b">
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
                <path d="M6 21c3 0 4-2.692 4-5V5c0-1.25-.757-2.017-2-2H4C2.75 3 2 3.75 2 4.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
              </svg>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" title="Text color">
            <div className="input-icon-wrapper">
              <div className="custom-color-picker">
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
          </Tooltip>
          <Tooltip placement="bottom" title="Background color">
            <div className="input-icon-wrapper">
              <div className="custom-color-picker">
                <FontAwesomeIcon icon={faPenToSquare} />
              </div>
              <input
                className="custom-color-picker"
                type="color"
                value={highlightColor}
                onChange={(e) => {
                  const color = e.target.value;
                  setHighlightColor(color);
                  editor.chain().focus().toggleHighlight({ color }).run();
                }}
              />
            </div>
          </Tooltip>
          <Tooltip placement="bottom" title="undo">
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
              <FontAwesomeIcon style={{ margin: '0 0 1px -1px' }} icon={faRotateLeft}></FontAwesomeIcon>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" title="redo">
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
              <FontAwesomeIcon style={{ margin: '0 0px 1px -6px' }} icon={faRotateRight}></FontAwesomeIcon>
            </button>
          </Tooltip>
        </div>
      </div>

      {isLoading && (
        <div
          ref={skeletonRef}
          className="skeleton-fullscreen"
          onMouseMove={handleMouseMove}
        >
          <Skeleton.Image active style={{ width: "50vw", height: "50vh" }} />
        </div>
      )}
    </div>
  );
};

MenuBar.propTypes = {
  editor: PropTypes.object.isRequired,
};

export default MenuBar;
