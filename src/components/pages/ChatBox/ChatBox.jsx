import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import PropTypes from "prop-types";
import { Dropdown, Menu, Modal } from "antd";
import "./ChatBox.scss";
import { useChat } from "../../../contexts/ChatContext";
import { useSignalR } from "../../../contexts/SignalRContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan, faEraser, faGear, faRecycle, faXmark } from "@fortawesome/free-solid-svg-icons";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import axiosInstance from "../../../axiosConfig";
import { cardio } from 'ldrs'
cardio.register()
const useUsername = () => {
  const tokenFromStorage = Cookies.get("token");
  if (tokenFromStorage) {
    try {
      const decodedToken = jwt_decode(tokenFromStorage);
      return decodedToken[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
      ];
    } catch (error) {
      console.error("Error decoding token:", error);
      return "mèo con ẩn danh";
    }
  }
  return "mèo con ẩn danh";
};
const useUserId = () => {
  const tokenFromStorage = Cookies.get("token");
  if (tokenFromStorage) {
    try {
      const decodedToken = jwt_decode(tokenFromStorage);
      return decodedToken[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
      ];
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  }
  return null;
};
const ChatBox = ({ onClose }) => {
  const [message, setMessage] = useState("");
  const [latestMessageFromUser, setLatestMessageFromUser] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const { messages, setMessages } = useChat();
  const { connection } = useSignalR();
  const textareaRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const username = useUsername();
  const userId = useUserId();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleScroll = () => {
    if (chatMessagesRef.current) {
      sessionStorage.setItem(
        "chatScrollPosition",
        chatMessagesRef.current.scrollTop
      );
    }
  };

  useLayoutEffect(() => {
    const storedScrollPosition = sessionStorage.getItem("chatScrollPosition");
    if (chatMessagesRef.current && storedScrollPosition) {
      chatMessagesRef.current.scrollTop = parseInt(storedScrollPosition, 10);
    }
  }, [messagesLoaded]);

  useEffect(() => {
    const storedScrollPosition = sessionStorage.getItem("chatScrollPosition");
    if (chatMessagesRef.current && storedScrollPosition) {
      chatMessagesRef.current.scrollTop = parseInt(storedScrollPosition, 10);
    }
    const chatMessagesCurrent = chatMessagesRef.current;
    if (chatMessagesCurrent) {
      chatMessagesCurrent.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (chatMessagesCurrent) {
        chatMessagesCurrent.removeEventListener("scroll", handleScroll);
      }
      if (chatMessagesRef.current) {
        sessionStorage.setItem(
          "chatScrollPosition",
          chatMessagesRef.current.scrollTop
        );
      }
    };
  }, []);
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await axiosInstance.get("/api/Chat/get-chats");
        if (response.status === 200) {
          const chatMessages = response.data;
          setMessages(chatMessages);
          setMessagesLoaded(true);
        } else {
          console.error("Failed to fetch messages");
        }
      } catch (error) {
        console.error("Error fetching messages: ", error);
      }
    };
    fetchMessages();
  }, [setMessages]);
  useEffect(() => {
    const isFirstLoad = sessionStorage.getItem("isFirstLoad");
    if (messagesLoaded && chatMessagesRef.current) {
      if (initialLoad && !isFirstLoad) {
        chatMessagesRef.current.scrollTo({
          top: chatMessagesRef.current.scrollHeight,
          behavior: "smooth",
        });
        setInitialLoad(false);
        sessionStorage.setItem("isFirstLoad", "false");
      } else if (latestMessageFromUser) {
        chatMessagesRef.current.scrollTo({
          top: chatMessagesRef.current.scrollHeight,
          behavior: "smooth",
        });
        setLatestMessageFromUser(false);
      }
    }
  }, [messagesLoaded, messages, latestMessageFromUser, initialLoad]);

  const handleSendMessage = useCallback(async () => {
    if (message.trim() && connection) {
      const tempMessageId = Date.now();
      const newMessage = {
        userId: userId || "anonymous",
        userName: username || "mèo con ẩn danh",
        content: message,
        sentDate: new Date().toISOString(),
        id: tempMessageId,
        status: "sending",
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setMessage("");
      setLatestMessageFromUser(true);
      try {
        const response = await axiosInstance.post("/api/Chat/add-chat", {
          userId: userId,
          userName: username,
          content: message,
        });
        if (response.status === 200) {
          const savedMessage = response.data;
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === tempMessageId
                ? { ...savedMessage, status: "sent" }
                : msg
            )
          );



        } else {
          console.error("Failed to send message");
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === tempMessageId ? { ...msg, status: "failed" } : msg
            )
          );
        }
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } catch (err) {
        console.error("Send message failed: ", err);
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempMessageId ? { ...msg, status: "failed" } : msg
          )
        );
      }
    }
  }, [message, userId, username, setMessages, connection]);
  const handleChange = (e) => {
    setMessage(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMenuClick = async (e) => {
    if (messages.length === 0) {
      // messages trống, không cần xóa
      Modal.info({
        title: "No messages to clear",
        okText: "OK",
      });
      return;
    }

    switch (e.key) {
      case "clear":
        Modal.confirm({
          title: "Clear all chats?",
          okText: "Yes",
          okType: "danger",
          cancelText: "No",
          onOk: async () => {
            await deleteAllChats();
          },
        });
        break;
      case "clear-me":
        Modal.confirm({
          title: "Clear your chats?",
          okText: "Yes",
          okType: "danger",
          cancelText: "No",
          onOk: async () => {
            await deleteMeChats();
          },
        });
        break;
      default:
        break;
    }
  };

  const deleteAllChats = async () => {
    setIsDeleting(true);
    try {
      const response = await axiosInstance.delete("/api/Chat/delete-all-chats");
      if (response.status === 200) {
        console.log('All chats deleted successfully');
        setMessages([]); // update messages state
      } else {
        console.error('Failed to delete chats');
      }
    } catch (error) {
      console.error('Error deleting chats:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteMeChats = async () => {
    setIsDeleting(true);
    try {
      const response = await axiosInstance.delete(`/api/Chat/delete-me-chats/${userId}`);
      if (response.status === 200) {
        console.log('All chats deleted successfully');
        // gọi API nạp messages
        const fetchResponse = await axiosInstance.get("/api/Chat/get-chats");
        if (fetchResponse.status === 200) {
          setMessages(fetchResponse.data); // cập nhật messages
        } else {
          console.error('Failed to fetch updated messages');
        }
      } else {
        console.error('Failed to delete chats');
      }
    } catch (error) {
      console.error('Error deleting chats:', error);
    } finally {
      setIsDeleting(false);
    }
  };


  const menuProfile = (
    <Menu onClick={handleMenuClick} className="custom-dropdown-menu">
      <Menu.Item key="clear-me" icon={<FontAwesomeIcon icon={faEraser} />}>
        Clear my chats
      </Menu.Item>
      <Menu.Item danger key="clear" icon={<FontAwesomeIcon icon={faBan} />}>
        Clear
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h3 className="m-0 p-1 font-extrabold">Chat</h3>
        <div className="section">

          <Dropdown
            placement="bottomLeft"
            overlay={menuProfile}
            trigger={["click"]}
            onClick={() => setDropdownVisible(!dropdownVisible)}
            onOpenChange={(visible) => setDropdownVisible(visible)}
            className="mr-3"
          >
            <a
              className="ant-dropdown-link"
              onClick={(e) => e.preventDefault()}
            >
              <button className="p-1">
                <FontAwesomeIcon icon={faGear} />
              </button>
            </a>
          </Dropdown>
          <button className="p-1" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

      </div>
      <div className="chat-messages" ref={chatMessagesRef}>
        {isDeleting ? (
          <div className="no-messages">
            <l-cardio
              size="50"
              stroke="4"
              speed="0.5"
              color="black"
            ></l-cardio>
          </div>

        ) : messages.length === 0 ? (
          <div className="no-messages">
            <h1>Empty messages</h1>
          </div>
        ) :
          (messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-message ${msg.status === "sending" ? "sending-message" : ""
                } ${msg.userName === username ? "sent-message" : "received-message"
                }`}
            >
              <strong className="chat-user">{msg.userName}</strong>
              <p className="chat-text">{msg.content}</p>
              <p className="chat-date">
                {new Date(msg.sentDate)
                  .toLocaleString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                  .replace(",", ", ")}
              </p>
            </div>
          )))}
      </div>
      <div className="chat-input">
        <textarea
          className="chatbox-input"
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message"
          rows={1}
          style={{ overflow: "hidden", resize: "none" }}
        />
        <button onClick={handleSendMessage}>
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </div>
    </div >
  );
};
ChatBox.propTypes = {
  onClose: PropTypes.func.isRequired,
};
export default ChatBox;