import { UserOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import "./Header.scss";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown, Image, Menu, Popover, Tooltip } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
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

const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const { token, setToken } = useAuth();
  const [avatar, setAvatar] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  useEffect(() => {
    const signalRUrl =
      import.meta.env.VITE_SIGNALR_URL || "https://localhost:7059/chathub";
    const connection = new HubConnectionBuilder()
      .withUrl(signalRUrl)
      .build();
    connection.on("ReceiveFriendRequest", async (senderId, receiverId, senderName) => {
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
                senderName,
                // content: `${senderName} has sent you a friend request.`,
                content: `muốn kết nghĩa với bạn`,
                senderAvatar: user.avatar,
              },
            ]);
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
          setAvatar(user.avatar);
          const notiResponse = await axiosInstance.get(`/api/Friend/get-noti-by-recvid/${userId}`);
          setNotifications(notiResponse.data);
        } catch {
          console.log('Not found or invalid token');
        }
      }
    };
    fetchUserAndNotifications();
  }, [setToken]);
  const handleMenuClick = (e) => {
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
        Cookies.remove("token");
        message.warning("Logout");
        setToken(null);
        navigate("/login");
        break;
      default:
        break;
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
  const content = (
    <div className="container-noti mr-2">
      {notifications.length === 0 ? (
        <div
          className="bg-white shadow-md rounded-lg p-3 max-w-xs flex items-center border border-gray-300 mt-2"
          style={{ minWidth: '250px', textAlign: 'center' }}
        >
          <p className="text-gray-600 w-full">Empty notification</p>
        </div>
      ) : (
        notifications.map((notification, index) => (
          <div
            key={index}
            className="bg-white shadow-md rounded-lg p-3 max-w-xs flex items-center border border-gray-300 mt-2"
            style={{ minWidth: '200px' }}
          >
            <Image
              className="rounded-full mr-3"
              style={{ width: '50px', height: '50px' }}
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
              <div className="flex space-x-1 justify-end">
                <button className="bg-gray-200 text-gray-600 px-2 py-1 text-xs rounded hover:bg-gray-300 transition">
                  Decline
                </button>
                <button className="bg-blue-500 text-white px-2 py-1 text-xs rounded hover:bg-blue-600 transition">
                  Agree
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
        <nav className="navbar flex justify-between items-center ">
          <Link to="/home-page" className="ml-5 text-black font-bold">
            Notaion
          </Link>
          <div className="flex items-center">
            <Popover
              content={content}
              title="Notification"
              trigger="click"
              placement="bottomLeft"
            >
              <Tooltip title="notification" placement="left">
                <FontAwesomeIcon
                  style={{
                    backgroundColor: "#faf8f7",
                    padding: "10px",
                    cursor: "pointer",
                  }}
                  className="text-black text-lg mr-4 rounded-full"
                  icon={faEnvelope}
                />
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
              <a
                className="ant-dropdown-link"
                onClick={(e) => e.preventDefault()}
              >
                <Tooltip title="user" placement="bottom">
                  <UserOutlined
                    style={{
                      backgroundColor: "#faf8f7",
                      padding: "10px",
                      cursor: "pointer",
                    }}
                    className="text-black text-lg  rounded-full"
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
