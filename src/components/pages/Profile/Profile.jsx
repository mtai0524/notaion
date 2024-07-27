import { useEffect, useState } from "react";
import axiosInstance from "../../../axiosConfig";
import { message, Spin, Card, Image } from "antd";
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

const Profile = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const { identifier } = useParams();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState("");
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
      } catch (error) {
        setLoading(false);
        message.error("User not found");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [identifier, navigate]);

  const showActions =
    currentUserId === identifier || currentUsername === identifier;

  // handle random avatar
  const setAvatarRandom = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    const avatarUrl = `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`;
    return avatarUrl;
  };

  // Handle edit button click
  const handleEditClick = async () => {
    if (showActions) {
      const newAvatar = setAvatarRandom();
      const encodedAvatar = encodeURIComponent(newAvatar);
      console.log(encodedAvatar);
      console.log(newAvatar);
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
    </div>
  );
};

export default Profile;
