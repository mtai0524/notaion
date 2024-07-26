import { UserOutlined } from "@ant-design/icons";
import { useState } from "react";
import "./Header.scss";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown, Menu, Space } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faSignInAlt } from "@fortawesome/free-solid-svg-icons";
const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const navigate = useNavigate();

  const handleMenuClick = (e) => {
    if (e.key === "login") {
      navigate("/login");
    }
    if (e.key === "home") {
      navigate("/home-page");
    }
  };

  const menuProfile = (
    <Menu onClick={handleMenuClick} className="custom-dropdown-menu">
      <Menu.Item key="home" icon={<FontAwesomeIcon icon={faHome} />}>
        Home
      </Menu.Item>
      <Menu.Item
        key="login"
        icon={<FontAwesomeIcon icon={faSignInAlt} />}
        className="!text-blue-700"
      >
        Login
      </Menu.Item>
      {/* Các mục menu khác */}
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
                <UserOutlined className="text-neutral-900 text-sm p-2 mr-1 rounded-full bg-white " />
              </Space>
            </a>
          </Dropdown>
        </nav>
      </div>
    </>
  );
};

export default Header;
