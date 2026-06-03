import { useParams, useNavigate } from "react-router-dom";
import CustomEditorProvider from "../../layouts/MenuBar/CustomEditorProvider";
import "./Content.scss";
import { useState, useRef, useCallback } from "react";
import { ArrowLeftOutlined, PictureOutlined, CloseOutlined } from "@ant-design/icons";
import { Tooltip, message } from "antd";
import axiosInstance from "../../../axiosConfig";

const COVER_GRADIENTS = [
  "linear-gradient(135deg,#667eea,#764ba2)",
  "linear-gradient(135deg,#f093fb,#f5576c)",
  "linear-gradient(135deg,#4facfe,#00f2fe)",
  "linear-gradient(135deg,#43e97b,#38f9d7)",
  "linear-gradient(135deg,#fa709a,#fee140)",
  "linear-gradient(135deg,#30cfd0,#667eea)",
  "linear-gradient(135deg,#a18cd1,#fbc2eb)",
  "linear-gradient(135deg,#fccb90,#d57eeb)",
  "linear-gradient(135deg,#84fab0,#8fd3f4)",
  "linear-gradient(135deg,#a1c4fd,#c2e9fb)",
  "linear-gradient(135deg,#fd7543,#f7ce68)",
  "linear-gradient(135deg,#d4fc79,#96e6a1)",
];

const EMOJI_PRESETS = [
  "📄","📝","🗒️","📓","🎯","💡","🚀","⭐",
  "🔥","✅","🎨","💼","📊","🌟","🧩","🔖",
  "📌","🏷️","📁","🗂️","📚","🖊️","🔍","📎",
];

const Content = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cover, setCover] = useState(() => localStorage.getItem(`notaion_cover_${id}`) || "");
  const [emoji, setEmoji] = useState(() => localStorage.getItem(`notaion_emoji_${id}`) || "");
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiInput, setEmojiInput] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const coverFileRef = useRef(null);

  const saveCover = useCallback((value) => {
    setCover(value);
    setShowCoverPicker(false);
    if (value) localStorage.setItem(`notaion_cover_${id}`, value);
    else localStorage.removeItem(`notaion_cover_${id}`);
  }, [id]);

  const saveEmoji = useCallback((value) => {
    setEmoji(value);
    setShowEmojiPicker(false);
    setEmojiInput("");
    if (value) localStorage.setItem(`notaion_emoji_${id}`, value);
    else localStorage.removeItem(`notaion_emoji_${id}`);
  }, [id]);

  const handleCoverUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("files", file);
    const hideMsg = message.loading("Uploading cover…", 0);
    try {
      const res = await axiosInstance.post("/api/files/upload/cloudinary", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = res.data[0];
      const url = d.cloudUrl;
      saveCover(url);
    } catch {
      message.error("Failed to upload cover image");
    } finally {
      hideMsg();
      e.target.value = "";
    }
  }, [saveCover]);

  const onWordCountChange = useCallback((count) => setWordCount(count), []);

  const coverStyle = cover
    ? cover.startsWith("linear-gradient")
      ? { background: cover }
      : { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
    : null;

  return (
    <div className="content-page">
      {cover && (
        <div className="page-cover" style={coverStyle}>
          <div className="cover-actions">
            <button className="cover-action-btn" onClick={() => setShowCoverPicker(!showCoverPicker)}>
              <PictureOutlined /> Change cover
            </button>
            <button className="cover-action-btn" onClick={() => saveCover("")}>
              <CloseOutlined /> Remove
            </button>
          </div>
        </div>
      )}

      <div className="page-content-wrap">
        <div className="page-top-nav">
          <Tooltip title="Back to pages">
            <button className="page-back-btn" onClick={() => navigate("/page")}>
              <ArrowLeftOutlined /> Pages
            </button>
          </Tooltip>
        </div>

        <div className="page-meta-row">
          <div className="page-icon-zone">
            {emoji && (
              <button className="page-icon-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Change icon">
                {emoji}
              </button>
            )}
            {showEmojiPicker && (
              <div className="emoji-picker-popup">
                <div className="emoji-grid">
                  {EMOJI_PRESETS.map((e) => (
                    <button key={e} className="emoji-grid-btn" onClick={() => saveEmoji(e)}>{e}</button>
                  ))}
                  {emoji && (
                    <button className="emoji-grid-btn emoji-remove-btn" title="Remove" onClick={() => saveEmoji("")}>✕</button>
                  )}
                </div>
                <div className="emoji-custom-row">
                  <input
                    className="emoji-custom-input"
                    placeholder="Paste or type emoji…"
                    value={emojiInput}
                    onChange={(e) => setEmojiInput(e.target.value)}
                    maxLength={2}
                  />
                  <button
                    className="emoji-apply-btn"
                    disabled={!emojiInput}
                    onClick={() => emojiInput && saveEmoji(emojiInput)}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="page-hover-actions">
            {!emoji && (
              <button className="page-hover-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                Add icon
              </button>
            )}
            {!cover && (
              <button className="page-hover-btn" onClick={() => setShowCoverPicker(!showCoverPicker)}>
                Add cover
              </button>
            )}
          </div>
        </div>

        {showCoverPicker && (
          <div className="cover-picker-panel">
            <p className="cover-picker-label">Color &amp; Gradient</p>
            <div className="cover-gradient-grid">
              {COVER_GRADIENTS.map((g, i) => (
                <button key={i} className="cover-swatch" style={{ background: g }} onClick={() => saveCover(g)} />
              ))}
            </div>
            <p className="cover-picker-label" style={{ marginTop: 10 }}>Image</p>
            <button className="cover-upload-btn" onClick={() => coverFileRef.current?.click()}>
              <PictureOutlined /> Upload image
            </button>
            <input type="file" accept="image/*" ref={coverFileRef} style={{ display: "none" }} onChange={handleCoverUpload} />
          </div>
        )}

        <div className="content-editor-wrap">
          <CustomEditorProvider pageId={id} onWordCountChange={onWordCountChange} />
        </div>

        {wordCount > 0 && (
          <div className="page-footer">
            <span className="word-count">{wordCount.toLocaleString()} words</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Content;
