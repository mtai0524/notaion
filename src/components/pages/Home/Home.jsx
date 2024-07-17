import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import "./Home.scss";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Button } from "react-bootstrap";
dayjs.extend(customParseFormat);
const Home = ({ backgroundColor, title, message }) => {
  const dateFormat = "YYYY-MM-DD";
  return (
    <div
      className="home-container"
      style={{ backgroundColor: backgroundColor }}
    >
      <h1 className="home-title">{title}</h1>
      <p className="home-message">{message}</p>
      <NavLink to="/home2">
        <Button className="btn btn-primary">Home 2</Button>
      </NavLink>
      <NavLink to="/">
        <button className="main-button">Home 1</button>
      </NavLink>
      <DatePicker
        defaultValue={dayjs("2019-09-03", dateFormat)}
        minDate={dayjs("2019-08-01", dateFormat)}
        maxDate={dayjs("2020-10-31", dateFormat)}
      />
    </div>
  );
};

Home.propTypes = {
  backgroundColor: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
};

export default Home;
