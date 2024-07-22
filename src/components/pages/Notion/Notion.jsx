import { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Dropdown, Menu, message, Space, Button } from "antd";
import { DownOutlined, UserOutlined } from "@ant-design/icons";
import "./Notion.scss";

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

const Notion = () => {
  const [items, setItems] = useState([
    { id: "1", content: "Item 1" },
    { id: "2", content: "Item 2" },
    { id: "3", content: "Item 3" },
    { id: "4", content: "Item 4" },
  ]);

  const [newContent, setNewContent] = useState({});
  const [dropdownVisible, setDropdownVisible] = useState({});

  const editTextareaRefs = useRef({});

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
    // Xử lý lệnh /h1, /h2, /h3
    if (value.startsWith("/h1")) {
      setNewContent((prev) => ({
        ...prev,
        [id]: `Heading 1 ${value.slice(3)}`,
      }));
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id
            ? { ...item, content: `Heading 1 ${value.slice(3)}` }
            : item
        )
      );
    } else if (value.startsWith("/h2")) {
      setNewContent((prev) => ({
        ...prev,
        [id]: `Heading 2 ${value.slice(3)}`,
      }));
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id
            ? { ...item, content: `Heading 2 ${value.slice(3)}` }
            : item
        )
      );
    } else if (value.startsWith("/h3")) {
      setNewContent((prev) => ({
        ...prev,
        [id]: `Heading 3 ${value.slice(3)}`,
      }));
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id
            ? { ...item, content: `Heading 3 ${value.slice(3)}` }
            : item
        )
      );
    } else {
      setNewContent((prev) => ({ ...prev, [id]: value }));
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id ? { ...item, content: value } : item
        )
      );
    }
  };

  const handleMenuClick = (e, id) => {
    message.info(`Clicked on ${e.key}`);
    setDropdownVisible((prev) => ({ ...prev, [id]: false }));
  };

  const menu = (id) => (
    <Menu onClick={(e) => handleMenuClick(e, id)}>
      <Menu.Item key="heading-1" icon={<UserOutlined />}>
        Heading 1
      </Menu.Item>
      <Menu.Item key="heading-2" icon={<UserOutlined />}>
        Heading 2
      </Menu.Item>
      <Menu.Item key="heading-3" icon={<UserOutlined />} danger>
        Heading 3
      </Menu.Item>
    </Menu>
  );

  return (
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
                    className="draggable-item"
                  >
                    <textarea
                      value={newContent[item.id] || item.content}
                      onChange={(e) =>
                        handleChangeContent(item.id, e.target.value)
                      }
                      ref={(el) => (editTextareaRefs.current[item.id] = el)}
                      className="edit-textarea"
                      placeholder="Enter your content here..."
                    />
                    <Space>
                      <Dropdown
                        className="dd-item-pages"
                        overlay={menu(item.id)}
                        trigger={["click"]}
                        visible={dropdownVisible[item.id]}
                        onClick={() =>
                          setDropdownVisible((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }))
                        }
                      >
                        <Button icon={<DownOutlined />} />
                      </Dropdown>
                      <span
                        {...provided.dragHandleProps}
                        className="drag-handle"
                      >
                        &#9776; {/* Biểu tượng kéo thả */}
                      </span>
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
  );
};

export default Notion;
