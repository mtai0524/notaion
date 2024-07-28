import { UserOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import "./Header.scss";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown, Menu, Space } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faNewspaper,
  faSignInAlt,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import Cookies from "js-cookie";
import { useAuth } from "../../../contexts/AuthContext";
import { message } from "antd";
import jwt_decode from "jwt-decode";
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
        navigate("/home-page");
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
  return (
    <>
      <div className="container-nav">
        <nav className="navbar flex justify-between items-center ">
          <Link to="/home-page" className="ml-5 text-black font-bold">
            Notaion
          </Link>
          <Dropdown
            placement="bottomRight"
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
              <Space>
                <UserOutlined
                  style={{ cursor: "pointer" }}
                  className="text-black text-sm p-2 mr-1 rounded-full bg-white outline-1 outline-black !border-black border-2 "
                />
              </Space>
            </a>
          </Dropdown>
        </nav>
      </div>
    </>
  );
};

export default Header;
