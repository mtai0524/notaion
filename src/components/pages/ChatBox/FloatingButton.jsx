import PropTypes from "prop-types";
import "./FloatingButton.scss";

const FloatingButton = ({ onClick, icon }) => {
  return (
    <button className="floating-button" onClick={onClick}>
      {icon}
    </button>
  );
};

FloatingButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.node.isRequired,
};

export default FloatingButton;
