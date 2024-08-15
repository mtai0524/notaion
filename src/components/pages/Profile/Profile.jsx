import { useEffect, useState } from "react";
import axiosInstance from "../../../axiosConfig";
import { message, Spin, Card, Image, Space } from "antd";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import "./Profile.scss";
import { useParams, useNavigate } from "react-router-dom";
const { Meta } = Card;
import {
  EditOutlined,
  EllipsisOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  DownloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";

const Profile = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const { identifier } = useParams();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState("");
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      const tokenFromStorage = Cookies.get("token");
      try {
        const decodedToken = jwt_decode(tokenFromStorage);
        const id =
          decodedToken[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
          ];
        const userNameToken =
          decodedToken[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
          ];
        setCurrentUserId(id);
        setCurrentUsername(userNameToken);

        if (!identifier) {
          navigate(`/profile/${id}`);
          return;
        }

        const response = await axiosInstance.get(
          `/api/account/profile/${identifier}`
        );
        setUserProfile(response.data);

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
    console.log(userId);

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

  const showActions =
    currentUserId === identifier || currentUsername === identifier;

  const setAvatarRandom = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    const avatarUrl = `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`;
    return avatarUrl;
  };

  const handleEditClick = async () => {
    if (showActions) {
      const newAvatar = setAvatarRandom();
      const encodedAvatar = encodeURIComponent(newAvatar);
      try {
        await axiosInstance.post(
          `/api/account/change-avatar/${currentUserId}/${encodedAvatar}`
        );
        setAvatar(newAvatar);
        message.success("Updated successfully");
      } catch (error) {
        message.error("Failed to update avatar");
      }
    }
  };

  if (loading || !userProfile) {
    return (
      <div className="loading-container">
        <Spin />
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

  return (
    <div className="profile-container">
      <Card
        className="profile-card"
        bordered={false}
        actions={
          showActions
            ? [
                <SettingOutlined key="setting" />,
                <EditOutlined
                  title="change avatar"
                  key="edit"
                  onClick={handleEditClick}
                />,
                <EllipsisOutlined key="ellipsis" />,
              ]
            : []
        }
      >
        <div className="profile-header">
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
            src={avatar || userProfile.avatar}
            alt="User"
          />
        </div>
        <Meta
          title={`Email: ${userProfile.email}`}
          description={`Username: ${userProfile.userName}`}
        />
      </Card>

      <div className="pages-container">
        <h2>Public Pages</h2>
        {pagesLoading ? (
          <Spin size="large" className="mt-5" />
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
            <Meta
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
    </div>
  );
};

export default Profile;
