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

const ChatBox = ({ onClose }) => {
  const [message, setMessage] = useState("");
  const [latestMessageFromUser, setLatestMessageFromUser] = useState(false);
  const { messages, setMessages } = useChat();
  const { connection } = useSignalR();
  const textareaRef = useRef(null);
  const chatMessagesRef = useRef(null);

  const username = useUsername();

  useEffect(() => {
    if (chatMessagesRef.current && latestMessageFromUser) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: "smooth",
      });
      setLatestMessageFromUser(false);
    }
  }, [messages, latestMessageFromUser]);

  const handleSendMessage = useCallback(async () => {
    if (message.trim() && connection) {
      const tempMessageId = Date.now();
      setMessages((prevMessages) => [
        ...prevMessages,
        { user: username, message: "sending...", id: tempMessageId },
      ]);

      try {
        await connection.invoke("SendMessage", username, message);
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempMessageId ? { ...msg, message } : msg
          )
        );
        setMessage("");
        setLatestMessageFromUser(true); // Mark that the latest message is from the user
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } catch (err) {
        console.error("Send message failed: ", err);
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== tempMessageId)
        );
      }
    }
  }, [message, connection, setMessages, username]);

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
              msg.message === "sending..." ? "sending-message" : ""
            } ${msg.user === username ? "sent-message" : "received-message"}`}
          >
            <strong className="chat-user">{msg.user}</strong>
            <p className="chat-text">{msg.message}</p>
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
