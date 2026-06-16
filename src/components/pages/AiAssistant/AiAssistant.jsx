import React, { useState, useEffect, useRef, useCallback } from "react";
import { Empty, notification, Spin } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import { faRobot, faTrash } from "@fortawesome/free-solid-svg-icons";
import axiosInstance from "../../../axiosConfig";
import MessageContent from "../UserChatBoxPrivate/MessageContent";
import "./AiAssistant.scss";

/**
 * Per-account private AI assistant — a 1-on-1 chat with the user's own bot.
 * History is stored server-side (encrypted, scoped by userId), so each account
 * sees only its own conversation.
 */
const AiAssistant = ({ userId, username }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" });

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setLoadingHistory(true);
    try {
      const res = await axiosInstance.get(`/api/AiChat/history/${userId}`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Load AI history failed", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinking]);

  const adjustHeight = (el) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;
    if (!userId) {
      notification.warning({ message: "Bạn cần đăng nhập để dùng trợ lý AI" });
      return;
    }
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const now = new Date().toISOString();
    setMessages((prev) => [...prev, { role: "user", content: text, sentDate: now }]);
    setThinking(true);
    try {
      const res = await axiosInstance.post("/api/AiChat/send", { userId, content: text });
      const reply = res.data || {};
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply.content || "", sentDate: reply.sentDate || new Date().toISOString() },
      ]);
    } catch (e) {
      console.error("AI send failed", e);
      notification.error({ message: "Gửi tin tới AI thất bại" });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "_Xin lỗi, hiện không phản hồi được. Vui lòng thử lại._", sentDate: new Date().toISOString() },
      ]);
    } finally {
      setThinking(false);
    }
  }, [input, thinking, userId]);

  const clearConversation = useCallback(async () => {
    if (!userId) return;
    try {
      await axiosInstance.delete(`/api/AiChat/clear/${userId}`);
      setMessages([]);
    } catch (e) {
      console.error("Clear AI conversation failed", e);
      notification.error({ message: "Xóa hội thoại thất bại" });
    }
  }, [userId]);

  if (!userId) {
    return (
      <div className="ai-assistant-empty">
        <Empty description={false} />
        <p className="font-semibold">Đăng nhập để dùng trợ lý AI riêng của bạn</p>
      </div>
    );
  }

  return (
    <div className="ai-assistant">
      <div className="ai-assistant-header">
        <span className="ai-assistant-title">
          <FontAwesomeIcon icon={faRobot} /> Trợ lý AI của bạn
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            className="ai-clear-btn"
            onClick={clearConversation}
            title="Xóa hội thoại"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        )}
      </div>

      <div className="ai-assistant-messages">
        {loadingHistory ? (
          <div className="ai-loading">
            <Spin />
          </div>
        ) : messages.length === 0 ? (
          <div className="ai-assistant-empty">
            <Empty description={false} />
            <p className="font-semibold">Hỏi trợ lý AI bất cứ điều gì</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role === "user" ? "ai-msg-user" : "ai-msg-bot"}`}>
              <strong className="ai-msg-author">
                {m.role === "user" ? (
                  username || "Bạn"
                ) : (
                  <>
                    <FontAwesomeIcon icon={faRobot} /> Notaion AI
                  </>
                )}
              </strong>
              <div className="ai-msg-body">
                <MessageContent content={m.content} />
              </div>
              <span className="ai-msg-date">
                {new Date(m.sentDate).toLocaleString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            </div>
          ))
        )}
        {thinking && (
          <div className="ai-msg ai-msg-bot">
            <strong className="ai-msg-author">
              <FontAwesomeIcon icon={faRobot} /> Notaion AI
            </strong>
            <div className="ai-msg-body ai-thinking">
              <Spin size="small" /> <span className="italic">AI đang suy nghĩ...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="ai-assistant-input">
        <textarea
          ref={inputRef}
          className="ai-textarea resize-none"
          placeholder="Nhập câu hỏi cho trợ lý AI..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustHeight(e.target);
          }}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          disabled={thinking}
        />
        <button
          type="button"
          onClick={send}
          disabled={thinking || !input.trim()}
          className="ai-send-btn"
          title="Gửi"
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </div>
    </div>
  );
};

export default AiAssistant;
