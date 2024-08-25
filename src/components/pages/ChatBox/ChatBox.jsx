import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import "./ChatBox.scss";
import { useChat } from "../../../contexts/ChatContext";
import { useSignalR } from "../../../contexts/SignalRContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import axiosInstance from "../../../axiosConfig";

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
  const { messages, setMessages } = useChat();
  const { connection } = useSignalR();
  const textareaRef = useRef(null);
  const chatMessagesRef = useRef(null);

  const username = useUsername();
  const userId = useUserId();

  const handleScroll = () => {
    if (chatMessagesRef.current) {
      sessionStorage.setItem(
        "chatScrollPosition",
        chatMessagesRef.current.scrollTop
      );
    }
  };

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
    if (chatMessagesRef.current && latestMessageFromUser) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: "smooth",
      });
      setLatestMessageFromUser(false);
    }
  }, [messages, latestMessageFromUser]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await axiosInstance.get("/api/Chat/get-chats");
        console.log("cc", response.data);

        if (response.status === 200) {
          const chatMessages = response.data;
          setMessages(chatMessages);
        } else {
          console.error("Failed to fetch messages");
        }
      } catch (error) {
        console.error("Error fetching messages: ", error);
      }
    };

    fetchMessages();
  }, [setMessages]);

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

          await connection.invoke(
            "SendMessage",
            username,
            savedMessage.content
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

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h3 className="m-0 p-1 font-extrabold">Chat</h3>
        <button className="p-1" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <div className="chat-messages" ref={chatMessagesRef}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`chat-message ${
              msg.status === "sending" ? "sending-message" : ""
            } ${
              msg.userName === username ? "sent-message" : "received-message"
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
        ))}
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
    </div>
  );
};

ChatBox.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default ChatBox;
