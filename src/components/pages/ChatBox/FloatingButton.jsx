import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDrag } from "@use-gesture/react";
import { useSpring, animated } from "react-spring";
import "./FloatingButton.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots } from "@fortawesome/free-regular-svg-icons";
import { faArrowRightFromBracket, faEllipsis } from "@fortawesome/free-solid-svg-icons";
import { Drawer, Dropdown, Empty, Menu, Modal, Tabs } from "antd";
import OnlineUsers from "../OnLine/OnLine";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { useAuth } from "../../../contexts/AuthContext";
import axiosInstance from "../../../axiosConfig";
import { useNavigate } from "react-router-dom";

const FloatingButton = ({ onClick, newMessagesCount }) => {
  const [placement] = useState("left");
  const [open, setOpen] = useState(false);
  const [position, api] = useSpring(() => ({ x: 0, y: 0 }));
  const { setToken } = useAuth();
  const [pages, setPages] = useState([]);
  const [userId, setUserId] = useState('');
  const [avatar, setAvatar] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPageId, setSelectedPageId] = useState("");
  const navigate = useNavigate();

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
          const userIdToken = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
          const avatarToken = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/country'];
          const emailToken = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
          setUserId(userIdToken);
          setUsername(userNameToken);
          setAvatar(avatarToken);
          setEmail(emailToken);
        } catch {
          console.log('Not found or invalid token');
        }
      }
    };

    fetchUserAndNotifications();
  }, [setToken]);

  const renderMenu = (pageId) => (
    <Menu>
      <Menu.Item key="archive">
        <span className='font-semibold'>Archive</span>
      </Menu.Item>
      <Menu.Item key="delete" danger onClick={() => confirmDeletePage(pageId)}>
        <span className='font-semibold'>Delete</span>
      </Menu.Item>
    </Menu>
  );

  const confirmDeletePage = (pageId) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this page?',
      content: 'This action cannot be undone.',
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: () => deletePage(pageId),
    });
  };

  const deletePage = async (pageId) => {
    try {
      await axiosInstance.delete(`/api/Page/${pageId}`);
      setPages((prevPages) => prevPages.filter(page => page.id !== pageId));
      navigate(`/home-page`);
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  };

  useEffect(() => {
    const fetchPagesUser = async () => {
      if (!userId) return;

      try {
        const response = await axiosInstance.get(`/api/Page/user/${userId}`);
        if (response.status === 200) {
          const pagesData = response.data.map((page) => ({
            id: page.id,
            title: page.title,
          }));
          setPages(pagesData);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchPagesUser();
  }, [userId]);

  const handlePageClick = (pageId) => {
    setSelectedPageId(pageId);
    navigate(`page/content/${pageId}`);
  };

  const showProfile = () => {
    navigate(`/profile/${username}`);
  }

  const titleDrawer = (
    <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={showProfile} >
      <img
        src={avatar}
        alt="User"
        style={{
          width: 40,
          height: 40,
          borderRadius: '10px',
          marginRight: 10,
        }}
      />

      <div className="flex flex-col">
        <span>{username}</span>
        <span className="text-sm opacity-60 font-normal">{email}</span>
      </div>

    </div>
  )

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
        title={titleDrawer}
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
              label: "my pages",
              key: "2",
              children: (
                <div>
                  {pages.length > 0 ? (
                    <ul>
                      {pages.map((page) => (
                        <li className={`page-item font-medium cursor-pointer ${selectedPageId === page.id ? "page-tabs-active" : ""}`} key={page.id} onClick={() => handlePageClick(page.id)}>
                          <span dangerouslySetInnerHTML={{ __html: page.title }} />
                          <Dropdown overlay={renderMenu(page.id)} trigger={['click']}>
                            <FontAwesomeIcon icon={faEllipsis} className="page-icon" onClick={(e) => e.stopPropagation()} />
                          </Dropdown>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex justify-center flex-col items-center">
                      <Empty description={false}></Empty>
                      <p className="font-semibold">No pages available</p>
                    </div>
                  )}
                </div>
              ),
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
