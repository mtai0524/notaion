import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import PropTypes from "prop-types";
import { Dropdown, Empty, Menu, Modal, notification } from "antd";
import "./ChatBox.scss";
import { useChat } from "../../../contexts/ChatContext";
import { useSignalR } from "../../../contexts/SignalRContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan, faEraser, faGear, faRecycle, faRobot, faXmark } from "@fortawesome/free-solid-svg-icons";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import axiosInstance from "../../../axiosConfig";
import { cardio } from 'ldrs'
cardio.register()
const useUsername = () => {
  const animalNames = [
    "Lạc đà cười",
    "Cá sấu đeo kính",
    "Chim cánh cụt lười",
    "Khỉ nhí nhố",
    "Nhím xù xì",
    "Cú mèo thức đêm",
    "Cá mập baby",
    "Tê giác điệu đà",
    "Chồn lông mượt",
    "Vịt bầu hát hò",
    "Dê núi hài hước",
    "Hươu cao cổ khệnh khạng",
    "Ốc sên tăng tốc",
    "Cò bay lượn",
    "Cua đỏ lém lỉnh",
    "Ếch xanh ẩm ướt",
    "Bướm đêm kỳ ảo",
    "Bò cạp bí ẩn",
    "Chuồn chuồn lướt gió",
    "Chuột túi bật nhảy",
    "Lợn con hồng hào",
    "Cừu lông xù",
    "Hải ly xây đập",
    "Bò tót mạnh mẽ",
    "Kiến chăm chỉ",
    "Ruồi nhanh nhẹn",
    "Tôm hùm đỏ rực",
    "Cá vàng hay quên",
    "Sáo đen líu lo",
    "Gấu Bắc Cực lạnh lùng",
    "Chồn hôi tinh nghịch",
    "Dơi đêm bí ẩn",
    "Sâu béo ngủ đông",
    "Chuột lém lỉnh",
    "Cá trê siêu quậy",
    "Heo mọi đáng yêu",
    "Gà mái siêng năng",
    "Vịt trời phiêu lưu",
    "Lươn vàng trơn tuột",
    "Cua nhảy múa",
    "Sói già thông thái",
    "Cáo lém lỉnh",
    "Hươu sao tinh nghịch",
    "Lợn rừng dũng mãnh",
    "Ngựa hoang tự do",
    "Bò rừng khổng lồ",
    "Sư tử hào hoa",
    "Vượn bay siêu tốc",
    "Rái cá tấu hài",
    "Cóc cụ triết lý",
    "Chuồn chuồn tia chớp",
    "Nhện thợ dệt",
    "Bò sát lạnh lùng",
    "Chim sâu tò mò",
    "Cá đuối uyển chuyển",
    "Tép nhảy hip hop",
    "Cá cơm nhanh nhảu",
    "Bạch tuộc đa năng",
    "Hải mã chững chạc",
    "Chim ưng săn mồi",
    "Cá voi hát opera",
    "Cọp vằn kiêu ngạo",
    "Lợn nái dễ thương",
    "Chim yến du dương",
    "Ốc biển lười biếng",
    "Bồ câu hòa bình",
    "Tê tê ẩn mình",
    "Gấu Koala mê ngủ",
  ];

  const tokenFromStorage = Cookies.get("token");
  if (tokenFromStorage) {
    try {
      const decodedToken = jwt_decode(tokenFromStorage);
      return decodedToken[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
      ];
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }

  const existingAnimalName = localStorage.getItem("anonymousName");
  if (existingAnimalName) {
    return existingAnimalName;
  }

  const randomAnimalName =
    animalNames[Math.floor(Math.random() * animalNames.length)];

  localStorage.setItem("anonymousName", randomAnimalName);

  return randomAnimalName;
};
const useUserId = () => {
  const tokenFromStorage = Cookies.get("token");
  if (tokenFromStorage) {
    try {
      const decodedToken = jwt_decode(tokenFromStorage);
      return decodedToken[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
      ];
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  }
  return null;
};
const ChatBox = ({ onClose }) => {
  const [message, setMessage] = useState("");
  const [latestMessageFromUser, setLatestMessageFromUser] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const { messages, setMessages } = useChat();
  const { connection } = useSignalR();
  const textareaRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const username = useUsername();
  const userId = useUserId();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { onlineUsers } = useSignalR();
  const token = Cookies.get("token");
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isMessageSent, setIsMessageSent] = useState(false);
  const [aiMode, setAiMode] = useState(false);

  useEffect(() => {
    const isFirstLoad = sessionStorage.getItem("isFirstLoad");
    if (messagesLoaded && chatMessagesRef.current) {
      if (initialLoad && !isFirstLoad) {
        chatMessagesRef.current.scrollTo({
          top: chatMessagesRef.current.scrollHeight,
          behavior: "smooth",
        });
        setInitialLoad(false);
        sessionStorage.setItem("isFirstLoad", "false");
      } else if (latestMessageFromUser) {
        chatMessagesRef.current.scrollTo({
          top: chatMessagesRef.current.scrollHeight,
          behavior: "smooth",
        });
        setLatestMessageFromUser(false);
      }
    }
  }, [messagesLoaded, messages, latestMessageFromUser, initialLoad]);

  useLayoutEffect(() => {
    if (chatMessagesRef.current) {
      if (isMessageSent) {
        // cuộn xuống cuối khi gửi tin
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        setIsMessageSent(false);
      } else if (pageNumber === 1 && messagesLoaded) {
        //  cuộn xuống cuối nếu tải lần đầu 
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
      } else if (!isMessageSent && pageNumber > 1) {
        // thêm pd 10 khi kéo phân trang
        chatMessagesRef.current.scrollTop += 5;
      }
    }
  }, [isMessageSent, pageNumber, messagesLoaded]); // messages bỏ thì không thể cách một đoạn top 


  const handleScrollInfinite = () => {
    if (chatMessagesRef.current.scrollTop === 0 && !loading && hasMoreMessages) {
      setPageNumber(prevPage => prevPage + 1);
    }
  };

  const fetchMessages = async () => {
    if (loading) return;
    setLoading(true);

    const pageSize = pageNumber === 1 ? 10 : 3;

    try {
      const response = await axiosInstance.get("/api/Chat/get-chats", {
        params: { decrypt: true, pageNumber, pageSize },
      });
      if (response.status === 200) {
        const reversedMessages = response.data.items.reverse();

        if (reversedMessages.length === 0) {
          setHasMoreMessages(false);
        } else {
          setMessages(prevMessages => [...reversedMessages, ...prevMessages]);
          setMessagesLoaded(true);
        }
      } else {
        console.error("Failed to fetch messages");
      }
    } catch (error) {
      console.error("Error fetching messages: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchMessages();
    };

    fetchData();
  }, [pageNumber]);


  const handleAiModeToggle = () => {
    setAiMode((prev) => {
      const newAiMode = !prev;

      // Show notification when AI mode is toggled
      notification.info({
        message: newAiMode ? "AI Mode Activated" : "AI Mode Deactivated",
        description: newAiMode
          ? "You can now interact with the bot."
          : "You are now chatting with a human.",
        placement: "topRight", // Notification will appear in the top-right corner
        duration: 2, // The notification will auto-dismiss after 2 seconds
      });

      return newAiMode;
    });
  };


  const handleSendMessage = useCallback(async () => {
    if (message.trim() && connection) {
      const messageContent = aiMode ? `/bot ${message}` : message;

      const tempMessageId = Date.now();
      const newMessage = {
        userId: userId || "anonymous",
        userName: username || "mèo con ẩn danh",
        content: messageContent,
        sentDate: new Date().toISOString(),
        id: tempMessageId,
        status: "sending",
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setMessage("");
      setLatestMessageFromUser(true);

      try {
        const response = await axiosInstance.post("/api/Chat/add-chat", {
          userId: userId,
          userName: username,
          content: messageContent,
        });

        if (response.status === 200) {
          const savedMessage = response.data;
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === tempMessageId
                ? { ...savedMessage, status: "sent" }
                : msg
            )
          );
          setIsMessageSent(true);
        } else {
          console.error("Failed to send message");
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === tempMessageId ? { ...msg, status: "failed" } : msg
            )
          );
        }

        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } catch (err) {
        console.error("Send message failed: ", err);
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempMessageId ? { ...msg, status: "failed" } : msg
          )
        );
      }
    }
  }, [message, userId, username, setMessages, connection, aiMode]);

  const handleChange = (e) => {
    setMessage(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMenuClick = async (e) => {
    if (messages.length === 0) {
      // messages trống, không cần xóa
      Modal.info({
        title: "No messages to clear",
        okText: "OK",
      });
      return;
    }

    switch (e.key) {
      case "clear":
        Modal.confirm({
          title: "Clear all chats?",
          okText: "Yes",
          okType: "danger",
          cancelText: "No",
          onOk: async () => {
            await deleteAllChats();
          },
        });
        break;
      case "clear-me":
        Modal.confirm({
          title: "Clear your chats?",
          okText: "Yes",
          okType: "danger",
          cancelText: "No",
          onOk: async () => {
            await deleteMeChats();
          },
        });
        break;
      default:
        break;
    }
  };

  const deleteAllChats = async () => {
    setIsDeleting(true);
    console.log(token);

    try {
      const response = await axiosInstance.delete("/api/Chat/delete-all-chats", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.status === 200) {
        console.log('All chats deleted successfully');
        setMessages([]); // update messages state
      } else {
        console.error('Failed to delete chats');
      }
    } catch (error) {
      console.error('Error deleting chats:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteMeChats = async () => {
    setIsDeleting(true);
    try {
      const response = await axiosInstance.delete(`/api/Chat/delete-me-chats/${userId}`);
      if (response.status === 200) {
        console.log('All chats deleted successfully');
        // gọi API nạp messages
        const fetchResponse = await axiosInstance.get("/api/Chat/get-chats");
        if (fetchResponse.status === 200) {
          setMessages(fetchResponse.data); // cập nhật messages
        } else {
          console.error('Failed to fetch updated messages');
        }
      } else {
        console.error('Failed to delete chats');
      }
    } catch (error) {
      console.error('Error deleting chats:', error);
    } finally {
      setIsDeleting(false);
    }
  };


  const menuProfile = (
    <Menu onClick={handleMenuClick} className="custom-dropdown-menu">
      <Menu.Item key="clear-me" icon={<FontAwesomeIcon icon={faEraser} />}>
        Clear my chats
      </Menu.Item>
      <Menu.Item danger key="clear" icon={<FontAwesomeIcon icon={faBan} />}>
        Clear
      </Menu.Item>
    </Menu>
  );

  const convertLinksToEmbedTags = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const embedRegex = /(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w\-]+)/g; // Nhúng YouTube
    const spotifyRegex = /(https?:\/\/(?:www\.)?spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+)/g; // Nhúng Spotify
    const imageRegex = /\.(jpg|jpeg|png|gif|bmp|webp)$/i; // Regex to detect image links

    let segments = [];
    let lastIndex = 0;

    text.split(" ").forEach((word, index) => {
      // Check if the word is a YouTube URL
      if (embedRegex.test(word)) {
        // Add the text before the YouTube link
        if (lastIndex < index) {
          segments.push(text.slice(lastIndex, text.indexOf(word)));
        }

        // Embed the YouTube iframe with a smaller height
        segments.push(
          <div key={index} className="embed-container">
            <iframe
              width="560"
              src={word.replace("watch?v=", "embed/")}
              frameBorder="0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ maxHeight: '200px' }}
            />
          </div>
        );

        // Add the YouTube URL below the iframe
        segments.push(
          <div key={`link-${index}`} className="embed-url">
            <a href={word} target="_blank" rel="noopener noreferrer">
              {word}
            </a>
          </div>
        );

        lastIndex = text.indexOf(word) + word.length; // Update last index
      }
      // Check if the word is a Spotify URL
      else if (spotifyRegex.test(word)) {
        // Add the text before the Spotify link
        if (lastIndex < index) {
          segments.push(text.slice(lastIndex, text.indexOf(word)));
        }

        // Convert Spotify URL to embed URL
        let embedUrl = word.replace("open.spotify.com", "open.spotify.com/embed");

        if (word.includes("album")) {
          embedUrl = embedUrl.replace("open.spotify.com/album", "open.spotify.com/embed/album");
        } else if (word.includes("track")) {
          embedUrl = embedUrl.replace("open.spotify.com/track", "open.spotify.com/embed/track");
        } else if (word.includes("playlist")) {
          embedUrl = embedUrl.replace("open.spotify.com/playlist", "open.spotify.com/embed/playlist");
        }

        // Embed the Spotify iframe
        segments.push(
          <div key={index} className="embed-container">
            <iframe
              width="300"
              height="80"
              src={embedUrl}
              frameBorder="0"
              allow="encrypted-media"
              style={{ border: "none", borderRadius: "8px" }}
            />
          </div>
        );

        // Add the Spotify URL below the iframe
        segments.push(
          <div key={`link-${index}`} className="embed-url">
            <a href={word} target="_blank" rel="noopener noreferrer">
              {word}
            </a>
          </div>
        );

        lastIndex = text.indexOf(word) + word.length; // Update last index
      }
      // Check if the word is an image URL
      else if (imageRegex.test(word)) {
        // Add the text before the image link
        if (lastIndex < index) {
          segments.push(text.slice(lastIndex, text.indexOf(word)));
        }

        // Embed the image and hide the URL
        segments.push(
          <div key={index} className="image-container">
            <img
              src={word}
              alt="Embedded"
              style={{ maxWidth: '100%', maxHeight: '500px' }}
            />
          </div>
        );
        lastIndex = text.indexOf(word) + word.length; // Update last index
      }
      // Check if the word is a regular URL
      else if (urlRegex.test(word)) {
        // Add the text before the URL link
        if (lastIndex < index) {
          segments.push(text.slice(lastIndex, text.indexOf(word)));
        }

        // Embed the URL as a clickable link
        segments.push(
          <a key={index} className="italic text-blue-600" href={word} target="_blank" rel="noopener noreferrer">
            {word}
          </a>
        );
        lastIndex = text.indexOf(word) + word.length; // Update last index
      }
    });

    // Add any remaining text after the last link
    if (lastIndex < text.length) {
      segments.push(text.slice(lastIndex));
    }

    return <>{segments}</>;
  };





  return (
    <div className="chat-box">
      <div className="chat-header">
        <h3 className="m-0 p-1 font-extrabold">Chat</h3>
        <div className="section">
          <Dropdown
            placement="bottomLeft"
            overlay={menuProfile}
            trigger={["click"]}
            onClick={() => setDropdownVisible(!dropdownVisible)}
            onOpenChange={(visible) => setDropdownVisible(visible)}
            className="mr-3"
          >
            <a className="ant-dropdown-link" onClick={(e) => e.preventDefault()}>
              <button className="p-1">
                <FontAwesomeIcon icon={faGear} />
              </button>
            </a>
          </Dropdown>
          <button className="p-1" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      </div>

      <div className="chat-messages" ref={chatMessagesRef} onScroll={handleScrollInfinite}>
        {isDeleting ? (
          <div className="no-messages">
            <l-cardio size="50" stroke="4" speed="0.5" color="black" />
          </div>
        ) : loading ? (
          <div className="no-messages flex flex-col">
            <l-cardio size="30" stroke="2" speed="0.5" color="black" />
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages flex flex-col">
            <Empty description={false} />
            <h1 className="font-semibold">Empty messages</h1>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOnline =
              msg.userName === "Chatbot" ||
              onlineUsers.some((user) => user.userName === msg.userName);

            return (
              <div
                key={index}
                className={`chat-message ${msg.status === "sending" ? "sending-message" : ""} ${msg.userName === username ? "sent-message" : "received-message"
                  }`}
              >
                <strong className="chat-user">
                  {msg.userName}
                  <span className={`status-dot ${isOnline ? "online" : "offline"}`} />
                </strong>
                <p className="chat-text">{convertLinksToEmbedTags(msg.content)}</p>
                <p className="chat-date">
                  {new Date(msg.sentDate)
                    .toLocaleString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                    .replace(",", ", ")}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="chat-input">
        <textarea
          className="chatbox-input"
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message"
          rows={1}
          style={{ overflow: "hidden", resize: "none" }}
        />
        <button onClick={handleAiModeToggle}>
          <FontAwesomeIcon
            icon={faRobot}
            style={{ color: aiMode ? "#504cd6" : "#4c4c4c" }}
          />
        </button>
        <button onClick={handleSendMessage}>
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </div>
    </div>
  );
};
ChatBox.propTypes = {
  onClose: PropTypes.func.isRequired,
};
export default ChatBox;