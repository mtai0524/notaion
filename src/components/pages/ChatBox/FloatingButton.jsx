import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDrag } from "@use-gesture/react";
import { useSpring, animated } from "react-spring";
import "./FloatingButton.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots } from "@fortawesome/free-regular-svg-icons";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { Drawer, Tabs, Tooltip } from "antd";
import OnlineUsers from "../OnLine/OnLine";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { useAuth } from "../../../contexts/AuthContext";

const FloatingButton = ({ onClick, newMessagesCount }) => {
  const [placement] = useState("left");
  const [open, setOpen] = useState(false);
  const [position, api] = useSpring(() => ({ x: 0, y: 0 }));
  const { token, setToken } = useAuth();
  const bind = useDrag(({ offset: [x, y] }) => {
    api.start({ x, y });
  });

  const showDrawer = () => {
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
  };

  const [tabPosition, setTabPosition] = useState('top');

  const [username, setUsername] = useState('');

  useEffect(() => {
    const fetchUserAndNotifications = async () => {
      const tokenFromCookie = Cookies.get('token');
      if (tokenFromCookie) {
        try {
          setToken(tokenFromCookie);
          const decodedToken = jwt_decode(tokenFromCookie);
          const userNameToken = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
          setUsername(userNameToken);
        } catch {
          console.log('Not found or invalid token');
        }
      }
    };

    fetchUserAndNotifications();
  }, [setToken]);
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
      <animated.button
        {...bind()}
        style={position}
        className="floating-drawer"
        onClick={showDrawer}
      >
        <FontAwesomeIcon className="text-gray-800" icon={faArrowRightFromBracket} />
      </animated.button>

      <Drawer
        title={username}
        placement={placement}
        closable={false}
        onClose={onClose}
        open={open}
        key={placement}
      >
        <Tabs
          tabPosition={tabPosition}
          items={[
            {
              label: "online users",
              key: "1",
              children: <OnlineUsers />,
            },
            {
              label: "Tab 2",
              key: "2",
              children: "Content of Tab 2",
            },
            {
              label: "Tab 3",
              key: "3",
              children: "Content of Tab 3",
            },
          ]}
        />
      </Drawer>
    </>
  );
};

FloatingButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  newMessagesCount: PropTypes.number.isRequired,
};

export default FloatingButton;
