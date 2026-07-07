import { useState, useEffect } from "react";
import { AuthProvider } from "../src/contexts/AuthContext";
import Header from "./components/layouts/Header/Header";
import { BrowserRouter, Navigate } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import Realtime from "./components/pages/Signal/Signal";
import Notion from "./components/pages/Notion/Notion";
import Login from "./components/pages/Login/Login";
import LoginSuccess from "./components/pages/Login/LoginSuccess";
import Home from "./components/pages/Home/Home";
import Register from "./components/pages/Register/Register";
import Profile from "./components/pages/Profile/Profile";
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
import useTracking from "./hooks/useTracking";
import FilesPage from "./pages/FilesPage";
import DailyNoteApp from "./components/pages/Note/DailyNoteApp";
import InsightDashboard from "./components/pages/InsightDashboard/InsightDashboard";
import MiniGame from "./components/pages/MiniGame/MiniGame";
import PixelGame from "./components/pages/PixelGame/PixelGame";
import { applyGlobalSettings } from "./utils/applyGlobalSettings";
import { useDeadlineReminders } from "./hooks/useDeadlineReminders";
import { registerReminderSW } from "./utils/notifyBrowser";


const App = () => {
  return (
    <AuthProvider>
      <SignalRProvider>
        <ChatProvider>
          <BrowserRouter>
            <MainApp />
          </BrowserRouter>
        </ChatProvider>
      </SignalRProvider>
    </AuthProvider>
  );
};

const MainApp = () => {
  useTracking();
  const [showChatBox, setShowChatBox] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(() => {
    return parseInt(localStorage.getItem("newMessagesCount")) || 0;
  });

  const { messages, setMessages, setIsAiThinking } = useChat();
  const { connection } = useSignalR();

  const tokenFromStorage = Cookies.get("token");
  useDeadlineReminders(Boolean(tokenFromStorage));
  useEffect(() => { registerReminderSW(); }, []);
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
    applyGlobalSettings();

    const onSettingsChange = () => applyGlobalSettings();
    window.addEventListener('notaion:settings-changed', onSettingsChange);
    window.addEventListener('storage', onSettingsChange);
    return () => {
      window.removeEventListener('notaion:settings-changed', onSettingsChange);
      window.removeEventListener('storage', onSettingsChange);
    };
  }, []);

  // Open public ChatBox + forward focus payload to ChatBox listener
  useEffect(() => {
    const handler = (event) => {
      const detail = event.detail || {};
      setShowChatBox(true);
      // Defer focus event so ChatBox has time to mount
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('notaion:focus-public-message', { detail }));
      }, 250);
    };
    window.addEventListener('notaion:open-chat-public', handler);
    return () => window.removeEventListener('notaion:open-chat-public', handler);
  }, []);

  useEffect(() => {
    const handleNewMessage = (event) => {
      const { user, content } = event.detail;
      console.log(`[App-Event] Incoming: user=${user}`);

      // 1. Luôn tắt trạng thái thinking nếu tên là Chatbot
      if (user && user.toLowerCase().includes("chatbot")) {
        console.log("[App-Event] Resetting AI thinking state...");
        setIsAiThinking(false);
      }

      // 2. Thông báo và đếm số tin nhắn mới
      if (user !== username) {
        setNewMessagesCount((prevCount) => {
          const newCount = prevCount + 1;
          localStorage.setItem("newMessagesCount", newCount);
          return newCount;
        });
      }
    };

    window.addEventListener("new-signalr-message", handleNewMessage);
    return () => window.removeEventListener("new-signalr-message", handleNewMessage);
  }, [username, setIsAiThinking]);

  const clearChatList = () => {
    setMessages([]); // clear chat when close
    setIsAiThinking(false);
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
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/daily-note" />} />
        <Route path="/signal" element={<Realtime />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login-success" element={<LoginSuccess />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home-page" element={<InsightDashboard />} />
        <Route path="/dashboard" element={<InsightDashboard />} />
        <Route path="/notion" element={<Notion />} />
        <Route path="/profile/:identifier" element={<Profile />} />
        <Route path="/profile/" element={<Profile />} />
        <Route path="/page/" element={<Page />} />
        <Route path="/page/content/:id" element={<Content />} />
        <Route path="/setting/" element={<Setting />} />
        <Route path="/note" element={<Note />} />
        <Route path="/daily-note" element={<DailyNoteApp />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/game" element={<MiniGame />} />
        <Route path="/pixel-game" element={<PixelGame />} />

        <Route path="*" element={<NotFound />}></Route>
      </Routes>
      <FloatingButton
        onClick={handleFloatingButtonClick}
        newMessagesCount={newMessagesCount}
      />
      {showChatBox && <ChatBox onClose={handleFloatingButtonClick} />}
    </>
  );
};

export default App;
