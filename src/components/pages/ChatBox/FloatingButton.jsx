import PropTypes from "prop-types";
import "./FloatingButton.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots } from "@fortawesome/free-regular-svg-icons";

const FloatingButton = ({ onClick }) => {
  return (
    <button className="floating-button" onClick={onClick}>
      <FontAwesomeIcon
        className="text-gray-800 text-[30px]"
        icon={faCommentDots}
      />
    </button>
  );
};

FloatingButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.node.isRequired,
};

export default FloatingButton;
