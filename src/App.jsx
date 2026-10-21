import { useState, useEffect, lazy, Suspense } from "react";
import { AuthProvider } from "../src/contexts/AuthContext";
import Header from "./components/layouts/Header/Header";
import { BrowserRouter, Navigate } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import { SignalRProvider, useSignalR } from "./contexts/SignalRContext";
import { ChatProvider, useChat } from "./contexts/ChatContext";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { useSignalRConnection } from "./hooks/useSignalRConnection";
import useTracking from "./hooks/useTracking";
import { applyGlobalSettings } from "./utils/applyGlobalSettings";
import { useDeadlineReminders } from "./hooks/useDeadlineReminders";
import { registerReminderSW } from "./utils/notifyBrowser";
// The landing page ("/" redirects here) ships with the entry so the first
// visit doesn't wait for a second round-trip.
import DailyNoteApp from "./components/pages/Note/DailyNoteApp";

// Pages load on demand so a visit to one route doesn't download the others
// (three.js games, tiptap editor, antd dashboards…).
const Realtime = lazy(() => import("./components/pages/Signal/Signal"));
const Notion = lazy(() => import("./components/pages/Notion/Notion"));
const Login = lazy(() => import("./components/pages/Login/Login"));
const LoginSuccess = lazy(() => import("./components/pages/Login/LoginSuccess"));
const Register = lazy(() => import("./components/pages/Register/Register"));
const Profile = lazy(() => import("./components/pages/Profile/Profile"));
const Note = lazy(() => import("./components/pages/Note/Note"));
const Page = lazy(() => import("./components/pages/Page/Page"));
const Content = lazy(() => import("./components/pages/Content/Content"));
const Setting = lazy(() => import("./components/pages/Setting/Setting"));
const ChatBox = lazy(() => import("./components/pages/ChatBox/ChatBox"));
// The floating chat button pulls in the whole chat drawer (markdown, gestures…),
// so it loads after the page instead of blocking it.
const FloatingButton = lazy(() => import("./components/pages/ChatBox/FloatingButton"));
const NotFound = lazy(() => import("./components/pages/NotFound/NotFound"));
const FilesPage = lazy(() => import("./pages/FilesPage"));
const InsightDashboard = lazy(() => import("./components/pages/InsightDashboard/InsightDashboard"));
const MiniGame = lazy(() => import("./components/pages/MiniGame/MiniGame"));
const PixelGame = lazy(() => import("./components/pages/PixelGame/PixelGame"));
const IsoCity = lazy(() => import("./components/pages/IsoCity/IsoCity"));
const DesktopApp = lazy(() => import("./components/pages/DesktopApp/DesktopApp"));


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
      <Suspense fallback={<div className="route-loading" aria-busy="true" />}>
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
        <Route path="/iso-city" element={<IsoCity />} />
        <Route path="/desktop" element={<DesktopApp />} />
        <Route path="/desktop-auth" element={<DesktopApp />} />

        <Route path="*" element={<NotFound />}></Route>
      </Routes>
      </Suspense>
      <Suspense fallback={null}>
        <FloatingButton
          onClick={handleFloatingButtonClick}
          newMessagesCount={newMessagesCount}
        />
      </Suspense>
      {showChatBox && (
        <Suspense fallback={null}>
          <ChatBox onClose={handleFloatingButtonClick} />
        </Suspense>
      )}
    </>
  );
};

export default App;
