import { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import Dropcursor from "@tiptap/extension-dropcursor";
import axiosInstance from "../../../axiosConfig";
import MenuBar from "./MenuBar";
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
      StarterKit,
      Image.configure({ allowBase64: false }),
      Dropcursor,
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
      <EditorContent editor={editor} />
    </div>
  );
};

CustomEditorProvider.propTypes = {
  pageId: PropTypes.string.isRequired,
};

export default CustomEditorProvider;
