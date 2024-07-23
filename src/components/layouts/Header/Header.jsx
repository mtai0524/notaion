import { UserOutlined } from "@ant-design/icons";
import { useState } from "react";
import "./Header.scss";

import { Dropdown, Menu, Space } from "antd";
const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState({});

  const menuProfile = () => (
    <Menu className="custom-dropdown-menu">
      <Menu.Item key="1">Profile</Menu.Item>
      <Menu.Item key="2">Settings</Menu.Item>
      <Menu.Item key="3" danger>
        Logout
      </Menu.Item>
    </Menu>
  );
  return (
    <>
      <div className="container-nav">
        <nav className="navbar bg-gray-500 flex justify-between items-center ">
          <h1 className="ml-5 text-white font-bold">Notaion</h1>
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
