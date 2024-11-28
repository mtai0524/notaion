import { useState, useEffect } from "react";
import { AuthProvider } from "../src/contexts/AuthContext";
import Header from "./components/layouts/Header/Header";
import { BrowserRouter, Navigate } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import Realtime from "./components/pages/Signal/Signal";
import Notion from "./components/pages/Notion/Notion";
import Login from "./components/pages/Login/Login";
import Register from "./components/pages/Register/Register";
import Profile from "./components/pages/Profile/Profile";
import Guide from "./components/pages/Guide/Guide";
import Note from "./components/pages/Note/Note";
import Page from "./components/pages/Page/Page";
import Content from "./components/pages/Content/Content";
import Setting from "./components/pages/Setting/Setting";
import { SignalRProvider, useSignalR } from "./contexts/SignalRContext";
import FloatingButton from "./components/pages/ChatBox/FloatingButton";
import ChatBox from "./components/pages/ChatBox/ChatBox";
import { ChatProvider, useChat } from "./contexts/ChatContext";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import NotFound from "./components/pages/NotFound/NotFound";
import { useSignalRConnection } from "./hooks/useSignalRConnection";

const App = () => {
  return (
    <AuthProvider>
      <SignalRProvider>
        <ChatProvider>
          <MainApp />
        </ChatProvider>
      </SignalRProvider>
    </AuthProvider>
  );
};

const MainApp = () => {
  const [showChatBox, setShowChatBox] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(() => {
    return parseInt(localStorage.getItem("newMessagesCount")) || 0;
  });

  const { messages, setMessages } = useChat();
  const { connection } = useSignalR();

  const tokenFromStorage = Cookies.get("token");
  let username;

  if (tokenFromStorage) {
    try {
      const decodedToken = jwt_decode(tokenFromStorage);
      username =
        decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
    } catch (error) {
      console.error("Error decoding token:", error);
      username = localStorage.getItem("anonymousName") || "mèo con";
    }
  } else {
    username = localStorage.getItem("anonymousName") || "mèo con";
  }



  useEffect(() => {
    if (!connection) return;

    const handleReceiveMessage = (user, receivedMessage) => {
      console.log("Message received:", user, receivedMessage);
      console.log("user       " + user);
      if (user !== username) {
        console.log("user" + user);
        console.log("username" + username);

        setMessages((prevMessages) => [
          ...prevMessages,
          {
            userName: user,
            content: receivedMessage,
            sentDate: new Date().toISOString(),
          },
        ]);
        setNewMessagesCount((prevCount) => {
          const newCount = prevCount + 1;
          localStorage.setItem("newMessagesCount", newCount);
          return newCount;
        });
      }
    };

    connection.on("ReceiveMessage", handleReceiveMessage);

    return () => {
      connection.off("ReceiveMessage", handleReceiveMessage);
    };
  }, [connection, setMessages, username]);

  const clearChatList = () => {
    setMessages([]); // clear chat when close
  };

  const handleFloatingButtonClick = () => {
    if (showChatBox) {
      clearChatList();
      setNewMessagesCount(0);
      localStorage.setItem("newMessagesCount", 0);
    }
    setShowChatBox(!showChatBox);
  };

  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/home-page" />} />
        <Route path="/signal" element={<Realtime />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home-page" element={<Notion />} />
        <Route path="/profile/:identifier" element={<Profile />} />
        <Route path="/profile/" element={<Profile />} />
        <Route path="/page/" element={<Page />} />
        <Route path="/page/content/:id" element={<Content />} />
        <Route path="/setting/" element={<Setting />} />
        <Route path="/guide/" element={<Guide />} />
        <Route path="/note/" element={<Note />} />
        <Route path="*" element={<NotFound />}></Route>
      </Routes>
      <FloatingButton
        onClick={handleFloatingButtonClick}
        newMessagesCount={newMessagesCount}
      />
      {showChatBox && <ChatBox onClose={handleFloatingButtonClick} />}
    </BrowserRouter>
  );
};

export default App;
