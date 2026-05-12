import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { Dropdown, Empty, Menu, Modal, notification } from "antd";
import "./ChatBox.scss";
import { useChat } from "../../../contexts/ChatContext";
import { useSignalR } from "../../../contexts/SignalRContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsLeftRight, faBan, faBookOpen, faCompress, faEraser, faExpand, faGear, faRobot, faXmark, faSearch, faCopy, faRedo, faArrowDown, faDownload, faVolumeHigh, faVolumeXmark, faCompressArrowsAlt, faExpandArrowsAlt, faCheck, faPaperclip, faUsers, faFilter } from "@fortawesome/free-solid-svg-icons";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import axiosInstance from "../../../axiosConfig";
import { uploadFilesToCloudinary } from "../../../services/fileService";
import { cardio } from 'ldrs'
import ReactMarkdown from 'react-markdown';
cardio.register()
const useUsername = () => {
  const animalNames = [
    "Lạc đà cười",
    "Cá sấu đeo kính",
    "Chim cánh cụt lười",
    "Khỉ nhí nhố",
    "Nhím xù xì",
    "Cú mèo thức đêm",
    "Cá mập baby",
    "Tê giác điệu đà",
    "Chồn lông mượt",
    "Vịt bầu hát hò",
    "Dê núi hài hước",
    "Hươu cao cổ khệnh khạng",
    "Ốc sên tăng tốc",
    "Cò bay lượn",
    "Cua đỏ lém lỉnh",
    "Ếch xanh ẩm ướt",
    "Bướm đêm kỳ ảo",
    "Bò cạp bí ẩn",
    "Chuồn chuồn lướt gió",
    "Chuột túi bật nhảy",
    "Lợn con hồng hào",
    "Cừu lông xù",
    "Hải ly xây đập",
    "Bò tót mạnh mẽ",
    "Kiến chăm chỉ",
    "Ruồi nhanh nhẹn",
    "Tôm hùm đỏ rực",
    "Cá vàng hay quên",
    "Sáo đen líu lo",
    "Gấu Bắc Cực lạnh lùng",
    "Chồn hôi tinh nghịch",
    "Dơi đêm bí ẩn",
    "Sâu béo ngủ đông",
    "Chuột lém lỉnh",
    "Cá trê siêu quậy",
    "Heo mọi đáng yêu",
    "Gà mái siêng năng",
    "Vịt trời phiêu lưu",
    "Lươn vàng trơn tuột",
    "Cua nhảy múa",
    "Sói già thông thái",
    "Cáo lém lỉnh",
    "Hươu sao tinh nghịch",
    "Lợn rừng dũng mãnh",
    "Ngựa hoang tự do",
    "Bò rừng khổng lồ",
    "Sư tử hào hoa",
    "Vượn bay siêu tốc",
    "Rái cá tấu hài",
    "Cóc cụ triết lý",
    "Chuồn chuồn tia chớp",
    "Nhện thợ dệt",
    "Bò sát lạnh lùng",
    "Chim sâu tò mò",
    "Cá đuối uyển chuyển",
    "Tép nhảy hip hop",
    "Cá cơm nhanh nhảu",
    "Bạch tuộc đa năng",
    "Hải mã chững chạc",
    "Chim ưng săn mồi",
    "Cá voi hát opera",
    "Cọp vằn kiêu ngạo",
    "Lợn nái dễ thương",
    "Chim yến du dương",
    "Ốc biển lười biếng",
    "Bồ câu hòa bình",
    "Tê tê ẩn mình",
    "Gấu Koala mê ngủ",
  ];

  const tokenFromStorage = Cookies.get("token");
  if (tokenFromStorage) {
    try {
      const decodedToken = jwt_decode(tokenFromStorage);
      return decodedToken[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
      ];
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }

  const existingAnimalName = localStorage.getItem("anonymousName");
  if (existingAnimalName) {
    return existingAnimalName;
  }

  const randomAnimalName =
    animalNames[Math.floor(Math.random() * animalNames.length)];

  localStorage.setItem("anonymousName", randomAnimalName);

  return randomAnimalName;
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
  const { onlineUsers } = useSignalR();
  const token = Cookies.get("token");
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isMessageSent, setIsMessageSent] = useState(false);
  const [aiMode, setAiMode] = useState(() => localStorage.getItem("aiMode") === "true");
  const { isAiThinking, setIsAiThinking } = useChat();
  const scrollHeightBeforeUpdateRef = useRef(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStudyMode, setIsStudyMode] = useState(false);

  // UX enhancements state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [copiedKey, setCopiedKey] = useState(null);
  const isAtBottomRef = useRef(true);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);

  // User-filter sidebar
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [userFilter, setUserFilter] = useState(null);

  // Attachment upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Chat preferences (persisted)
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem("chatCompactMode") === "true");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("chatSoundEnabled") === "true");
  const [autoScroll, setAutoScroll] = useState(() => {
    const v = localStorage.getItem("chatAutoScroll");
    return v === null ? true : v === "true";
  });
  const autoScrollRef = useRef(autoScroll);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { autoScrollRef.current = autoScroll; }, [autoScroll]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const togglePref = useCallback((key, current, setter) => {
    const next = !current;
    setter(next);
    localStorage.setItem(key, String(next));
  }, []);

  const playPing = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(540, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      setTimeout(() => ctx.close().catch(() => {}), 400);
    } catch (e) {
      /* ignore */
    }
  }, []);

  const exportChat = useCallback(() => {
    if (!messages || messages.length === 0) {
      notification.info({ message: "Không có tin nhắn để export", duration: 2 });
      return;
    }
    const lines = messages.map((m) => {
      const ts = m.sentDate ? new Date(m.sentDate).toLocaleString("en-GB") : "";
      const who = m.userName || "anonymous";
      const body = (m.content || "").replace(/^\/bot\s*/i, "");
      return `### ${who} — ${ts}\n\n${body}\n`;
    });
    const blob = new Blob([`# Chat export\n\n${lines.join("\n---\n\n")}`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chat-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    URL.revokeObjectURL(url);
  }, [messages]);

  // Lắng nghe tin nhắn Realtime thông qua Custom Event (Từ SignalRContext)
  useEffect(() => {
    const handleNewMessage = (event) => {
      const { user, content } = event.detail;
      console.log(`[ChatBox-Event] New message from ${user}`);
      
      // Cập nhật danh sách tin nhắn
      if (user !== username) {
        setMessages((prev) => [
          ...prev,
          {
            userName: user,
            content: content,
            sentDate: new Date().toISOString(),
          },
        ]);
        if (soundEnabledRef.current) playPing();
        if (autoScrollRef.current && isAtBottomRef.current) {
          setLatestMessageFromUser(true);
        } else {
          setUnreadCount((c) => c + 1);
        }
      }

      if (user && user.toLowerCase().includes("chatbot")) {
        setIsAiThinking(false);
      }
    };

    window.addEventListener("new-signalr-message", handleNewMessage);
    return () => window.removeEventListener("new-signalr-message", handleNewMessage);
  }, [username, setMessages, setIsAiThinking]);

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

  // Tự động tắt trạng thái thinking nếu tin nhắn cuối cùng là của Chatbot (Fallback)
  useEffect(() => {
    if (messages.length > 0 && isAiThinking) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.userName === "Chatbot") {
        setIsAiThinking(false);
      }
    }
  }, [messages, isAiThinking, setIsAiThinking]);

  useLayoutEffect(() => {
    if (chatMessagesRef.current) {
      if (isMessageSent) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        setIsMessageSent(false);
        console.log(pageNumber);
      }
    }
  }, [isMessageSent]);

  useLayoutEffect(() => {
    if (chatMessagesRef.current) {
      if (pageNumber === 1) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
      } else if (scrollHeightBeforeUpdateRef.current > 0) {
        const newHeight = chatMessagesRef.current.scrollHeight;
        const diff = newHeight - scrollHeightBeforeUpdateRef.current;
        chatMessagesRef.current.scrollTop = diff;
        scrollHeightBeforeUpdateRef.current = 0;
      }
    }
  }, [messages, messagesLoaded]);


  const handleScrollInfinite = () => {
    const el = chatMessagesRef.current;
    if (!el) return;

    if (el.scrollTop <= 10 && !loading && hasMoreMessages) {
      scrollHeightBeforeUpdateRef.current = el.scrollHeight;
      setPageNumber(prevPage => prevPage + 1);
    }

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setIsAtBottom(nearBottom);
    if (nearBottom && unreadCount > 0) setUnreadCount(0);
  };

  const scrollToBottom = useCallback(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setUnreadCount(0);
  }, []);

  const fetchMessages = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const response = await axiosInstance.get("/api/Chat/get-chats", {
        params: { decrypt: true, pageNumber, pageSize: 15 },
      });
      if (response.status === 200) {
        const reversedMessages = response.data.items.reverse();

        if (reversedMessages.length === 0) {
          setHasMoreMessages(false); // Nếu không còn tin nhắn, ngừng tải thêm
        } else {
          setMessages(prevMessages => [...reversedMessages, ...prevMessages]);
          setMessagesLoaded(true);
        }
      } else {
        console.error("Failed to fetch messages");
      }
    } catch (error) {
      console.error("Error fetching messages: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchMessages();
    };

    fetchData();
  }, [pageNumber]);


  const handleAiModeToggle = () => {
    setAiMode((prev) => {
      const newAiMode = !prev;
      localStorage.setItem("aiMode", newAiMode);
      notification.info({
        message: newAiMode ? "AI Mode Activated" : "AI Mode Deactivated",
        description: newAiMode
          ? "You can giờ đây chat với AI Bot."
          : "Bạn đang chat với mọi người.",
        placement: "topRight",
        duration: 2,
      });

      return newAiMode;
    });
  };


  const sendMessageWithContent = useCallback(async (rawText, opts = {}) => {
    const text = (rawText || "").trim();
    if (!text || !connection) return;

    const useAi = opts.forceAi ?? aiMode;
    const messageContent = useAi ? `/bot ${text}` : text;

    const tempMessageId = Date.now();
    const newMessage = {
      userId: userId || "anonymous",
      userName: username || "mèo con ẩn danh",
      content: messageContent,
      sentDate: new Date().toISOString(),
      id: tempMessageId,
      status: "sending",
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setLatestMessageFromUser(true);

    if (useAi && !isStudyMode) {
      setIsAiThinking(true);
    }

    try {
      let response;
      if (isStudyMode && username === "minhtai") {
        response = await axiosInstance.post("/api/Chat/update-ai-memory", {
          userId: userId,
          userName: username,
          content: text,
        });

        if (response.status === 200) {
          notification.success({
            message: "Đã ghi vào bộ nhớ AI",
            description: "AI sẽ sử dụng kiến thức này trong các câu trả lời sau.",
            duration: 2
          });
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === tempMessageId
                ? { ...msg, content: `📝 [Đã học]: ${msg.content}`, status: "sent" }
                : msg
            )
          );
        }
        return;
      }

      response = await axiosInstance.post("/api/Chat/add-chat", {
        userId: userId,
        userName: username,
        content: messageContent,
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
        setIsMessageSent(true);
      } else {
        console.error("Failed to send message");
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempMessageId ? { ...msg, status: "failed" } : msg
          )
        );
      }
    } catch (err) {
      console.error("Send message failed: ", err);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempMessageId ? { ...msg, status: "failed" } : msg
        )
      );
    }
  }, [aiMode, connection, isStudyMode, setIsAiThinking, setMessages, userId, username]);

  const appendToMessage = useCallback((snippet) => {
    setMessage((prev) => {
      if (!prev) return snippet;
      const sep = prev.endsWith("\n") || prev.endsWith(" ") ? "" : "\n";
      return prev + sep + snippet;
    });
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
      }
    });
  }, []);

  const handleUploadFiles = useCallback(async (filesArray) => {
    const files = Array.from(filesArray || []).filter((f) => f && f.size > 0);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadFilesToCloudinary(files, (pct) => setUploadProgress(pct));
      if (!Array.isArray(uploaded) || uploaded.length === 0) {
        throw new Error("Upload trả về rỗng");
      }
      const snippets = uploaded.map((meta) => {
        const url = meta.cloudUrl;
        const name = meta.originalName || "attachment";
        if (!url) return "";
        const isImage = (meta.contentType || "").startsWith("image/");
        return isImage ? `![${name}](${url})` : `[📎 ${name}](${url})`;
      }).filter(Boolean).join("\n");

      if (snippets) appendToMessage(snippets);
      notification.success({
        message: `Đã tải lên ${uploaded.length} file`,
        duration: 1.5
      });
    } catch (err) {
      console.error("Upload failed", err);
      notification.error({
        message: "Upload thất bại",
        description: err?.response?.data?.title || err?.message || "Không xác định",
        duration: 3
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [appendToMessage]);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleUploadFiles(files);
    }
  }, [handleUploadFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) handleUploadFiles(files);
  }, [handleUploadFiles]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim()) return;
    const text = message;
    setMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessageWithContent(text);
  }, [message, sendMessageWithContent]);

  const handleRegenerate = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.userName !== "Chatbot" && (m.content || "").trim()) {
        const stripped = m.content.replace(/^\/bot\s*/i, "");
        if (stripped) {
          sendMessageWithContent(stripped, { forceAi: true });
          return;
        }
      }
    }
    notification.info({ message: "Không có câu hỏi nào để regenerate", duration: 2 });
  }, [messages, sendMessageWithContent]);

  const handleCopyMessage = useCallback(async (content, key) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    } catch (err) {
      console.error("Copy failed", err);
    }
  }, []);


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

  const handleMenuClick = async (e) => {
    switch (e.key) {
      case "compact":
        togglePref("chatCompactMode", compactMode, setCompactMode);
        return;
      case "sound":
        togglePref("chatSoundEnabled", soundEnabled, setSoundEnabled);
        return;
      case "autoscroll":
        togglePref("chatAutoScroll", autoScroll, setAutoScroll);
        return;
      case "export":
        exportChat();
        return;
      default:
        break;
    }

    if (messages.length === 0) {
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
    console.log(token);

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


  const userStats = useMemo(() => {
    const map = new Map();
    for (const m of messages) {
      const name = m.userName || "anonymous";
      const prev = map.get(name);
      const ts = m.sentDate ? new Date(m.sentDate).getTime() : 0;
      const last = (m.content || "").replace(/^\/bot\s*/i, "").replace(/!\[[^\]]*\]\([^)]+\)/g, "[image]");
      if (prev) {
        prev.count += 1;
        if (ts > prev.lastTs) { prev.lastTs = ts; prev.lastSnippet = last; }
      } else {
        map.set(name, { name, count: 1, lastTs: ts, lastSnippet: last });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastTs - a.lastTs);
  }, [messages]);

  const checkMark = (active) => (
    <FontAwesomeIcon icon={faCheck} style={{ opacity: active ? 1 : 0.15 }} />
  );

  const menuProfile = (
    <Menu onClick={handleMenuClick} className="custom-dropdown-menu chatbox-settings-menu">
      <Menu.Item key="compact" icon={checkMark(compactMode)}>
        <FontAwesomeIcon icon={compactMode ? faCompressArrowsAlt : faExpandArrowsAlt} style={{ marginRight: 8 }} />
        Compact mode
      </Menu.Item>
      <Menu.Item key="sound" icon={checkMark(soundEnabled)}>
        <FontAwesomeIcon icon={soundEnabled ? faVolumeHigh : faVolumeXmark} style={{ marginRight: 8 }} />
        Sound on new message
      </Menu.Item>
      <Menu.Item key="autoscroll" icon={checkMark(autoScroll)}>
        <FontAwesomeIcon icon={faArrowDown} style={{ marginRight: 8 }} />
        Auto-scroll
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="export" icon={<FontAwesomeIcon icon={faDownload} />}>
        Export chat (.md)
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="clear-me" icon={<FontAwesomeIcon icon={faEraser} />}>
        Clear my chats
      </Menu.Item>
      <Menu.Item danger key="clear" icon={<FontAwesomeIcon icon={faBan} />}>
        Clear
      </Menu.Item>
    </Menu>
  );

  const markdownComponents = {
    // Tùy chỉnh cách hiển thị link để giữ tính năng Embed YouTube/Spotify
    a: ({ href, children }) => {
      const embedRegex = /(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w\-]+)/g;
      const spotifyRegex = /(https?:\/\/open\.spotify\.com\/(?:track|album|playlist)\/[\w\-?=]+)/g;

      if (embedRegex.test(href)) {
        return (
          <div className="embed-container">
            <iframe
              width="560"
              height="315"
              src={href.replace("watch?v=", "embed/")}
              frameBorder="0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <a href={href} target="_blank" rel="noopener noreferrer" className="italic text-blue-600 block mt-1">
              {href}
            </a>
          </div>
        );
      }

      if (spotifyRegex.test(href)) {
        const spotifyEmbedUrl = href.replace(/(https:\/\/open\.spotify\.com\/)/, "https://open.spotify.com/embed/");
        return (
          <div className="spotify-container">
            <iframe
              style={{ borderRadius: "12px" }}
              src={`${spotifyEmbedUrl}?utm_source=generator&theme=0`}
              width="100%"
              height="152"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        );
      }

      return <a href={href} target="_blank" rel="noopener noreferrer" className="italic text-blue-600">{children}</a>;
    },
    // Tùy chỉnh hiển thị ảnh
    img: ({ src, alt }) => (
      <div className="image-container">
        <img src={src} alt={alt} style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid #ddd" }} />
      </div>
    ),
    // Thêm style cho code block + nút copy
    code: ({ node, inline, className, children, ...props }) => {
      if (inline) {
        return (
          <code className="bg-gray-200 px-1 rounded text-red-600 font-mono" {...props}>
            {children}
          </code>
        );
      }
      const codeText = Array.isArray(children) ? children.join("") : String(children || "");
      const blockKey = `code-${codeText.slice(0, 24)}-${codeText.length}`;
      return (
        <div className="code-block-wrap">
          <button
            type="button"
            className="code-copy-btn"
            onClick={() => handleCopyMessage(codeText.replace(/\n$/, ""), blockKey)}
            title="Copy code"
          >
            <FontAwesomeIcon icon={copiedKey === blockKey ? faRobot : faCopy} />
            <span className="ml-1">{copiedKey === blockKey ? "Copied" : "Copy"}</span>
          </button>
          <pre className="bg-gray-800 text-white p-2 rounded-md overflow-x-auto my-2 text-sm">
            <code {...props}>{children}</code>
          </pre>
        </div>
      );
    }
  };



  return (
    <div className={`chat-box ${isExpanded ? "expanded" : ""} ${compactMode ? "compact" : ""}`}>
      <div className="chat-header">
        <h3 className="m-0 p-1 font-extrabold">Chat chít</h3>
        <div className="section">
          <button
            className={`p-1 mr-2 ${showUserPanel ? "active-tool" : ""}`}
            onClick={() => setShowUserPanel((s) => !s)}
            title="Lọc theo user"
          >
            <FontAwesomeIcon icon={faUsers} />
          </button>
          <button
            className={`p-1 mr-2 ${showSearch ? "active-tool" : ""}`}
            onClick={() => { setShowSearch((s) => !s); if (showSearch) setSearchQuery(""); }}
            title="Search messages"
          >
            <FontAwesomeIcon icon={faSearch} />
          </button>
          {username === "minhtai" && (
            <button
              className="p-1 mr-2"
              onClick={() => setIsStudyMode(!isStudyMode)}
              title={isStudyMode ? "Tắt chế độ học" : "Bật chế độ học"}
              style={{ color: isStudyMode ? "#ff9800" : "inherit" }}
            >
              <FontAwesomeIcon icon={faBookOpen} />
            </button>
          )}
          <button className="p-1 mr-2" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Thu nhỏ" : "Mở rộng"}>
            <FontAwesomeIcon icon={isExpanded ? faCompress : faExpand} />
          </button>
          <Dropdown
            placement="bottomLeft"
            overlay={menuProfile}
            trigger={["click"]}
            onClick={() => setDropdownVisible(!dropdownVisible)}
            onOpenChange={(visible) => setDropdownVisible(visible)}
            className="mr-2"
          >
            <a className="ant-dropdown-link" onClick={(e) => e.preventDefault()}>
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

      {showSearch && (
        <div className="chat-search-bar">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            autoFocus
            placeholder="Search trong tin nhắn đã tải..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} title="Clear">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>
      )}

      <div className="chat-body">
        {showUserPanel && (
          <aside className="chat-user-panel">
            <header className="user-panel-head">
              <FontAwesomeIcon icon={faUsers} />
              <span>Participants ({userStats.length})</span>
            </header>
            <div className="user-panel-list">
              <button
                className={`user-row ${userFilter === null ? "active" : ""}`}
                onClick={() => setUserFilter(null)}
              >
                <span className="user-avatar all">∗</span>
                <span className="user-meta">
                  <span className="user-name">All users</span>
                  <span className="user-sub">{messages.length} tin nhắn</span>
                </span>
              </button>
              {userStats.map((u) => {
                const isOnline = u.name === "Chatbot" || onlineUsers.some((o) => o.userName === u.name);
                const initial = (u.name || "?").charAt(0).toUpperCase();
                const isBot = u.name === "Chatbot";
                const lastTime = u.lastTs ? new Date(u.lastTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                return (
                  <button
                    key={u.name}
                    className={`user-row ${userFilter === u.name ? "active" : ""}`}
                    onClick={() => setUserFilter(userFilter === u.name ? null : u.name)}
                    title={u.lastSnippet}
                  >
                    <span className={`user-avatar ${isBot ? "bot" : ""}`}>
                      {isBot ? <FontAwesomeIcon icon={faRobot} /> : initial}
                      <span className={`avatar-dot ${isOnline ? "online" : "offline"}`} />
                    </span>
                    <span className="user-meta">
                      <span className="user-name">
                        {u.name}
                        <span className="user-count">{u.count}</span>
                      </span>
                      <span className="user-sub">{lastTime} · {u.lastSnippet?.slice(0, 32) || "—"}</span>
                    </span>
                  </button>
                );
              })}
              {userStats.length === 0 && (
                <div className="user-panel-empty">Chưa có ai trong cuộc trò chuyện.</div>
              )}
            </div>
          </aside>
        )}

      <div className="chat-messages-wrap">
        {userFilter && (
          <div className="filter-banner">
            <FontAwesomeIcon icon={faFilter} />
            <span>Showing only <strong>{userFilter}</strong></span>
            <button onClick={() => setUserFilter(null)} title="Clear filter">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}
        <div className="chat-messages" ref={chatMessagesRef} onScroll={handleScrollInfinite}>
          {isDeleting ? (
            <div className="no-messages">
              <l-cardio size="50" stroke="4" speed="0.5" color="black" />
            </div>
          ) : (loading && messages.length === 0) ? (
            <div className="no-messages flex flex-col">
              <l-cardio size="30" stroke="2" speed="0.5" color="black" />
            </div>
          ) : messages.length === 0 ? (
            <div className="no-messages flex flex-col">
              <Empty description={false} />
              <h1 className="font-semibold">Empty messages</h1>
            </div>
          ) : (() => {
            const q = searchQuery.trim().toLowerCase();
            let filtered = messages;
            if (userFilter) filtered = filtered.filter((m) => m.userName === userFilter);
            if (q) filtered = filtered.filter((m) => (m.content || "").toLowerCase().includes(q) || (m.userName || "").toLowerCase().includes(q));

            if (filtered.length === 0) {
              const label = userFilter || (q ? `"${searchQuery}"` : "");
              return (
                <div className="no-messages flex flex-col">
                  <Empty description={false} />
                  <h1 className="font-semibold">{label ? `No matches for ${label}` : "Empty"}</h1>
                </div>
              );
            }

            const lastBotIndex = (() => {
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].userName === "Chatbot") return i;
              }
              return -1;
            })();

            return filtered.map((msg, index) => {
              const isOnline =
                msg.userName === "Chatbot" ||
                onlineUsers.some((user) => user.userName === msg.userName);

              const realIndex = messages.indexOf(msg);
              const isLastBot = realIndex === lastBotIndex && msg.userName === "Chatbot";
              const msgKey = msg.id ?? `msg-${realIndex}`;

              return (
                <div
                  key={msgKey}
                  className={`chat-message ${msg.status === "sending" ? "sending-message" : ""} ${msg.userName === username ? "sent-message" : "received-message"
                    }`}
                >
                  <strong className="chat-user">
                    {msg.userName === "Chatbot" && (
                      <FontAwesomeIcon icon={faRobot} style={{ marginRight: "5px", color: "#504cd6" }} />
                    )}
                    {msg.userName}
                    <span className={`status-dot ${isOnline ? "online" : "offline"}`} />
                  </strong>
                  <div className="chat-text">
                    <ReactMarkdown components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <div className="chat-message-actions">
                    <button
                      className="msg-action-btn"
                      onClick={() => handleCopyMessage((msg.content || "").replace(/^\/bot\s*/i, ""), msgKey)}
                      title="Copy message"
                    >
                      <FontAwesomeIcon icon={faCopy} />
                      <span>{copiedKey === msgKey ? "Copied" : "Copy"}</span>
                    </button>
                    {isLastBot && (
                      <button
                        className="msg-action-btn"
                        onClick={handleRegenerate}
                        title="Regenerate"
                        disabled={isAiThinking}
                      >
                        <FontAwesomeIcon icon={faRedo} />
                        <span>Regenerate</span>
                      </button>
                    )}
                  </div>
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
              );
            });
          })()}
          {isAiThinking && (
            <div className="chat-message received-message ai-thinking">
              <strong className="chat-user">
                <FontAwesomeIcon icon={faRobot} style={{ marginRight: "5px", color: "#504cd6" }} />
                Chatbot
              </strong>
              <div className="chat-text thinking-animation">
                <l-cardio size="25" stroke="2" speed="0.8" color="#504cd6" />
                <span className="ml-2 italic text-gray-500">AI đang suy nghĩ...</span>
              </div>
            </div>
          )}
        </div>

        {!isAtBottom && (
          <button className="scroll-bottom-fab" onClick={scrollToBottom} title="Cuộn xuống mới nhất">
            <FontAwesomeIcon icon={faArrowDown} />
            {unreadCount > 0 && <span className="unread-pill">+{unreadCount}</span>}
          </button>
        )}
      </div>
      </div>

      {uploading && (
        <div className="chat-upload-bar">
          <span className="upload-label">Đang tải lên... {uploadProgress}%</span>
          <div className="upload-track">
            <div className="upload-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      <div
        className={`chat-input ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { handleUploadFiles(e.target.files); e.target.value = ""; }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Đính kèm ảnh / file (hoặc paste / drag-drop)"
          disabled={uploading}
        >
          <FontAwesomeIcon icon={faPaperclip} />
        </button>
        <textarea
          className="chatbox-input"
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          placeholder={aiMode ? "Hỏi AI bất cứ điều gì... (Shift+Enter để xuống dòng)" : "Type a message — paste/drop ảnh để gửi"}
          rows={1}
          style={{ overflow: "hidden", resize: "none" }}
        />
        <button onClick={handleAiModeToggle} title={aiMode ? "Đang chat với AI — click để chat với người" : "Click để chat với AI"}>
          <FontAwesomeIcon
            icon={faRobot}
            style={{ color: aiMode ? "#504cd6" : "#4c4c4c" }}
          />
        </button>
        <button onClick={handleSendMessage} title="Send (Enter)" disabled={!message.trim() || uploading}>
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
        {dragOver && <div className="drag-overlay">Thả file vào đây để upload</div>}
      </div>
    </div>
  );
};
ChatBox.propTypes = {
  onClose: PropTypes.func.isRequired,
};
export default ChatBox;