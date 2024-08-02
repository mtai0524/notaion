import { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Document from "@tiptap/extension-document";
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
import "antd/dist/reset.css";
import "ldrs/bouncy";
const CustomEditorProvider = ({ pageId }) => {
  const [content, setContent] = useState("");
  console.log(content);
  const [loading, setLoading] = useState(false);
  const [spinPosition, setSpinPosition] = useState({ top: "50%", left: "50%" });

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
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
      Image.configure({ allowBase64: false }),
      Dropcursor,
      Placeholder.configure({ placeholder: "Write something …" }),
    ],
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/);
      const paragraph = content.match(/<p[^>]*>(.*?)<\/p>/);
      const title = titleMatch ? titleMatch[1] : "";
      const finalTitle = title || (paragraph ? paragraph[1] : "");

      (async () => {
        try {
          await axiosInstance.put(`/api/Page/${pageId}`, {
            content,
            title: finalTitle,
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
      const items = event.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          const formData = new FormData();
          formData.append("file", file);

          setLoading(true);
          try {
            const response = await axiosInstance.post(
              "/api/items/upload",
              formData,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              }
            );
            const imageUrl = response.data.url;
            editor.chain().focus().setImage({ src: imageUrl }).run();
          } catch (error) {
            console.error("Failed to upload image", error);
          } finally {
            setLoading(false);
          }
          break;
        }
      }
    },
    [editor]
  );

  useEffect(() => {
    if (editor) {
      editor.view.dom.addEventListener("paste", handlePaste);
      return () => {
        editor.view.dom.removeEventListener("paste", handlePaste);
      };
    }
  }, [editor, handlePaste]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;

      setSpinPosition({
        top: `${scrollTop + window.innerHeight / 2}px`,
      });
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        width: "80vw",
        maxWidth: "800px",
        marginBottom: "100px",
        position: "relative",
      }}
    >
      {loading && (
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            position: "absolute",
            top: `calc(${spinPosition.top} - 150px)`,
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <l-bouncy size="60" color="#DF74B4"></l-bouncy>
        </div>
      )}
      <MenuBar editor={editor} />
      <EditorContent
        style={{ marginTop: "90px", minWidth: "80vw" }}
        editor={editor}
      />
    </div>
  );
};

CustomEditorProvider.propTypes = {
  pageId: PropTypes.string.isRequired,
};

export default CustomEditorProvider;
