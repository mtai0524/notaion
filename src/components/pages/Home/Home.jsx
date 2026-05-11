import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import "./Home.scss";
import { DatePicker } from "antd";
import { 
  RocketOutlined, 
  MessageOutlined, 
  FileTextOutlined, 
  ThunderboltOutlined 
} from "@ant-design/icons";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

const Home = ({ title, message }) => {
  const dateFormat = "YYYY-MM-DD";

  const menuItems = [
    { title: "Workspace", icon: <FileTextOutlined />, path: "/notion", color: "#fdf57d" },
    { title: "AI Chat", icon: <MessageOutlined />, path: "/signal", color: "#a5f3fc" },
    { title: "Quick Board", icon: <ThunderboltOutlined />, path: "/home2", color: "#fca5a5" },
    { title: "Dashboard", icon: <RocketOutlined />, path: "/dashboard", color: "#c084fc" },
  ];

  return (
    <div className="home-container">
      <div className="home-header">
        <h1 className="home-title">{title || "NOTAION WORKSPACE"}</h1>
        <p className="home-message">{message || "Hệ thống ghi chú và quản lý thông minh dành cho bạn."}</p>
        <div className="header-meta">
          <DatePicker 
            defaultValue={dayjs()} 
            format={dateFormat}
            className="neo-datepicker"
          />
        </div>
      </div>

      <div className="neo-grid">
        {menuItems.map((item, idx) => (
          <NavLink to={item.path} key={idx} className="neo-card" style={{ '--accent-color': item.color }}>
            <div className="neo-icon">{item.icon}</div>
            <span className="neo-text">{item.title}</span>
          </NavLink>
        ))}
      </div>

      <div className="home-footer">
        <div className="footer-tag">v2.0 Stable</div>
        <div className="footer-tag">Minh Tai Development</div>
      </div>
    </div>
  );
};

Home.propTypes = {
  backgroundColor: PropTypes.string,
  title: PropTypes.string,
  message: PropTypes.string,
};

export default Home;
