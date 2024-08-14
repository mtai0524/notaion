import PropTypes from "prop-types";
import "./FloatingButton.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots } from "@fortawesome/free-regular-svg-icons";

const FloatingButton = ({ onClick, newMessagesCount }) => {
  return (
    <button className="floating-button" onClick={onClick}>
      <FontAwesomeIcon
        className="text-gray-800 text-[30px]"
        icon={faCommentDots}
      />
      {newMessagesCount > 0 && (
        <span className="new-messages-count">{newMessagesCount}</span>
      )}
    </button>
  );
};

FloatingButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  newMessagesCount: PropTypes.number.isRequired,
};

export default FloatingButton;
