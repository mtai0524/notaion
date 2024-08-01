import { Modal, Card, message, Spin, Switch } from "antd";
import axiosInstance from "../../../axiosConfig";
import jwt_decode from "jwt-decode";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Page.scss";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { format } from "date-fns";
const { Meta } = Card;

const Page = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingCardId, setDeletingCardId] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [forceDelete, setForceDelete] = useState(
    JSON.parse(localStorage.getItem("forceDelete")) || false
  );
  const [addLoading, setAddLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();

  const formatDate = (date) => {
    return format(date, " HH:mm, dd/MM/yyyy");
  };

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const tokenFromStorage = Cookies.get("token");
        const decodedToken = jwt_decode(tokenFromStorage);
        const userId =
          decodedToken[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
          ];

        const response = await axiosInstance.get(`/api/Page/user/${userId}`);

        if (response.status === 200) {
          setCards(
            response.data.map((page) => ({
              id: page.id,
              title: page.title,
              description: page.content,
              createDate: page.createdAt,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching pages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, []);

  const addNewCard = async () => {
    setAddLoading(true);
    try {
      const tokenFromStorage = Cookies.get("token");
      const decodedToken = jwt_decode(tokenFromStorage);
      const userId =
        decodedToken[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
        ];

      const newPage = {
        title: "Title",
        content: "",
        userId: userId,
        public: true,
      };

      const response = await axiosInstance.post("/api/Page", newPage);

      if (response.status === 201) {
        const createdPage = response.data;
        setCards([
          ...cards,
          {
            id: createdPage.id,
            title: createdPage.title,
            description: createdPage.content,
            createDate: createdPage.createdAt,
          },
        ]);
        message.success("Page created!");
      }
    } catch (error) {
      console.error("Error creating page:", error);
    } finally {
      setAddLoading(false);
    }
  };

  const deleteCard = async (cardId) => {
    setDeleteLoading(true);
    try {
      await axiosInstance.delete(`/api/Page/${cardId}`);
      setCards(cards.filter((card) => card.id !== cardId));
    } catch (error) {
      console.error("Error deleting page:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCardClick = (cardId) => {
    navigate(`/page/content/${cardId}`);
  };

  const showDeleteConfirm = (cardId) => {
    setDeletingCardId(cardId);
    if (forceDelete) {
      deleteCard(cardId);
    } else {
      setIsModalVisible(true);
    }
  };

  const handleDeleteConfirm = () => {
    if (deletingCardId !== null) {
      deleteCard(deletingCardId);
    }
    setIsModalVisible(false);
  };

  const handleDeleteCancel = () => {
    setIsModalVisible(false);
  };

  const handleSwitchChange = (checked) => {
    setForceDelete(checked);
    localStorage.setItem("forceDelete", JSON.stringify(checked));
  };

  return (
    <div className="flex justify-center align-middle">
      <div className="container-content-page m-3" style={{ width: "100%" }}>
        <div className="profile-container flex !flex-col !justify-center !align-middle">
          <div style={{ marginBottom: "10px" }}>
            <span style={{ marginRight: "10px" }}>Force</span>
            <Switch checked={forceDelete} onChange={handleSwitchChange} />
          </div>
          <button
            onClick={addNewCard}
            className="main-button"
            disabled={addLoading}
          >
            {addLoading ? <Spin size="small" /> : "Add new page"}
          </button>
          {loading ? (
            <Spin size="large" className="mt-5" />
          ) : cards.length === 0 ? (
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
                title="No pages available"
                description="You don't have any pages yet. Please add a new page"
              />
            </Card>
          ) : (
            cards.map((card, index) => (
              <div
                key={index}
                style={{
                  position: "relative",
                }}
              >
                <Card
                  style={{
                    width: "80vw",
                    maxWidth: "800px",
                    minHeight: "150px",
                    maxHeight: "300px",
                    overflow: "hidden",
                    cursor: "pointer",
                    position: "relative",
                  }}
                  className="profile-card"
                  bordered={false}
                  onClick={() => handleCardClick(card.id)}
                >
                  <div
                    style={{ position: "absolute", top: "0", right: "10px" }}
                  >
                    <span
                      className="text-gray-400"
                      style={{ fontSize: ".8em" }}
                    >
                      {formatDate(card.createDate)}
                    </span>
                  </div>

                  <Meta
                    title={
                      <div
                        className="card-content"
                        dangerouslySetInnerHTML={{ __html: card.title }}
                      />
                    }
                    description={
                      <div
                        style={{ maxHeight: "150px" }}
                        dangerouslySetInnerHTML={{ __html: card.description }}
                      />
                    }
                  />

                  <div
                    style={{
                      position: "absolute",
                      bottom: "10px",
                      right: "10px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FontAwesomeIcon
                      className="text-red-400 text-xl"
                      icon={faXmark}
                      key="remove"
                      onClick={() => showDeleteConfirm(card.id)}
                    />
                  </div>
                </Card>
                {deleteLoading && deletingCardId === card.id && (
                  <div className="loading-overlay">
                    <Spin size="large" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        title="Confirm Delete"
        visible={isModalVisible}
        onOk={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        okText="Yes"
        cancelText="No"
      >
        <p>Are you sure you want to delete this page?</p>
      </Modal>
    </div>
  );
};

export default Page;
