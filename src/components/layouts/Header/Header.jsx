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
  const location = useLocation();

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
        style={{ backgroundColor: location.pathname === "/home-page" ? "#f0f0f0" : "transparent" }} // Gray if on home page
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
            key="setting"
            icon={<FontAwesomeIcon icon={faGears} />}
            style={{ backgroundColor: location.pathname === "/setting" ? "#f0f0f0" : "transparent" }} // Gray if on setting
          >
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

  const [acceptedNotifications, setAcceptedNotifications] = useState(new Set());

  const handleAcceptFriendRequest = async (senderId, receiverId, notificationId, index) => {
    try {
      const response = await axiosInstance.post('/api/FriendShip/accept-friend-request', {
        senderId: senderId,
        receiverId: receiverId
      });

      if (response.status === 200) {
        message.success('Accepted!');
        setAcceptedNotifications(prev => new Set(prev).add(notificationId)); // Track accepted notifications
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

  const content = (
    <div className="container-noti mr-2 !min-h-20">
      {notifications.length === 0 ? (
        <div className="bg-white rounded-lg p-3 max-w-xs flex items-center flex-col" style={{ minWidth: '240px', textAlign: 'center' }}>
          <div className="text-gray-600 w-full !min-h-20 flex items-center justify-center font-medium">
            <div className="flex flex-col">
              <Empty description={false}></Empty>
              <span>Empty notification</span>
            </div>
          </div>
        </div>
      ) : (
        notifications.map((notification, index) => (
          <div
            key={index}
            className={`bg-white rounded p-3 max-w-xs flex items-center border-2 !border-gray-950 mt-2 ${notification.isRead ? 'bg-gray-200' : ''}`}
            style={{ minWidth: '200px', position: 'relative' }}
            onClick={() => handleNotificationClick(notification.id)} // Click to set read status
          >
            {!notification.isRead && (
              <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-green-400 rounded-full" style={{ zIndex: 1 }}></div>
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
              <p className="text-xs text-gray-600 font-semibold" style={{ marginTop: '5px' }}>
                {acceptedNotifications.has(notification.id) ? 'đã đồng ý kết nghĩa 👋' : 'muốn kết nghĩa với bạn'}
              </p>
              <div className="flex space-x-1 justify-end mt-2">
                {!acceptedNotifications.has(notification.id) && (
                  <>
                    <button
                      className="bg-gray-200 text-gray-600 px-2 py-1 text-xs rounded hover:bg-gray-300 transition font-bold"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleAcceptFriendRequest(notification.senderId, notification.receiverId, notification.id, index)}
                      className="bg-zinc-700 text-white px-2 py-1 text-xs hover:bg-zinc-800 rounded transition font-medium"
                    >
                      Agree
                    </button>
                  </>
                )}
                <button
                  onClick={() => removeNotification(notification.id, index)}
                  className="btn-close-noti ml-2 text-red-300 hover:text-red-700 transition"
                >
                  <FontAwesomeIcon icon={faClose} />
                </button>
                <Dropdown overlay={renderMenuNoti(notification.senderName)} trigger={['click']}>
                  <button className="absolute bottom-[-3px] opacity-60 right-[8px] z-50" onClick={(e) => e.stopPropagation()}>
                    <FontAwesomeIcon icon={faEllipsis} />
                  </button>
                </Dropdown>
              </div>
            </div>
          </div>
        ))
      )}
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
          <Link to="/home-page" className="ml-5 text-black font-bold">
            Notaion
          </Link>
          <div className="flex items-center">
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
                    ref={ref1}
                    className="text-black text-lg rounded-full"
                  />
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
