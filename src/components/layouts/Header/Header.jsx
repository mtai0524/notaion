import { UserOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import "./Header.scss";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown, Image, Menu, Popover, Tooltip } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBan,
  faClose,
  faDeleteLeft,
  faGears,
  faHome,
  faNewspaper,
  faSignInAlt,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import Cookies from "js-cookie";
import { useAuth } from "../../../contexts/AuthContext";
import { message } from "antd";
import jwt_decode from "jwt-decode";
import { faEnvelope } from "@fortawesome/free-regular-svg-icons";
import { HubConnectionBuilder } from "@microsoft/signalr";
import axiosInstance from "../../../axiosConfig";
import { useSignalR } from "../../../contexts/SignalRContext";

const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const { token, setToken } = useAuth();
  const [avatar, setAvatar] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const { connection } = useSignalR();

  useEffect(() => {
    const signalRUrl = import.meta.env.VITE_SIGNALR_URL || "https://localhost:7059/chathub";
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
                senderName,
                content: `muốn kết nghĩa với bạn`,
                senderAvatar: user.avatar,
                isRead: false, // read/unread status
              },
            ]);
            setNotificationCount((prevCount) => prevCount + 1); // Update count
          }
        }
      } catch (error) {
        console.error("Error processing notification:", error);
      }
    });

    connection.start().catch((err) => console.error("SignalR Connection Error: ", err));
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
          setNotifications(notiData);
          const unreadCount = notiData.filter(n => !n.isRead).length; // Set count unread notifications
          setNotificationCount(unreadCount);
        } catch {
          console.log('Not found or invalid token');
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

        await connection.invoke("LogoutUser", userId)
          .then(() => console.log("User logged out successfully"))
          .catch(err => console.error("Error logging out user:", err));

        Cookies.remove("token");

        navigate("/login");
      } catch (err) {
        console.error("Logout error: ", err);
      }
    }
  };


  const menuProfile = (
    <Menu onClick={handleMenuClick} className="custom-dropdown-menu">
      <Menu.Item key="home" icon={<FontAwesomeIcon icon={faHome} />}>
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
          <Menu.Item key="page" icon={<FontAwesomeIcon icon={faNewspaper} />}>
            Page
          </Menu.Item>
          <Menu.Item key="profile" icon={<FontAwesomeIcon icon={faUser} />}>
            Profile
          </Menu.Item>
          <Menu.Item key="setting" icon={<FontAwesomeIcon icon={faGears} />}>
            Setting
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

  const content = (
    <div className="container-noti mr-2 !min-h-20">
      {notifications.length === 0 ? (
        <div
          className="bg-white rounded-lg p-3 max-w-xs flex items-center border-2 !border-gray-950"
          style={{ minWidth: '240px', textAlign: 'center' }}
        >
          <div className="text-gray-600 w-full !min-h-20 flex items-center justify-center font-medium">Empty notification</div>
        </div>
      ) : (
        notifications.map((notification, index) => (
          <div
            key={index}
            className={`bg-white rounded p-3 max-w-xs flex items-center border-2 !border-gray-950 mt-2 ${notification.isRead ? 'bg-gray-200' : ''}`}
            style={{ minWidth: '200px', position: 'relative' }}
            onClick={() => handleNotificationClick(notification.id)} //  click to read
          >
            {!notification.isRead && (
              <div
                className="absolute top-1 left-1 w-2.5 h-2.5 bg-green-400 rounded-full"
                style={{ zIndex: 1 }}
              ></div>
            )}
            <Image
              className="rounded-full mr-3"
              style={{ width: '60px', height: '60px' }}
              src={notification.senderAvatar || avatar}
              alt="Avatar"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-800 text-sm mb-1">
                <span className="font-bold">{notification.senderName}</span>
              </p>
              <p className="text-xs text-gray-600" style={{ marginTop: '5px' }}>
                muốn kết nghĩa với bạn
              </p>
              <div className="flex space-x-1 justify-end mt-2">
                <button
                  className="bg-gray-200 text-gray-600 px-2 py-1 text-xs rounded hover:bg-gray-300 transition font-bold"
                >
                  Decline
                </button>
                <button
                  className="bg-zinc-700 text-white px-2 py-1 text-xs hover:bg-zinc-800 rounded transition font-medium"
                >
                  Agree
                </button>
                <button
                  onClick={() => removeNotification(notification.id, index)}
                  className="btn-close-noti ml-2 text-red-300 hover:text-red-700 transition"
                >
                  <FontAwesomeIcon icon={faClose} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );


  return (
    <>
      <div className="container-nav">
        <nav className="navbar flex justify-between items-center">
          <Link to="/home-page" className="ml-5 text-black font-bold">
            Notaion
          </Link>
          <div className="flex items-center">
            <Popover
              content={content}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Notification</span>
                  {notifications.length > 0 && (
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',

                        cursor: 'pointer',
                        fontSize: '12px',
                        marginRight: '11px'
                      }}
                      onClick={clearNotifications}
                    >
                      <span className="text-red-500">
                        clear
                      </span>
                    </button>
                  )}
                </div>
              }
              trigger="click"
              placement="bottomLeft"
            >
              <Tooltip title="notification" placement="left">
                <div style={{ position: 'relative' }}>
                  <FontAwesomeIcon
                    style={{
                      backgroundColor: "#faf8f7",
                      padding: "10px",
                      cursor: "pointer",
                    }}
                    className="text-black text-lg mr-4 rounded-full"
                    icon={faEnvelope}
                  />
                  {notificationCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '0',
                        right: '10px',
                        background: 'red',
                        color: 'white',
                        borderRadius: '50%',
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}
                    >
                      {notificationCount}
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
                <Tooltip title="user" placement="bottom">
                  <UserOutlined
                    style={{
                      backgroundColor: "#faf8f7",
                      padding: "10px",
                      cursor: "pointer",
                    }}
                    className="text-black text-lg rounded-full"
                  />
                </Tooltip>
              </a>
            </Dropdown>
          </div>
        </nav>
      </div>
    </>
  );
};

export default Header;
