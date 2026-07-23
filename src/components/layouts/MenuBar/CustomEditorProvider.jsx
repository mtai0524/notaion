import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Document from "@tiptap/extension-document";
import CodeBlockComponent from "../../ui/codeBlock/CodeBlockComponent";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import ListItem from "@tiptap/extension-list-item";
import Paragraph from "@tiptap/extension-paragraph";
import TaskList from "@tiptap/extension-task-list";
import { Color } from "@tiptap/extension-color";
import Dropcursor from "@tiptap/extension-dropcursor";
import axiosInstance from "../../../axiosConfig";
import MenuBar from "./MenuBar";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TaskItem from "@tiptap/extension-task-item";
import PropTypes from "prop-types";
import OrderedList from "@tiptap/extension-ordered-list";
import "antd/dist/reset.css";
import { message } from "antd";
import "ldrs/bouncy";
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { common, createLowlight } from "lowlight";
import { useAuth } from "../../../contexts/AuthContext";
import SlashCommand from "./SlashCommand";
import ImageNodeView from "./ImageNodeView";
import FileAttachmentNodeView from "./FileAttachmentNodeView";
const lowlight = createLowlight(common);

// Image extended with a `name` attribute (original filename, persisted as
// data-name) and a React NodeView that adds the right-click context menu.
const ImageWithMenu = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-name"),
        renderHTML: (attributes) =>
          attributes.name ? { "data-name": attributes.name } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      href: {
        default: null,
      },
      name: {
        default: "Attachment",
      },
      size: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-type="file-attachment"]',
        getAttrs: (element) => ({
          href: element.getAttribute("href"),
          name: element.getAttribute("data-name") || element.innerText || "Attachment",
          size: element.getAttribute("data-size"),
        }),
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentNodeView);
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-type": "file-attachment",
        "data-name": HTMLAttributes.name,
        "data-size": HTMLAttributes.size,
        class: "file-attachment-card",
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      [
        "div",
        { class: "file-attachment-icon" },
        "📁",
      ],
      [
        "div",
        { class: "file-attachment-info" },
        [
          "div",
          { class: "file-attachment-name" },
          HTMLAttributes.name || "Attachment",
        ],
        [
          "div",
          { class: "file-attachment-meta" },
          HTMLAttributes.size ? `Download (${HTMLAttributes.size})` : "Click to download",
        ],
      ],
    ];
  },
});

