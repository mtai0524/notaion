import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const CommandsList = ({ items, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const handleKeyDown = (event) => {
    if (event.key === "ArrowUp") {
      setSelectedIndex(
        (prevIndex) => (prevIndex - 1 + items.length) % items.length
      );
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      setSelectedIndex((prevIndex) => (prevIndex + 1) % items.length);
      event.preventDefault();
    } else if (event.key === "Enter") {
      onSelect(items[selectedIndex]);
      event.preventDefault();
    }
  };

  return (
    <div className="dropdown-menu" tabIndex={0} onKeyDown={handleKeyDown}>
      {items.length > 0 ? (
        items.map((item, index) => (
          <button
            key={index}
            className={index === selectedIndex ? "is-selected" : ""}
            onClick={() => onSelect(item)}
          >
            {item.title}
          </button>
        ))
      ) : (
        <div className="item">No result</div>
      )}
    </div>
  );
};

CommandsList.propTypes = {
  items: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default CommandsList;
