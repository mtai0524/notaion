import React, { useState } from "react";
import PropTypes from "prop-types";
import Draggable from "react-draggable";
import "./FloatingButton.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots } from "@fortawesome/free-regular-svg-icons";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { Drawer, Tooltip } from 'antd';
import OnlineUsers from "../OnLine/OnLine";

const FloatingButton = ({ onClick, newMessagesCount }) => {
  const [placement] = useState('left');
  const [open, setOpen] = useState(false);

  const showDrawer = () => {
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
  };

  return (
    <>
      <button className="floating-button" onClick={onClick}>
        <FontAwesomeIcon
          className="text-gray-800 text-[30px]"
          icon={faCommentDots}
        />
        {newMessagesCount > 0 && (
          <span className="new-messages-count">{newMessagesCount}</span>
        )}
      </button>
      <Draggable axis="y" bounds={'parent'}>
        <button className="floating-drawer" onClick={showDrawer}>
          <Tooltip title="show drawer" placement="right">
            <FontAwesomeIcon
              className="text-gray-800"
              icon={faArrowRightFromBracket}
            />
          </Tooltip>
        </button>
      </Draggable>

      <Drawer
        title="Basic Drawer"
        placement={placement}
        closable={false}
        onClose={onClose}
        open={open}
        key={placement}
      >
        <OnlineUsers />
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
      </Drawer>
    </>
  );
};

FloatingButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  newMessagesCount: PropTypes.number.isRequired,
};

export default FloatingButton;