const CustomEditorProvider = ({ pageId, onWordCountChange }) => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const { token, setToken } = useAuth();
  const slashFileInputRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const tokenFromCookie = Cookies.get('token');
      if (tokenFromCookie) {
        try {
          setToken(tokenFromCookie);
          const decodedToken = jwt_decode(tokenFromCookie);
          const userIdToken = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
          setUserId(userIdToken);
        } catch {
          console.log('Not found or invalid token');
        }
      }
    };

    fetchUser();
  }, [setToken]);

  const editor = useEditor({
    extensions: [
      FileAttachment,
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent);
        },
      }).configure({ lowlight }),
      Document,
      Paragraph,
      Text,
      OrderedList,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Underline,
      Color.configure({ types: [TextStyle.name, ListItem.name] }),
      TextStyle.configure({ types: [ListItem.name] }),
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Highlight.configure({ multicolor: true }),
      ImageWithMenu.configure({ allowBase64: false }),
      Dropcursor,
      Placeholder.configure({ placeholder: "Write something … or type '/' for commands" }),
      SlashCommand,
    ],
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      if (onWordCountChange) {
        const text = editor.getText();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        onWordCountChange(words);
      }
      const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/);
      const paragraph = content.match(/<p[^>]*>(.*?)<\/p>/);
      const title = titleMatch ? titleMatch[1] : "";
      const finalTitle = title || (paragraph ? paragraph[1] : "");
      (async () => {
        try {
          await axiosInstance.put(`/api/Page/${pageId}`, {
            content,
            title: finalTitle,
            userId,
          });
        } catch (error) {
          console.error("Failed to save content to API", error);
        }
      })();
    },
  });
  useEffect(() => {
    if (editor && pageId) {
      (async () => {
        await fetchAndSetContent();
      })();
    }
  }, [editor, pageId]);
  const fetchAndSetContent = async () => {
    try {
      const response = await axiosInstance.get(`/api/Page/${pageId}`);
      const fetchedContent = response.data?.content || "<h1>Title here</h1>";
      setContent(fetchedContent);
      if (editor) {
        editor.commands.setContent(fetchedContent);
        editor.chain().focus().run();
      }
    } catch (error) {
      console.error("Failed to fetch content from API", error);
      setContent("<h1>Title here</h1>");
    }
  };
  const handlePaste = useCallback(
    async (event) => {
      const clipboardItems = event.clipboardData.items;
      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.startsWith("image/") || clipboardItems[i].kind === 'file') {
          const file = clipboardItems[i].getAsFile();
          if (!file) continue;

          event.preventDefault();
          const formData = new FormData();
          formData.append("files", file);
          setLoading(true);
          const hideLoading = message.loading(
            file.type.startsWith("image/") ? "Đang tải ảnh lên..." : "Đang tải file lên...",
            0
          );
          try {
            const response = await axiosInstance.post(
              "/api/files/upload/cloudinary",
              formData,
              { headers: { "Content-Type": "multipart/form-data" } }
            );
            const fileData = response.data[0];
            const fileUrl = fileData.cloudUrl;

            if (file.type.startsWith("image/")) {
              editor.chain().focus().setImage({ src: fileUrl, name: fileData.originalName }).run();
              message.success("Tải ảnh thành công");
            } else {
              editor.chain().focus().insertContent({
                type: "fileAttachment",
                attrs: {
                  href: fileUrl,
                  name: fileData.originalName,
                  size: fileData.sizeInBytes || fileData.size ? formatFileSize(fileData.sizeInBytes || fileData.size) : null,
                },
              }).run();
              message.success("Tải file thành công");
            }
          } catch (error) {
            console.error("Failed to upload file", error);
            message.error("Tải lên thất bại, vui lòng thử lại");
          } finally {
            hideLoading();
            setLoading(false);
          }
          break;
        }
      }
    },
    [editor]
  );

  const handleDrop = useCallback(
    async (event) => {
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (!files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("files", file);
        setLoading(true);
        const hideLoading = message.loading(
          file.type.startsWith("image/") ? "Đang tải ảnh lên..." : "Đang tải file lên...",
          0
        );
        try {
          const response = await axiosInstance.post(
            "/api/files/upload/cloudinary",
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
          const fileData = response.data[0];
          const fileUrl = fileData.cloudUrl;

          if (file.type.startsWith("image/")) {
            editor.chain().focus().setImage({ src: fileUrl, name: fileData.originalName }).run();
            message.success("Tải ảnh thành công");
          } else {
            editor.chain().focus().insertContent({
              type: "fileAttachment",
              attrs: {
                href: fileUrl,
                name: fileData.originalName,
                size: fileData.sizeInBytes || fileData.size ? formatFileSize(fileData.sizeInBytes || fileData.size) : null,
              },
            }).run();
            message.success("Tải file thành công");
          }
        } catch (error) {
          console.error("Failed to upload file", error);
          message.error("Tải lên thất bại, vui lòng thử lại");
        } finally {
          hideLoading();
          setLoading(false);
        }
      }
    },
    [editor]
  );

  const handleSlashFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file || !editor) return;
    const formData = new FormData();
    formData.append("files", file);
    setLoading(true);
    const hideLoading = message.loading(
      file.type.startsWith("image/") ? "Đang tải ảnh lên..." : "Đang tải file lên...",
      0
    );
    try {
      const response = await axiosInstance.post(
        "/api/files/upload/cloudinary",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const fileData = response.data[0];
      const fileUrl = fileData.cloudUrl;
      if (file.type.startsWith("image/")) {
        editor.chain().focus().setImage({ src: fileUrl, name: fileData.originalName }).run();
        message.success("Tải ảnh thành công");
      } else {
        editor.chain().focus().insertContent({
          type: "fileAttachment",
          attrs: {
            href: fileUrl,
            name: fileData.originalName,
            size: fileData.sizeInBytes || fileData.size ? formatFileSize(fileData.sizeInBytes || fileData.size) : null,
          },
        }).run();
        message.success("Tải file thành công");
      }
    } catch (error) {
      console.error("Slash upload failed", error);
      message.error("Tải lên thất bại, vui lòng thử lại");
    } finally {
      hideLoading();
      setLoading(false);
      e.target.value = "";
    }
  }, [editor]);

  useEffect(() => {
    const handler = (e) => {
      if (!slashFileInputRef.current) return;
      slashFileInputRef.current.accept = e.detail.type === "image" ? "image/*" : "*/*";
      slashFileInputRef.current.click();
    };
    window.addEventListener("notaion:slash-upload", handler);
    return () => window.removeEventListener("notaion:slash-upload", handler);
  }, []);

  useEffect(() => {
    if (editor) {
      editor.view.dom.addEventListener("paste", handlePaste);
      editor.view.dom.addEventListener("drop", handleDrop);
      return () => {
        editor.view.dom.removeEventListener("paste", handlePaste);
        editor.view.dom.removeEventListener("drop", handleDrop);
      };
    }
  }, [editor, handlePaste, handleDrop]);

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        marginBottom: "100px",
        position: "relative",
      }}
    >
      {loading && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 1000,
            padding: "12px 18px",
            borderRadius: "var(--radius-md)",
            border: "var(--global-border-width, 2px) var(--global-border-style, solid) var(--border-color)",
            boxShadow: "var(--box-shadow)",
            backgroundColor: "var(--container-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <l-bouncy size="30" color="var(--accent-color)"></l-bouncy>
          <span style={{ fontSize: "13px", color: "var(--text-color)" }}>Đang tải lên...</span>
        </div>
      )}
      <input
        type="file"
        ref={slashFileInputRef}
        style={{ display: "none" }}
        onChange={handleSlashFileChange}
      />
      <MenuBar editor={editor} />
      <EditorContent
        style={{
          marginTop: "90px",
          maxWidth: "100%",
        }}
        editor={editor}
      />
    </div>
  );
};
CustomEditorProvider.propTypes = {
  pageId: PropTypes.string.isRequired,
  onWordCountChange: PropTypes.func,
};
export default CustomEditorProvider;
