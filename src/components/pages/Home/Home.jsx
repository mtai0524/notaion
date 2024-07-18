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
    <>
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
        <NavLink to="/signal">
          <button className="main-button">signal</button>
        </NavLink>
        <DatePicker
          defaultValue={dayjs("2019-09-03", dateFormat)}
          minDate={dayjs("2019-08-01", dateFormat)}
          maxDate={dayjs("2020-10-31", dateFormat)}
        />
      </div>

      <div className="game-container">
        <div className="board-game">
          <div className="square" data-index="0"></div>
          <div className="square" data-index="1"></div>
          <div className="square" data-index="2"></div>
          <div className="square" data-index="3"></div>
          <div className="square" data-index="4"></div>
          <div className="square" data-index="5"></div>
          <div className="square" data-index="6"></div>
          <div className="square" data-index="7"></div>
          <div className="square" data-index="8"></div>
        </div>
      </div>
    </>
  );
};

Home.propTypes = {
  backgroundColor: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
};

export default Home;
