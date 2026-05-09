import { createContext, useContext, useState } from "react";
import PropTypes from "prop-types";

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  return (
    <ChatContext.Provider value={{ messages, setMessages, isAiThinking, setIsAiThinking }}>
      {children}
    </ChatContext.Provider>
  );
};

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
