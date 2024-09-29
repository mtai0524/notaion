import { Modal, Card, message, Spin, Dropdown, Menu, Tooltip, Empty, Pagination, Input } from "antd";
import axiosInstance from "../../../axiosConfig";
import jwt_decode from "jwt-decode";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import "./Page.scss";
import { DashOutlined } from '@ant-design/icons';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCirclePlus,
  faFilter,
  faRefresh,
  faSearch,
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
  const [addLoadingRefesh, setAddLoadingRefesh] = useState(false);
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
        const userId = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
        const response = await axiosInstance.get(`/api/Page/user/${userId}`);
        if (response.status === 200) {
          const pages = response.data.map((page) => ({
            id: page.id,
            title: page.title,
            description: page.content,
            createDate: page.createdAt,
            updateDate: page.updatedAt,
          }));
          setOriginalCards(pages);
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
        className={`filter-option ${filter === "newest" ? "selected" : ""} `}
      >
        <span className="font-semibold">created newest</span>
      </Menu.Item>
      <Menu.Item
        key="oldest"
        className={`filter-option ${filter === "oldest" ? "selected" : ""}`}
      >
        <span className="font-semibold">created oldest</span>
      </Menu.Item>
      <Menu.Item
        key="modified_newest"
        className={`filter-option ${filter === "modified_newest" ? "selected" : ""
          }`}
      >
        <span className="font-semibold">modified newest</span>
      </Menu.Item>
      <Menu.Item
        key="modified_oldest"
        className={`filter-option ${filter === "modified_oldest" ? "selected" : ""
          }`}
      >
        <span className="font-semibold">modified oldest</span>
      </Menu.Item>
    </Menu>
  );
  const renderMenu = (id) => (
    <Menu>
      <Menu.Item key="archive">
        <span className='font-semibold'>archive</span>
      </Menu.Item>
      <Menu.Item key="delete" danger onClick={() => showDeleteConfirm(id)}>
        <span className='font-semibold' >delete</span>
      </Menu.Item>
    </Menu>
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(3);
  const paginatedCards = cards.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const handlePageChange = (page, pageSize) => {
    setCurrentPage(page);
    setPageSize(pageSize);
  };

  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [originalCards, setOriginalCards] = useState([]);
  const inputRef = useRef(null);

  const handleSearch = () => {
    const filteredCards = originalCards.filter(card =>
      card.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      card.description.toLowerCase().includes(searchKeyword.toLowerCase())
    );
    setCards(filteredCards);
    setCurrentPage(1); // reset to first page
    setSearchKeyword("");
  };

  const showSearchModal = () => {
    setIsSearchModalVisible(true);
  };

  const handleSearchCancel = () => {
    setIsSearchModalVisible(false);
  };

  const handleEnterKey = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRefresh = () => {
    setAddLoadingRefesh(true);
    const savedFilter = localStorage.getItem("filter") || "newest";
    setFilter(savedFilter);
    sortCards(originalCards, savedFilter);
    setSearchKeyword("");
    setIsSearchModalVisible(false);

    setTimeout(() => {
      setAddLoadingRefesh(false);
    }, 1000);
  };


  useEffect(() => {
    if (isSearchModalVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchModalVisible]);


  return (
    <div className="flex justify-center align-middle">
      <div className="container-content-page m-3" style={{ width: "100%" }}>
        <div className="profile-container flex flex-col justify-center align-middle">
          <div className="flex justify-between align-middle" style={{ maxWidth: "810px", width: "80vw" }}>
            <Tooltip placement="right" title="Add New Page">
              <div className="flex justify-center align-items-center">
                <button onClick={addNewCard} className="main-button font-bold" disabled={addLoading}>
                  {addLoading ? <l-cardio size="20" stroke="2" speed="0.5" color="black" /> : "New Page"}
                </button>
              </div>
            </Tooltip>

            <Modal
              title="Search Pages"
              visible={isSearchModalVisible}
              onOk={handleSearch}
              onCancel={handleSearchCancel}
              okText="Search"
              cancelText="Cancel"
              key={isSearchModalVisible ? 'visible' : 'hidden'} // Thay đổi key
            >
              <Input
                placeholder="Enter keyword to search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={handleEnterKey}
                ref={inputRef} // Gắn ref cho input
              />
            </Modal>
            <div className="flex flex-row">
              <Tooltip placement="left" title="Search Pages">
                <button onClick={showSearchModal} className="main-button font-bold">
                  <FontAwesomeIcon icon={faSearch} />
                </button>
              </Tooltip>
              <Tooltip placement="left" title="Refresh Pages">
                <button onClick={handleRefresh} className="main-button font-bold" >
                  {addLoadingRefesh ? <l-cardio size="20" stroke="2" speed="0.5" color="black" /> : <FontAwesomeIcon icon={faRefresh} />}
                </button>
              </Tooltip>
              <Tooltip placement="left" title="Filter Pages">
                <div className="flex align-items-center">
                  <Dropdown placement="bottomRight" overlay={filterMenu} trigger={["click"]}>
                    <button className="main-button font-bold">
                      <FontAwesomeIcon icon={faFilter} />
                    </button>
                  </Dropdown>
                </div>
              </Tooltip>
            </div>

          </div>
          {loading ? (
            <div className="mt-10">
              <l-cardio size="60" stroke="3" speed="1" color="black" />
            </div>
          ) : paginatedCards.length === 0 ? (
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
              <Empty description={false} />
              <Meta
                className="flex items-center justify-center h-full"
                title="No pages available"
                description="You don't have any pages yet. Please add a new page."
              />
            </Card>
          ) : (
            paginatedCards.map((card, index) => (
              <div key={index} style={{ position: "relative" }}>
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
                  <div style={{ position: "absolute", top: "0", right: "10px" }}>
                    <span className="text-gray-400" style={{ fontSize: ".8em" }}>
                      Created: {formatDate(card.createDate)}
                    </span>
                  </div>
                  <Tooltip placement="bottomRight" title="Public Page">
                    <div
                      style={{ position: "absolute", top: "2px", left: "5px", fontSize: "4px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FontAwesomeIcon
                        className="text-gray-600 text-sm"
                        icon={faShareFromSquare}
                        onClick={() => handlePublicPage(card.id)}
                      />
                    </div>
                  </Tooltip>
                  <Meta
                    title={<div className="card-content" dangerouslySetInnerHTML={{ __html: card.title }} />}
                    description={
                      <div style={{ maxHeight: "100px", marginBottom: "20px" }} dangerouslySetInnerHTML={{ __html: card.description }} />
                    }
                  />
                  <span
                    className="text-gray-400 mt-3 pt-3"
                    style={{ fontSize: ".8em", position: "absolute", bottom: "2px", left: "10px" }}
                  >
                    Modified: {formatDate(card.updateDate)}
                  </span>
                  <div style={{ position: "absolute", bottom: "-10px", right: "0px" }} onClick={(e) => e.stopPropagation()}>
                    <Tooltip placement="bottomRight" title="More Settings">
                      <Dropdown overlay={renderMenu(card.id)} trigger={['click']}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '40px',
                            height: '40px',
                            cursor: 'pointer',
                            opacity: '0.8',
                            borderRadius: '50%',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DashOutlined style={{ fontSize: '20px' }} />
                        </div>
                      </Dropdown>
                    </Tooltip>
                  </div>
                </Card>
                {deleteLoading && deletingCardId === card.id && (
                  <div className="loading-overlay">
                    <l-cardio size="50" stroke="3" speed="0.5" color="black" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        { }
        {cards.length > 0 && (
          <div className="flex justify-center items-center">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={cards.length}
              onChange={handlePageChange}
              showSizeChanger
              pageSizeOptions={[3, 5, 10, 20]}
              style={{ marginTop: '20px', textAlign: 'center' }}
            />
          </div>
        )}
      </div>
      { }
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
