import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import "./ChatBox.scss";
import { useChat } from "../../../contexts/ChatContext";
import { useSignalR } from "../../../contexts/SignalRContext";

const ChatBox = ({ onClose }) => {
  const [message, setMessage] = useState("");
  const { messages, setMessages } = useChat();
  const { connection, connectionId } = useSignalR();

  const textareaRef = useRef(null);

  useEffect(() => {
    if (!connection) return;

    const handleReceiveMessage = (user, receivedMessage) => {
      console.log("Message received:", user, receivedMessage);
      if (user !== connectionId) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { user, message: receivedMessage },
        ]);
      }
    };

    connection.on("ReceiveMessage", handleReceiveMessage);

    return () => {
      connection.off("ReceiveMessage", handleReceiveMessage);
    };
  }, [connection, setMessages, connectionId]);

  const handleSendMessage = useCallback(async () => {
    if (message.trim() && connection) {
      try {
        await connection.invoke("SendMessage", connectionId, message);

        setMessages((prevMessages) => [
          ...prevMessages,
          { user: connectionId, message },
        ]);
        setMessage("");

        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } catch (err) {
        console.error("Send message failed: ", err);
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
        <h3>Chat</h3>
        <button onClick={onClose}>&times;</button>
      </div>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className="chat-message">
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
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

ChatBox.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default ChatBox;
