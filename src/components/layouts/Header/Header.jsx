import { UserOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import "./Header.scss";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown, Menu, Popover, Tooltip } from "antd";
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
const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const navigate = useNavigate();
  const { token, setToken } = useAuth();

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
            decodedToken[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            ];
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

  useEffect(() => {
    const tokenFromCookie = Cookies.get("token");
    if (tokenFromCookie) {
      setToken(tokenFromCookie);
    }
  }, []);

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
    <div>
      <p>Hi there!</p>
      <p>
        I&apos;m Minh Tai, and I&apos;m looking forward to making new friends.
        I&apos;d love to connect with you and learn more about your interests
        and experiences.
      </p>
      <p>
        Whether it&apos;s discussing our favorite books, sharing travel stories,
        or simply having a good chat, I&apos;m excited to get to know you
        better.
      </p>
      <p>
        Feel free to reach out anytime. Let&apos;s make this a fun and enriching
        friendship journey!
      </p>
      <p>Looking forward to hearing from you soon.</p>
      <p>
        Best regards,
        <br />
        Minh Tai
      </p>
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
              placement="bottom"
            >
              <Tooltip title="notification" placement="bottom">
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
