import { UserOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { useState, useEffect, useRef } from "react";
import "./Header.scss";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Dropdown, Empty, Image, Menu, Popover, Tooltip, Tour } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBan,
  faClose,
  faDeleteLeft,
  faEllipsis,
  faGears,
  faHome,
  faKeyboard,
  faNewspaper,
  faSignInAlt,
  faUser,
  faFolderOpen,
  faColumns,
  faUserPlus,
  faComment,
  faTrashCan,
  faGamepad,
  faClock,
} from "@fortawesome/free-solid-svg-icons";

import Cookies from "js-cookie";
import { useAuth } from "../../../contexts/AuthContext";
import { message, notification } from "antd";
import jwt_decode from "jwt-decode";
import { faEnvelope } from "@fortawesome/free-regular-svg-icons";
import { HubConnectionBuilder } from "@microsoft/signalr";
import axiosInstance from "../../../axiosConfig";
import { useSignalR } from "../../../contexts/SignalRContext";
import config from "../../../config";
import { notifyBrowser } from "../../../utils/notifyBrowser";

const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const { token, setToken } = useAuth();
  const [avatar, setAvatar] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const { connection } = useSignalR();
  const location = useLocation();

  // Tabs + Message notifications (realtime, session-persisted)
  const [activeNotiTab, setActiveNotiTab] = useState("friend"); // 'friend' | 'message'
  const [messageNotifs, setMessageNotifs] = useState(() => {
    try {
      const raw = sessionStorage.getItem("headerMsgNotifs");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [deadlineNotifs, setDeadlineNotifs] = useState(() => {
    try {
      const raw = sessionStorage.getItem("headerDeadlineNotifs");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const currentUserName = (() => {
    try {
      const t = Cookies.get("token");
      if (!t) return null;
      return jwt_decode(t)["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
    } catch { return null; }
  })();

  const currentUserIdFromToken = (() => {
    try {
      const t = Cookies.get("token");
      if (!t) return null;
      return jwt_decode(t)["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    } catch { return null; }
  })();

  useEffect(() => {
    try {
      sessionStorage.setItem("headerMsgNotifs", JSON.stringify(messageNotifs.slice(0, 50)));
    } catch { /* quota — skip */ }
  }, [messageNotifs]);

  useEffect(() => {
    try {
      sessionStorage.setItem("headerDeadlineNotifs", JSON.stringify(deadlineNotifs.slice(0, 50)));
    } catch { /* quota — skip */ }
  }, [deadlineNotifs]);

  const truncate = (s, n = 90) => {
    const str = (s || "").replace(/!\[[^\]]*\]\([^)]+\)/g, "[ảnh]")
      .replace(/\[📎\s[^\]]*\]\([^)]+\)/g, "[file]")
      .replace(/^\/bot\s*/i, "");
    return str.length > n ? str.slice(0, n) + "…" : str;
  };

  const showToast = ({ key, title, description, onClick }) => {
    notification.open({
      key,
      message: title,
      description,
      placement: "bottomRight",
      duration: 4,
      onClick: () => {
        if (onClick) onClick();
        notification.destroy(key);
      },
      style: { cursor: onClick ? "pointer" : "default" },
    });
  };

  useEffect(() => {
    const handlerPublic = (event) => {
      const { user, content } = event.detail || {};
      if (!user || !content) return;
      if (currentUserName && user === currentUserName) return;
      const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMessageNotifs((prev) => [
        {
          id,
          type: "public",
          userName: user,
          content,
          time: new Date().toISOString(),
          isRead: false,
        },
        ...prev,
      ].slice(0, 50));
      showToast({
        key: id,
        title: `${user} · public`,
        description: truncate(content),
        onClick: () => {
          window.dispatchEvent(new CustomEvent("notaion:open-chat-public", {
            detail: { senderName: user, content, time: new Date().toISOString() },
          }));
        },
      });
    };

    const handlerPrivate = (event) => {
      const { senderId, receiverId, senderUserName, message, sentAt } = event.detail || {};
      if (!senderId || !message) return;
      // BE dùng Clients.All → mọi client đều nhận. Chỉ giữ message gửi cho mình.
      if (currentUserIdFromToken && receiverId && receiverId !== currentUserIdFromToken) return;
      // Bỏ qua tin nhắn do chính mình gửi
      if (currentUserIdFromToken && senderId === currentUserIdFromToken) return;
      if (currentUserName && senderUserName === currentUserName) return;
      const id = `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMessageNotifs((prev) => [
        {
          id,
          type: "private",
          userName: senderUserName || "Unknown",
          senderId,
          content: message,
          time: sentAt || new Date().toISOString(),
          isRead: false,
        },
        ...prev,
      ].slice(0, 50));
      showToast({
        key: id,
        title: `${senderUserName || "Unknown"} · DM`,
        description: truncate(message),
        onClick: () => {
          window.dispatchEvent(new CustomEvent("notaion:open-chat-private", {
            detail: { senderId, senderName: senderUserName, content: message, time: sentAt },
          }));
        },
      });
    };

    window.addEventListener("new-signalr-message", handlerPublic);
    window.addEventListener("new-signalr-private-message", handlerPrivate);
    return () => {
      window.removeEventListener("new-signalr-message", handlerPublic);
      window.removeEventListener("new-signalr-private-message", handlerPrivate);
    };
  }, [currentUserName, currentUserIdFromToken]);

  useEffect(() => {
    const handler = (event) => {
      const { noteId, title, date, kind } = event.detail || {};
      if (!noteId) return;
      const heading = kind === 'lead' ? '⏰ Deadline approaching' : '⏰ Deadline reached';
      const id = `dl-${noteId}-${kind}`;
      const path = `/daily-note?date=${date || ''}`;
      setDeadlineNotifs((prev) => [
        { id, type: 'deadline', kind, title, date, time: new Date().toISOString(), isRead: false },
        ...prev.filter((n) => n.id !== id),
      ].slice(0, 50));
      showToast({
        key: id,
        title: heading,
        description: title,
        onClick: () => navigate(path),
      });
      notifyBrowser(heading, title, { path, tag: id });
    };
    window.addEventListener("notaion:deadline-reminder", handler);
    return () => window.removeEventListener("notaion:deadline-reminder", handler);
  }, [navigate]);

  const unreadFriendCount = notifications.filter((n) => !n.isRead).length;
  const unreadMessageCount = messageNotifs.filter((n) => !n.isRead).length;
  const unreadDeadlineCount = deadlineNotifs.filter((n) => !n.isRead).length;
  const totalUnread = unreadFriendCount + unreadMessageCount + unreadDeadlineCount;

  const markMessageRead = (id) => {
    setMessageNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const removeMessageNotif = (id) => {
    setMessageNotifs((prev) => prev.filter((n) => n.id !== id));
  };

  const clearMessageNotifs = () => {
    setMessageNotifs([]);
    sessionStorage.removeItem("headerMsgNotifs");
  };

  const markAllMessagesRead = () => {
    setMessageNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markDeadlineRead = (id) =>
    setDeadlineNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  const markAllDeadlinesRead = () =>
    setDeadlineNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
  const clearDeadlineNotifs = () => {
    setDeadlineNotifs([]);
    sessionStorage.removeItem("headerDeadlineNotifs");
  };

  useEffect(() => {
    const signalRUrl = config.SIGNALR_URL;
    const connection = new HubConnectionBuilder()
      .withUrl(signalRUrl)
      .withAutomaticReconnect()
      .build();

    connection.on("ReceiveFriendRequest", async (senderId, receiverId, senderName, notificationId) => {
      try {
        const tokenFromStorage = Cookies.get("token");
        if (tokenFromStorage) {
          const decodedToken = jwt_decode(tokenFromStorage);
          const currentUserId = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
          const response = await axiosInstance.get(`/api/account/user/${senderId}`);
          const user = response.data;

          if (currentUserId === receiverId) {
            setNotifications((prevNotifications) => [
              ...prevNotifications,
              {
                id: notificationId,
                senderId,
                receiverId,
                senderName,
                content: `muốn kết nghĩa với bạn`,
                senderAvatar: user.avatar,
                isRead: false, // read/unread status
              },
            ]);
            setNotificationCount((prevCount) => prevCount + 1); // Update count
            showToast({
              key: `fr-${notificationId}`,
              title: "Lời mời kết bạn",
              description: `${senderName} muốn kết nghĩa với bạn`,
              onClick: () => navigate(`/profile/${senderName}`),
            });
          }
        }
      } catch (error) {
        console.error("Error processing notification:", error);
      }
    });

    connection.start().catch((err) => console.error("SignalR Connection Error: ", err));
    return () => {
      connection.stop();
    };
  }, []);

  useEffect(() => {
    const fetchUserAndNotifications = async () => {
      const tokenFromCookie = Cookies.get('token');
      if (tokenFromCookie) {
        setToken(tokenFromCookie);
        try {
          const decodedToken = jwt_decode(tokenFromCookie);
          const userId = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
          const response = await axiosInstance.get(`/api/account/user/${userId}`);
          const user = response.data;
          setCurrentUser(userId);
          setAvatar(user.avatar);

          const notiResponse = await axiosInstance.get(`/api/Notification/get-noti-by-recvid/${userId}`);
          const notiData = notiResponse.data;

          const updatedNotiData = await Promise.all(notiData.map(async (notification) => {
            const friendshipCheck = await axiosInstance.get(`/api/FriendShip/check-friendship/${userId}/${notification.senderName}`);
            const { isFriend } = friendshipCheck.data;
            return {
              ...notification,
              isFriend: isFriend,
            };
          }));

          setNotifications(updatedNotiData);

          const unreadCount = updatedNotiData.filter(n => !n.isRead).length;
          setNotificationCount(unreadCount);

        } catch (error) {
          console.log('Error fetching user or notifications:', error);
        }
      }
    };

    fetchUserAndNotifications();
  }, [setToken]);


  const handleMenuClick = async (e) => {
    switch (e.key) {
      case "login":
        navigate("/login");
        break;
      case "home":
        navigate("/home-page");
        break;
      case "page":
        navigate("/page");
        break;
      case "setting":
        navigate("/setting");
        break;
      case "profile":
        try {
          const tokenFromStorage = Cookies.get("token");
          const decodedToken = jwt_decode(tokenFromStorage);
          const userId =
            decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
          navigate(`/profile/${userId}`);
        } catch {
          console.log("Not found");
        }
        break;
      case "logout":
        await handleLogout();
        break;
      case "shortcut":
        navigate("/shortcut");
        break;
      case "guide":
        navigate("/guide");
        break;
      case "files":
        navigate("/files");
        break;
      case "daily-note":
        navigate("/daily-note");
        break;
      case "dashboard":
        navigate("/dashboard");
        break;
      case "game":
        navigate("/game");
        break;

      default:
        break;
    }
  };

  const handleLogout = async () => {
    if (connection) {
      try {
        const token = Cookies.get("token");
        const decodedToken = jwt_decode(token);
        const userId = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];

        // call signal logout user
        await connection.invoke("LogoutUser", userId)
          .then(() => console.log("User logged out successfully"))
          .catch(err => console.error("Error logging out user:", err));

        Cookies.remove("token");
        setToken(null);
        navigate("/login");
      } catch (err) {
        console.error("Logout error: ", err);
      }
    }
  };


  const menuProfile = (
    <Menu onClick={handleMenuClick} className="custom-dropdown-menu">
      <Menu.Item
        key="home"
        icon={<FontAwesomeIcon icon={faHome} />}
        style={{ backgroundColor: location.pathname === "/home-page" ? "#f0f0f0" : "transparent" }}
      >
        Home
      </Menu.Item>
      {!token && (
        <Menu.Item
          key="login"
          icon={<FontAwesomeIcon icon={faSignInAlt} />}
          className="switch-login-page"
        >
          Login
        </Menu.Item>
      )}
      {token && (
        <>
          <Menu.Item
            key="page"
            icon={<FontAwesomeIcon icon={faNewspaper} />}
            style={{ backgroundColor: location.pathname.startsWith("/page") ? "#f0f0f0" : "transparent" }} // Gray if on page
          >
            Page
          </Menu.Item>
          <Menu.Item
            key="profile"
            icon={<FontAwesomeIcon icon={faUser} />}
            style={{
              backgroundColor: location.pathname.startsWith("/profile") ? "#f0f0f0" : "transparent",
            }}
          >
            Profile
          </Menu.Item>
          <Menu.Item
            key="files"
            icon={<FontAwesomeIcon icon={faFolderOpen} />}
            style={{
              backgroundColor: location.pathname === "/files" ? "#f0f0f0" : "transparent",
            }}
          >
            Files
          </Menu.Item>
          <Menu.Item
            key="daily-note"
            icon={<FontAwesomeIcon icon={faNewspaper} />}
            style={{
              backgroundColor: location.pathname === "/daily-note" ? "#f0f0f0" : "transparent",
            }}
          >
            Daily Notes
          </Menu.Item>
          <Menu.Item
            key="dashboard"
            icon={<FontAwesomeIcon icon={faColumns} />}
            style={{
              backgroundColor: location.pathname === "/dashboard" ? "#f0f0f0" : "transparent",
            }}
          >
            Dashboard
          </Menu.Item>
          <Menu.Item
            key="game"
            icon={<FontAwesomeIcon icon={faGamepad} />}
            style={{
              backgroundColor: location.pathname === "/game" ? "#f0f0f0" : "transparent",
            }}
          >
            Mini Game
          </Menu.Item>


          <Menu.Item
            key="setting"
            icon={<FontAwesomeIcon icon={faGears} />}
            style={{ backgroundColor: location.pathname === "/setting" ? "#f0f0f0" : "transparent" }} // Gray if on setting
          >
            Setting
          </Menu.Item>
          <Menu.Item
            key="guide"
            icon={<QuestionCircleOutlined />}
            style={{ backgroundColor: location.pathname === "/guide" ? "#f0f0f0" : "transparent" }}
          >
            Guide
          </Menu.Item>
          <Menu.Item
            key="shortcut"
            icon={<FontAwesomeIcon icon={faKeyboard} />}
            style={{ backgroundColor: location.pathname === "/shortcut" ? "#f0f0f0" : "transparent" }}
          >
            Shortcut
          </Menu.Item>
          <Menu.Item
            key="logout"
            icon={<FontAwesomeIcon icon={faSignInAlt} />}
            danger
          >
            Logout
          </Menu.Item>
        </>
      )}
    </Menu>
  );

  const markAsRead = async (notificationId) => {
    try {
      const notificationToUpdate = notifications.find(n => n.id === notificationId);
      if (notificationToUpdate.isRead) {
        return;
      }

      await axiosInstance.put(`/api/Notification/mark-as-read/${notificationId}`);

      setNotifications((prevNotifications) =>
        prevNotifications.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification
        )
      );

      const unreadCount = notifications.filter(n => !n.isRead).length - 1;
      setNotificationCount(unreadCount);

    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const removeNotification = async (notificationId, indexToRemove) => {
    try {
      await axiosInstance.delete(`/api/Notification/${notificationId}`);
      setNotifications((prevNotifications) => {
        const newNotifications = prevNotifications.filter((_, index) => index !== indexToRemove);
        const newNotificationCount = newNotifications.filter(n => !n.isRead).length;
        setNotificationCount(newNotificationCount);
        return newNotifications;
      });
      console.log('Notification deleted successfully');
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearNotifications = async () => {
    try {
      await axiosInstance.delete(`/api/Notification/clear-by-receiver/${currentUser}`);
      setNotifications([]);
      setNotificationCount(0); // reset count
      console.log("All notifications cleared successfully.");
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const handleNotificationClick = async (notificationId) => {
    await markAsRead(notificationId);
  };

  const [acceptedNotifications, setAcceptedNotifications] = useState(new Set());

  const handleAcceptFriendRequest = async (senderId, receiverId, notificationId, index) => {
    try {
      console.log('senderId' + senderId);
      console.log('receiverId' + receiverId);

      const response = await axiosInstance.post('/api/FriendShip/accept-friend-request', {
        senderId: senderId,
        receiverId: receiverId
      });

      if (response.status === 200) {
        message.success('Accepted!');

        setNotifications((prevNotifications) =>
          prevNotifications.map((notification, i) =>
            i === index
              ? { ...notification, isFriend: true }
              : notification
          )
        );
      }
    } catch (error) {
      message.error('Failed to accept friend request.');
      console.error('Error accepting friend request:', error);
    }
  };


  const showProfile = (senderName) => {
    navigate(`/profile/${senderName}`);
  }

  const renderMenuNoti = (senderName) => {
    return (
      <Menu>
        <Menu.Item key="profile" onClick={() => showProfile(senderName)}>
          <span className='font-semibold'>Profile</span>
        </Menu.Item>
      </Menu>
    );
  };

  const openChatFromNotif = (notif) => {
    if (notif.type === "private") {
      window.dispatchEvent(new CustomEvent("notaion:open-chat-private", {
        detail: { senderId: notif.senderId, senderName: notif.userName, content: notif.content, time: notif.time }
      }));
    } else {
      window.dispatchEvent(new CustomEvent("notaion:open-chat-public", {
        detail: { senderName: notif.userName, content: notif.content, time: notif.time }
      }));
    }
    markMessageRead(notif.id);
  };

  const buildMessageNotifMenu = (notif) => (
    <Menu>
      <Menu.Item key="open" onClick={() => openChatFromNotif(notif)}>
        <span className="font-semibold">Mở tin nhắn</span>
      </Menu.Item>
      {!notif.isRead && (
        <Menu.Item key="read" onClick={() => markMessageRead(notif.id)}>
          <span className="font-semibold">Đánh dấu đã đọc</span>
        </Menu.Item>
      )}
      <Menu.Item key="delete" danger onClick={() => removeMessageNotif(notif.id)}>
        <span className="font-semibold">Xóa</span>
      </Menu.Item>
    </Menu>
  );

  const buildFriendNotifMenu = (notification, index) => (
    <Menu>
      <Menu.Item key="profile" onClick={() => showProfile(notification.senderName)}>
        <span className="font-semibold">Xem profile</span>
      </Menu.Item>
      {!notification.isRead && (
        <Menu.Item key="read" onClick={() => markAsRead(notification.id)}>
          <span className="font-semibold">Đánh dấu đã đọc</span>
        </Menu.Item>
      )}
      <Menu.Item key="delete" danger onClick={() => removeNotification(notification.id, index)}>
        <span className="font-semibold">Xóa</span>
      </Menu.Item>
    </Menu>
  );

  const friendList = (
    notifications.length === 0 ? (
      <div className="noti-empty">
        <Empty description={false} />
        <span>No friend notifications</span>
      </div>
    ) : (
      <div className="noti-list">
        {notifications.map((notification, index) => (
          <Dropdown
            key={index}
            overlay={buildFriendNotifMenu(notification, index)}
            trigger={["contextMenu"]}
          >
            <div
              className={`noti-item ${notification.isRead ? "is-read" : "is-unread"}`}
              onClick={() => handleNotificationClick(notification.id)}
              title="Right-click để mở menu"
            >
              {!notification.isRead && <span className="unread-dot" />}
              <div className="noti-avatar">
                <Image
                  preview={false}
                  src={notification.senderAvatar || avatar}
                  alt="Avatar"
                />
              </div>
              <div className="noti-body">
                <div className="noti-line-1">
                  <span className="noti-name" title={notification.senderName}>{notification.senderName}</span>
                </div>
                <p className="noti-text">
                  {notification.isFriend ? "đã đồng ý kết nghĩa 👋" : "muốn kết nghĩa với bạn"}
                </p>
                {!notification.isFriend && (
                  <div className="noti-actions-row">
                    <button className="btn-pixel btn-pixel-ghost" onClick={(e) => e.stopPropagation()}>
                      Decline
                    </button>
                    <button
                      className="btn-pixel btn-pixel-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAcceptFriendRequest(notification.senderId, notification.receiverId, notification.id, index);
                      }}
                    >
                      Agree
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Dropdown>
        ))}
      </div>
    )
  );

  const formatRelative = (iso) => {
    const ts = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - ts);
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    return new Date(iso).toLocaleDateString();
  };

  const messageList = (
    messageNotifs.length === 0 ? (
      <div className="noti-empty">
        <Empty description={false} />
        <span>No message notifications</span>
      </div>
    ) : (
      <div className="noti-list">
        {messageNotifs.map((notif) => {
          const preview = (notif.content || "")
            .replace(/^\/bot\s*/i, "")
            .replace(/!\[[^\]]*\]\([^)]+\)/g, "[ảnh]")
            .replace(/\[📎\s[^\]]*\]\([^)]+\)/g, "[file]")
            .slice(0, 90);
          const initial = (notif.userName || "?").charAt(0).toUpperCase();
          const isBot = notif.userName === "Chatbot";
          const isPrivate = notif.type === "private";
          return (
            <Dropdown
              key={notif.id}
              overlay={buildMessageNotifMenu(notif)}
              trigger={["contextMenu"]}
            >
              <div
                className={`noti-item noti-item-message ${notif.isRead ? "is-read" : "is-unread"} ${isPrivate ? "is-private" : ""}`}
                onClick={() => openChatFromNotif(notif)}
                title="Click để mở · Right-click để hiện menu"
              >
                {!notif.isRead && <span className="unread-dot" />}
                <div className={`noti-avatar noti-avatar-letter ${isBot ? "is-bot" : ""} ${isPrivate ? "is-private" : ""}`}>
                  {isBot ? <FontAwesomeIcon icon={faComment} /> : initial}
                </div>
                <div className="noti-body">
                  <div className="noti-line-1">
                    <span className="noti-name" title={notif.userName}>
                      {notif.userName}
                      {isPrivate && <span className="noti-tag-private">DM</span>}
                    </span>
                    <span className="noti-time">{formatRelative(notif.time)}</span>
                  </div>
                  <p className="noti-text noti-text-snippet" title={preview}>
                    {preview || "[trống]"}
                  </p>
                </div>
              </div>
            </Dropdown>
          );
        })}
      </div>
    )
  );

  const deadlineList = (
    deadlineNotifs.length === 0 ? (
      <div className="noti-empty">
        <Empty description={false} />
        <span>No reminders</span>
      </div>
    ) : (
      <div className="noti-list">
        {deadlineNotifs.map((notif) => (
          <div
            key={notif.id}
            className={`noti-item noti-item-message ${notif.isRead ? "is-read" : "is-unread"}`}
            onClick={() => { markDeadlineRead(notif.id); navigate(`/daily-note?date=${notif.date || ''}`); }}
            title="Click to open the note's day"
          >
            {!notif.isRead && <span className="unread-dot" />}
            <div className="noti-avatar noti-avatar-letter">
              <FontAwesomeIcon icon={faClock} />
            </div>
            <div className="noti-body">
              <div className="noti-line-1">
                <span className="noti-name">
                  {notif.kind === 'lead' ? 'Deadline approaching' : 'Deadline reached'}
                </span>
                <span className="noti-time">{formatRelative(notif.time)}</span>
              </div>
              <p className="noti-text noti-text-snippet" title={notif.title}>
                {(notif.title || 'Untitled note').slice(0, 90)}
              </p>
            </div>
          </div>
        ))}
      </div>
    )
  );

  const content = (
    <div className="noti-panel">
      <div className="noti-tabs">
        <button
          onClick={() => setActiveNotiTab("friend")}
          className={`noti-tab ${activeNotiTab === "friend" ? "is-active" : ""}`}
        >
          <FontAwesomeIcon icon={faUserPlus} />
          <span>Friend</span>
          {unreadFriendCount > 0 && <span className="noti-tab-badge">{unreadFriendCount}</span>}
        </button>
        <button
          onClick={() => setActiveNotiTab("message")}
          className={`noti-tab ${activeNotiTab === "message" ? "is-active" : ""}`}
        >
          <FontAwesomeIcon icon={faComment} />
          <span>Message</span>
          {unreadMessageCount > 0 && <span className="noti-tab-badge">{unreadMessageCount}</span>}
        </button>
        <button
          onClick={() => setActiveNotiTab("deadline")}
          className={`noti-tab ${activeNotiTab === "deadline" ? "is-active" : ""}`}
        >
          <FontAwesomeIcon icon={faClock} />
          <span>Reminders</span>
          {unreadDeadlineCount > 0 && <span className="noti-tab-badge">{unreadDeadlineCount}</span>}
        </button>
      </div>

      {activeNotiTab === "friend" && notifications.length > 0 && (
        <div className="noti-actions">
          <button onClick={clearNotifications} className="noti-action-btn is-danger">
            <FontAwesomeIcon icon={faTrashCan} />
            Clear
          </button>
        </div>
      )}
      {activeNotiTab === "message" && messageNotifs.length > 0 && (
        <div className="noti-actions">
          <button onClick={markAllMessagesRead} className="noti-action-btn">
            Mark all read
          </button>
          <button onClick={clearMessageNotifs} className="noti-action-btn is-danger">
            <FontAwesomeIcon icon={faTrashCan} />
            Clear
          </button>
        </div>
      )}
      {activeNotiTab === "deadline" && deadlineNotifs.length > 0 && (
        <div className="noti-actions">
          <button onClick={markAllDeadlinesRead} className="noti-action-btn">
            Mark all read
          </button>
          <button onClick={clearDeadlineNotifs} className="noti-action-btn is-danger">
            <FontAwesomeIcon icon={faTrashCan} />
            Clear
          </button>
        </div>
      )}

      {activeNotiTab === "friend" ? friendList : activeNotiTab === "message" ? messageList : deadlineList}
    </div>
  );

  const ref1 = useRef(null);
  const ref2 = useRef(null);
  const ref3 = useRef(null);
  const [openTour, setOpenTour] = useState(false);
  const steps = [
    {
      title: 'Login',
      description: 'Click here and choose login.',
      target: () => ref1.current,
    },
    {
      title: 'Notification',
      description: 'You can see notifications about request from everyone',
      target: () => ref2.current,
    },
    {
      title: 'Trial account',
      description: <div>
        <span className="font-medium">Welcome to Notaion. <br></br><span className="font-medium">You can use a trial account to test the web</span></span>
        <br />
        <div className="flex justify-center flex-col " >
          <span className="font-semibold">Username: <span className="underline">test</span></span>
          <span className="font-semibold">Password: <span className="underline">123</span></span>
        </div>
      </div>,
      target: () => ref3.current,
    },
    {
      title: 'I got your back',
      description: <span>
        <div className="flex justify-center flex-col" >
          <div>
            <span className="font-semibold">Tri Cao</span>: <span className="italic font-medium">"Backend lỏ, dùng solid vào"</span>
          </div>
          <div>
            <span className="font-semibold">Dang Tien</span>: <span className="italic font-medium">"Notaion hahaha, có gì mới chưa Tài?"</span>
          </div>
          <div>
            <span className="font-semibold">Si Trinh</span>: <span className="italic font-medium">"Bận quá"</span>
          </div>
          <div>
            <span className="font-semibold">Tuan Vinh</span>: <span className="italic font-medium">"Notion hả"</span>
          </div>
        </div>
      </span>,
      target: () => ref3.current,
    },
    {
      title: 'Contact',
      description: <div>
        <div className="flex flex-col items-center justify-center">
          <span className="font-semibold">Minh Tai</span>
          <div className="flex items-center">
            <span className="font-semibold mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 24 24">
                <path d="M10.9,2.1c-4.6,0.5-8.3,4.2-8.8,8.7c-0.5,4.7,2.2,8.9,6.3,10.5C8.7,21.4,9,21.2,9,20.8v-1.6c0,0-0.4,0.1-0.9,0.1 c-1.4,0-2-1.2-2.1-1.9c-0.1-0.4-0.3-0.7-0.6-1C5.1,16.3,5,16.3,5,16.2C5,16,5.3,16,5.4,16c0.6,0,1.1,0.7,1.3,1c0.5,0.8,1.1,1,1.4,1 c0.4,0,0.7-0.1,0.9-0.2c0.1-0.7,0.4-1.4,1-1.8c-2.3-0.5-4-1.8-4-4c0-1.1,0.5-2.2,1.2-3C7.1,8.8,7,8.3,7,7.6c0-0.4,0-0.9,0.2-1.3 C7.2,6.1,7.4,6,7.5,6c0,0,0.1,0,0.1,0C8.1,6.1,9.1,6.4,10,7.3C10.6,7.1,11.3,7,12,7s1.4,0.1,2,0.3c0.9-0.9,2-1.2,2.5-1.3 c0,0,0.1,0,0.1,0c0.2,0,0.3,0.1,0.4,0.3C17,6.7,17,7.2,17,7.6c0,0.8-0.1,1.2-0.2,1.4c0.7,0.8,1.2,1.8,1.2,3c0,2.2-1.7,3.5-4,4 c0.6,0.5,1,1.4,1,2.3v2.6c0,0.3,0.3,0.6,0.7,0.5c3.7-1.5,6.3-5.1,6.3-9.3C22,6.1,16.9,1.4,10.9,2.1z"></path>
              </svg>
            </span>
            <span className="font-semibold ">mtai0524</span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 50 50">
                <path d="M 5.5 7 C 3.019531 7 1 9.019531 1 11.5 L 1 11.925781 L 25 29 L 49 11.925781 L 49 11.5 C 49 9.019531 46.980469 7 44.5 7 Z M 6.351563 9 L 43.644531 9 L 25 22 Z M 1 14.027344 L 1 38.5 C 1 40.980469 3.019531 43 5.5 43 L 44.5 43 C 46.980469 43 49 40.980469 49 38.5 L 49 14.027344 L 43 18.296875 L 43 41 L 7 41 L 7 18.296875 Z"></path>
              </svg>
            </span>
            <span className="font-semibold">duatreodaiduongden</span>
          </div>
          <span className="font-semibold">Have a good day at work 🌻</span>
        </div>

      </div>,
      target: () => ref3.current,
    },
  ];

  return (
    <>
      <div className="container-nav">
        <nav className="navbar flex justify-between items-center">
          <Link to="/notion" className="ml-5 text-black font-bold">
            Notaion
          </Link>
          <div className="flex items-center">
            {token && (
              <Tooltip title="daily notes" placement="left">
                <FontAwesomeIcon
                  icon={faNewspaper}
                  onClick={() => navigate("/daily-note")}
                  style={{
                    backgroundColor: "#faf8f7",
                    padding: "10px",
                    cursor: "pointer",
                  }}
                  className={`text-lg rounded-full mr-4 ${location.pathname === "/daily-note" ? "text-blue-600" : "text-black"}`}
                />
              </Tooltip>
            )}

            <Tooltip title="guide" placement="left" >
              <QuestionCircleOutlined
                onClick={() => setOpenTour(true)}
                style={{
                  backgroundColor: "#faf8f7",
                  padding: "10px",
                  cursor: "pointer",
                }}
                className="text-black text-lg rounded-full mr-4"
              />
            </Tooltip>

            <Popover
              content={content}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Notification</span>
                </div>
              }
              trigger="click"
              placement="bottomLeft"
            >
              <Tooltip title="notification" placement="left" >
                <div style={{ position: 'relative' }} >
                  <FontAwesomeIcon
                    style={{
                      backgroundColor: "#faf8f7",
                      padding: "10px",
                      cursor: "pointer",
                    }}
                    className="text-black text-lg mr-4 rounded-full"
                    icon={faEnvelope}
                    ref={ref2}

                  />
                  {totalUnread > 0 && (
                    <span className="nav-bell-badge">
                      {totalUnread}
                    </span>
                  )}
                </div>
              </Tooltip>

            </Popover>

            <Dropdown
              placement="bottom"
              overlay={menuProfile}
              trigger={["click"]}
              onClick={() => setDropdownVisible(!dropdownVisible)}
              onOpenChange={(visible) => setDropdownVisible(visible)}
              className="mr-5"
            >
              <a className="ant-dropdown-link" onClick={(e) => e.preventDefault()}>
                <Tooltip title={token ? (currentUserName || "user") : "Chưa đăng nhập — click để login"} placement="bottom">
                  <div
                    ref={ref1}
                    className={`nav-user-badge ${token ? "is-authed" : "is-anon"}`}
                  >
                    {token && avatar ? (
                      <img src={avatar} alt="avatar" className="nav-user-avatar" />
                    ) : (
                      <UserOutlined className="nav-user-icon" />
                    )}
                    <span className={`nav-user-status ${token ? "is-online" : "is-offline"}`} />
                  </div>
                </Tooltip>
              </a>
            </Dropdown>

            <Tour
              open={openTour}
              onClose={() => setOpenTour(false)}
              steps={steps}
              indicatorsRender={(current, total) => (
                <span>
                  {current + 1} / {total}
                </span>
              )}
            />
          </div>
        </nav>
      </div>
    </>
  );
};

export default Header;

