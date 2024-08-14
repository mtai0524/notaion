import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import "./ChatBox.scss";
import { useChat } from "../../../contexts/ChatContext";
import { useSignalR } from "../../../contexts/SignalRContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";

const ChatBox = ({ onClose, incrementNewMessages }) => {
  const [message, setMessage] = useState("");
  const { messages, setMessages } = useChat();
  const { connection, connectionId } = useSignalR();

  const textareaRef = useRef(null);
  const chatMessagesRef = useRef(null);

  useEffect(() => {
    if (!connection) return;

    const handleReceiveMessage = (user, receivedMessage) => {
      console.log("Message received:", user, receivedMessage);
      if (user !== connectionId) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { user, message: receivedMessage },
        ]);
        incrementNewMessages();
      }
    };

    connection.on("ReceiveMessage", handleReceiveMessage);

    return () => {
      connection.off("ReceiveMessage", handleReceiveMessage);
    };
  }, [connection, setMessages, connectionId, incrementNewMessages]);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (message.trim() && connection) {
      const tempMessageId = Date.now();
      setMessages((prevMessages) => [
        ...prevMessages,
        { user: connectionId, message: "sending...", id: tempMessageId },
      ]);

      try {
        await connection.invoke("SendMessage", connectionId, message);

        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempMessageId ? { ...msg, message } : msg
          )
        );
        setMessage("");

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
  }, [message, connection, setMessages, connectionId]);

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
            }`}
          >
            <strong>{msg.user}:</strong> {msg.message}
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
  incrementNewMessages: PropTypes.func.isRequired,
};

export default ChatBox;
