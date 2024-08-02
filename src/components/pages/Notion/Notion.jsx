import { useState, useRef, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import {
  Dropdown,
  Menu,
  Space,
  Tooltip,
  Popconfirm,
  message,
  Spin,
  Image,
} from "antd";
import {
  DownloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import "./Notion.scss";
import axiosInstance from "../../../axiosConfig";
import debounce from "lodash.debounce";
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result.map((item, index) => ({ ...item, order: index }));
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
  const [activeDropdown, setActiveDropdown] = useState(null);
  const editTextareaRefs = useRef({});
  const [apiAvailable, setApiAvailable] = useState(true);
  const [loadingImage, setLoadingImage] = useState(null);
  const checkApiConnection = async () => {
    try {
      await axiosInstance.get("/api/HealthCheck/health-check"); // health check
      // message.success("Connected server");
      return true;
    } catch (error) {
      message.error("Failed connect server");
      return false;
    }
  };
  useEffect(() => {
    const checkConnection = async () => {
      const available = await checkApiConnection();
      setApiAvailable(available);
    };

    checkConnection();
  }, []);
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
      <Menu.Item key="heading-4">
        <Tooltip placement="left" title="Apply Code style">
          <span>Code</span>
        </Tooltip>
      </Menu.Item>
      <Menu.Item key="choose-image">
        <Tooltip placement="left" title="Choose image">
          <span>Image</span>
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
  const handleAction = (text) => {
    return message.loading(`${text}...`, 0);
  };

  const fetchItems = async () => {
    const hideLoading = handleAction("Loading");
    try {
      await axiosInstance.get("/api/Items").then((response) => {
        setItems(response.data);
        // message.success("Loading finished", 1);
      });
    } catch (error) {
      console.error("Error fetching items:", error);
      message.error("Error fetching items", 1);
    } finally {
      setTimeout(hideLoading, 1);
    }
  };

  useEffect(() => {
    // Kiểm tra và thêm item nếu danh sách item rỗng
    if (items.length === 0) {
      const newBlockId = generateRandomId();
      setItems([
        {
          id: newBlockId,
          placeholder: "Type your content here...",
          heading: "",
          order: 0,
        },
      ]);
      setBlockId(newBlockId);
    }
  }, [items]);

  useEffect(() => {
    // Focus vào textarea mới sau khi items được cập nhật
    if (blockId) {
      const newTextarea = editTextareaRefs.current[blockId];
      if (newTextarea) {
        newTextarea.focus();
      }
    }
  }, [blockId]);

  useEffect(() => {
    fetchItems();
  }, []);

  const addItem = (id) => {
    const newBlockId = generateRandomId();
    const index = id
      ? items.findIndex((item) => item.id === id) + 1
      : items.length;
    const newItem = {
      id: newBlockId,
      heading: "",
      code: "",
      order: index,
    };
    const newItems = [...items];
    newItems.splice(index, 0, newItem);
    setItems(newItems.map((item, idx) => ({ ...item, order: idx })));
    setBlockId(newBlockId);
    setTimeout(() => {
      editTextareaRefs.current[newBlockId]?.focus();
    }, 0);
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

    const scrollY = window.scrollY;

    const reorderedItems = reorder(
      items,
      result.source.index,
      result.destination.index
    );

    setItems(() => {
      const updatedItems = reorderedItems.map((item, index) => ({
        ...item,
        order: index,
      }));
      saveItems(updatedItems, true);
      return updatedItems;
    });

    window.scrollTo(0, scrollY);
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

  const saveNewItems = async (heading, id) => {
    let updatedItems;
    setItems((prevItems) => {
      updatedItems = prevItems.map((item) =>
        item.id === id ? { ...item, heading } : item
      );
    });
    setItems(updatedItems);
    await saveItems(updatedItems, false);
  };

  const editingItemIdRef = useRef(null);

  const handleFileChange = async (e) => {
    const id = editingItemIdRef.current;
    setLoadingImage(id);

    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axiosInstance.post("/api/Items/upload", formData);
      responseDataImage(response, e, id);
      setLoadingImage(null);
    } catch (error) {
      console.error("Error uploading image:", error);
      setLoadingImage(null);
    }
  };

  const responseDataImage = (response, e, id) => {
    const data = response.data;
    const currentContent =
      newContent[id] || items.find((item) => item.id === id)?.content || "";
    const cursorPosition = e.target.selectionStart;
    const beforeCursor = currentContent.substring(0, cursorPosition);
    const newContentWithImage = `${beforeCursor}${data.url}`;
    handleChangeContent(id, newContentWithImage);
  };

  const fileInputRef = useRef(null);
  const handleMenuClick = async (e, id) => {
    editingItemIdRef.current = id;
    const scrollY = window.scrollY;
    if (e.key === "choose-image") {
      fileInputRef.current.click(); //  dialog chọn file
    }
    if (e.key === "delete") {
      setItems((prevItems) => prevItems.filter((item) => item.id !== id)); // remove id of item has choose
      await deleteItem(id, true);
    } else {
      saveNewItems(e.key, id);
    }
    setDropdownVisible((prev) => ({ ...prev, [id]: false }));
    setActiveDropdown(null);
    window.scrollTo(0, scrollY);
  };
  const applyHeadingFormat = async (id, heading) => {
    saveNewItems(heading, id);
  };

  const handleKeyDown = async (e, id) => {
    if (e.key === "/") {
      e.preventDefault(); // Ngăn chặn việc gõ ký tự `/` vào textarea
      setDropdownVisible((prev) => ({ ...prev, [id]: !prev[id] }));
      setActiveDropdown(id);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addItem(id);
      if (apiAvailable) {
        await saveItems(items, false);
      }
    } else if (e.key === "Backspace") {
      const currentItemIndex = items.findIndex((item) => item.id === id);
      const currentItem = items[currentItemIndex];

      if (
        currentItem &&
        (!newContent[id] || !newContent[id].trim()) &&
        (!currentItem.content || !currentItem.content.trim())
      ) {
        e.preventDefault();

        const updatedItems = items.filter((item) => item.id !== id);
        setItems(updatedItems);
        if (apiAvailable) {
          deleteItemDebounced(id);
        }
        // Đặt focus vào item gần nhất phía trên hoặc tạo mới nếu không còn item nào
        if (updatedItems.length === 0) {
          const newBlockId = generateRandomId();
          setItems([
            {
              id: newBlockId,
              placeholder: "Type your content here...",
              heading: "",
              code: "",
              order: 0,
            },
          ]);
          setBlockId(newBlockId);
          setTimeout(() => {
            const newTextarea = editTextareaRefs.current[newBlockId];
            if (newTextarea) {
              newTextarea.focus();
            }
          }, 0);
        } else if (currentItemIndex > 0) {
          const previousItemId = updatedItems[currentItemIndex - 1].id;
          setTimeout(() => {
            const previousTextarea = editTextareaRefs.current[previousItemId];
            if (previousTextarea) {
              previousTextarea.focus();
              // Đặt con trỏ vào cuối nội dung
              previousTextarea.setSelectionRange(
                previousTextarea.value.length,
                previousTextarea.value.length
              );
            }
          }, 0);
        }
      }
    }
  };

  // sự kiện tổ hợp phím ctrl + để chọn menu
  const handleKeyDownGlobal = async (e) => {
    if (e.ctrlKey) {
      const id = activeDropdown;
      if (e.key === "1" && id) {
        e.preventDefault();
        await applyHeadingFormat(id, "heading-1");
      } else if (e.key === "2" && id) {
        e.preventDefault();
        await applyHeadingFormat(id, "heading-2");
      } else if (e.key === "3" && id) {
        e.preventDefault();
        await applyHeadingFormat(id, "heading-3");
      } else if (e.key === "d" && id) {
        e.preventDefault();
        setItems((prevItems) => prevItems.filter((item) => item.id !== id)); // remove id of item has choose
        await deleteItem(id, true);
        if (items.length === 0) {
          const newBlockId = generateRandomId();
          setItems([
            {
              id: newBlockId,
              placeholder: "Type your content here...",
              heading: "",
              code: "",
              order: 0,
            },
          ]);
          setBlockId(newBlockId);
        }
      } else if (e.key === "4" && id) {
        e.preventDefault();
        await applyHeadingFormat(id, "heading-4");
      }
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDownGlobal);
    return () => document.removeEventListener("keydown", handleKeyDownGlobal);
  }, [activeDropdown]);

  const deleteItem = async (id, noti) => {
    try {
      await axiosInstance.delete(`/api/Items/delete-item/${id}`);
      if (noti) {
        message.success("Deleted", 0.5);
      }
      return true;
    } catch (error) {
      if (noti) {
        message.error("Error deleting item", 0.5);
      }
      return false;
    }
  };
  const deleteItemDebounced = useCallback(
    debounce(async (id) => {
      if (apiAvailable) {
        await deleteItem(id, false);
      }
    }, 500),
    [apiAvailable]
  );
  const deleteAllItems = async () => {
    try {
      const response = await axiosInstance.delete("/api/Items");
      message.destroy("Delete...", 1);
      console.log(response.data.message);
    } catch (error) {
      console.error(
        "Error deleting items:",
        error.response ? error.response.data.message : error.message
      );
    }
  };

  const handleDeleteAll = () => {
    deleteAllItems();
    setItems([]);
    const newBlockId = generateRandomId();
    setItems([
      {
        id: newBlockId,
        placeholder: "Type your content here...",
        heading: "",
        code: "",
        order: 0,
      },
    ]);
    setBlockId(newBlockId);
    setTimeout(() => {
      editTextareaRefs.current[newBlockId]?.focus();
    }, 0);
  };

  const saveItems = async (updatedItems, showNoti) => {
    if (!apiAvailable) {
      return;
    }
    const hideLoading = showNoti ? handleAction("Saving") : () => {};

    try {
      console.log("Saving items:", updatedItems);
      await axiosInstance.post("/api/Items/bulk", updatedItems);
      if (showNoti) {
        message.success("Saved", 1);
      }
    } catch (error) {
      console.error("Error saving items:", error);
      if (showNoti) {
        message.error("Error saving items", 1);
      }
    } finally {
      if (hideLoading) {
        setTimeout(hideLoading, 500);
      }
    }
  };

  const saveItemsDebounced = useCallback(
    debounce(async (updatedItems) => {
      await saveItems(updatedItems, false);
    }, 1000), // thời gian gọi cập nhật thay đổi khi người dùng không thay đổi nội dung trong textarea
    []
  );

  const handleChangeContent = useCallback(
    (id, value) => {
      setNewContent((prev) => ({ ...prev, [id]: value }));
      const updatedItems = items.map((item) =>
        item.id === id ? { ...item, content: value } : item
      );
      setItems(updatedItems);
      saveItemsDebounced(updatedItems);
    },
    [items, setNewContent, setItems, saveItemsDebounced]
  );

  const handlePaste = async (e, id) => {
    const clipboardItems = e.clipboardData.items;
    let imageFound = false;

    for (let i = 0; i < clipboardItems.length; i++) {
      if (clipboardItems[i].type.indexOf("image") !== -1) {
        imageFound = true; //  find image from clipboard
        const blob = clipboardItems[i].getAsFile();
        const formData = new FormData();
        formData.append("file", blob);
        setLoadingImage(id);

        try {
          const response = await axiosInstance.post(
            "/api/Items/upload",
            formData
          );

          if (response.status !== 200) {
            throw new Error("Failed to upload image");
          }
          responseDataImage(response, e, id);
        } catch (error) {
          console.error("Error uploading image:", error);
        } finally {
          setLoadingImage(null);
        }

        e.preventDefault();
        break;
      }
    }
    if (!imageFound) {
      setLoadingImage(null);
    }
  };
  const onDownload = (imgUrl) => {
    fetch(imgUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const url = URL.createObjectURL(new Blob([blob]));
        const link = document.createElement("a");
        link.href = url;
        link.download = "image.png";
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(url);
        link.remove();
      });
  };
  const renderItemContent = (item) => {
    if (
      item.content &&
      item.content.match(/\.(jpeg|jpg|gif|png|webp|heic)$/) != null
    ) {
      return (
        <Image
          width={200}
          src={item.content}
          style={{
            maxWidth: "100%",
            maxHeight: "200px",
            border: "2px solid black",
          }}
          preview={{
            toolbarRender: (
              _,
              {
                image: { url },
                transform: { scale },
                actions: {
                  onFlipY,
                  onFlipX,
                  onRotateLeft,
                  onRotateRight,
                  onZoomOut,
                  onZoomIn,
                  onReset,
                },
              }
            ) => (
              <Space size={12} className="toolbar-wrapper">
                <DownloadOutlined onClick={() => onDownload(url)} />
                <SwapOutlined rotate={90} onClick={onFlipY} />
                <SwapOutlined onClick={onFlipX} />
                <RotateLeftOutlined onClick={onRotateLeft} />
                <RotateRightOutlined onClick={onRotateRight} />
                <ZoomOutOutlined disabled={scale === 1} onClick={onZoomOut} />
                <ZoomInOutlined disabled={scale === 50} onClick={onZoomIn} />
                <UndoOutlined onClick={onReset} />
              </Space>
            ),
          }}
        />
      );
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <div className="w-full flex justify-end pr-10">
        <Popconfirm
          placement="topRight"
          title="Delete all"
          description="Delete all records"
          okText="Yes"
          cancelText="No"
          onConfirm={handleDeleteAll}
        >
          <button style={{ borderColor: "#21242b" }} className="main-button ">
            <span>Delete all</span>
          </button>
        </Popconfirm>
      </div>
      <div style={{ overflow: "hidden" }}>
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
                        <div className="container-block">
                          {renderItemContent(item) ? (
                            renderItemContent(item)
                          ) : (
                            <textarea
                              placeholder={item.placeholder}
                              value={newContent[item.id] || item.content}
                              onChange={(e) =>
                                handleChangeContent(item.id, e.target.value)
                              }
                              onKeyDown={(e) => handleKeyDown(e, item.id)}
                              onPaste={(e) => handlePaste(e, item.id)}
                              ref={(el) =>
                                (editTextareaRefs.current[item.id] = el)
                              }
                              className={`edit-textarea ${
                                item.heading ? `heading-${item.heading}` : ""
                              }`}
                            />
                          )}
                          {loadingImage === item.id && (
                            <div className="loading-overlay">
                              <Spin />
                            </div>
                          )}
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
                              <svg
                                style={{
                                  width: "10px",
                                  marginLeft: "5px",
                                  padding: "0px !important",
                                }}
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 10 16"
                              >
                                <path d="M4 14c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM2 6C.9 6 0 6.9 0 8s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6C.9 0 0 .9 0 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                              </svg>
                            </span>
                          </Dropdown>
                        </div>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </>
  );
};

export default Notion;
