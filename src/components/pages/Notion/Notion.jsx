import { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Dropdown, Menu, message, Space } from "antd";
import "./Notion.scss";
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

const Notion = () => {
  const [items, setItems] = useState([
    { id: "1", content: "Item 1", heading: "" },
    { id: "2", content: "Item 2", heading: "" },
    { id: "3", content: "Item 3", heading: "" },
    { id: "4", content: "Item 4", heading: "" },
  ]);

  const [newContent, setNewContent] = useState({});
  const [dropdownVisible, setDropdownVisible] = useState({});
  const [boxShadow, setBoxShadow] = useState("none");
  const [rounded, setRounded] = useState("0px");
  const [activeDropdown, setActiveDropdown] = useState(null); // State để quản lý dropdown hiện tại

  const editTextareaRefs = useRef({});

  const handleBoxShadowChange = (newBoxShadow, newRounded) => {
    setBoxShadow(newBoxShadow);
    setRounded(newRounded);
  };

  useEffect(() => {
    Object.keys(editTextareaRefs.current).forEach((id) => {
      const textarea = editTextareaRefs.current[id];
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    });
  }, [items, newContent]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const reorderedItems = reorder(
      items,
      result.source.index,
      result.destination.index
    );
    setItems(reorderedItems);
  };

  const handleChangeContent = (id, value) => {
    setNewContent((prev) => ({ ...prev, [id]: value }));
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, content: value } : item
      )
    );
  };

  const handleMenuClick = (e, id) => {
    const heading = e.key;
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, heading } : item))
    );
    message.info(`Applied ${heading.replace("heading-", "Heading ")} format`);
    setDropdownVisible((prev) => ({ ...prev, [id]: false }));
    setActiveDropdown(null);
  };

  const menu = (id) => (
    <Menu
      onClick={(e) => handleMenuClick(e, id)}
      className="custom-dropdown-menu"
    >
      <Menu.Item key="heading-1">Heading 1</Menu.Item>
      <Menu.Divider />
      <Menu.Item key="heading-2">Heading 2</Menu.Item>
      <Menu.Divider />
      <Menu.Item key="heading-3" danger>
        Heading 3
      </Menu.Item>
    </Menu>
  );

  const handleClickOutside = (event) => {
    const isClickInsideMenu = event.target.closest(".ant-dropdown");
    if (!isClickInsideMenu) {
      setDropdownVisible((prev) =>
        Object.keys(prev).reduce((acc, id) => ({ ...acc, [id]: false }), {})
      );
      setActiveDropdown(null);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyHeadingFormat = (id, heading) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, heading } : item))
    );
    message.info(`Applied ${heading.replace("heading-", "Heading ")} format`);
  };

  const handleKeyDown = (e, id) => {
    if (e.key === "/") {
      e.preventDefault(); // Ngăn chặn việc gõ ký tự `/` vào textarea
      setDropdownVisible((prev) => ({ ...prev, [id]: !prev[id] }));
      setActiveDropdown(id);
    }
  };

  // sự kiện tổ hợp phím ctrl + để chọn menu
  const handleKeyDownGlobal = (e) => {
    if (e.ctrlKey) {
      const id = activeDropdown;
      if (e.key === "1" && id) {
        e.preventDefault();
        applyHeadingFormat(id, "heading-1");
      } else if (e.key === "2" && id) {
        e.preventDefault();
        applyHeadingFormat(id, "heading-2");
      } else if (e.key === "3" && id) {
        e.preventDefault();
        applyHeadingFormat(id, "heading-3");
      }
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDownGlobal);
    return () => document.removeEventListener("keydown", handleKeyDownGlobal);
  }, [activeDropdown]);

  return (
    <>
      <button
        onClick={() => handleBoxShadowChange("-2px 2px 0 0 #111827", "0px")}
      >
        Change Box Shadow to Subtle
      </button>
      <button
        onClick={() => handleBoxShadowChange("-2px 2px 0 0 #111827", "4px")}
      >
        Change Box Shadow to Subtle and rounded
      </button>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="droppable">
          {(provided) => (
            <ul
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="droppable-list"
            >
              {items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="draggable-item flex"
                    >
                      <textarea
                        value={newContent[item.id] || item.content}
                        onChange={(e) =>
                          handleChangeContent(item.id, e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, item.id)} // Thêm sự kiện onKeyDown
                        ref={(el) => (editTextareaRefs.current[item.id] = el)}
                        className={`edit-textarea ${
                          item.heading ? `heading-${item.heading}` : ""
                        }`}
                        style={{ boxShadow: boxShadow, borderRadius: rounded }}
                        placeholder="Enter your content here..."
                      />
                      <Space>
                        <Dropdown
                          className="dd-item-pages"
                          placement="topRight"
                          overlay={menu(item.id)}
                          trigger={["click"]}
                          onOpenChange={(visible) =>
                            setDropdownVisible(visible)
                          }
                          onClick={() => setDropdownVisible(!dropdownVisible)}
                        >
                          <span
                            {...provided.dragHandleProps}
                            className="drag-handle"
                          >
                            &#9776;
                          </span>
                        </Dropdown>
                      </Space>
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </>
  );
};

export default Notion;
