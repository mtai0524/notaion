import { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Dropdown, Menu, message, Space, Tooltip } from "antd";
import "./Notion.scss";
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

const generateRandomId = () => {
  return Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
};

const Notion = () => {
  const [blockId, setBlockId] = useState();
  const [items, setItems] = useState([]);
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
    setItems([
      {
        id: generateRandomId(),
        placeholder: "Type your content here...",
        heading: "",
      },
    ]);
    setBlockId(generateRandomId());
  }, []);

  const addItem = () => {
    setBlockId(generateRandomId());
    const newItem = {
      id: blockId,
      // content: blockId,
      heading: "",
    };
    setItems([...items, newItem]);
    message.info("New item added");
  };

  useEffect(() => {
    Object.keys(editTextareaRefs.current).forEach((id) => {
      const textarea = editTextareaRefs.current[id];
      if (textarea) {
        textarea.style.height = "15px";
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
  const handleMenuClick = (e, id) => {
    if (e.key === "delete") {
      setItems((prevItems) => prevItems.filter((item) => item.id !== id)); // remove id of item has choose
      message.info("Item deleted");
    } else {
      const heading = e.key;
      setItems((prevItems) =>
        prevItems.map((item) => (item.id === id ? { ...item, heading } : item))
      );
      message.info(`Applied ${heading.replace("heading-", "Heading ")} format`);
    }
    setDropdownVisible((prev) => ({ ...prev, [id]: false }));
    setActiveDropdown(null);
  };

  const menu = (id) => (
    <Menu
      onClick={(e) => handleMenuClick(e, id)}
      className="custom-dropdown-menu"
    >
      <Menu.Item key="heading-1">
        <Tooltip placement="left" title="Apply Heading 1 style">
          <span>Heading 1</span>
        </Tooltip>
      </Menu.Item>
      <Menu.Item key="heading-2">
        <Tooltip placement="left" title="Apply Heading 2 style">
          <span>Heading 2</span>
        </Tooltip>
      </Menu.Item>
      <Menu.Item key="heading-3">
        <Tooltip placement="left" title="Apply Heading 3 style">
          <span>Heading 3</span>
        </Tooltip>
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" danger>
        <Tooltip placement="left" title="Delete this item">
          <span>Delete</span>
        </Tooltip>
      </Menu.Item>
    </Menu>
  );

  const applyHeadingFormat = (id, heading) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, heading } : item))
    );
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
      } else if (e.key === "4" && id) {
        e.preventDefault();
        setItems((prevItems) => prevItems.filter((item) => item.id !== id)); // remove id of item has choose
      }
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDownGlobal);
    return () => document.removeEventListener("keydown", handleKeyDownGlobal);
  }, [activeDropdown]);

  return (
    <>
      <button onClick={addItem} type="primary">
        Add Item
      </button>
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
                        placeholder={item.placeholder}
                        value={newContent[item.id] || item.content}
                        onChange={(e) =>
                          handleChangeContent(item.id, e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, item.id)}
                        ref={(el) => (editTextareaRefs.current[item.id] = el)}
                        className={`edit-textarea ${
                          item.heading ? `heading-${item.heading}` : ""
                        }`}
                        style={{ boxShadow: boxShadow, borderRadius: rounded }}
                      />
                      <Space>
                        <Dropdown
                          className="dd-item-pages"
                          placement="topRight"
                          overlay={menu(item.id)}
                          trigger={["click"]}
                          visible={
                            dropdownVisible[item.id] ||
                            activeDropdown === item.id
                          }
                          onClick={() =>
                            setDropdownVisible((prev) => ({
                              ...prev,
                              [item.id]: !prev[item.id],
                            }))
                          }
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
