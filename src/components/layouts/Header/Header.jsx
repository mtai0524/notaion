import { UserOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import "./Header.scss";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown, Menu, Space } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faSignInAlt, faUser } from "@fortawesome/free-solid-svg-icons";
import Cookies from "js-cookie";
import { useAuth } from "../../../contexts/AuthContext";
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
      case "profile":
        navigate("/profile");
        break;
      case "logout":
        Cookies.remove("token");
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
        <nav className="navbar bg-gray-500 flex justify-between items-center ">
          <Link to="/home-page" className="ml-5 text-white font-bold">
            Notaion
          </Link>
          <Dropdown
            placement="bottomRight"
            arrow
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
                  className="text-neutral-900 text-sm p-2 mr-1 rounded-full bg-white "
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
