import { Modal, Card, message, Spin, Dropdown, Menu, Tooltip } from "antd";
import axiosInstance from "../../../axiosConfig";
import jwt_decode from "jwt-decode";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Page.scss";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCirclePlus,
  faFilter,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { format } from "date-fns";
import { faShareFromSquare } from "@fortawesome/free-regular-svg-icons";
import { cardio } from 'ldrs';
cardio.register();
const { Meta } = Card;

const Page = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingCardId, setDeletingCardId] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [filter, setFilter] = useState(
    localStorage.getItem("filter") || "newest"
  );
  const [force, setForce] = useState(
    localStorage.getItem("forceDelete") || "true"
  );
  const navigate = useNavigate();

  const formatDate = (date) => {
    return format(date, " HH:mm, dd/MM/yyyy");
  };

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const getForceFromLocal = localStorage.getItem("forceDelete");
        console.log(force);
        setForce(getForceFromLocal);
        const tokenFromStorage = Cookies.get("token");
        const decodedToken = jwt_decode(tokenFromStorage);
        const userId =
          decodedToken[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
          ];

        const response = await axiosInstance.get(`/api/Page/user/${userId}`);

        if (response.status === 200) {
          const pages = response.data.map((page) => ({
            id: page.id,
            title: page.title,
            description: page.content,
            createDate: page.createdAt,
            updateDate: page.updatedAt,
          }));
          setCards(pages);

          const savedFilter = localStorage.getItem("filter") || "newest";
          setFilter(savedFilter);
          sortCards(pages, savedFilter);
        }
      } catch (error) {
        console.error("Error fetching pages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, []);

  const sortCards = (cardsToSort, filter) => {
    let sortedCards = [...cardsToSort];
    if (filter === "newest") {
      sortedCards.sort(
        (a, b) => new Date(b.createDate) - new Date(a.createDate)
      );
    } else if (filter === "oldest") {
      sortedCards.sort(
        (a, b) => new Date(a.createDate) - new Date(b.createDate)
      );
    } else if (filter === "modified_newest") {
      sortedCards.sort(
        (a, b) => new Date(b.updateDate) - new Date(a.updateDate)
      );
    } else if (filter === "modified_oldest") {
      sortedCards.sort(
        (a, b) => new Date(a.updateDate) - new Date(b.updateDate)
      );
    }

    setCards(sortedCards);
  };

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
        public: false,
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
            updateDate: createdPage.updatedAt,
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

  const publicPage = async (cardId) => {
    try {
      const response = await axiosInstance.post(
        `/api/Page/public-page/${cardId}`
      );
      message.success("Public successful!");
      console.log(response);
    } catch (error) {
      console.error("Error deleting page:", error);
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

  const handlePublicPage = (cardId) => {
    publicPage(cardId);
  };

  const showDeleteConfirm = (cardId) => {
    setDeletingCardId(cardId);

    if (force === "true") {
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

  const handleFilterChange = async ({ key }) => {
    setFilter(key);
    localStorage.setItem("filter", key);
    sortCards(cards, key);
  };

  const filterMenu = (
    <Menu onClick={handleFilterChange}>
      <Menu.Item
        key="newest"
        className={`filter-option ${filter === "newest" ? "selected" : ""}`}
      >
        created newest
      </Menu.Item>
      <Menu.Item
        key="oldest"
        className={`filter-option ${filter === "oldest" ? "selected" : ""}`}
      >
        created oldest
      </Menu.Item>
      <Menu.Item
        key="modified_newest"
        className={`filter-option ${filter === "modified_newest" ? "selected" : ""
          }`}
      >
        modified newest
      </Menu.Item>
      <Menu.Item
        key="modified_oldest"
        className={`filter-option ${filter === "modified_oldest" ? "selected" : ""
          }`}
      >
        modified oldest
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="flex justify-center align-middle">
      <div className="container-content-page m-3" style={{ width: "100%" }}>
        <div className="profile-container flex !flex-col !justify-center !align-middle">
          <div
            style={{ maxWidth: "810px", width: "80vw" }}
            className=" flex justify-between align-middle"
          >
            <Tooltip placement="right" title="add new page">
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={addNewCard}
                  className="main-button font-bold"
                  disabled={addLoading}
                >
                  <FontAwesomeIcon className="mr-2" icon={faCirclePlus} />
                  {addLoading ? <Spin size="small" /> : "new page"}
                </button>
              </div>
            </Tooltip>
            <Tooltip placement="left" title="filter pages">
              <div style={{ display: "flex", alignItems: "center" }}>
                <Dropdown
                  placement="bottomRight"
                  overlay={filterMenu}
                  trigger={["click"]}
                >
                  <button className="main-button font-bold">
                    <FontAwesomeIcon icon={faFilter} />
                  </button>
                </Dropdown>
              </div>
            </Tooltip>
          </div>

          {loading ? (
            <div className="mt-10">
              <l-cardio
                size="60"
                stroke="3"
                speed="1"
                color="black"
              />
            </div>

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
              className="profile-card flex justify-center items-center"
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
                    maxHeight: "400px",
                    overflow: "hidden",
                    cursor: "pointer",
                    position: "relative",
                  }}
                  className="profile-card"
                  bordered={false}
                  onClick={() => handleCardClick(card.id)}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "0",
                      right: "10px",
                    }}
                  >
                    <span
                      className="text-gray-400"
                      style={{ fontSize: ".8em" }}
                    >
                      created: {formatDate(card.createDate)}
                    </span>
                  </div>
                  <Tooltip placement="bottomRight" title="public page">
                    <div
                      style={{
                        position: "absolute",
                        top: "2px",
                        left: "5px",
                        fontSize: "4px",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FontAwesomeIcon
                        className="text-gray-600 text-sm"
                        icon={faShareFromSquare}
                        key="remove"
                        onClick={() => handlePublicPage(card.id)}
                      />
                    </div>
                  </Tooltip>
                  <Meta
                    title={
                      <div
                        className="card-content"
                        dangerouslySetInnerHTML={{ __html: card.title }}
                      />
                    }
                    description={
                      <div
                        style={{ maxHeight: "150px", marginBottom: "20px" }}
                        dangerouslySetInnerHTML={{ __html: card.description }}
                      />
                    }
                  />
                  <span
                    className="text-gray-400 mt-3 pt-3"
                    style={{
                      fontSize: ".8em",
                      position: "absolute",
                      bottom: "2px",
                      left: "10px",
                    }}
                  >
                    modified: {formatDate(card.updateDate)}
                  </span>

                  <Tooltip placement="bottomRight" title="delete page">
                    <div
                      style={{
                        position: "absolute",
                        bottom: "2px",
                        right: "5px",
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
                  </Tooltip>
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
