import { useEffect, useState } from "react";
import axiosInstance from "../../../axiosConfig";
import { message, Spin, Card, Image, Space, Button, Tooltip, Menu, Dropdown, Modal, Tabs, Empty } from "antd";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import "./Profile.scss";
import { useParams, useNavigate } from "react-router-dom";
import { EditOutlined, EllipsisOutlined, SettingOutlined } from "@ant-design/icons";
import { DownloadOutlined, RotateLeftOutlined, RotateRightOutlined, SwapOutlined, UndoOutlined, ZoomInOutlined, ZoomOutOutlined } from "@ant-design/icons";
import * as signalR from "@microsoft/signalr";
import { useSignalR } from "../../../contexts/SignalRContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserGroup } from "@fortawesome/free-solid-svg-icons";
import { cardio } from 'ldrs';
cardio.register();
import { MoreOutlined } from '@ant-design/icons';
const { Meta } = Card;
const Profile = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const { identifier } = useParams();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState("");
  const [avatarToken, setAvatarToken] = useState("");
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const { connection } = useSignalR();
  const [isRequesting, setIsRequesting] = useState(false);
  const [added, setAdded] = useState(false);
  const { onlineUsers } = useSignalR();
  const [isFriend, setIsFriend] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalListFriend, setModalListFriend] = useState(false);
  const [friends, setFriends] = useState([]);


  const generateAvatars = (avatarType) => {
    return Array.from({ length: 10 }, (_, index) => {
      const seed = Math.floor(Math.random() * 1000000000 + index);
      return `https://api.dicebear.com/9.x/${avatarType}/svg?seed=${seed}`;
    });
  };
  const [avatars, setAvatars] = useState(generateAvatars("notionists"));
  const [avatarType, setAvatarType] = useState("notionists");

  const refreshAvatars = () => {
    setAvatars(generateAvatars(avatarType));
  };

  const fetchFriends = async () => {
    try {
      const response = await axiosInstance.get(`/api/FriendShip/get-friends/${currentUserId}`);
      setFriends(response.data);
    } catch (error) {
      console.error('Error fetching friends', error);
    }
  };

  useEffect(() => {
    if (modalListFriend) {
      fetchFriends();
    }
  }, [modalListFriend]);


  useEffect(() => {
    if (userProfile) {
      setUserProfile(prev => ({
        ...prev,
        avatar: avatar
      }));
    }
  }, [avatar]);

  useEffect(() => {
    const checkFriendship = async () => {
      try {
        const response = await axiosInstance.get(`/api/FriendShip/check-friendship/${currentUserId}/${identifier}`);
        setIsFriend(response.data.isFriend);
      } catch (error) {
        console.error('Failed to check friendship:', error);
      }
    };

    checkFriendship();
  }, [currentUserId, identifier]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      const tokenFromStorage = Cookies.get("token");
      try {
        const decodedToken = jwt_decode(tokenFromStorage);
        const id = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
        const userNameToken = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
        setAvatarToken(decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/country"]);
        setCurrentUserId(id);
        setCurrentUsername(userNameToken);

        if (!identifier) {
          navigate(`/profile/${id}`);
          return;
        }

        const response = await axiosInstance.get(`/api/account/profile/${identifier}`);
        setUserProfile(response.data);

        setAvatar(response.data.avatar);

        fetchPublicPages(identifier);
      } catch (error) {
        setLoading(false);
        message.error("User not found");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [identifier, navigate]);


  const fetchPublicPages = async (userId) => {
    setPagesLoading(true);
    try {
      const response = await axiosInstance.get(`/api/Page/user/${userId}`);
      const publicPages = response.data.filter((page) => page.public);
      setPages(publicPages);
    } catch (error) {
      console.error("Error fetching pages:", error);
    } finally {
      setPagesLoading(false);
    }
  };

  const showActions = currentUserId === identifier || currentUsername === identifier;

  const handleEditClick = () => {
    if (showActions) {
      setModalVisible(true);
    }
  };

  const handleAvatarSelect = async (avatarUrl) => {
    const encodedAvatar = encodeURIComponent(avatarUrl);
    try {
      const response = await axiosInstance.put(`/api/account/change-avatar/${currentUserId}/${encodedAvatar}`);

      const updatedAvatar = response.data.avatar;
      console.log("avaatar" + updatedAvatar);

      setAvatar(updatedAvatar);

      message.success("Updated successfully");
      setModalVisible(false);
    } catch (error) {
      message.error("Failed to update avatar");
    }
  };


  const handleAddFriend = async () => {
    if (currentUserId === identifier) {
      message.warning("You cannot send a friend request to yourself.");
      return;
    }

    if (isRequesting) return;

    setIsRequesting(true);
    setLoadingRequest(true);

    try {
      const friendRequestPayload = {
        requesterId: currentUserId,
        requesterName: currentUsername,
        recipientId: identifier,
        avatar: avatarToken,
      };

      await axiosInstance.post('/api/Friend/send-friend-request', friendRequestPayload);

      if (connection) {
        await connection.invoke("SendFriendRequest", currentUserId, identifier, currentUsername);
      }
    } catch (error) {
      message.success("Request sent!");
    } finally {
      setIsRequesting(false);
      setLoadingRequest(false);

    }
  };

  if (loading || !userProfile) {
    return (
      <div className="loading-container">
        <l-cardio size="60" stroke="3" speed="1" color="black" />
      </div>
    );
  }

  const onDownload = (imgUrl) => {
    fetch(imgUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const url = URL.createObjectURL(new Blob([blob]));
        const link = document.createElement("a");
        link.href = url;
        link.download = "image.png";
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(url);
        link.remove();
      });
  };

  const isOnline = onlineUsers.some(user => user.userName === userProfile.userName);

  const showMenuPersonal = async (e) => {
    switch (e.key) {
      case 'friends':
        showListFriend();
        break;
      default:
        break;
    }

  }
  const menuPersonal = (
    <Menu onClick={showMenuPersonal}>
      <Menu.Item key="friends" icon={<FontAwesomeIcon icon={faUserGroup} />}>
        Friends
      </Menu.Item>
    </Menu>
  );

  const onTabChange = (key) => {
    setAvatarType(key);
    setAvatars(generateAvatars(key));
  };

  const tabs = [
    {
      key: "notionists",
      label: "Notionists",
    },
    {
      key: "open-peeps",
      label: "Open Peeps",
    },
    {
      key: "croodles",
      label: "Croodles",
    },
    {
      key: "lorelei",
      label: "Lorelei",
    },
    {
      key: "pixel-art",
      label: "Pixel",
    },
  ];


  const showListFriend = () => {
    setModalListFriend(true);
  }


  const handleRemoveFriend = async (friendId) => {
    try {
      await axiosInstance.delete(`/api/friendship/${friendId}`);
      fetchFriends();
    } catch (error) {
      console.error("Error removing friend:", error);
    }
  };
  const { confirm } = Modal;

  const showConfirm = (friendshipId) => {
    let loading = false;

    const handleOk = async () => {
      loading = true;
      try {
        await handleRemoveFriend(friendshipId);
      } catch (error) {
        console.error('Error while unfriending:', error);
      } finally {
        loading = false;
      }
    };

    confirm({
      title: 'Are you sure you want to unfriend this person?',
      content: 'This action cannot be undone.',
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      okButtonProps: {
        loading: loading,
      },
      onOk() {
        handleOk();
      },
      onCancel() {
        console.log('Unfriend canceled');
      },
    });
  };

  const handleViewProfile = (friendUserName) => {
    setModalListFriend(false);
    navigate(`/profile/${friendUserName}`);
  };


  const menu = (friendshipId, friendUserName) => (
    <Menu>
      <Menu.Item onClick={() => handleViewProfile(friendUserName)}>
        <span className="font-semibold text-xs">Profile</span>
      </Menu.Item>
      <Menu.Item danger onClick={() => showConfirm(friendshipId)}>
        <span className="font-semibold text-xs">Unfriend</span>
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="profile-container">
      <Modal
        title="List friend"
        visible={modalListFriend}
        onCancel={() => setModalListFriend(false)}
        footer={null}
      >
        <ul className="friends-list">
          {friends.length > 0 ? (
            friends.map((friend) => {
              const friendId = friend.senderId === currentUserId ? friend.receiverId : friend.senderId;
              const friendUserName = friend.senderId === currentUserId ? friend.receiverUserName : friend.senderUserName;
              const friendAvatar = friend.senderId === currentUserId ? friend.receiverAvatar : friend.senderAvatar;

              return (
                <li key={friend.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <img src={friendAvatar} alt={`${friendUserName}'s avatar`} style={{ marginRight: '10px' }} />
                  {friendUserName}
                  <Dropdown overlay={menu(friend.friendshipId, friendUserName)} trigger={['click']}>
                    <MoreOutlined style={{ fontSize: '20px', marginLeft: 'auto', cursor: 'pointer', opacity: '0.6' }} />
                  </Dropdown>
                </li>
              );
            })
          ) : (
            <div className="no-friends flex flex-col">
              <Empty description={false}></Empty>
              <span>No friends found.</span>
            </div>
          )}
        </ul>
      </Modal>

      <Card
        className="profile-card"
        bordered={false}
        actions={
          showActions
            ? [
              <SettingOutlined key="setting" />,
              <EditOutlined title="change avatar" key="edit" onClick={handleEditClick} />,
              <Dropdown placement="bottom" overlay={menuPersonal} trigger={["click"]} className="mr-5">
                <a className="ant-dropdown-link" onClick={(e) => e.preventDefault()}>
                  <Tooltip title="personal">
                    <EllipsisOutlined key="ellipsis" />
                  </Tooltip>
                </a>
              </Dropdown>
            ]
            : []
        }
      >
        <div className="profile-header" style={{ position: 'relative' }}>
          <Image
            preview={{
              toolbarRender: (
                _,
                {
                  image: { url },
                  transform: { scale },
                  actions: {
                    onFlipY,
                    onFlipX,
                    onRotateLeft,
                    onRotateRight,
                    onZoomOut,
                    onZoomIn,
                    onReset,
                  },
                }
              ) => (
                <Space size={12} className="toolbar-wrapper">
                  <DownloadOutlined onClick={() => onDownload(url)} />
                  <SwapOutlined rotate={90} onClick={onFlipY} />
                  <SwapOutlined onClick={onFlipX} />
                  <RotateLeftOutlined onClick={onRotateLeft} />
                  <RotateRightOutlined onClick={onRotateRight} />
                  <ZoomOutOutlined disabled={scale === 1} onClick={onZoomOut} />
                  <ZoomInOutlined disabled={scale === 50} onClick={onZoomIn} />
                  <UndoOutlined onClick={onReset} />
                </Space>
              ),
            }}
            className="avatar-profile"
            src={userProfile.avatar}
            alt="User"

          />

          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '90px',
              width: '20px',
              height: '20px',
              backgroundColor: isOnline ? '#28df28' : '#f32a2a',
              borderRadius: '50%',
              border: '3px solid white',
            }}
          />
        </div>
        <Meta
          title={`Email: ${userProfile.userName}`}
          description={`Username: ${userProfile.email}`}
        />
        <div className="flex justify-end mt-2 -mb-4 -mr-2">
          {(currentUserId !== identifier && currentUsername !== identifier) && (
            <button
              className={`makeFriend ${isFriend || added ? 'bg-gray-600 cursor-not-allowed' : 'bg-zinc-700'} text-white px-2 py-1 text-xs rounded transition font-medium`}
              onClick={!isFriend && !added ? handleAddFriend : undefined}
              disabled={isFriend || added || loadingRequest}
            >
              {loadingRequest ? (
                <l-cardio
                  size="20"
                  stroke="2"
                  speed="0.5"
                  color="white"
                  className="mr-2"
                />
              ) : isFriend ? (
                "Already Friends"
              ) : (
                added ? "Requested" : "Request"
              )}
            </button>
          )}
        </div>
      </Card>

      <div className="pages-container">
        <h2>Public Pages</h2>
        {pagesLoading ? (
          <div className="card-loading-container">
            <Card
              style={{
                width: "80vw",
                maxWidth: "800px",
                minHeight: "150px",
                maxHeight: "300px",
                overflow: "hidden",
                cursor: "pointer",
                position: "relative",
                textAlign: "center",
              }}
              className="profile-card"
              bordered={false}
            >
              <div className="loading-overlay">
                <l-cardio
                  size="30"
                  stroke="2"
                  speed="0.5"
                  color="black"
                />
              </div>
            </Card>
          </div>
        ) : pages.length === 0 ? (
          <Card
            style={{
              width: "80vw",
              maxWidth: "800px",
              minHeight: "150px",
              maxHeight: "300px",
              overflow: "hidden",
              cursor: "pointer",
              position: "relative",
              textAlign: "center",
            }}
            className="profile-card"
            bordered={false}
          >
            <Empty description={false}></Empty>
            <Meta
              className="flex items-center justify-center h-full "
              title="No public pages available"
              description="This user does not have any public pages."
            />
          </Card>
        ) : (
          pages.map((page) => (
            <Card
              key={page.id}
              style={{
                width: "80vw",
                maxWidth: "800px",
                minHeight: "150px",
                maxHeight: "400px",
                overflow: "hidden",
                cursor: "pointer",
                position: "relative",
              }}
              className="profile-card"
              bordered={false}
              onClick={() => navigate(`/page/content/${page.id}`)}
            >
              <Meta
                title={page.title}
                description={
                  <div
                    style={{ maxHeight: "150px", marginBottom: "20px" }}
                    dangerouslySetInnerHTML={{ __html: page.content }}
                  />
                }
              />
            </Card>
          ))
        )}
      </div>

      <div className="profile-container">
        <Modal
          title="Choose an Avatar"
          visible={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={[
            <Button key="refresh" onClick={refreshAvatars}>
              refresh
            </Button>
          ]}
        >
          <Tabs defaultActiveKey="notionists" onChange={onTabChange}>
            {tabs.map((tab) => (
              <Tabs.TabPane tab={tab.label} key={tab.key}>
                <div className="avatar-selection">
                  {avatars.map((url, index) => (
                    <div key={index} className="avatar-item">
                      <img
                        src={url}
                        alt={`Avatar ${index + 1}`}
                        onClick={() => handleAvatarSelect(url)}
                        className="avatar-image"
                      />
                    </div>
                  ))}
                </div>
              </Tabs.TabPane>
            ))}
          </Tabs>
        </Modal>
      </div>
    </div>
  );
};

export default Profile;

